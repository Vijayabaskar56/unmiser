import { db } from "@/db/index";
import { type Budget, type BudgetCategoryLimit, budgetCategoryLimits, budgets } from "@/db/schema";
import { createDrizzleCollection } from "../collection-factory";

export const budgetCollection = createDrizzleCollection<Budget>({
  db,
  table: budgets,
  getKey: (row) => row.id,
});

export const budgetCategoryLimitCollection = createDrizzleCollection<BudgetCategoryLimit>({
  db,
  table: budgetCategoryLimits,
  getKey: (row) => row.id,
});
