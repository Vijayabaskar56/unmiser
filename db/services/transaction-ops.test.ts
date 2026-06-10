import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accountBalances, accounts, categories, transactions } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-support/harness";

import {
  addTransaction,
  editTransaction,
  softDeleteTransaction,
  transfer,
  undoDelete,
} from "@/db/services/transaction-ops";

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
      currency: "INR",
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

async function openingBalance(db: TestDb, accountId: number, balance: string) {
  await db.insert(accountBalances).values({
    accountId,
    balance,
    timestamp: "2026-01-01T09:00:00Z",
    sourceType: "MANUAL",
  });
}

function readingsFor(db: TestDb, accountId: number) {
  return db
    .select()
    .from(accountBalances)
    .where(eq(accountBalances.accountId, accountId))
    .orderBy(accountBalances.timestamp);
}

function allTransactions(db: TestDb) {
  return db.select().from(transactions);
}

// ---- tests --------------------------------------------------------------

describe("addTransaction", () => {
  it("persists an expense and updates the account balance", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    await openingBalance(db, accountId, "100.00");

    await addTransaction(db, {
      accountId,
      amount: "30.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
      isCreditCard: false,
      smsSender: "HDFCBK",
      smsBody: "spent 30 at shop",
    });

    const txns = await allTransactions(db);
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe("30.00");
    expect(txns[0].transactionHash).not.toBe("");
    // The transaction row carries a direct account reference (ADR-0006) — not
    // just the (deletable) balance row, so the link survives soft-delete.
    expect(txns[0].accountId).toBe(accountId);

    const rows = await readingsFor(db, accountId);
    const calc = rows.find((r) => r.transactionId === txns[0].id);
    expect(calc?.balance).toBe("70.00");

    sqlite.close();
  });

  it("dedups: adding the same SMS-derived (sender/amount/body) twice yields ONE row", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    await openingBalance(db, accountId, "100.00");

    const input = {
      accountId,
      amount: "30.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE" as const,
      dateTime: "2026-01-01T10:00:00Z",
      isCreditCard: false,
      smsSender: "HDFCBK",
      smsBody: "spent 30 at shop",
    };

    const firstId = await addTransaction(db, input);
    // A later re-scan of the same SMS (even a different dateTime) must not duplicate.
    const secondId = await addTransaction(db, { ...input, dateTime: "2026-02-09T10:00:00Z" });

    expect(secondId).toBe(firstId);
    expect(await allTransactions(db)).toHaveLength(1);

    sqlite.close();
  });

  it("does NOT resurrect a soft-deleted hash when the same SMS re-arrives", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    await openingBalance(db, accountId, "100.00");

    const input = {
      accountId,
      amount: "30.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE" as const,
      dateTime: "2026-01-01T10:00:00Z",
      isCreditCard: false,
      smsSender: "HDFCBK",
      smsBody: "spent 30 at shop",
    };
    const id = await addTransaction(db, input);

    // User deliberately deletes it.
    await softDeleteTransaction(db, id, accountId, false);

    // The same SMS re-arrives. Dedup must skip — including the soft-deleted row.
    const reId = await addTransaction(db, input);

    expect(reId).toBe(id);
    const txns = await allTransactions(db);
    expect(txns).toHaveLength(1);
    expect(txns[0].isDeleted).toBe(true); // stayed deleted, not resurrected

    sqlite.close();
  });
});

describe("transfer", () => {
  it("moves both balances between same-currency accounts (one TRANSFER row)", async () => {
    const { db, sqlite } = createTestDb();
    const from = await seedAccount(db, { accountLast4: "1111", currency: "INR" });
    const to = await seedAccount(db, { accountLast4: "2222", currency: "INR" });
    const categoryId = await seedCategory(db);
    await openingBalance(db, from, "200.00");
    await openingBalance(db, to, "50.00");

    const txnId = await transfer(db, {
      fromAccount: { id: from, currency: "INR", isCreditCard: false },
      toAccount: { id: to, currency: "INR", isCreditCard: false },
      amount: "75.00",
      categoryId,
      dateTime: "2026-01-01T10:00:00Z",
    });

    const txns = await allTransactions(db);
    expect(txns).toHaveLength(1);
    expect(txns[0].transactionType).toBe("TRANSFER");
    expect(txns[0].fromAccount).toBe(String(from));
    expect(txns[0].toAccount).toBe(String(to));

    // Source debited: 200 - 75 = 125; target credited: 50 + 75 = 125.
    const fromRows = await readingsFor(db, from);
    const toRows = await readingsFor(db, to);
    expect(fromRows.find((r) => r.transactionId === txnId)?.balance).toBe("125.00");
    expect(toRows.find((r) => r.transactionId === txnId)?.balance).toBe("125.00");

    sqlite.close();
  });

  it("throws on a cross-currency transfer", async () => {
    const { db, sqlite } = createTestDb();
    const from = await seedAccount(db, { accountLast4: "1111", currency: "INR" });
    const to = await seedAccount(db, { accountLast4: "2222", currency: "USD" });
    const categoryId = await seedCategory(db);
    await openingBalance(db, from, "200.00");
    await openingBalance(db, to, "50.00");

    await expect(
      transfer(db, {
        fromAccount: { id: from, currency: "INR", isCreditCard: false },
        toAccount: { id: to, currency: "USD", isCreditCard: false },
        amount: "75.00",
        categoryId,
        dateTime: "2026-01-01T10:00:00Z",
      }),
    ).rejects.toThrow(/cross-currency/i);

    // No transaction row and no balance change leaked through.
    expect(await allTransactions(db)).toHaveLength(0);

    sqlite.close();
  });
});

describe("softDeleteTransaction / undoDelete", () => {
  it("removes the delta on soft-delete and restores it on undo", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    await openingBalance(db, accountId, "100.00");

    const id = await addTransaction(db, {
      accountId,
      amount: "30.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
      isCreditCard: false,
      smsSender: "HDFCBK",
      smsBody: "spent 30 at shop",
    });
    expect((await readingsFor(db, accountId)).find((r) => r.transactionId === id)?.balance).toBe(
      "70.00",
    );

    // Soft-delete: the expense delta is removed; only the 100.00 opening remains.
    await softDeleteTransaction(db, id, accountId, false);
    let rows = await readingsFor(db, accountId);
    expect(rows.filter((r) => r.transactionId === id)).toHaveLength(0);
    expect(rows.at(-1)?.balance).toBe("100.00");
    // Row is retained, just flagged.
    const txns = await allTransactions(db);
    expect(txns).toHaveLength(1);
    expect(txns[0].isDeleted).toBe(true);

    // Undo: the delta is restored -> 70.00 again.
    await undoDelete(db, id, accountId, false);
    rows = await readingsFor(db, accountId);
    expect(rows.find((r) => r.transactionId === id)?.balance).toBe("70.00");
    expect((await allTransactions(db))[0].isDeleted).toBe(false);

    sqlite.close();
  });
});

describe("editTransaction", () => {
  it("updates the amount and re-cascades the balance", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db);
    await openingBalance(db, accountId, "100.00");

    const id = await addTransaction(db, {
      accountId,
      amount: "30.00",
      merchantName: "Shop",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00Z",
      isCreditCard: false,
      smsSender: "HDFCBK",
      smsBody: "spent 30 at shop",
    });

    await editTransaction(db, id, accountId, false, { amount: "50.00" });

    const txns = await allTransactions(db);
    expect(txns[0].amount).toBe("50.00");
    // 100 - 50 re-derived; no duplicate reading.
    const rows = await readingsFor(db, accountId);
    expect(rows.filter((r) => r.transactionId === id)).toHaveLength(1);
    expect(rows.find((r) => r.transactionId === id)?.balance).toBe("50.00");

    sqlite.close();
  });
});
