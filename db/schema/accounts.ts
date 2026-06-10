import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";
import { CARD_TYPES } from "./enums";

// Account identity + presentation. Extracted so balance snapshots and cards
// don't each duplicate icon/color/currency/credit-limit per row (3NF).
export const accounts = sqliteTable(
  "accounts",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    bankName: text().notNull(),
    // Canonical bank id resolved from the manifest registry (e.g. "in.hdfc.bank").
    // Manual-create and SMS-create funnel through one resolver so the same bank never
    // forks into duplicate accounts from a free-text label mismatch. See ADR-0006.
    canonicalBank: text(),
    accountLast4: text().notNull(),
    iconResId: integer().notNull().default(0),
    iconName: text().notNull().default(""),
    color: text().notNull().default("#33B5E5"),
    currency: text().notNull().default("INR"),
    isWallet: integer({ mode: "boolean" }).notNull().default(false),
    isCreditCard: integer({ mode: "boolean" }).notNull().default(false),
    creditLimit: text(), // BigDecimal as string
    isSample: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex("index_accounts_bank_name_account_last4").on(t.bankName, t.accountLast4)],
);

// A timestamped balance reading for an account.
export const accountBalances = sqliteTable(
  "account_balances",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    accountId: integer()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    balance: text().notNull(), // BigDecimal as string
    timestamp: text().notNull(),
    transactionId: integer(), // soft link to transactions.id (no FK, mirrors source)
    smsSource: text(),
    sourceType: text(), // TRANSACTION, SMS_BALANCE, MANUAL, CARD_LINK
    createdAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("index_account_balances_account_id_timestamp").on(t.accountId, t.timestamp),
    index("index_account_balances_account_id").on(t.accountId),
    index("index_account_balances_timestamp").on(t.timestamp),
  ],
);

export const cards = sqliteTable(
  "cards",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    cardLast4: text().notNull(),
    cardType: text({ enum: CARD_TYPES }).notNull(),
    bankName: text().notNull(),
    accountId: integer().references(() => accounts.id, { onDelete: "set null" }), // debit cards
    nickname: text(),
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    lastBalance: text(),
    lastBalanceSource: text(),
    lastBalanceDate: text(),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
    currency: text().notNull().default("INR"),
    isSample: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("index_cards_bank_name_card_last4").on(t.bankName, t.cardLast4),
    index("index_cards_card_last4").on(t.cardLast4),
    index("index_cards_account_id").on(t.accountId),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type NewAccountBalance = typeof accountBalances.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
