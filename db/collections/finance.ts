import { BTreeIndex, createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { eq } from "drizzle-orm";

import { queryClient } from "@/lib/query-client";
import { db } from "../index";
import {
  type Account,
  type AccountBalance,
  type Category,
  type Subcategory,
  type Transaction,
  accountBalances,
  accounts,
  categories,
  subcategories,
  transactions,
} from "../schema";

/**
 * Read-mostly TanStack DB collections backing the Phase-1 screens. They use the
 * queryCollectionOptions-over-a-drizzle-select pattern, but financial WRITES do
 * NOT go through the collection's optimistic handlers —
 * they go through the services layer (@/db/services/transaction-ops, seed,
 * app-settings) which runs the balance cascade. After a service write the screen
 * calls `<collection>.utils.refetch()` so the live query re-reads the persisted
 * rows. This keeps a single source of truth for balance math (the cascade) and
 * avoids the collection re-deriving balances independently.
 */

export const categoryCollection = createCollection(
  queryCollectionOptions<Category>({
    queryKey: ["categories"],
    queryClient,
    getKey: (c) => c.id,
    queryFn: async () => db.select().from(categories),
  }),
);

export const subcategoryCollection = createCollection(
  queryCollectionOptions<Subcategory>({
    queryKey: ["subcategories"],
    queryClient,
    getKey: (s) => s.id,
    queryFn: async () => db.select().from(subcategories),
  }),
);

export const accountCollection = createCollection(
  queryCollectionOptions<Account>({
    queryKey: ["accounts"],
    queryClient,
    getKey: (a) => a.id,
    queryFn: async () => db.select().from(accounts),
  }),
);

export const accountBalanceCollection = createCollection(
  queryCollectionOptions<AccountBalance>({
    queryKey: ["account_balances"],
    queryClient,
    getKey: (b) => b.id,
    queryFn: async () => db.select().from(accountBalances),
  }),
);

export const transactionCollection = createCollection(
  queryCollectionOptions<Transaction>({
    queryKey: ["transactions"],
    queryClient,
    getKey: (t) => t.id,
    // Only show live (not soft-deleted) transactions on the list.
    queryFn: async () => db.select().from(transactions).where(eq(transactions.isDeleted, false)),
  }),
);

// Indexes backing the screens' ordered live queries (transactions list is
// orderBy(dateTime desc), accounts list is orderBy(bankName)); without them
// TanStack DB re-sorts the full collection on every update.
transactionCollection.createIndex((t) => t.dateTime, { indexType: BTreeIndex });
accountCollection.createIndex((a) => a.bankName, { indexType: BTreeIndex });
