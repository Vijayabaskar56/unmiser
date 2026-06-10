import { eq } from "drizzle-orm";

import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { merchantMappings } from "@/db/schema";

// `db` is dependency-injected so this module stays driver-agnostic: the app
// passes the expo-sqlite (async) drizzle instance, tests pass better-sqlite3.
// Drizzle query builders are awaitable on both, so we always `await`.
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Case-normalize a cleaned merchant name into the `merchantMappings` primary
 * key. Cleaning is deterministic in the parser engine (ADR-0012); this is the
 * final case-fold so the same merchant always maps to the same row regardless
 * of how the SMS happened to capitalize it. Surrounding whitespace is trimmed.
 */
function normalizeMerchantKey(cleanedMerchant: string): string {
  return cleanedMerchant.trim().toLowerCase();
}

/**
 * Record that a (cleaned) merchant belongs to a category — the "learned
 * mapping" layer of ADR-0012. Called on user (re)categorization. Keyed on the
 * case-normalized cleaned merchant name (`merchantMappings.merchantName` is the
 * PK), so re-learning the same merchant updates in place rather than
 * duplicating.
 */
export async function learnMapping(
  db: Db,
  cleanedMerchant: string,
  categoryId: number,
): Promise<void> {
  const merchantName = normalizeMerchantKey(cleanedMerchant);
  await db.insert(merchantMappings).values({ merchantName, categoryId }).onConflictDoUpdate({
    target: merchantMappings.merchantName,
    set: { categoryId },
  });
}

/**
 * Look up the learned category for a (cleaned) merchant. The lookup is
 * case-insensitive on the normalized key. Returns null when nothing has been
 * learned for this merchant.
 */
export async function lookupCategoryForMerchant(
  db: Db,
  cleanedMerchant: string,
): Promise<number | null> {
  const merchantName = normalizeMerchantKey(cleanedMerchant);
  const rows = await db
    .select({ categoryId: merchantMappings.categoryId })
    .from(merchantMappings)
    .where(eq(merchantMappings.merchantName, merchantName))
    .limit(1);
  return rows.length > 0 ? rows[0].categoryId : null;
}

/**
 * Resolve the category for a freshly-cleaned merchant, applying the ADR-0012
 * precedence chain. The rules engine (Phase 3) sits above this and is out of
 * scope here, so the precedence implemented is:
 *
 *   learned merchantMapping > parser's guessed category
 *
 * Returns null when there is neither a learned mapping nor a parser default.
 */
export async function resolveCategory(
  db: Db,
  input: { cleanedMerchant: string; parserCategoryId: number | null },
): Promise<number | null> {
  const learned = await lookupCategoryForMerchant(db, input.cleanedMerchant);
  if (learned !== null) return learned;
  return input.parserCategoryId;
}
