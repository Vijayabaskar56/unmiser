import { add } from "@/lib/money";

interface TxnRow {
  categoryId: number | null;
  amount: string;
  isDeleted: boolean;
}

export interface CategoryAgg {
  count: number;
  total: string;
}

/**
 * Per-category transaction count + summed amount (all-time), for the Categories
 * list. Pure: feed it live-query rows. Skips deleted and uncategorised rows.
 */
export function aggregateByCategory(txns: TxnRow[]): Map<number, CategoryAgg> {
  const byId = new Map<number, CategoryAgg>();
  for (const txn of txns) {
    if (txn.isDeleted || txn.categoryId == null) continue;
    const entry = byId.get(txn.categoryId) ?? { count: 0, total: "0" };
    entry.count += 1;
    entry.total = add(entry.total, txn.amount);
    byId.set(txn.categoryId, entry);
  }
  return byId;
}
