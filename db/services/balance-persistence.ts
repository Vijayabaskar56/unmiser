import { eq } from "drizzle-orm";

import { accountBalances, transactions } from "@/db/schema";
import {
  calculateBalance,
  recalculateBalancesAfter,
  type Reading,
  type SourceType,
  type TxnType,
} from "@/lib/balance-service";

/**
 * A drizzle instance (expo-sqlite async or better-sqlite3 sync). Query builders
 * are awaitable on both drivers, so this module stays db-driver-agnostic by
 * accepting the instance as a parameter. The app wraps a single call in
 * `db.transaction(...)` so the insert + cascade commit atomically; better-sqlite3
 * transaction callbacks must be synchronous, which is why every PURE computation
 * (the anchor-segmented fold in @/lib/balance-service) happens before any write.
 */
type Db = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
};

export interface ApplyTransactionBalanceParams {
  accountId: number;
  transactionId: number;
  amount: string;
  transactionType: TxnType;
  isCreditCard: boolean;
  timestamp: string;
  /** A balance the SMS explicitly stated for this point — anchors the reading. */
  explicitBalance?: string | null;
  smsSource?: string | null;
  /**
   * When the transaction has been soft-deleted (transactions.isDeleted = true),
   * its reading is dropped from the series so its delta no longer counts, and the
   * subsequent readings re-cascade off the prior running balance.
   */
  isDeleted?: boolean;
}

const ZERO = "0.00";

/**
 * Persist the accountBalances series for a newly added/edited/deleted transaction
 * and re-run the anchor-segmented cascade for its account.
 *
 * The whole computation is performed against an in-memory snapshot of the
 * account's readings (loaded ordered by timestamp, each calculated row carrying
 * the joined transaction's amount/type and SMS-stated `balanceAfter`). Only after
 * the pure fold is the minimal set of rows written back. Callers should wrap this
 * in a single DB transaction.
 */
export async function applyTransactionBalance(
  db: Db,
  params: ApplyTransactionBalanceParams,
): Promise<void> {
  const {
    accountId,
    transactionId,
    amount,
    transactionType,
    isCreditCard,
    timestamp,
    explicitBalance,
    smsSource,
    isDeleted,
  } = params;

  // 1. Load the account's existing readings joined to their transactions, in
  //    timestamp order. Pure data — no mutation yet.
  const existing = await loadReadings(db, accountId, isCreditCard);

  // 2. Locate any reading already owned by this transaction (the edit case). Its
  //    timestamp may move; the change point is the EARLIER of the old and new
  //    timestamps so a back-dated edit re-cascades from far enough back.
  const ownReading = existing.find((r) => r.transactionId === transactionId);
  const changePoint =
    ownReading && ownReading.timestamp < timestamp ? ownReading.timestamp : timestamp;

  // 3. The starting balance is the running balance at the last reading strictly
  //    before the change point.
  const before = existing.filter((r) => r.timestamp < changePoint && r.id !== ownReading?.id);
  const startingBalance = before.length > 0 ? before[before.length - 1].balance : ZERO;

  // Soft-delete: drop this transaction's reading, re-cascade the rest, done.
  if (isDeleted) {
    const remaining = existing
      .filter((r) => r.timestamp >= changePoint && r.id !== ownReading?.id)
      .sort(byTimestamp);
    const recomputedAfterDelete = recalculateBalancesAfter(remaining, startingBalance);

    if (ownReading) {
      await db.delete(accountBalances).where(eq(accountBalances.id, ownReading.id));
    }
    for (const row of recomputedAfterDelete) {
      const prior = existing.find((r) => r.id === row.id);
      if (prior && prior.balance !== row.balance) {
        await db
          .update(accountBalances)
          .set({ balance: row.balance })
          .where(eq(accountBalances.id, row.id));
      }
    }
    return;
  }

  const newBalance =
    explicitBalance ?? calculateBalance(startingBalance, amount, transactionType, isCreditCard);
  const sourceType: SourceType =
    explicitBalance != null ? "TRANSACTION_SMS_BALANCE" : "TRANSACTION_CALCULATED";

  // 4. Build this transaction's reading as a balance-service Reading so it joins
  //    the in-memory series before the cascade fold runs.
  const ownId = ownReading?.id ?? null;
  const newReading: DbReading = {
    id: ownId ?? -1, // placeholder until inserted
    accountId,
    balance: newBalance,
    timestamp,
    sourceType,
    transactionId,
    transactionAmount: amount,
    transactionType,
    transactionBalanceAfter: explicitBalance ?? null,
    isCreditCard,
  };

  // 5. Assemble the post-change series: every reading after the change point,
  //    excluding the transaction's own (stale) reading, plus the new reading,
  //    re-sorted by timestamp. Run the PURE anchor-segmented fold over it.
  const afterReadings = existing
    .filter((r) => r.timestamp >= changePoint && r.id !== ownReading?.id)
    .concat(newReading)
    .sort(byTimestamp);

  const recomputed = recalculateBalancesAfter(afterReadings, startingBalance);

  // 6. Persist. Writes happen only after all computation is done so the app can
  //    wrap this in one synchronous-callback DB transaction.
  for (const row of recomputed) {
    if (row.transactionId === transactionId && row.id === (ownId ?? -1)) {
      if (ownId == null) {
        await db.insert(accountBalances).values({
          accountId,
          balance: row.balance,
          timestamp: row.timestamp,
          transactionId,
          sourceType: row.sourceType,
          smsSource: smsSource ?? null,
        });
      } else {
        await db
          .update(accountBalances)
          .set({
            balance: row.balance,
            timestamp: row.timestamp,
            sourceType: row.sourceType,
            smsSource: smsSource ?? null,
          })
          .where(eq(accountBalances.id, ownId));
      }
      continue;
    }
    // Existing rows: only write back the ones the fold actually changed.
    const prior = existing.find((r) => r.id === row.id);
    if (prior && prior.balance !== row.balance) {
      await db
        .update(accountBalances)
        .set({ balance: row.balance })
        .where(eq(accountBalances.id, row.id));
    }
  }
}

function byTimestamp(a: DbReading, b: DbReading): number {
  if (a.timestamp < b.timestamp) return -1;
  if (a.timestamp > b.timestamp) return 1;
  // Stable tiebreak for same-timestamp readings (second-precision SMS): order by
  // the owning transaction id so the cascade is deterministic and a freshly
  // added reading (real transactionId) sorts after earlier same-second ones.
  const at = a.transactionId ?? Number.NEGATIVE_INFINITY;
  const bt = b.transactionId ?? Number.NEGATIVE_INFINITY;
  if (at !== bt) return at < bt ? -1 : 1;
  return (a.id ?? 0) - (b.id ?? 0);
}

interface DbReading extends Reading {
  accountId: number;
}

/**
 * Load an account's readings ordered by timestamp, mapped to the balance-service
 * Reading shape, carrying the linked transaction's amount/type and SMS-stated
 * post-transaction balance.
 */
async function loadReadings(
  db: Db,
  accountId: number,
  isCreditCard: boolean,
): Promise<DbReading[]> {
  const rows = await db
    .select({
      id: accountBalances.id,
      accountId: accountBalances.accountId,
      balance: accountBalances.balance,
      timestamp: accountBalances.timestamp,
      sourceType: accountBalances.sourceType,
      transactionId: accountBalances.transactionId,
      transactionAmount: transactions.amount,
      transactionType: transactions.transactionType,
      transactionBalanceAfter: transactions.balanceAfter,
    })
    .from(accountBalances)
    .leftJoin(transactions, eq(accountBalances.transactionId, transactions.id))
    .where(eq(accountBalances.accountId, accountId))
    .orderBy(accountBalances.timestamp, accountBalances.transactionId, accountBalances.id);

  return rows.map((r: any) => ({
    id: r.id,
    accountId: r.accountId,
    balance: r.balance,
    timestamp: r.timestamp,
    sourceType: r.sourceType as SourceType | null,
    transactionId: r.transactionId,
    transactionAmount: r.transactionAmount,
    transactionType: r.transactionType as TxnType | null,
    transactionBalanceAfter: r.transactionBalanceAfter,
    isCreditCard,
  })) as DbReading[];
}
