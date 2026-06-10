import { eq } from "drizzle-orm";

import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { appSettings, accounts, APP_SETTING_KEYS } from "@/db/schema";

// `db` is dependency-injected so this module stays driver-agnostic: the app
// passes the expo-sqlite (async) drizzle instance, tests pass better-sqlite3.
// Drizzle query builders are awaitable on both, so we always `await`.
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Read a single app preference. Values are stored as text (string or JSON);
 * interpretation is the caller's responsibility. Returns null when unset.
 */
export async function getSetting(db: Db, key: string): Promise<string | null> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return rows.length > 0 ? (rows[0].value ?? null) : null;
}

/**
 * Upsert a single app preference. Stored as text.
 */
export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

/**
 * The main account is an app preference holding an `accounts.id` (ADR-0005),
 * stored as text. Returns null when unset (or stored as a non-numeric value).
 */
export async function getMainAccountId(db: Db): Promise<number | null> {
  const raw = await getSetting(db, APP_SETTING_KEYS.mainAccountId);
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function setMainAccount(db: Db, accountId: number): Promise<void> {
  await setSetting(db, APP_SETTING_KEYS.mainAccountId, String(accountId));
}

/**
 * Account-deletion consequence (ADR-0005): if the deleted account was the main
 * account, clear the `mainAccountId` pref (repoint to null) so derived state —
 * base currency, the Add-sheet default — falls back cleanly instead of holding a
 * dangling pointer. Deleting any other account leaves the pref untouched.
 *
 * Call this from the account-deletion flow. It is a no-op when no main account
 * is set or when a different account is deleted.
 */
export async function clearMainAccountIfDeleted(db: Db, deletedAccountId: number): Promise<void> {
  const mainAccountId = await getMainAccountId(db);
  if (mainAccountId !== deletedAccountId) return;

  await db.delete(appSettings).where(eq(appSettings.key, APP_SETTING_KEYS.mainAccountId));
}

/**
 * Base currency is derived, never duplicated (ADR-0005): it is the currency of
 * the main account. Returns null when no main account is set, or when the stored
 * main-account id no longer points at an existing account (e.g. it was deleted).
 */
export async function getBaseCurrency(db: Db): Promise<string | null> {
  const mainAccountId = await getMainAccountId(db);
  if (mainAccountId === null) return null;

  const rows = await db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.id, mainAccountId))
    .limit(1);

  return rows.length > 0 ? rows[0].currency : null;
}
