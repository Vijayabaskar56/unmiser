import { defineRelations } from "drizzle-orm";

import { accountBalances, accounts, cards } from "./schema/accounts";
import { budgetCategoryLimits, budgets } from "./schema/budgets";
import { categories, merchantMappings, subcategories } from "./schema/categories";
import { chatMessages } from "./schema/chat";
import { exchangeRates } from "./schema/exchange-rates";
import { ruleApplications, transactionRules } from "./schema/rules";
import { pluginAssets, plugins, unrecognizedSms } from "./schema/sms";
import { subscriptions } from "./schema/subscriptions";
import { transactions } from "./schema/transactions";
import { webhookCursors, webhookLogs, webhookProfiles } from "./schema/webhooks";

// All tables, passed to defineRelations so the v1 relational query builder
// (db.query.*) knows about every table. Enums/types are intentionally excluded.
export const tables = {
  accounts,
  accountBalances,
  cards,
  transactions,
  categories,
  subcategories,
  merchantMappings,
  budgets,
  budgetCategoryLimits,
  subscriptions,
  transactionRules,
  ruleApplications,
  exchangeRates,
  plugins,
  pluginAssets,
  unrecognizedSms,
  chatMessages,
  webhookProfiles,
  webhookLogs,
  webhookCursors,
};

// drizzle-orm v1 relations — mirror the schema's foreign keys.
export const relations = defineRelations(tables, (r) => ({
  accounts: {
    balances: r.many.accountBalances({
      from: r.accounts.id,
      to: r.accountBalances.accountId,
    }),
    cards: r.many.cards({
      from: r.accounts.id,
      to: r.cards.accountId,
    }),
  },
  accountBalances: {
    account: r.one.accounts({
      from: r.accountBalances.accountId,
      to: r.accounts.id,
    }),
  },
  cards: {
    account: r.one.accounts({
      from: r.cards.accountId,
      to: r.accounts.id,
    }),
  },
  categories: {
    subcategories: r.many.subcategories({
      from: r.categories.id,
      to: r.subcategories.categoryId,
    }),
    transactions: r.many.transactions({
      from: r.categories.id,
      to: r.transactions.categoryId,
    }),
    subscriptions: r.many.subscriptions({
      from: r.categories.id,
      to: r.subscriptions.categoryId,
    }),
    merchantMappings: r.many.merchantMappings({
      from: r.categories.id,
      to: r.merchantMappings.categoryId,
    }),
    budgetLimits: r.many.budgetCategoryLimits({
      from: r.categories.id,
      to: r.budgetCategoryLimits.categoryId,
    }),
  },
  subcategories: {
    category: r.one.categories({
      from: r.subcategories.categoryId,
      to: r.categories.id,
    }),
  },
  transactions: {
    category: r.one.categories({
      from: r.transactions.categoryId,
      to: r.categories.id,
    }),
    subcategory: r.one.subcategories({
      from: r.transactions.subcategoryId,
      to: r.subcategories.id,
    }),
    ruleApplications: r.many.ruleApplications({
      from: r.transactions.id,
      to: r.ruleApplications.transactionId,
    }),
  },
  subscriptions: {
    category: r.one.categories({
      from: r.subscriptions.categoryId,
      to: r.categories.id,
    }),
    subcategory: r.one.subcategories({
      from: r.subscriptions.subcategoryId,
      to: r.subcategories.id,
    }),
  },
  merchantMappings: {
    category: r.one.categories({
      from: r.merchantMappings.categoryId,
      to: r.categories.id,
    }),
  },
  budgets: {
    categoryLimits: r.many.budgetCategoryLimits({
      from: r.budgets.id,
      to: r.budgetCategoryLimits.budgetId,
    }),
  },
  budgetCategoryLimits: {
    budget: r.one.budgets({
      from: r.budgetCategoryLimits.budgetId,
      to: r.budgets.id,
    }),
    category: r.one.categories({
      from: r.budgetCategoryLimits.categoryId,
      to: r.categories.id,
    }),
  },
  transactionRules: {
    applications: r.many.ruleApplications({
      from: r.transactionRules.id,
      to: r.ruleApplications.ruleId,
    }),
  },
  ruleApplications: {
    rule: r.one.transactionRules({
      from: r.ruleApplications.ruleId,
      to: r.transactionRules.id,
    }),
    transaction: r.one.transactions({
      from: r.ruleApplications.transactionId,
      to: r.transactions.id,
    }),
  },
  webhookProfiles: {
    logs: r.many.webhookLogs({
      from: r.webhookProfiles.id,
      to: r.webhookLogs.profileId,
    }),
    cursors: r.many.webhookCursors({
      from: r.webhookProfiles.id,
      to: r.webhookCursors.profileId,
    }),
  },
  webhookLogs: {
    profile: r.one.webhookProfiles({
      from: r.webhookLogs.profileId,
      to: r.webhookProfiles.id,
    }),
  },
  webhookCursors: {
    profile: r.one.webhookProfiles({
      from: r.webhookCursors.profileId,
      to: r.webhookProfiles.id,
    }),
  },
}));
