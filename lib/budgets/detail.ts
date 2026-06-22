import Decimal from "decimal.js";

import type { Budget, BudgetCategoryLimit, Transaction } from "@/db/schema";
import { addPeriod, endOfPeriod, isWithin, nowIso, startOfPeriod } from "@/lib/dates";
import { currentBudgetWindow } from "@/lib/budgets/progress";

/** Mono ramp (ink → light grey) + accent, cycled for pie slices. */
export const COMPOSITION_PALETTE = ["#15140f", "#e9e83f", "#6f6d63", "#a8a69a", "#cfcdc2"];

export interface CompositionSlice {
  label: string;
  value: number;
  amount: string;
  color: string;
}

/**
 * "Where did it go" — spend within the budget's current window grouped by
 * merchant, biggest first, capped at `topN` with the remainder folded into an
 * "Other" slice. Drives the detail-screen pie.
 */
export function spendComposition(input: {
  budget: Budget;
  limits: BudgetCategoryLimit[];
  transactions: Transaction[];
  topN?: number;
  at?: string;
}): CompositionSlice[] {
  const topN = input.topN ?? 4;
  const at = input.at ?? nowIso();
  const window = currentBudgetWindow(input.budget, at);
  const categoryIds = new Set(input.limits.map((l) => l.categoryId));

  const byMerchant = new Map<string, Decimal>();
  for (const txn of input.transactions) {
    if (txn.isDeleted || txn.transactionType !== "EXPENSE") continue;
    if (txn.currency !== input.budget.currency) continue;
    if (!isWithin(txn.dateTime, window.start, window.end)) continue;
    if (categoryIds.size > 0 && !categoryIds.has(txn.categoryId)) continue;
    const key = txn.merchantName || "Unknown";
    byMerchant.set(key, (byMerchant.get(key) ?? new Decimal(0)).plus(txn.amount || "0"));
  }

  const sorted = [...byMerchant.entries()].sort((a, b) => b[1].comparedTo(a[1]));
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);

  const slices: CompositionSlice[] = head.map(([label, amount], i) => ({
    label,
    value: amount.toNumber(),
    amount: amount.toFixed(2),
    color: COMPOSITION_PALETTE[i % COMPOSITION_PALETTE.length],
  }));

  if (tail.length > 0) {
    const rest = tail.reduce((sum, [, amount]) => sum.plus(amount), new Decimal(0));
    slices.push({
      label: "Other",
      value: rest.toNumber(),
      amount: rest.toFixed(2),
      color: COMPOSITION_PALETTE[Math.min(head.length, COMPOSITION_PALETTE.length - 1)],
    });
  }

  return slices;
}

export interface HistoryMonth {
  /** Short month label, e.g. "Jun". */
  label: string;
  /** ISO date inside that month (period start). */
  monthIso: string;
  spent: string;
  limit: string;
  percent: number;
  isCurrent: boolean;
  over: boolean;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Trailing `months` of spend for this budget's categories, oldest → newest, each
 * month measured against the budget's current limit. Drives the history bars.
 */
export function monthlyHistory(input: {
  budget: Budget;
  limits: BudgetCategoryLimit[];
  transactions: Transaction[];
  months?: number;
  at?: string;
}): HistoryMonth[] {
  const months = input.months ?? 6;
  const at = input.at ?? nowIso();
  const categoryIds = new Set(input.limits.map((l) => l.categoryId));
  const limit = input.limits
    .reduce((sum, l) => sum.plus(l.limitAmount || "0"), new Decimal(0))
    .toFixed(2);

  const out: HistoryMonth[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const anchor = addPeriod(at, "MONTHLY", -back);
    const start = startOfPeriod(anchor, "MONTHLY");
    const end = endOfPeriod(anchor, "MONTHLY");
    const spent = input.transactions
      .filter((txn) => {
        if (txn.isDeleted || txn.transactionType !== "EXPENSE") return false;
        if (txn.currency !== input.budget.currency) return false;
        if (!isWithin(txn.dateTime, start, end)) return false;
        return categoryIds.size === 0 || categoryIds.has(txn.categoryId);
      })
      .reduce((sum, txn) => sum.plus(txn.amount || "0"), new Decimal(0));

    const percent = new Decimal(limit).isZero()
      ? 0
      : Math.round(spent.dividedBy(limit).times(100).toNumber());
    out.push({
      label: MONTH_LABELS[new Date(start).getMonth()],
      monthIso: start,
      spent: spent.toFixed(2),
      limit,
      percent,
      isCurrent: back === 0,
      over: percent >= 100,
    });
  }
  return out;
}
