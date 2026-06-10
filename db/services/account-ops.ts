import { eq } from "drizzle-orm";

import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { accounts, transactions } from "@/db/schema";
import { clearMainAccountIfDeleted } from "@/db/services/app-settings";

// `db` is dependency-injected so this module stays driver-agnostic: the app
// passes the expo-sqlite (async) drizzle instance, tests pass better-sqlite3.
// Drizzle query builders are awaitable on both, so we always `await`.
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * The three account "kinds" the UI offers. They collapse onto the two boolean
 * flags the schema stores (isWallet / isCreditCard): the Android app models the
 * same trio as those flags, and "bank" is simply "neither flag set". Keeping a
 * single `kind` at the call boundary stops callers from setting both flags at
 * once (a nonsensical wallet-credit hybrid).
 */
export type AccountKind = "bank" | "credit" | "wallet";

export interface CreateAccountInput {
  bankName: string;
  accountLast4: string;
  currency: string;
  kind: AccountKind;
  /** Stored only for credit accounts; BigDecimal as string. */
  creditLimit?: string | null;
  canonicalBank?: string | null;
  color?: string;
  iconName?: string;
}

/** Editable account fields. Identity flags derive from `kind` at create time and
 *  are not flipped here; presentation + currency + credit limit are. */
export interface EditAccountChanges {
  bankName?: string;
  accountLast4?: string;
  currency?: string;
  creditLimit?: string | null;
  canonicalBank?: string | null;
  color?: string;
  iconName?: string;
}

function kindToFlags(kind: AccountKind): { isWallet: boolean; isCreditCard: boolean } {
  return {
    isWallet: kind === "wallet",
    isCreditCard: kind === "credit",
  };
}

/**
 * Create an account. Maps `kind` onto the isWallet/isCreditCard booleans and
 * persists creditLimit only for credit accounts. The unique (bankName,
 * accountLast4) index is enforced by the DB — a duplicate insert rejects, so the
 * same bank+last4 never forks into two accounts (mirrors ADR-0006's de-dup
 * intent at the storage layer). Returns the new account id.
 */
export async function createAccount(db: Db, input: CreateAccountInput): Promise<number> {
  const { isWallet, isCreditCard } = kindToFlags(input.kind);

  const [row] = await db
    .insert(accounts)
    .values({
      bankName: input.bankName,
      accountLast4: input.accountLast4,
      currency: input.currency,
      isWallet,
      isCreditCard,
      // Only credit accounts carry a limit; anything else stores null.
      creditLimit: isCreditCard ? (input.creditLimit ?? null) : null,
      canonicalBank: input.canonicalBank ?? null,
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.iconName !== undefined ? { iconName: input.iconName } : {}),
    })
    .returning({ id: accounts.id });

  return row.id;
}

/**
 * Apply a partial change-set to an account. No-op when `changes` is empty.
 */
export async function editAccount(db: Db, id: number, changes: EditAccountChanges): Promise<void> {
  // Drop undefined keys so we never overwrite a column with null/undefined the
  // caller didn't mean to touch.
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return;

  await db.update(accounts).set(set).where(eq(accounts.id, id));
}

/**
 * Delete an account.
 *
 * First clears the main-account pref if it pointed here (ADR-0005) so derived
 * state — base currency, the Add-sheet default — doesn't hold a dangling pointer.
 *
 * Then explicitly nulls transactions.accountId for this account: that column was
 * added via `ALTER TABLE ADD COLUMN`, which in SQLite cannot attach an
 * `ON DELETE SET NULL` action, so the live FK is NO ACTION (RESTRICT) and a plain
 * delete would throw. Nulling it here keeps the transaction rows alive but
 * detached (ADR-0006). accountBalances cascade-delete and cards.accountId
 * set-null happen via FKs declared on the original table, so they need no help.
 */
export async function deleteAccount(db: Db, id: number): Promise<void> {
  await clearMainAccountIfDeleted(db, id);
  await db.update(transactions).set({ accountId: null }).where(eq(transactions.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
}
