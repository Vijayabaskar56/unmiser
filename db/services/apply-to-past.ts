import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { accounts, transactions } from "@/db/schema";
import { applyTransactionBalance } from "@/db/services/balance-persistence";
import {
  buildRuleLookupContext,
  insertRuleApplications,
  listActiveRules,
} from "@/db/services/rule-ops";
import { syncSubscriptionFromRecurringTransaction } from "@/db/services/subscription-ops";
import { evaluateRules } from "@/lib/rules/interpreter";
import type { TxnType } from "@/lib/balance-service";
import type { RuleDefinition, RuleTransactionDraft } from "@/lib/rules/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/** id -> account metadata needed for draft naming and the balance cascade. */
type AccountMeta = Map<number, { name: string; isCreditCard: boolean }>;

async function loadAccountMeta(db: Db): Promise<AccountMeta> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.bankName,
      isCreditCard: accounts.isCreditCard,
    })
    .from(accounts);
  return new Map(rows.map((row) => [row.id, { name: row.name, isCreditCard: row.isCreditCard }]));
}

function rowToDraft(
  row: typeof transactions.$inferSelect,
  accountMeta: AccountMeta,
): RuleTransactionDraft {
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
    smsSender: row.smsSender,
    bankName: row.bankName,
    accountId: row.accountId,
    // The transactions table has no accountName column; resolve it from the
    // accounts map so rule-application history records the human name (not a
    // numeric id) and ACCOUNT no-op detection compares like for like.
    accountName: row.accountId != null ? (accountMeta.get(row.accountId)?.name ?? null) : null,
    isRecurring: row.isRecurring,
    billingCycle: row.billingCycle,
    flagged: row.flagged,
  };
}

/**
 * Count how many existing (non-deleted) transactions an in-memory rule
 * definition would change — used by the Create-rule screen to show
 * "N past transactions match" before the rule is saved.
 */
export async function previewRuleMatches(db: Db, definition: RuleDefinition): Promise<number> {
  const lookups = await buildRuleLookupContext(db);
  const accountMeta = await loadAccountMeta(db);
  const rows = await db.select().from(transactions).where(eq(transactions.isDeleted, false));
  let count = 0;
  for (const row of rows) {
    if (evaluateRules([definition], rowToDraft(row, accountMeta), lookups).mutations.length > 0)
      count += 1;
  }
  return count;
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
  const accountMeta = await loadAccountMeta(db);
  const rows = await db.select().from(transactions).where(eq(transactions.isDeleted, false));
  const sample: RuleTransactionDraft[] = [];
  let count = 0;

  for (const row of rows) {
    const result = evaluateRules(rules, rowToDraft(row, accountMeta), lookups);
    if (result.mutations.length === 0) continue;
    count += 1;
    if (sample.length < 10) sample.push(result.transaction);
  }
  return { count, sample };
}

export async function applyToPast(
  db: Db,
  ruleIds?: string[],
): Promise<{ processed: number; updated: number; ambiguous: number }> {
  const rules = await selectedRules(db, ruleIds);
  const lookups = await buildRuleLookupContext(db);
  const accountMeta = await loadAccountMeta(db);
  const rows = await db.select().from(transactions).where(eq(transactions.isDeleted, false));
  let updated = 0;
  let ambiguous = 0;

  for (let i = 0; i < rows.length; i += 500) {
    for (const row of rows.slice(i, i + 500)) {
      const result = evaluateRules(rules, rowToDraft(row, accountMeta), lookups);
      if (result.mutations.length === 0) continue;
      const oldAccountId = row.accountId;
      const newAccountId = result.transaction.accountId;
      const accountChanged = newAccountId !== oldAccountId;

      await db
        .update(transactions)
        .set({
          merchantName: result.transaction.merchantName,
          description: result.transaction.description,
          categoryId: result.transaction.categoryId,
          categoryName: result.transaction.categoryName,
          subcategoryId: result.transaction.subcategoryId,
          subcategoryName: result.transaction.subcategoryName,
          accountId: newAccountId,
          isRecurring: result.transaction.isRecurring,
          billingCycle: result.transaction.billingCycle,
          flagged: result.transaction.flagged ?? false,
        })
        .where(eq(transactions.id, row.id));

      // A SET-ACCOUNT rule moved this row to a different account. The bare update
      // above changed transactions.accountId but left the account_balances series
      // of BOTH accounts stale: the old account still carries this row's reading
      // and the new account has none. Re-run the same cascade editTransaction
      // uses — drop the reading from the old account, then add it to the new one —
      // so neither balance is corrupted.
      if (accountChanged) {
        if (oldAccountId != null) {
          await applyTransactionBalance(db, {
            accountId: oldAccountId,
            transactionId: row.id,
            amount: row.amount,
            transactionType: row.transactionType as TxnType,
            isCreditCard: accountMeta.get(oldAccountId)?.isCreditCard ?? false,
            timestamp: row.dateTime,
            explicitBalance: row.balanceAfter ?? null,
            smsSource: row.smsSender ?? null,
            isDeleted: true,
          });
        }
        if (newAccountId != null) {
          await applyTransactionBalance(db, {
            accountId: newAccountId,
            transactionId: row.id,
            amount: row.amount,
            transactionType: row.transactionType as TxnType,
            isCreditCard: accountMeta.get(newAccountId)?.isCreditCard ?? false,
            timestamp: row.dateTime,
            explicitBalance: row.balanceAfter ?? null,
            smsSource: row.smsSender ?? null,
          });
        }
      }

      await insertRuleApplications(db, row.id, result.applications);
      if (result.transaction.isRecurring) {
        const subscriptionMatch = await syncSubscriptionFromRecurringTransaction(db, row.id);
        // An ambiguous match links nothing; track it separately so the summary does not
        // overstate how many rows were successfully reconciled with a subscription.
        if (subscriptionMatch.kind === "ambiguous") ambiguous += 1;
      }
      updated += 1;
    }
  }

  return { processed: rows.length, updated, ambiguous };
}
