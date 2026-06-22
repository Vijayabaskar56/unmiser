import { describe, expect, it } from "vitest";

import { budgetImpact, pacingProjection } from "@/lib/budgets/pacing";

describe("pacingProjection", () => {
  it("flags a burn rate that projects over the limit while today is still under", () => {
    // Half the month elapsed, ₹6k of ₹10k spent → projects ₹12k → over.
    const p = pacingProjection({
      spent: "6000.00",
      limit: "10000.00",
      windowStart: "2026-06-01T00:00:00",
      windowEnd: "2026-06-30T23:59:59",
      at: "2026-06-15T12:00:00",
    });
    expect(p.projectedOver).toBe(true);
    expect(Number(p.projectedSpend)).toBeGreaterThan(11000);
    expect(Number(p.projectedOverBy)).toBeGreaterThan(1000);
  });

  it("stays on pace when the burn rate lands under the limit", () => {
    const p = pacingProjection({
      spent: "3000.00",
      limit: "10000.00",
      windowStart: "2026-06-01T00:00:00",
      windowEnd: "2026-06-30T23:59:59",
      at: "2026-06-15T12:00:00",
    });
    expect(p.projectedOver).toBe(false);
    expect(p.projectedOverBy).toBe("0.00");
  });
});

describe("budgetImpact", () => {
  it("computes the post-spend percent and exceed flag", () => {
    const i = budgetImpact({ currentSpent: "21747.00", newAmount: "5000.00", limit: "25000.00" });
    expect(i.spentAfter).toBe("26747.00");
    expect(i.willExceed).toBe(true);
    expect(i.percentAfter).toBe(107);
    expect(i.remainingAfter).toBe("0.00");
  });

  it("reports remaining headroom when under", () => {
    const i = budgetImpact({ currentSpent: "10000.00", newAmount: "2000.00", limit: "25000.00" });
    expect(i.willExceed).toBe(false);
    expect(i.percentAfter).toBe(48);
    expect(i.remainingAfter).toBe("13000.00");
  });
});
