import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { categories, subcategories } from "@/db/schema";
import { addTransaction, type AddTransactionInput } from "@/db/services/transaction-ops";
import { resolveCategory } from "@/db/services/merchant-mapping";
import {
  buildRuleLookupContext,
  insertRuleApplications,
  listActiveRules,
} from "@/db/services/rule-ops";
import { matchAndLinkSubscriptionPayment } from "@/db/services/subscription-ops";
import { evaluateRules } from "@/lib/rules/interpreter";
import type { RuleTransactionDraft } from "@/lib/rules/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export type PipelineOutcome =
  | { kind: "saved"; transactionId: number }
  | { kind: "blocked"; ruleId: string; ruleName: string };

async function loadNames(
  db: Db,
  input: { categoryId: number; subcategoryId?: number | null },
): Promise<{ categoryName: string | null; subcategoryName: string | null }> {
  const [category] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .limit(1);
  const [subcategory] =
    input.subcategoryId == null
      ? []
      : await db
          .select({ name: subcategories.name })
          .from(subcategories)
          .where(eq(subcategories.id, input.subcategoryId))
          .limit(1);
  return { categoryName: category?.name ?? null, subcategoryName: subcategory?.name ?? null };
}

function toDraft(input: AddTransactionInput, names: Awaited<ReturnType<typeof loadNames>>) {
  return {
    amount: input.amount,
    transactionType: input.transactionType,
    categoryId: input.categoryId,
    categoryName: names.categoryName,
    subcategoryId: input.subcategoryId ?? null,
    subcategoryName: names.subcategoryName,
    merchantName: input.merchantName,
    description: input.description ?? null,
    smsBody: input.smsBody ?? null,
    bankName: input.sourcePluginId ?? null,
    billingCycle: input.billingCycle ?? null,
  } satisfies RuleTransactionDraft;
}

export async function saveTransactionThroughPipeline(
  db: Db,
  input: AddTransactionInput,
  options: { explicitUserFields?: Array<keyof AddTransactionInput> } = {},
): Promise<PipelineOutcome> {
  const mappedCategoryId = await resolveCategory(db, {
    cleanedMerchant: input.merchantName,
    parserCategoryId: input.categoryId,
  });
  const mappedInput = { ...input, categoryId: mappedCategoryId ?? input.categoryId };
  const names = await loadNames(db, {
    categoryId: mappedInput.categoryId,
    subcategoryId: mappedInput.subcategoryId,
  });

  const rules = await listActiveRules(db);
  const evaluated = evaluateRules(
    rules,
    toDraft(mappedInput, names),
    await buildRuleLookupContext(db),
  );
  if (evaluated.blocked) {
    return {
      kind: "blocked",
      ruleId: evaluated.blocked.ruleId,
      ruleName: evaluated.blocked.ruleName,
    };
  }

  const finalInput = { ...mappedInput };
  if (!options.explicitUserFields?.includes("merchantName")) {
    finalInput.merchantName = evaluated.transaction.merchantName;
  }
  if (!options.explicitUserFields?.includes("description")) {
    finalInput.description = evaluated.transaction.description;
  }
  finalInput.isRecurring = evaluated.transaction.isRecurring ?? finalInput.isRecurring;
  finalInput.billingCycle = evaluated.transaction.billingCycle ?? finalInput.billingCycle;
  if (!options.explicitUserFields?.includes("categoryId")) {
    finalInput.categoryId = evaluated.transaction.categoryId;
    finalInput.subcategoryId = evaluated.transaction.subcategoryId ?? null;
  }

  const transactionId = await addTransaction(db, finalInput);
  await insertRuleApplications(db, transactionId, evaluated.applications);
  await matchAndLinkSubscriptionPayment(db, transactionId);
  return { kind: "saved", transactionId };
}
