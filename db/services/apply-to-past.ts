import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { transactions } from "@/db/schema";
import {
  buildRuleLookupContext,
  insertRuleApplications,
  listActiveRules,
} from "@/db/services/rule-ops";
import { evaluateRules } from "@/lib/rules/interpreter";
import type { RuleDefinition, RuleTransactionDraft } from "@/lib/rules/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

function rowToDraft(row: typeof transactions.$inferSelect): RuleTransactionDraft {
  return {
    amount: row.amount,
    transactionType: row.transactionType,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    merchantName: row.merchantName,
    description: row.description,
    smsBody: row.smsBody,
    bankName: row.bankName,
    isRecurring: row.isRecurring,
    billingCycle: row.billingCycle,
  };
}

async function selectedRules(db: Db, ruleIds?: string[]): Promise<RuleDefinition[]> {
  const active = await listActiveRules(db);
  if (!ruleIds || ruleIds.length === 0) return active;
  const wanted = new Set(ruleIds);
  return active.filter((rule) => wanted.has(rule.id));
}

export async function previewApplyToPast(
  db: Db,
  ruleIds?: string[],
): Promise<{ count: number; sample: RuleTransactionDraft[] }> {
  const rules = await selectedRules(db, ruleIds);
  const lookups = await buildRuleLookupContext(db);
  const rows = await db.select().from(transactions).where(eq(transactions.isDeleted, false));
  const sample: RuleTransactionDraft[] = [];
  let count = 0;

  for (const row of rows) {
    const result = evaluateRules(rules, rowToDraft(row), lookups);
    if (result.mutations.length === 0) continue;
    count += 1;
    if (sample.length < 10) sample.push(result.transaction);
  }
  return { count, sample };
}

export async function applyToPast(
  db: Db,
  ruleIds?: string[],
): Promise<{ processed: number; updated: number }> {
  const rules = await selectedRules(db, ruleIds);
  const lookups = await buildRuleLookupContext(db);
  const rows = await db.select().from(transactions).where(eq(transactions.isDeleted, false));
  let updated = 0;

  for (let i = 0; i < rows.length; i += 500) {
    for (const row of rows.slice(i, i + 500)) {
      const result = evaluateRules(rules, rowToDraft(row), lookups);
      if (result.mutations.length === 0) continue;
      await db
        .update(transactions)
        .set({
          merchantName: result.transaction.merchantName,
          description: result.transaction.description,
          categoryId: result.transaction.categoryId,
          categoryName: result.transaction.categoryName,
          subcategoryId: result.transaction.subcategoryId,
          subcategoryName: result.transaction.subcategoryName,
          isRecurring: result.transaction.isRecurring,
          billingCycle: result.transaction.billingCycle,
        })
        .where(eq(transactions.id, row.id));
      await insertRuleApplications(db, row.id, result.applications);
      updated += 1;
    }
  }

  return { processed: rows.length, updated };
}
