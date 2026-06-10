import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";
import { categories } from "./categories";
import { BUDGET_PERIODS, BUDGET_TRACK_TYPES, BUDGET_TYPES } from "./enums";

export const budgets = sqliteTable("budgets", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  amount: text().notNull(), // BigDecimal as string
  year: integer().notNull(),
  month: integer().notNull(),
  currency: text().notNull().default("INR"),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: text().notNull().$defaultFn(nowIso),
  updatedAt: text().notNull().$defaultFn(nowIso),
  startDate: text().notNull().$defaultFn(nowIso),
  endDate: text().notNull().$defaultFn(nowIso),
  periodType: text({ enum: BUDGET_PERIODS }).notNull().default("MONTHLY"),
  trackType: text({ enum: BUDGET_TRACK_TYPES }).notNull().default("ALL_TRANSACTIONS"),
  budgetType: text({ enum: BUDGET_TYPES }).notNull().default("EXPENSE"),
  accountIds: text().notNull().default(""), // CSV of "BankName:Last4"
  color: text().notNull().default("#4CAF50"),
  isSample: integer({ mode: "boolean" }).notNull().default(false),
});

export const budgetCategoryLimits = sqliteTable(
  "budget_category_limits",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    budgetId: integer()
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    categoryName: text(), // denormalized cache of categories.name
    limitAmount: text().notNull(), // BigDecimal as string
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("index_budget_category_limits_budget_id").on(t.budgetId),
    index("index_budget_category_limits_category_id").on(t.categoryId),
  ],
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetCategoryLimit = typeof budgetCategoryLimits.$inferSelect;
export type NewBudgetCategoryLimit = typeof budgetCategoryLimits.$inferInsert;
