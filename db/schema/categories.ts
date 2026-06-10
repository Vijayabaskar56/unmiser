import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";

export const categories = sqliteTable(
  "categories",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    color: text().notNull(),
    iconResId: integer().notNull().default(0),
    iconName: text().notNull().default(""),
    description: text().notNull().default(""),
    isSystem: integer({ mode: "boolean" }).notNull().default(false),
    isIncome: integer({ mode: "boolean" }).notNull().default(false),
    displayOrder: integer().notNull().default(999),
    // Stable identity for system rows (e.g. "food"); null for user-created. Reset
    // matches on this, surviving a user rename. See ADR-0004.
    seedKey: text(),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("index_categories_name").on(t.name),
    index("index_categories_seed_key").on(t.seedKey),
  ],
);

export const subcategories = sqliteTable(
  "subcategories",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text().notNull(),
    iconResId: integer().notNull().default(0),
    iconName: text().notNull().default(""),
    color: text().notNull().default("#757575"),
    isSystem: integer({ mode: "boolean" }).notNull().default(false),
    // Stable identity for system rows; null for user-created. See ADR-0004.
    seedKey: text(),
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("index_subcategories_category_id").on(t.categoryId),
    index("index_subcategories_seed_key").on(t.seedKey),
  ],
);

export const merchantMappings = sqliteTable(
  "merchant_mappings",
  {
    merchantName: text().primaryKey(),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    categoryName: text(), // denormalized cache of categories.name
    createdAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [index("index_merchant_mappings_category_id").on(t.categoryId)],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Subcategory = typeof subcategories.$inferSelect;
export type NewSubcategory = typeof subcategories.$inferInsert;
export type MerchantMapping = typeof merchantMappings.$inferSelect;
export type NewMerchantMapping = typeof merchantMappings.$inferInsert;
