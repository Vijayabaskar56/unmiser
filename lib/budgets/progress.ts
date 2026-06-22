import Decimal from "decimal.js";

import type { Budget, BudgetCategoryLimit, Category, Transaction } from "@/db/schema";
import type { BudgetPeriod } from "@/db/schema/enums";
import { endOfPeriod, isWithin, nowIso, startOfPeriod } from "@/lib/dates";

export interface BudgetProgress {
  budget: Budget;
  limits: BudgetCategoryLimit[];
  categoryNames: string[];
  spent: string;
  limit: string;
  remaining: string;
  percentUsed: number;
  daysRemaining: number;
  recommendedDailySpending: string;
  status: "calm" | "watch" | "tight" | "over";
}

export function currentBudgetWindow(
  budget: Pick<Budget, "periodType" | "startDate" | "endDate">,
  at: string = nowIso(),
): { start: string; end: string } {
  if (budget.periodType === "CUSTOM") {
    return { start: budget.startDate, end: budget.endDate };
  }
  const period = budget.periodType as Exclude<BudgetPeriod, "CUSTOM">;
  return { start: startOfPeriod(at, period), end: endOfPeriod(at, period) };
}

export function daysRemainingInWindow(endIso: string, atIso: string = nowIso()): number {
  const end = new Date(endIso);
  const at = new Date(atIso);
  if (Number.isNaN(end.getTime()) || Number.isNaN(at.getTime())) return 0;
  const ms = end.getTime() - at.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function buildBudgetProgress(input: {
  budgets: Budget[];
  limits: BudgetCategoryLimit[];
  categories: Category[];
  transactions: Transaction[];
  at?: string;
}): BudgetProgress[] {
  const at = input.at ?? nowIso();
  const categoryNames = new Map(input.categories.map((category) => [category.id, category.name]));
  const limitsByBudget = groupBy(input.limits, (limit) => limit.budgetId);

  return input.budgets
    .filter((budget) => budget.isActive)
    .map((budget) => {
      const limits = limitsByBudget.get(budget.id) ?? [];
      const categoryIds = new Set(limits.map((limit) => limit.categoryId));
      const window = currentBudgetWindow(budget, at);
      const limitTotal = sum(limits.map((limit) => limit.limitAmount || "0"));
      const spent = sum(
        input.transactions
          .filter((txn) => {
            if (txn.isDeleted || txn.currency !== budget.currency) return false;
            if (txn.transactionType !== "EXPENSE") return false;
            if (!isWithin(txn.dateTime, window.start, window.end)) return false;
            return categoryIds.size === 0 || categoryIds.has(txn.categoryId);
          })
          .map((txn) => txn.amount),
      );
      const remaining = Decimal.max(new Decimal(limitTotal).minus(spent), 0);
      const percentUsed = new Decimal(limitTotal).isZero()
        ? 0
        : Decimal.min(new Decimal(spent).dividedBy(limitTotal).times(100), 999).toNumber();
      const daysRemaining = daysRemainingInWindow(window.end, at);
      const recommendedDailySpending =
        daysRemaining <= 0 ? remaining.toFixed(2) : remaining.dividedBy(daysRemaining).toFixed(2);

      return {
        budget,
        limits,
        categoryNames: limits.map(
          (limit) => limit.categoryName ?? categoryNames.get(limit.categoryId) ?? "Category",
        ),
        spent: new Decimal(spent).toFixed(2),
        limit: new Decimal(limitTotal).toFixed(2),
        remaining: remaining.toFixed(2),
        percentUsed: Math.round(percentUsed),
        daysRemaining,
        recommendedDailySpending,
        status: statusFor(percentUsed),
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed || a.budget.name.localeCompare(b.budget.name));
}

function statusFor(percentUsed: number): BudgetProgress["status"] {
  if (percentUsed >= 100) return "over";
  if (percentUsed >= 85) return "tight";
  if (percentUsed >= 65) return "watch";
  return "calm";
}

function sum(values: string[]): string {
  return values.reduce((total, value) => total.plus(value || "0"), new Decimal(0)).toString();
}

function groupBy<T, K>(rows: T[], getKey: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    out.set(key, [...(out.get(key) ?? []), row]);
  }
  return out;
}
