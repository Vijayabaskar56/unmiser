import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  categories,
  ruleApplications,
  subcategories,
  transactionRules,
  transactions,
} from "@/db/schema";
import { createTestDb } from "@/db/test-support/harness";
import {
  buildRuleLookupContext,
  insertRuleApplications,
  listActiveRules,
  saveRule,
  seedSystemRuleTemplates,
} from "@/db/services/rule-ops";

describe("rule ops", () => {
  it("saves validated rules and lists active rules by priority", async () => {
    const { db, sqlite } = createTestDb();
    await saveRule(db, {
      id: "inactive",
      name: "Inactive",
      priority: 1,
      isActive: false,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "x" }],
      actions: [{ actionType: "SET", field: "NARRATION", value: "x" }],
    });
    await saveRule(db, {
      id: "active",
      name: "Active",
      priority: 2,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "x" }],
      actions: [{ actionType: "SET", field: "NARRATION", value: "x" }],
    });

    const rules = await listActiveRules(db);
    expect(rules.map((rule) => rule.id)).toEqual(["active"]);
    expect(rules[0].conditions[0].field).toBe("MERCHANT");

    sqlite.close();
  });

  it("rejects disallowed action fields before writing", async () => {
    const { db, sqlite } = createTestDb();
    await expect(
      saveRule(db, {
        id: "bad",
        name: "Bad",
        priority: 1,
        conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "x" }],
        actions: [{ actionType: "SET", field: "AMOUNT" as never, value: "1" }],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(transactionRules)).toHaveLength(0);
    sqlite.close();
  });

  it("builds lookup maps and inserts audit rows", async () => {
    const { db, sqlite } = createTestDb();
    const [category] = await db
      .insert(categories)
      .values({ name: "Food", color: "#f00" })
      .returning();
    const [subcategory] = await db
      .insert(subcategories)
      .values({ categoryId: category.id, name: "Burgers" })
      .returning();
    await saveRule(db, {
      id: "rule",
      name: "Rule",
      priority: 1,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "x" }],
      actions: [{ actionType: "SET", field: "SUBCATEGORY", value: "Burgers" }],
    });
    const [transaction] = await db
      .insert(transactions)
      .values({
        amount: "10",
        merchantName: "Shop",
        categoryId: category.id,
        transactionType: "EXPENSE",
        dateTime: "2026-01-01T00:00:00Z",
        transactionHash: "hash-rule-audit",
      })
      .returning();

    const lookups = await buildRuleLookupContext(db);
    expect(lookups.categoryByName?.get("food")?.id).toBe(category.id);
    expect(lookups.subcategoryByName?.get("burgers")?.id).toBe(subcategory.id);

    await insertRuleApplications(db, transaction.id, [
      {
        ruleId: "rule",
        ruleName: "Rule",
        fieldsModified: [{ field: "NARRATION", oldValue: null, newValue: "x", actionType: "SET" }],
      },
    ]);

    const rows = await db
      .select()
      .from(ruleApplications)
      .where(eq(ruleApplications.transactionId, String(transaction.id)));
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].fieldsModified)[0].field).toBe("NARRATION");
    sqlite.close();
  });

  it("seeds inactive system templates idempotently", async () => {
    const { db, sqlite } = createTestDb();
    await seedSystemRuleTemplates(db);
    await seedSystemRuleTemplates(db);
    const rows = await db.select().from(transactionRules);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.isActive === false && row.isSystemTemplate === true)).toBe(true);
    sqlite.close();
  });
});
