import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  accountBalances,
  accounts,
  budgetCategoryLimits,
  budgets,
  cards,
  categories,
  chatMessages,
  exchangeRates,
  merchantMappings,
  ruleApplications,
  subcategories,
  subscriptions,
  transactionRules,
  transactions,
  unrecognizedSms,
  webhookCursors,
  webhookLogs,
  webhookProfiles,
} from "@/db/schema";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * "Delete all data" (Data & Privacy). Wipes every financial and automation
 * table in child→parent order (transactions before categories satisfies the
 * RESTRICT FK; the rest are cascade/set-null so order is forgiving).
 *
 * Deliberately PRESERVES `app_settings` (setup-completed flag, profile,
 * preferences) and installed `plugins`/`pluginAssets` — wiping those would
 * force re-onboarding and re-install the user's SMS parsers, which a data reset
 * shouldn't do.
 */
export async function deleteAllData(db: Db): Promise<void> {
  await db.delete(ruleApplications);
  await db.delete(transactions);
  await db.delete(accountBalances);
  await db.delete(cards);
  await db.delete(budgetCategoryLimits);
  await db.delete(budgets);
  await db.delete(subscriptions);
  await db.delete(subcategories);
  await db.delete(merchantMappings);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(transactionRules);
  await db.delete(unrecognizedSms);
  await db.delete(chatMessages);
  await db.delete(webhookLogs);
  await db.delete(webhookCursors);
  await db.delete(webhookProfiles);
  await db.delete(exchangeRates);
}
