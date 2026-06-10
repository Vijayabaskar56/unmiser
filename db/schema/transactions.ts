import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";
import { accounts } from "./accounts";
import { categories, subcategories } from "./categories";
import { TRANSACTION_SOURCES, TRANSACTION_TYPES } from "./enums";

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    amount: text().notNull(), // BigDecimal as string
    merchantName: text().notNull(),
    categoryId: integer()
      .notNull()
      .references(() => categories.id),
    subcategoryId: integer().references(() => subcategories.id, { onDelete: "set null" }),
    categoryName: text(), // denormalized cache of categories.name (SMS matching)
    subcategoryName: text(), // denormalized cache of subcategories.name
    transactionType: text({ enum: TRANSACTION_TYPES }).notNull(),
    dateTime: text().notNull(),
    description: text(),
    smsBody: text(),
    bankName: text(),
    smsSender: text(),
    // Direct, queryable link to the owning account (ADR-0006). The legacy
    // accountNumber/fromAccount/toAccount text fields are kept for SMS/transfer
    // semantics, but accountId is the robust association that survives soft-delete
    // (the balance row is removed on delete; this row reference is not).
    accountId: integer().references(() => accounts.id, { onDelete: "set null" }),
    accountNumber: text(),
    balanceAfter: text(),
    transactionHash: text().notNull().default(""),
    sourceType: text({ enum: TRANSACTION_SOURCES }).notNull().default("MANUAL"),
    sourcePluginId: text(),
    sourcePluginVersion: text(),
    sourceReceivedAt: text(),
    isRecurring: integer({ mode: "boolean" }).notNull().default(false),
    isDeleted: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
    currency: text().notNull().default("INR"),
    fromAccount: text(),
    toAccount: text(),
    billingCycle: text(),
    attachments: text().notNull().default(""),
    isSample: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("index_transactions_transaction_hash").on(t.transactionHash),
    index("index_transactions_category_id").on(t.categoryId),
    index("index_transactions_account_id").on(t.accountId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
