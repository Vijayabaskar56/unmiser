import { eq } from "drizzle-orm";

import { transactions } from "@/db/schema";
import type { TransactionSource } from "@/db/schema/enums";
import type { TxnType } from "@/lib/balance-service";
import { transactionHash } from "@/lib/dedup-hash";
import { applyTransactionBalance } from "@/db/services/balance-persistence";

/**
 * Manual-transaction operations layer.
 *
 * Sits above @/db/services/balance-persistence (the pure-then-write balance
 * cascade). Every operation is db-driver-agnostic: it accepts the drizzle
 * instance as a parameter so the same code runs on expo-sqlite (async) on-device
 * and better-sqlite3 (sync) in tests. The app wraps each call in a single
 * `db.transaction(...)` so the transaction row write and the balance cascade
 * commit atomically; better-sqlite3 transaction callbacks must be synchronous,
 * which is honoured because applyTransactionBalance computes the pure result
 * before issuing any write.
 *
 * Dedup (ADR-0010): every row — manual or SMS — gets a synthesized
 * `transactionHash` from (smsSender | amount | smsBody). Before insert, if a row
 * with that hash exists (INCLUDING soft-deleted rows) the add is skipped, so a
 * re-arriving SMS never duplicates or resurrects a deliberately deleted txn.
 */
type Db = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
  delete: (...args: any[]) => any;
};

export interface AddTransactionInput {
  accountId: number;
  amount: string;
  merchantName: string;
  categoryId: number;
  transactionType: TxnType;
  dateTime: string;
  isCreditCard: boolean;
  /** Sender + body feed the dedup hash. Empty strings are fine for pure-manual rows. */
  smsSender?: string | null;
  smsBody?: string | null;
  subcategoryId?: number | null;
  description?: string | null;
  currency?: string;
  billingCycle?: string | null;
  isRecurring?: boolean;
  /** An SMS-stated post-transaction balance, if any — anchors the reading. */
  balanceAfter?: string | null;
  transactionHash?: string;
  sourceType?: TransactionSource;
  sourcePluginId?: string | null;
  sourcePluginVersion?: string | null;
  sourceReceivedAt?: string | null;
}

function synthHash(input: {
  smsSender?: string | null;
  amount: string;
  smsBody?: string | null;
  dateTime: string;
  accountId: number;
}): string {
  // SMS-sourced rows carry a real sender/body; pure-manual rows fall back to
  // their identity (account + datetime) so the hash is still unique and the same
  // dedup code path applies to everything (ADR-0010 "lean: synthesize for all").
  const sender = input.smsSender ?? "";
  const body = input.smsBody ?? `manual:${input.accountId}:${input.dateTime}`;
  return transactionHash({ sender, amount: input.amount, body });
}

/**
 * Insert a transaction (synthesizing its dedup hash) and apply the balance
 * cascade. If the hash already exists — including on a soft-deleted row — the add
 * is skipped and the existing row id is returned.
 */
export async function addTransaction(db: Db, input: AddTransactionInput): Promise<number> {
  const hash =
    input.transactionHash ??
    synthHash({
      smsSender: input.smsSender,
      amount: input.amount,
      smsBody: input.smsBody,
      dateTime: input.dateTime,
      accountId: input.accountId,
    });

  const existing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.transactionHash, hash));
  if (existing.length > 0) {
    return existing[0].id;
  }

  const [row] = await db
    .insert(transactions)
    .values({
      amount: input.amount,
      accountId: input.accountId,
      merchantName: input.merchantName,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId ?? null,
      transactionType: input.transactionType,
      dateTime: input.dateTime,
      description: input.description ?? null,
      smsSender: input.smsSender ?? null,
      smsBody: input.smsBody ?? null,
      balanceAfter: input.balanceAfter ?? null,
      transactionHash: hash,
      sourceType: input.sourceType ?? "MANUAL",
      sourcePluginId: input.sourcePluginId ?? null,
      sourcePluginVersion: input.sourcePluginVersion ?? null,
      sourceReceivedAt: input.sourceReceivedAt ?? null,
      currency: input.currency ?? "INR",
      billingCycle: input.billingCycle ?? null,
      isRecurring: input.isRecurring ?? false,
    })
    .returning();

  await applyTransactionBalance(db, {
    accountId: input.accountId,
    transactionId: row.id,
    amount: input.amount,
    transactionType: input.transactionType,
    isCreditCard: input.isCreditCard,
    timestamp: input.dateTime,
    explicitBalance: input.balanceAfter ?? null,
    smsSource: input.smsSender ?? null,
  });

  return row.id;
}

export interface TransferInput {
  fromAccount: { id: number; currency: string; isCreditCard: boolean };
  toAccount: { id: number; currency: string; isCreditCard: boolean };
  amount: string;
  merchantName?: string;
  categoryId: number;
  dateTime: string;
  smsSender?: string | null;
  smsBody?: string | null;
  description?: string | null;
  currency?: string;
}

/**
 * Record a single TRANSFER transaction moving money between two accounts and
 * apply equal-and-opposite balance deltas to both legs (source debited, target
 * credited), reusing the cascade.
 *
 * v1 guard (CONTEXT "Transfer"): both accounts MUST share a currency. A
 * cross-currency transfer throws — the original Kotlin silently mis-added the
 * legs; we reject instead and defer multi-currency to Phase 6.
 */
export async function transfer(db: Db, input: TransferInput): Promise<number> {
  if (input.fromAccount.currency !== input.toAccount.currency) {
    throw new Error(
      `Cross-currency transfer is not supported in v1: from ${input.fromAccount.currency} to ${input.toAccount.currency}`,
    );
  }

  const hash = synthHash({
    smsSender: input.smsSender,
    amount: input.amount,
    smsBody: input.smsBody ?? `transfer:${input.fromAccount.id}->${input.toAccount.id}`,
    dateTime: input.dateTime,
    accountId: input.fromAccount.id,
  });

  const [row] = await db
    .insert(transactions)
    .values({
      amount: input.amount,
      accountId: input.fromAccount.id,
      merchantName: input.merchantName ?? "Transfer",
      categoryId: input.categoryId,
      transactionType: "TRANSFER",
      dateTime: input.dateTime,
      description: input.description ?? null,
      smsSender: input.smsSender ?? null,
      smsBody: input.smsBody ?? null,
      transactionHash: hash,
      currency: input.currency ?? input.fromAccount.currency,
      fromAccount: String(input.fromAccount.id),
      toAccount: String(input.toAccount.id),
    })
    .returning();

  // Source leg: money leaves -> apply as an EXPENSE delta on the source account.
  await applyTransactionBalance(db, {
    accountId: input.fromAccount.id,
    transactionId: row.id,
    amount: input.amount,
    transactionType: "EXPENSE",
    isCreditCard: input.fromAccount.isCreditCard,
    timestamp: input.dateTime,
    smsSource: input.smsSender ?? null,
  });
  // Target leg: money arrives -> apply as an INCOME delta on the target account.
  await applyTransactionBalance(db, {
    accountId: input.toAccount.id,
    transactionId: row.id,
    amount: input.amount,
    transactionType: "INCOME",
    isCreditCard: input.toAccount.isCreditCard,
    timestamp: input.dateTime,
    smsSource: input.smsSender ?? null,
  });

  return row.id;
}

export interface EditTransactionChanges {
  amount?: string;
  merchantName?: string;
  categoryId?: number;
  subcategoryId?: number | null;
  transactionType?: TxnType;
  dateTime?: string;
  description?: string | null;
  balanceAfter?: string | null;
}

/**
 * Update a transaction's fields and re-run the balance cascade for its account.
 * The transaction row is written first (as the source of truth the cascade reads
 * the joined amount/type from), then applyTransactionBalance re-derives readings.
 */
export async function editTransaction(
  db: Db,
  id: number,
  accountId: number,
  isCreditCard: boolean,
  changes: EditTransactionChanges,
): Promise<void> {
  const current = await loadTransaction(db, id);

  await db.update(transactions).set(changes).where(eq(transactions.id, id));

  const amount = changes.amount ?? current.amount;
  const transactionType = (changes.transactionType ?? current.transactionType) as TxnType;
  const timestamp = changes.dateTime ?? current.dateTime;
  const explicitBalance =
    changes.balanceAfter !== undefined ? changes.balanceAfter : current.balanceAfter;

  await applyTransactionBalance(db, {
    accountId,
    transactionId: id,
    amount,
    transactionType,
    isCreditCard,
    timestamp,
    explicitBalance: explicitBalance ?? null,
    smsSource: current.smsSender ?? null,
  });
}

/**
 * Soft-delete a transaction (ADR-0008): flip isDeleted = true and re-cascade so
 * its balance delta is removed. The row is retained for sync.
 */
export async function softDeleteTransaction(
  db: Db,
  id: number,
  accountId: number,
  isCreditCard: boolean,
): Promise<void> {
  await setDeleted(db, id, accountId, isCreditCard, true);
}

/**
 * Undo a soft-delete (ADR-0008): flip isDeleted = false and re-cascade so the
 * delta is restored.
 */
export async function undoDelete(
  db: Db,
  id: number,
  accountId: number,
  isCreditCard: boolean,
): Promise<void> {
  await setDeleted(db, id, accountId, isCreditCard, false);
}

async function setDeleted(
  db: Db,
  id: number,
  accountId: number,
  isCreditCard: boolean,
  isDeleted: boolean,
): Promise<void> {
  const current = await loadTransaction(db, id);
  await db.update(transactions).set({ isDeleted }).where(eq(transactions.id, id));

  await applyTransactionBalance(db, {
    accountId,
    transactionId: id,
    amount: current.amount,
    transactionType: current.transactionType as TxnType,
    isCreditCard,
    timestamp: current.dateTime,
    explicitBalance: current.balanceAfter ?? null,
    smsSource: current.smsSender ?? null,
    isDeleted,
  });
}

async function loadTransaction(db: Db, id: number) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!row) {
    throw new Error(`Transaction ${id} not found`);
  }
  return row as {
    amount: string;
    transactionType: string;
    dateTime: string;
    balanceAfter: string | null;
    smsSender: string | null;
  };
}
