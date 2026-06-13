import { eq, type SQL, type SQLWrapper } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { accounts, categories, transactions } from "@/db/schema";
import { nowIso, parseIso, toIso } from "@/lib/dates";
import { transactionHash } from "@/lib/dedup-hash";

/**
 * Dev-only sample-data utility (ROADMAP §5 "Out of Scope", CONTEXT "Sample data").
 *
 * `isSample` is a seed/dev marker, NEVER a shipped feature: there is no UI for
 * it. `loadSampleData` inserts a small, realistic set of rows flagged
 * `isSample = true` so a developer can see populated screens; `clearSampleData`
 * removes ONLY those rows; `excludeSample` is the single shared filter every
 * production read uses to keep sample rows invisible.
 *
 * USAGE GUARD: call sites MUST gate `loadSampleData` behind `__DEV__` so it is
 * dead-code-eliminated from production bundles, e.g.
 *
 *   if (__DEV__) await loadSampleData(db);
 *
 * `clearSampleData`/`excludeSample` are harmless in production (they only ever
 * touch `isSample` rows, of which there are none in a shipped build) but
 * `loadSampleData` must never run there.
 *
 * `db` is dependency-injected so the module stays driver-agnostic: the app
 * passes the expo-sqlite (async) drizzle instance, tests pass better-sqlite3.
 * Drizzle query builders are awaitable on both, so we always `await`.
 */
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/** Any of our tables that carries an `isSample` boolean column. */
type SampleTable = { isSample: SQLWrapper };

/**
 * Where-fragment that excludes sample rows from a production read:
 *   db.select().from(transactions).where(excludeSample(transactions))
 * Works for any table with an `isSample` column (accounts, transactions, …).
 */
export function excludeSample(table: SampleTable): SQL {
  return eq(table.isSample as never, false);
}

// A compact, realistic fixture set. Two accounts + a handful of transactions
// across the seeded default categories (which always exist after seedDefaults).
const SAMPLE_ACCOUNTS = [
  {
    bankName: "Sample HDFC Bank",
    accountLast4: "1234",
    iconName: "type_finance_bank",
    color: "#004C8F",
    currency: "INR",
  },
  {
    bankName: "Sample Cash Wallet",
    accountLast4: "0000",
    iconName: "type_finance_wallet",
    color: "#4CAF50",
    currency: "INR",
    isWallet: true,
  },
] as const;

// merchant / amount / type — categoryId is resolved at insert time to the first
// seeded category so the fixture survives without hard-coding ids.
const SAMPLE_TXNS = [
  { merchant: "Swiggy", amount: "452.00", type: "EXPENSE" as const, daysAgo: 1 },
  { merchant: "Uber", amount: "189.50", type: "EXPENSE" as const, daysAgo: 2 },
  { merchant: "Amazon", amount: "1299.00", type: "EXPENSE" as const, daysAgo: 3 },
  { merchant: "BigBasket", amount: "876.25", type: "EXPENSE" as const, daysAgo: 5 },
  { merchant: "Acme Payroll", amount: "65000.00", type: "INCOME" as const, daysAgo: 7 },
  { merchant: "Netflix", amount: "499.00", type: "EXPENSE" as const, daysAgo: 9 },
] as const;

/**
 * Insert a small realistic set of `isSample = true` rows (accounts +
 * transactions referencing the already-seeded default categories). Idempotent
 * by dedup hash: re-running skips rows whose synthesized hash already exists.
 *
 * DEV-ONLY — gate call sites behind `__DEV__` (see module docs).
 */
export async function loadSampleData(db: Db): Promise<void> {
  // Resolve a real category id (seedDefaults must have run). Fall back gracefully
  // if the caller forgot to seed — pick whatever category exists.
  const cats = await db.select({ id: categories.id }).from(categories);
  const categoryId = cats.length > 0 ? cats[0].id : 1;

  // 1. Sample accounts — skip ones already present (by bank + last4).
  const accountIdByLast4 = new Map<string, number>();
  for (const a of SAMPLE_ACCOUNTS) {
    const existing = await db
      .select({ id: accounts.id, last4: accounts.accountLast4 })
      .from(accounts)
      .where(eq(accounts.accountLast4, a.accountLast4));
    const match = existing.find((r) => r.last4 === a.accountLast4);
    if (match) {
      accountIdByLast4.set(a.accountLast4, match.id);
      continue;
    }
    const [row] = await db
      .insert(accounts)
      .values({
        bankName: a.bankName,
        accountLast4: a.accountLast4,
        iconName: a.iconName,
        color: a.color,
        currency: a.currency,
        isWallet: "isWallet" in a ? a.isWallet : false,
        isSample: true,
      })
      .returning();
    accountIdByLast4.set(a.accountLast4, row.id);
  }

  const primaryAccountLast4 = SAMPLE_ACCOUNTS[0].accountLast4;
  const accountId = accountIdByLast4.get(primaryAccountLast4) ?? 0;
  const now = nowIso();

  // 2. Sample transactions — synthesize a dedup hash so re-running is a no-op.
  for (const t of SAMPLE_TXNS) {
    const dateTime = toIso(daysBefore(now, t.daysAgo));
    const hash = transactionHash({
      sender: "",
      amount: t.amount,
      body: `sample:${accountId}:${t.merchant}:${dateTime}`,
    });
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.transactionHash, hash));
    if (existing.length > 0) continue;

    await db.insert(transactions).values({
      amount: t.amount,
      merchantName: t.merchant,
      categoryId,
      transactionType: t.type,
      dateTime,
      currency: "INR",
      transactionHash: hash,
      isSample: true,
    });
  }
}

/**
 * Delete ONLY `isSample = true` rows. Non-sample (real) rows are never touched.
 * Idempotent: clearing when no sample rows exist is a no-op.
 */
export async function clearSampleData(db: Db): Promise<void> {
  // Transactions first (they reference accounts/categories), then accounts.
  await db.delete(transactions).where(eq(transactions.isSample, true));
  await db.delete(accounts).where(eq(accounts.isSample, true));
}

function daysBefore(iso: string, days: number): Date {
  const d = parseIso(iso);
  d.setDate(d.getDate() - days);
  return d;
}
