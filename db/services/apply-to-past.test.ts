import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accountBalances, accounts, categories, transactions } from "@/db/schema";
import { applyToPast } from "@/db/services/apply-to-past";
import { saveRule } from "@/db/services/rule-ops";
import { addTransaction } from "@/db/services/transaction-ops";
import { createTestDb, type TestDb } from "@/db/test-support/harness";

async function seedCategory(db: TestDb, name: string): Promise<number> {
  const [row] = await db.insert(categories).values({ name, color: "#555555" }).returning();
  return row.id;
}

async function seedTransaction(db: TestDb) {
  const [account] = await db
    .insert(accounts)
    .values({ bankName: "HDFC", accountLast4: "1234", currency: "INR" })
    .returning();
  const categoryId = await seedCategory(db, "Shopping");
  const [transaction] = await db
    .insert(transactions)
    .values({
      accountId: account.id,
      amount: "500.00",
      merchantName: "Casino Pay",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-06-12T12:00:00Z",
      transactionHash: "apply-block",
    })
    .returning();
  return transaction.id;
}

describe("apply to past", () => {
  it("does not delete or update existing transactions for BLOCK actions", async () => {
    const { db, sqlite } = createTestDb();
    const transactionId = await seedTransaction(db);
    await saveRule(db, {
      id: "rule-block",
      name: "Block gambling",
      priority: 1,
      isActive: true,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "Casino" }],
      actions: [{ actionType: "BLOCK" }],
    });

    const result = await applyToPast(db);
    const [row] = await db.select().from(transactions);

    expect(result).toEqual({ processed: 1, updated: 0, ambiguous: 0 });
    expect(row.id).toBe(transactionId);
    expect(row.isDeleted).toBe(false);
    sqlite.close();
  });

  it("recascades both accounts when a SET ACCOUNT rule moves a transaction", async () => {
    const { db, sqlite } = createTestDb();
    const [from] = await db
      .insert(accounts)
      .values({ bankName: "HDFC", accountLast4: "1111", currency: "INR" })
      .returning();
    const [to] = await db
      .insert(accounts)
      .values({ bankName: "ICICI", accountLast4: "2222", currency: "INR" })
      .returning();
    const categoryId = await seedCategory(db, "Shopping");

    // addTransaction runs the balance cascade, so the source account gets a reading.
    const txnId = await addTransaction(db, {
      accountId: from.id,
      amount: "500.00",
      merchantName: "Move Me",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-06-12T12:00:00Z",
      isCreditCard: false,
    });

    await saveRule(db, {
      id: "rule-move",
      name: "Route to ICICI",
      priority: 1,
      isActive: true,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "Move" }],
      actions: [{ actionType: "SET", field: "ACCOUNT", value: "ICICI" }],
    });

    const result = await applyToPast(db);
    expect(result.updated).toBe(1);

    const [row] = await db.select().from(transactions).where(eq(transactions.id, txnId));
    expect(row.accountId).toBe(to.id);

    // The old account must no longer carry this transaction's reading; the new one must.
    const fromReadings = await db
      .select()
      .from(accountBalances)
      .where(eq(accountBalances.accountId, from.id));
    const toReadings = await db
      .select()
      .from(accountBalances)
      .where(eq(accountBalances.accountId, to.id));
    expect(fromReadings.some((r) => r.transactionId === txnId)).toBe(false);
    expect(toReadings.some((r) => r.transactionId === txnId)).toBe(true);

    sqlite.close();
  });
});
