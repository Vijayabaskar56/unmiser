import { db } from "@/db/index";
import {
  type Category,
  categories,
  type MerchantMapping,
  merchantMappings,
  type Subcategory,
  subcategories,
} from "@/db/schema";
import { createDrizzleCollection } from "../collection-factory";

/**
 * Plain optimistic-CRUD collections for the category taxonomy. No derived-state
 * cascade — these are leaf entities (ADR-0011).
 */
export const categoryCollection = createDrizzleCollection<Category>({
  db,
  table: categories,
  getKey: (row) => row.id,
});

export const subcategoryCollection = createDrizzleCollection<Subcategory>({
  db,
  table: subcategories,
  getKey: (row) => row.id,
});

/** Learned merchant -> category mappings (ADR-0012). Keyed by merchantName. */
export const merchantMappingCollection = createDrizzleCollection<MerchantMapping>({
  db,
  table: merchantMappings,
  getKey: (row) => row.merchantName,
});
