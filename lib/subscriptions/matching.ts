import Decimal from "decimal.js";

import { advanceDate, cyclesPerMonth, parseBillingCycle } from "@/lib/subscriptions/billing-cycle";
import type { MandateInfo } from "@/lib/parser/types";

export function normalizeSubscriptionMerchant(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAmount(value: string): string {
  return new Decimal(value.replaceAll(",", "")).toFixed(2);
}

export function fallbackSubscriptionIdentity(
  mandate: MandateInfo & { billingCycle?: string | null },
): string {
  return [
    normalizeSubscriptionMerchant(mandate.merchant),
    normalizeAmount(mandate.amount),
    mandate.currency,
    normalizeSubscriptionMerchant(mandate.provider),
    mandate.billingCycle ?? "",
  ].join("|");
}

export function amountWithinTolerance(amount: string, expected: string, tolerance = 0.05): boolean {
  const actual = new Decimal(amount);
  const target = new Decimal(expected);
  if (target.isZero()) return actual.isZero();
  return actual.minus(target).abs().div(target.abs()).lte(tolerance);
}

export function merchantLooksRelated(left: string, right: string): boolean {
  const a = normalizeSubscriptionMerchant(left);
  const b = normalizeSubscriptionMerchant(right);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

export function predictNextPayment(input: {
  mandateNextDate?: string | null;
  lastPaidDate?: string | null;
  billingCycle?: string | null;
  linkedPaymentDates?: string[];
}): string | null {
  if (input.mandateNextDate) return input.mandateNextDate;
  const cycle = parseBillingCycle(input.billingCycle);
  if (input.lastPaidDate && cycle) return advanceDate(input.lastPaidDate, cycle);

  const dates = [...(input.linkedPaymentDates ?? [])].sort();
  if (dates.length < 2) return null;
  const gaps = dates.slice(1).map((date, index) => {
    const left = new Date(`${dates[index]}T00:00:00`).getTime();
    const right = new Date(`${date}T00:00:00`).getTime();
    return Math.round((right - left) / 86_400_000);
  });
  const sortedGaps = gaps.sort((a, b) => a - b);
  const mid = Math.floor(sortedGaps.length / 2);
  const median =
    sortedGaps.length % 2 === 0
      ? Math.round((sortedGaps[mid - 1] + sortedGaps[mid]) / 2)
      : sortedGaps[mid];
  const last = dates.at(-1)!;
  const next = new Date(`${last}T00:00:00`);
  next.setDate(next.getDate() + median);
  return next.toISOString().slice(0, 10);
}

export function monthlyEquivalent(amount: string, billingCycle?: string | null): string {
  return new Decimal(amount).mul(cyclesPerMonth(parseBillingCycle(billingCycle))).toFixed(2);
}
