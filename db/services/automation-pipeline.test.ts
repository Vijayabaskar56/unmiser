import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accountBalances,
  accounts,
  categories,
  merchantMappings,
  ruleApplications,
  subscriptions,
  transactions,
} from "@/db/schema";
import { saveRule } from "@/db/services/rule-ops";
import { saveTransactionThroughPipeline } from "@/db/services/automation-pipeline";
import { createTestDb, type TestDb } from "@/db/test-support/harness";

async function seedCategory(db: TestDb, name: string): Promise<number> {
  const [row] = await db.insert(categories).values({ name, color: "#444444" }).returning();
  return row.id;
}

async function seedAccount(db: TestDb): Promise<number> {
  const [row] = await db
    .insert(accounts)
    .values({ bankName: "HDFC", accountLast4: "1234", currency: "INR" })
    .returning();
  await db.insert(accountBalances).values({
    accountId: row.id,
    balance: "1000.00",
    timestamp: "2026-06-01T00:00:00Z",
    sourceType: "MANUAL",
  });
  return row.id;
}

describe("automation pipeline", () => {
  it("applies learned mapping before active rules, then lets rules win", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const parserCategoryId = await seedCategory(db, "Shopping");
    const mappingCategoryId = await seedCategory(db, "Food");
    const ruleCategoryId = await seedCategory(db, "Subscriptions");
    await db.insert(merchantMappings).values({
      merchantName: "netflix",
      categoryId: mappingCategoryId,
      categoryName: "Food",
    });
    await saveRule(db, {
      id: "rule-subscription",
      name: "Subscriptions rule",
      priority: 1,
      isActive: true,
      conditions: [{ field: "CATEGORY", operator: "EQUALS", value: "Food" }],
      actions: [
        { actionType: "SET", field: "CATEGORY", value: "Subscriptions" },
        { actionType: "SET", field: "RECURRING", value: "true" },
      ],
    });

    const outcome = await saveTransactionThroughPipeline(db, {
      accountId,
      amount: "499.00",
      merchantName: "Netflix",
      categoryId: parserCategoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-06-12T10:00:00Z",
      isCreditCard: false,
    });

    expect(outcome.kind).toBe("saved");
    const [row] = await db.select().from(transactions);
    expect(row.categoryId).toBe(ruleCategoryId);
    expect(row.isRecurring).toBe(true);
    expect(row.subscriptionId).not.toBeNull();
    const [subscription] = await db.select().from(subscriptions);
    expect(subscription.merchantName).toBe("Netflix");
    expect(subscription.nextPaymentDate).toBe("2026-07-12");
    const audits = await db.select().from(ruleApplications);
    expect(audits).toHaveLength(1);
    sqlite.close();
  });

  it("keeps explicit user category over rule category actions on manual save", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const travelCategoryId = await seedCategory(db, "Travel");
    await seedCategory(db, "Food");
    await saveRule(db, {
      id: "rule-food",
      name: "Food rule",
      priority: 1,
      isActive: true,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "Swiggy" }],
      actions: [{ actionType: "SET", field: "CATEGORY", value: "Food" }],
    });

    const outcome = await saveTransactionThroughPipeline(
      db,
      {
        accountId,
        amount: "120.00",
        merchantName: "Swiggy",
        categoryId: travelCategoryId,
        transactionType: "EXPENSE",
        dateTime: "2026-06-12T11:00:00Z",
        isCreditCard: false,
      },
      { explicitUserFields: ["categoryId"] },
    );

    expect(outcome.kind).toBe("saved");
    const [row] = await db.select().from(transactions);
    expect(row.categoryId).toBe(travelCategoryId);
    sqlite.close();
  });

  it("returns blocked without inserting a transaction", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db, "Shopping");
    await saveRule(db, {
      id: "rule-block",
      name: "Block gambling",
      priority: 1,
      isActive: true,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "Casino" }],
      actions: [{ actionType: "BLOCK" }],
    });

    const outcome = await saveTransactionThroughPipeline(db, {
      accountId,
      amount: "500.00",
      merchantName: "Casino Pay",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-06-12T12:00:00Z",
      isCreditCard: false,
    });

    expect(outcome).toEqual({
      kind: "blocked",
      ruleId: "rule-block",
      ruleName: "Block gambling",
    });
    expect(await db.select().from(transactions)).toHaveLength(0);
    expect(
      await db.select().from(accountBalances).where(eq(accountBalances.transactionId, 1)),
    ).toHaveLength(0);
    sqlite.close();
  });

  it("ignores category actions that do not resolve to a category id", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const categoryId = await seedCategory(db, "Miscellaneous");
    await saveRule(db, {
      id: "rule-missing-category",
      name: "Missing category",
      priority: 1,
      isActive: true,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "Swiggy" }],
      actions: [{ actionType: "SET", field: "CATEGORY", value: "Food" }],
    });

    const outcome = await saveTransactionThroughPipeline(db, {
      accountId,
      amount: "120.00",
      merchantName: "Swiggy",
      categoryId,
      transactionType: "EXPENSE",
      dateTime: "2026-06-12T13:00:00Z",
      isCreditCard: false,
    });

    expect(outcome.kind).toBe("saved");
    const [row] = await db.select().from(transactions);
    expect(row.categoryId).toBe(categoryId);
    expect(await db.select().from(ruleApplications)).toHaveLength(0);
    sqlite.close();
  });
});
