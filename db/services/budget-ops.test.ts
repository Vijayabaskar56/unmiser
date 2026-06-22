import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { budgetCategoryLimits, budgets, categories } from "@/db/schema";
import { saveBudget } from "@/db/services/budget-ops";
import { createTestDb } from "@/db/test-support/harness";

describe("saveBudget", () => {
  it("creates a budget with category limits", async () => {
    const { db, sqlite } = createTestDb();
    const [category] = await db
      .insert(categories)
      .values({ name: "Food", color: "#15140f", isIncome: false })
      .returning();

    const id = await saveBudget(db, {
      name: "Food guardrail",
      amount: "1000.00",
      periodType: "MONTHLY",
      categoryLimits: [
        { categoryId: category.id, categoryName: category.name, limitAmount: "1000.00" },
      ],
    });

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    const limits = await db
      .select()
      .from(budgetCategoryLimits)
      .where(eq(budgetCategoryLimits.budgetId, id));

    expect(budget.name).toBe("Food guardrail");
    expect(budget.periodType).toBe("MONTHLY");
    expect(limits).toHaveLength(1);
    expect(limits[0].categoryName).toBe("Food");

    sqlite.close();
  });
});
