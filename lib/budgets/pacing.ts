import Decimal from "decimal.js";

import { nowIso } from "@/lib/dates";

/**
 * Pillar-2 behavior signals derived from a budget's spend so far. Two cheap,
 * high-impact nudges (ROADMAP §4):
 *
 * - {@link pacingProjection} — loss-aversion "Budget Pacing Alert": extrapolate
 *   the current burn rate to the end of the period and warn when that projection
 *   blows the limit, even while today's spend is still under it.
 * - {@link budgetImpact} — choice-architecture "Pre-Spend Nudge": what a pending
 *   amount would do to a category's budget, shown before the user commits.
 */

export interface PacingProjection {
  /** Fraction of the window elapsed, 0–1. */
  fractionElapsed: number;
  /** Spend per day at the current rate. */
  burnRate: string;
  /** Spend extrapolated to the end of the window at the current rate. */
  projectedSpend: string;
  /** Projected end-of-period spend exceeds the limit. */
  projectedOver: boolean;
  /** How much the projection overshoots the limit (0 when on pace). */
  projectedOverBy: string;
}

/**
 * Burn-rate projection for a budget window. `projectedSpend = spent / elapsed`
 * fraction — i.e. "keep spending at this rate and you'll land here". Only
 * meaningful once a little of the window has elapsed and something is spent.
 */
export function pacingProjection(input: {
  spent: string;
  limit: string;
  windowStart: string;
  windowEnd: string;
  at?: string;
}): PacingProjection {
  const at = input.at ?? nowIso();
  const start = new Date(input.windowStart).getTime();
  const end = new Date(input.windowEnd).getTime();
  const now = new Date(at).getTime();

  const totalMs = Math.max(0, end - start);
  const elapsedMs = Math.min(Math.max(0, now - start), totalMs);
  const fractionElapsed = totalMs === 0 ? 1 : elapsedMs / totalMs;

  const spent = new Decimal(input.spent || "0");
  const limit = new Decimal(input.limit || "0");

  // Too early to extrapolate (no time elapsed) → projection is just spend so far.
  const projected = fractionElapsed <= 0 ? spent : spent.dividedBy(fractionElapsed);
  const elapsedDays = elapsedMs / 86_400_000;
  const burnRate = elapsedDays <= 0 ? spent : spent.dividedBy(elapsedDays);

  const projectedOverBy = Decimal.max(projected.minus(limit), 0);

  return {
    fractionElapsed,
    burnRate: burnRate.toFixed(2),
    projectedSpend: projected.toFixed(2),
    projectedOver: !limit.isZero() && projected.greaterThan(limit),
    projectedOverBy: projectedOverBy.toFixed(2),
  };
}

export interface BudgetImpact {
  /** Spend after the pending amount lands. */
  spentAfter: string;
  /** Percent of the limit used after the pending amount, 0–999 (rounded). */
  percentAfter: number;
  /** The pending amount pushes the category over its limit. */
  willExceed: boolean;
  /** Remaining headroom after the amount (0 when it exceeds). */
  remainingAfter: string;
}

/**
 * What a pending spend would do to a category's budget — the Pre-Spend Nudge.
 * Pure: caller supplies the matching budget's current spend + limit.
 */
export function budgetImpact(input: {
  currentSpent: string;
  newAmount: string;
  limit: string;
}): BudgetImpact {
  const spentAfter = new Decimal(input.currentSpent || "0").plus(input.newAmount || "0");
  const limit = new Decimal(input.limit || "0");
  const percentAfter = limit.isZero()
    ? 0
    : Math.round(Decimal.min(spentAfter.dividedBy(limit).times(100), 999).toNumber());
  const remainingAfter = Decimal.max(limit.minus(spentAfter), 0);
  return {
    spentAfter: spentAfter.toFixed(2),
    percentAfter,
    willExceed: !limit.isZero() && spentAfter.greaterThan(limit),
    remainingAfter: remainingAfter.toFixed(2),
  };
}
