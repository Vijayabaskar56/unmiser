import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { categories, subcategories, transactions } from "@/db/schema";

/**
 * Category + subcategory CRUD (Phase-1).
 *
 * The category taxonomy is leaf state (ADR-0011): no balance cascade, no derived
 * readings — just plain inserts/updates/deletes. `db` is injected so the same
 * code runs against the expo-sqlite (async) driver on-device and the
 * better-sqlite3 (sync) driver in tests; both extend the BaseSQLiteDatabase
 * surface used here (select/insert/update/delete are awaitable on both).
 *
 * Referential-integrity note: `transactions.categoryId` is NOT NULL with the
 * default (RESTRICT) FK action, so a raw DELETE of an in-use category would throw
 * a low-level constraint error. deleteCategory checks the reference count FIRST
 * and throws a clear "category in use" error instead. Subcategories, by contrast,
 * are ON DELETE CASCADE off their category and ON DELETE SET NULL on transactions,
 * so removing a category or subcategory never strands a transaction.
 */
type CategoryDb = BaseSQLiteDatabase<"sync" | "async", any, any>;

export interface CreateCategoryInput {
  name: string;
  color: string;
  iconName?: string;
  description?: string;
  isIncome: boolean;
  displayOrder?: number;
}

export interface EditCategoryChanges {
  name?: string;
  color?: string;
  iconName?: string;
  description?: string;
  isIncome?: boolean;
  displayOrder?: number;
}

export interface CreateSubcategoryInput {
  categoryId: number;
  name: string;
  iconName?: string;
  color?: string;
}

export interface EditSubcategoryChanges {
  name?: string;
  iconName?: string;
  color?: string;
}

/**
 * Insert a user category and return its id. Always a non-system row
 * (isSystem=false, seedKey=null) — only the seed service creates system rows.
 */
export async function createCategory(db: CategoryDb, input: CreateCategoryInput): Promise<number> {
  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      color: input.color,
      iconName: input.iconName ?? "",
      description: input.description ?? "",
      isIncome: input.isIncome,
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      isSystem: false,
      seedKey: null,
    })
    .returning();
  return row.id;
}

/** Update a category's editable fields. */
export async function editCategory(
  db: CategoryDb,
  id: number,
  changes: EditCategoryChanges,
): Promise<void> {
  await db.update(categories).set(changes).where(eq(categories.id, id));
}

/**
 * Delete a category. Throws "category in use" if any transaction references it
 * (transactions.categoryId is NOT NULL / RESTRICT) — the count is checked before
 * issuing the delete so the row is never partially removed. Subcategories under
 * the category cascade-delete automatically.
 */
export async function deleteCategory(db: CategoryDb, id: number): Promise<void> {
  const referencing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.categoryId, id));
  if (referencing.length > 0) {
    throw new Error(
      `Cannot delete category ${id}: it is in use by ${referencing.length} transaction(s).`,
    );
  }
  await db.delete(categories).where(eq(categories.id, id));
}

/**
 * Insert a user subcategory under a category and return its id. Always a
 * non-system row (isSystem=false).
 */
export async function createSubcategory(
  db: CategoryDb,
  input: CreateSubcategoryInput,
): Promise<number> {
  const [row] = await db
    .insert(subcategories)
    .values({
      categoryId: input.categoryId,
      name: input.name,
      iconName: input.iconName ?? "",
      ...(input.color !== undefined ? { color: input.color } : {}),
      isSystem: false,
      seedKey: null,
    })
    .returning();
  return row.id;
}

/** Update a subcategory's editable fields. */
export async function editSubcategory(
  db: CategoryDb,
  id: number,
  changes: EditSubcategoryChanges,
): Promise<void> {
  await db.update(subcategories).set(changes).where(eq(subcategories.id, id));
}

/** Delete a subcategory. Transactions referencing it are ON DELETE SET NULL. */
export async function deleteSubcategory(db: CategoryDb, id: number): Promise<void> {
  await db.delete(subcategories).where(eq(subcategories.id, id));
}
