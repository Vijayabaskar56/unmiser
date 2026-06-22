import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { budgetCategoryLimits, budgets } from "@/db/schema";
import type { BudgetPeriod, BudgetTrackType, BudgetType } from "@/db/schema/enums";
import { endOfPeriod, nowIso, startOfPeriod } from "@/lib/dates";

type BudgetDb = BaseSQLiteDatabase<"sync" | "async", any, any>;

export interface SaveBudgetInput {
  id?: number;
  name: string;
  amount: string;
  currency?: string;
  periodType: BudgetPeriod;
  trackType?: BudgetTrackType;
  budgetType?: BudgetType;
  categoryLimits: Array<{ categoryId: number; categoryName?: string | null; limitAmount: string }>;
  color?: string;
  isActive?: boolean;
}

export async function saveBudget(db: BudgetDb, input: SaveBudgetInput): Promise<number> {
  if (input.categoryLimits.length === 0) {
    throw new Error("Add at least one category limit.");
  }

  const now = nowIso();
  const periodType = input.periodType;
  const startDate = periodType === "CUSTOM" ? now : startOfPeriod(now, periodType);
  const endDate = periodType === "CUSTOM" ? now : endOfPeriod(now, periodType);
  const budgetValues = {
    name: input.name.trim(),
    amount: input.amount,
    currency: input.currency ?? "INR",
    year: new Date(now).getFullYear(),
    month: new Date(now).getMonth() + 1,
    periodType,
    trackType: input.trackType ?? "ALL_TRANSACTIONS",
    budgetType: input.budgetType ?? "EXPENSE",
    startDate,
    endDate,
    color: input.color ?? "#15140f",
    isActive: input.isActive ?? true,
    updatedAt: now,
  };

  const id =
    input.id !== undefined
      ? await updateBudget(db, input.id, budgetValues)
      : await createBudget(db, budgetValues);

  await db.delete(budgetCategoryLimits).where(eq(budgetCategoryLimits.budgetId, id));
  await db.insert(budgetCategoryLimits).values(
    input.categoryLimits.map((limit) => ({
      budgetId: id,
      categoryId: limit.categoryId,
      categoryName: limit.categoryName ?? null,
      limitAmount: limit.limitAmount,
      updatedAt: now,
    })),
  );

  return id;
}

export async function deleteBudget(db: BudgetDb, id: number): Promise<void> {
  await db.delete(budgets).where(eq(budgets.id, id));
}

async function createBudget(db: BudgetDb, values: typeof budgets.$inferInsert): Promise<number> {
  const [row] = await db.insert(budgets).values(values).returning();
  return row.id;
}

async function updateBudget(
  db: BudgetDb,
  id: number,
  values: Partial<typeof budgets.$inferInsert>,
): Promise<number> {
  await db.update(budgets).set(values).where(eq(budgets.id, id));
  return id;
}
