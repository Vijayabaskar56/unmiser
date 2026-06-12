import { and, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { accounts, categories, subcategories } from "@/db/schema";
import { SEED_CASH_ACCOUNT, SEED_CATEGORIES, SEED_SUBCATEGORIES } from "@/db/seed/categories";
import { seedSystemRuleTemplates } from "@/db/services/rule-ops";

// The seed/reset service. `db` is injected so the same code runs against the
// expo-sqlite (async) driver on-device and the better-sqlite3 (sync) driver in
// tests — query builders are awaitable on both. See the DRIVER NOTE in the
// module brief: we read the current state first (a pure decision), then issue
// only the writes that are missing, so the whole thing is safe to wrap in a
// transaction by the caller (app: db.transaction; tests: implicit).
//
// Atomicity note for the app: wrap the whole `seedDefaults` call in
// `db.transaction(async (tx) => seedDefaults(tx))` to make first-launch seeding
// all-or-nothing. The function itself takes any drizzle instance, so a tx works.

// Accept any drizzle SQLite db whose query builders are awaitable — the base both
// the expo-sqlite (async, on-device) and better-sqlite3 (sync, tests) flavours
// extend. Typing against either concrete driver would wrongly reject the other.
type SeedDb = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Idempotently insert the default system categories, subcategories and the Cash
 * wallet. Any category/subcategory whose `seedKey` already exists is skipped (the
 * existing, possibly user-edited row is left untouched). Safe to run on every
 * launch.
 */
export async function seedDefaults(db: SeedDb): Promise<void> {
  // 1. Categories — skip seedKeys already present.
  const existingCats = await db
    .select({ id: categories.id, seedKey: categories.seedKey })
    .from(categories);
  const existingCatKeys = new Set(
    existingCats.map((c) => c.seedKey).filter((k): k is string => k != null),
  );

  for (const cat of SEED_CATEGORIES) {
    if (existingCatKeys.has(cat.seedKey)) continue;
    await db.insert(categories).values({
      name: cat.name,
      description: cat.description,
      color: cat.color,
      iconName: cat.iconName,
      isSystem: true,
      isIncome: cat.isIncome,
      displayOrder: cat.displayOrder,
      seedKey: cat.seedKey,
    });
  }

  // 2. Resolve category seedKey -> id for subcategory parenting (post-insert).
  const catRows = await db
    .select({ id: categories.id, seedKey: categories.seedKey })
    .from(categories);
  const catIdBySeedKey = new Map<string, number>();
  for (const c of catRows) {
    if (c.seedKey != null) catIdBySeedKey.set(c.seedKey, c.id);
  }

  // 3. Subcategories — skip seedKeys already present.
  const existingSubKeys = new Set(
    (await db.select({ seedKey: subcategories.seedKey }).from(subcategories))
      .map((s) => s.seedKey)
      .filter((k): k is string => k != null),
  );

  for (const sub of SEED_SUBCATEGORIES) {
    if (existingSubKeys.has(sub.seedKey)) continue;
    const categoryId = catIdBySeedKey.get(sub.categorySeedKey);
    if (categoryId == null) continue; // parent missing (should not happen)
    await db.insert(subcategories).values({
      categoryId,
      name: sub.name,
      iconName: sub.iconName,
      color: sub.color,
      isSystem: true,
      seedKey: sub.seedKey,
    });
  }

  // 4. Cash wallet — identified by (bankName, accountLast4) since accounts have
  // no seedKey column. Insert only if absent.
  const existingCash = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.bankName, SEED_CASH_ACCOUNT.bankName),
        eq(accounts.accountLast4, SEED_CASH_ACCOUNT.accountLast4),
      ),
    );
  if (existingCash.length === 0) {
    await db.insert(accounts).values({
      bankName: SEED_CASH_ACCOUNT.bankName,
      accountLast4: SEED_CASH_ACCOUNT.accountLast4,
      iconName: SEED_CASH_ACCOUNT.iconName,
      color: SEED_CASH_ACCOUNT.color,
      currency: SEED_CASH_ACCOUNT.currency,
      isWallet: SEED_CASH_ACCOUNT.isWallet,
    });
  }

  await seedSystemRuleTemplates(db);
}

/**
 * Restore a system category's name/color/iconName to the shipped defaults,
 * matched by `seedKey` (so it works even after the user renamed the category).
 * Returns true if a row was reset, false if the seedKey is unknown or no row
 * currently carries it.
 */
export async function resetCategory(db: SeedDb, seedKey: string): Promise<boolean> {
  const seed = SEED_CATEGORIES.find((c) => c.seedKey === seedKey);
  if (!seed) return false;

  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.seedKey, seedKey));
  if (rows.length === 0) return false;

  await db
    .update(categories)
    .set({ name: seed.name, color: seed.color, iconName: seed.iconName })
    .where(eq(categories.seedKey, seedKey));

  return true;
}
