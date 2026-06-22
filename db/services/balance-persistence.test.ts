import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accountBalances,
  accounts,
  categories,
  transactions,
  type NewTransaction,
} from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-support/harness";

import { applyTransactionBalance } from "@/db/services/balance-persistence";

// ---- seed helpers -------------------------------------------------------

async function seedAccount(
  db: TestDb,
  over: Partial<typeof accounts.$inferInsert> = {},
): Promise<number> {
  const [row] = await db
    .insert(accounts)
    .values({
      bankName: "HDFC",
      accountLast4: "1234",
      isCreditCard: false,
      ...over,
    })
    .returning();
  return row.id;
}

async function seedCategory(db: TestDb): Promise<number> {
  const [row] = await db
    .insert(categories)
    .values({ name: "General", color: "#888888", isIncome: false })
    .returning();
  return row.id;
}

let hashCounter = 0;
async function seedTransaction(
  db: TestDb,
  categoryId: number,
  over: Partial<NewTransaction>,
): Promise<number> {
  const [row] = await db
    .insert(transactions)
    .values({
      amount: "0.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
      transactionHash: `h${hashCounter++}`,
      ...over,
    })
    .returning();
  return row.id;
}

function readingsFor(db: TestDb, accountId: number) {
  return db
    .select()
    .from(accountBalances)
    .where(eq(accountBalances.accountId, accountId))
    .orderBy(accountBalances.timestamp);
}

// ---- tests --------------------------------------------------------------

describe("applyTransactionBalance", () => {
  it("writes a TRANSACTION_CALCULATED reading for a new expense", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    // Seed a manual opening balance so the running balance has a starting anchor.
    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const txnId = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });

    await applyTransactionBalance(db, {
      accountId,
      transactionId: txnId,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const rows = await readingsFor(db, accountId);
    const calc = rows.find((r) => r.transactionId === txnId);
    expect(calc).toBeDefined();
    expect(calc?.sourceType).toBe("TRANSACTION_CALCULATED");
    expect(calc?.balance).toBe("70.00");

    sqlite.close();
  });

  it("persists two same-account transactions sharing one second-precision timestamp", async () => {
    // Regression: account_balances was uniquely keyed on (accountId, timestamp).
    // SMS timestamps are second-precision, so two transactions in the same second
    // on one account collided and crashed the scan. The unique key now includes
    // transactionId, so both readings persist and the running balance cascades.
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    const ts = "2026-01-01T10:00:00Z";

    // Opening anchor so expense deltas are visible (the model floors a normal
    // account at 0, so without an anchor both readings would read 0.00).
    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const txnA = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: ts,
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: txnA,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: ts,
    });

    const txnB = await seedTransaction(db, categoryId, {
      amount: "20.00",
      transactionType: "EXPENSE",
      dateTime: ts,
    });
    // Must not throw a UNIQUE constraint violation.
    await applyTransactionBalance(db, {
      accountId,
      transactionId: txnB,
      amount: "20.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: ts,
    });

    const rows = await readingsFor(db, accountId);
    expect(rows.filter((r) => r.transactionId != null)).toHaveLength(2);
    // Cascade off 100: -30 then -20 => latest running balance is 50.00.
    const latest = rows.find((r) => r.transactionId === txnB);
    expect(latest?.balance).toBe("50.00");

    sqlite.close();
  });

  it("computes the running balance for a later transaction off the prior reading", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const first = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const second = await seedTransaction(db, categoryId, {
      amount: "20.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T11:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: second,
      amount: "20.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T11:00:00Z",
    });

    const rows = await readingsFor(db, accountId);
    expect(rows.find((r) => r.transactionId === first)?.balance).toBe("70.00");
    // 70.00 - 20.00, off the first reading's running balance.
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("50.00");

    sqlite.close();
  });

  it("re-cascades subsequent calculated balances when a past transaction's amount is edited", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const first = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const second = await seedTransaction(db, categoryId, {
      amount: "20.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T11:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: second,
      amount: "20.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T11:00:00Z",
    });

    // Edit the FIRST (past) transaction: 30.00 -> 50.00. The transactions row is
    // updated first (as the app would), then balance persistence is re-applied.
    await db.update(transactions).set({ amount: "50.00" }).where(eq(transactions.id, first));

    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "50.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const rows = await readingsFor(db, accountId);
    // No duplicate reading for the edited transaction.
    expect(rows.filter((r) => r.transactionId === first)).toHaveLength(1);
    // 100 - 50 = 50 for first; then 50 - 20 = 30 cascaded into second.
    expect(rows.find((r) => r.transactionId === first)?.balance).toBe("50.00");
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("30.00");

    sqlite.close();
  });

  it("removes a soft-deleted transaction's delta and re-cascades", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const first = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const second = await seedTransaction(db, categoryId, {
      amount: "20.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T11:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: second,
      amount: "20.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T11:00:00Z",
    });

    // Soft-delete the FIRST transaction. The app flips isDeleted then re-applies.
    await db.update(transactions).set({ isDeleted: true }).where(eq(transactions.id, first));

    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
      isDeleted: true,
    });

    const rows = await readingsFor(db, accountId);
    // The deleted transaction's reading is gone.
    expect(rows.filter((r) => r.transactionId === first)).toHaveLength(0);
    // Second now cascades straight off the 100.00 opening: 100 - 20 = 80.
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("80.00");

    sqlite.close();
  });

  it("stops the recompute at a MANUAL/SMS anchor reading (carried, not overwritten)", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const first = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    // A user manually re-stated the balance AFTER the first transaction. This is
    // an anchor (ground truth) that must survive any later cascade.
    await db.insert(accountBalances).values({
      accountId,
      balance: "500.00",
      timestamp: "2026-01-01T10:30:00Z",
      sourceType: "MANUAL_EDIT",
    });

    const second = await seedTransaction(db, categoryId, {
      amount: "20.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T11:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: second,
      amount: "20.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T11:00:00Z",
    });
    // Second cascades off the 500.00 anchor, not off first's reading.
    let rows = await readingsFor(db, accountId);
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("480.00");

    // Now edit the FIRST transaction's amount wildly. The anchor must NOT move,
    // and the post-anchor reading must still derive from the anchor.
    await db.update(transactions).set({ amount: "90.00" }).where(eq(transactions.id, first));
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "90.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
    });

    rows = await readingsFor(db, accountId);
    // First re-derives: 100 - 90 = 10.
    expect(rows.find((r) => r.transactionId === first)?.balance).toBe("10.00");
    // Anchor is untouched ground truth.
    expect(rows.find((r) => r.sourceType === "MANUAL_EDIT")?.balance).toBe("500.00");
    // Second still derives from the anchor, unaffected by the edit upstream.
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("480.00");

    sqlite.close();
  });

  it("tags an SMS-stated balance as TRANSACTION_SMS_BALANCE and anchors off it", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "100.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    // An SMS that stated an explicit post-transaction balance of 777.00. We also
    // record it on the transaction's balanceAfter so the joined fold treats it as
    // ground truth on any later cascade.
    const first = await seedTransaction(db, categoryId, {
      amount: "30.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
      balanceAfter: "777.00",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: first,
      amount: "30.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T10:00:00Z",
      explicitBalance: "777.00",
    });

    const reading = (await readingsFor(db, accountId)).find((r) => r.transactionId === first);
    expect(reading?.sourceType).toBe("TRANSACTION_SMS_BALANCE");
    expect(reading?.balance).toBe("777.00");

    // A later transaction cascades off the SMS-stated 777.00, not a calculated 70.
    const second = await seedTransaction(db, categoryId, {
      amount: "100.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T11:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: second,
      amount: "100.00",
      transactionType: "EXPENSE",
      isCreditCard: false,
      timestamp: "2026-01-01T11:00:00Z",
    });
    const rows = await readingsFor(db, accountId);
    expect(rows.find((r) => r.transactionId === second)?.balance).toBe("677.00");

    sqlite.close();
  });

  it("accumulates debt for credit-card spend", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db, { isCreditCard: true });
    const categoryId = await seedCategory(db);

    await db.insert(accountBalances).values({
      accountId,
      balance: "0.00",
      timestamp: "2026-01-01T09:00:00Z",
      sourceType: "MANUAL",
    });

    const spend = await seedTransaction(db, categoryId, {
      amount: "150.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
    });
    await applyTransactionBalance(db, {
      accountId,
      transactionId: spend,
      amount: "150.00",
      transactionType: "EXPENSE",
      isCreditCard: true,
      timestamp: "2026-01-01T10:00:00Z",
    });

    const rows = await readingsFor(db, accountId);
    // Credit-card spend increases the amount owed.
    expect(rows.find((r) => r.transactionId === spend)?.balance).toBe("150.00");

    sqlite.close();
  });
});
