import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

import { transactions } from "./transactions";

export const transactionRules = sqliteTable(
  "transaction_rules",
  {
    id: text().primaryKey(), // caller-supplied id
    name: text().notNull(),
    description: text(),
    priority: integer().notNull(),
    conditions: text().notNull(), // JSON string
    actions: text().notNull(), // JSON string
    isActive: integer({ mode: "boolean" }).notNull(),
    isSystemTemplate: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
  },
  (t) => [
    index("index_transaction_rules_priority_is_active").on(t.priority, t.isActive),
    index("index_transaction_rules_name").on(t.name),
  ],
);

export const ruleApplications = sqliteTable(
  "rule_applications",
  {
    id: text().primaryKey(),
    ruleId: text()
      .notNull()
      .references(() => transactionRules.id, { onDelete: "cascade" }),
    ruleName: text().notNull(),
    // Stored as TEXT even though transactions.id is INTEGER (SQLite is loosely typed).
    transactionId: text()
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    fieldsModified: text().notNull(), // JSON string
    appliedAt: text().notNull(),
  },
  (t) => [
    index("index_rule_applications_rule_id").on(t.ruleId),
    index("index_rule_applications_transaction_id").on(t.transactionId),
    index("index_rule_applications_applied_at").on(t.appliedAt),
  ],
);

export type TransactionRule = typeof transactionRules.$inferSelect;
export type NewTransactionRule = typeof transactionRules.$inferInsert;
export type RuleApplication = typeof ruleApplications.$inferSelect;
export type NewRuleApplication = typeof ruleApplications.$inferInsert;
