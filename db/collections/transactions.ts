import { eq } from "drizzle-orm";

import { db } from "@/db/index";
import { accountBalances, accounts, type Transaction, transactions } from "@/db/schema";
import { applyTransactionBalance } from "@/db/services/balance-persistence";
import type { TxnType } from "@/lib/balance-service";
import { createDrizzleCollection } from "../collection-factory";

/**
 * TanStack DB collection for transactions — the user-authored entity (ADR-0002).
 *
 * Writes go through the optimistic CRUD layer; the `afterWrite` hook runs the
 * balance cascade (@/db/services/balance-persistence `applyTransactionBalance`)
 * in the same persistence step so account balances re-derive on every write
 * (ADR-0002, ADR-0011). Balances are NEVER a collection — they are a service-
 * recomputed read-projection.
 *
 * Account linkage: `transactions` has no `accountId` column. A transaction's
 * account is the `accountBalances` row already linked to it via
 * `transactionId`; the cascade reads from there and looks up the account's
 * `isCreditCard`. A row with no linked balance reading yet (e.g. the very first
 * optimistic insert, before `addTransaction` has anchored it) cascades to a
 * no-op — the full add-with-account flow lives in @/db/services/transaction-ops.
 */
export const transactionCollection = createDrizzleCollection<Transaction>({
  db,
  table: transactions,
  getKey: (row) => row.id,
  afterWrite: async (ctx) => {
    if (ctx.operation === "delete") return;
    for (const row of ctx.rows) {
      await cascadeForTransaction(row);
    }
  },
});

/**
 * Re-run the balance cascade for one transaction row by resolving its account
 * from the linked `accountBalances` reading. No-op when the transaction has no
 * balance reading yet (the account isn't known at the collection layer).
 */
async function cascadeForTransaction(row: Transaction): Promise<void> {
  const [link] = await db
    .select({ accountId: accountBalances.accountId })
    .from(accountBalances)
    .where(eq(accountBalances.transactionId, row.id));
  if (!link) return;

  const [account] = await db
    .select({ isCreditCard: accounts.isCreditCard })
    .from(accounts)
    .where(eq(accounts.id, link.accountId));
  if (!account) return;

  await applyTransactionBalance(db, {
    accountId: link.accountId,
    transactionId: row.id,
    amount: row.amount,
    transactionType: row.transactionType as TxnType,
    isCreditCard: account.isCreditCard,
    timestamp: row.dateTime,
    explicitBalance: row.balanceAfter ?? null,
    smsSource: row.smsSender ?? null,
    isDeleted: row.isDeleted,
  });
}
