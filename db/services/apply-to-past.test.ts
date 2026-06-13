import { describe, expect, it } from "vitest";

import { accounts, categories, transactions } from "@/db/schema";
import { applyToPast } from "@/db/services/apply-to-past";
import { saveRule } from "@/db/services/rule-ops";
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
});
