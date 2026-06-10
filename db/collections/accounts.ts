import { db } from "@/db/index";
import { type Account, accounts, type Card, cards } from "@/db/schema";
import { createDrizzleCollection } from "../collection-factory";

/**
 * Optimistic-CRUD collections for accounts and cards. Account *balances* are NOT
 * a collection — they are a service-recomputed read-projection (ADR-0002).
 */
export const accountCollection = createDrizzleCollection<Account>({
  db,
  table: accounts,
  getKey: (row) => row.id,
});

export const cardCollection = createDrizzleCollection<Card>({
  db,
  table: cards,
  getKey: (row) => row.id,
});
