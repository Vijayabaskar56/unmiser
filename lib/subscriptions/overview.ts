/**
 * Pure derivations for the Subscriptions list header + rows. Plain inputs, no
 * DB/React, so they unit-test without a device.
 */
import Decimal from "decimal.js";

import { monthlyEquivalent } from "@/lib/subscriptions/matching";

const MS_PER_DAY = 86_400_000;

function atMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole days from `today` to an ISO date (`yyyy-mm-dd`); negative if in the past. */
export function daysUntil(dateIso: string, today: Date): number {
  const target = new Date(`${dateIso}T00:00:00`).getTime();
  return Math.round((target - atMidnight(today)) / MS_PER_DAY);
}

/** True when a payment falls between today and `withinDays` from now (inclusive). */
export function isDueSoon(
  dateIso: string | null | undefined,
  today: Date,
  withinDays = 7,
): boolean {
  if (!dateIso) return false;
  const days = daysUntil(dateIso, today);
  return days >= 0 && days <= withinDays;
}

/** Sum of the monthly-equivalent cost across the given rows, as a fixed(2) string. */
export function monthlyTotal(rows: { amount: string; billingCycle?: string | null }[]): string {
  return rows
    .reduce((sum, row) => sum.plus(monthlyEquivalent(row.amount, row.billingCycle)), new Decimal(0))
    .toFixed(2);
}

interface PartitionRow {
  state: string;
  nextPaymentDate?: string | null;
}

/** Split rows into active / hidden, and the active rows due within `upcomingDays`. */
export function partitionSubscriptions<T extends PartitionRow>(
  rows: T[],
  today: Date,
  upcomingDays = 30,
): { active: T[]; hidden: T[]; upcoming: T[] } {
  const active = rows.filter((r) => r.state === "ACTIVE");
  const hidden = rows.filter((r) => r.state === "HIDDEN");
  const upcoming = active.filter((r) => {
    if (!r.nextPaymentDate) return false;
    const days = daysUntil(r.nextPaymentDate, today);
    return days >= 0 && days <= upcomingDays;
  });
  return { active, hidden, upcoming };
}
