import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";
import { categories, subcategories } from "./categories";
import { SUBSCRIPTION_STATES } from "./enums";

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    merchantName: text().notNull(),
    amount: text().notNull(), // BigDecimal as string
    nextPaymentDate: text(), // LocalDate (nullable)
    state: text({ enum: SUBSCRIPTION_STATES }).notNull().default("ACTIVE"),
    bankName: text(),
    umn: text(), // Unique Mandate Number for E-Mandates
    categoryId: integer().references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: integer().references(() => subcategories.id, { onDelete: "set null" }),
    categoryName: text(), // denormalized cache of categories.name
    subcategoryName: text(), // denormalized cache of subcategories.name
    smsBody: text(),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
    currency: text().notNull().default("INR"),
    billingCycle: text(),
    lastPaidDate: text(), // LocalDate (nullable)
    isSample: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("index_subscriptions_category_id").on(t.categoryId)],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
