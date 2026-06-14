import { add } from "@/lib/money";

/**
 * Pure derivations for the profile "Financial Overview". They take plain rows in
 * and return numbers/strings out — no DB, no React — so the screen can feed them
 * live-query results and they stay unit-testable.
 *
 * Multi-currency: callers pass a `convert(amount, fromCurrency)` that returns the
 * amount in the base (display) currency. Tests pass identity; the screen wires a
 * real exchange-rate converter (falling back to identity when a rate is missing,
 * mirroring the accounts screen).
 */
export type Convert = (amount: string, fromCurrency: string) => string;

interface AccountRow {
  id: number;
  currency: string;
}
interface BalanceRow {
  accountId: number;
  balance: string;
  timestamp: string;
}
interface TxnRow {
  transactionType: string;
  amount: string;
  dateTime: string;
  isDeleted: boolean;
  currency: string;
}
interface SubRow {
  state: string;
  nextPaymentDate: string | null;
}

/** Latest balance reading per account (newest timestamp wins). */
export function latestBalanceByAccount(rows: BalanceRow[]): Map<number, string> {
  const latest = new Map<number, { balance: string; timestamp: string }>();
  for (const row of rows) {
    const prev = latest.get(row.accountId);
    if (!prev || row.timestamp > prev.timestamp) {
      latest.set(row.accountId, { balance: row.balance, timestamp: row.timestamp });
    }
  }
  const out = new Map<number, string>();
  for (const [id, { balance }] of latest) out.set(id, balance);
  return out;
}

/** Net worth = Σ latest balance per account, each converted to base currency. */
export function netWorth(accounts: AccountRow[], balances: BalanceRow[], convert: Convert): string {
  const latest = latestBalanceByAccount(balances);
  let total = "0";
  for (const account of accounts) {
    const balance = latest.get(account.id);
    if (balance === undefined) continue;
    total = add(total, convert(balance, account.currency));
  }
  return total;
}

function isSameMonth(dateTime: string, now: Date): boolean {
  const d = new Date(dateTime);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Σ amounts of the given type in the current calendar month, in base currency. */
export function monthTotal(txns: TxnRow[], type: string, now: Date, convert: Convert): string {
  let total = "0";
  for (const txn of txns) {
    if (txn.isDeleted) continue;
    if (txn.transactionType !== type) continue;
    if (!isSameMonth(txn.dateTime, now)) continue;
    total = add(total, convert(txn.amount, txn.currency));
  }
  return total;
}

/** Count of ACTIVE subscriptions due within `days` (default 30) of `now`. */
export function upcomingSubscriptionCount(subs: SubRow[], now: Date, days = 30): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const limit = new Date(start);
  limit.setDate(limit.getDate() + days);
  return subs.filter((sub) => {
    if (sub.state !== "ACTIVE" || !sub.nextPaymentDate) return false;
    const date = new Date(`${sub.nextPaymentDate}T00:00:00`);
    return date >= start && date <= limit;
  }).length;
}

/** Count of non-deleted transactions. */
export function transactionCount(txns: { isDeleted: boolean }[]): number {
  return txns.filter((t) => !t.isDeleted).length;
}

/** Inclusive count of calendar months from the earliest non-deleted txn to now. */
export function monthsTracked(txns: { dateTime: string; isDeleted: boolean }[], now: Date): number {
  let earliest: Date | null = null;
  for (const txn of txns) {
    if (txn.isDeleted) continue;
    const d = new Date(txn.dateTime);
    if (!earliest || d < earliest) earliest = d;
  }
  if (!earliest) return 0;
  const months =
    (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1;
  return Math.max(1, months);
}
