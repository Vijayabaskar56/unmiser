import { describe, expect, it } from "vitest";

import {
  daysUntil,
  isDueSoon,
  monthlyTotal,
  partitionSubscriptions,
} from "@/lib/subscriptions/overview";

const today = new Date("2026-06-14T00:00:00");

describe("daysUntil", () => {
  it("counts whole days from today to a future date", () => {
    expect(daysUntil("2026-06-20", today)).toBe(6);
  });

  it("is 0 for today", () => {
    expect(daysUntil("2026-06-14", today)).toBe(0);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-06-10", today)).toBe(-4);
  });
});

describe("isDueSoon", () => {
  it("is true within the default 7-day window", () => {
    expect(isDueSoon("2026-06-20", today)).toBe(true);
  });

  it("is false beyond the window", () => {
    expect(isDueSoon("2026-06-25", today)).toBe(false);
  });

  it("is false for a past date", () => {
    expect(isDueSoon("2026-06-10", today)).toBe(false);
  });

  it("is false when there is no date", () => {
    expect(isDueSoon(null, today)).toBe(false);
    expect(isDueSoon(undefined, today)).toBe(false);
  });
});

describe("monthlyTotal", () => {
  it("sums the monthly-equivalent of all rows", () => {
    // 1500/mo + 1200/yr (=100/mo) = 1600.00
    const rows = [
      { amount: "1500", billingCycle: "monthly" },
      { amount: "1200", billingCycle: "yearly" },
    ];
    expect(monthlyTotal(rows)).toBe("1600.00");
  });

  it("is 0.00 for no rows", () => {
    expect(monthlyTotal([])).toBe("0.00");
  });
});

describe("partitionSubscriptions", () => {
  const rows = [
    { state: "ACTIVE", nextPaymentDate: "2026-06-20", amount: "100", billingCycle: "monthly" }, // upcoming
    { state: "ACTIVE", nextPaymentDate: "2026-08-01", amount: "100", billingCycle: "monthly" }, // active, not upcoming
    { state: "ACTIVE", nextPaymentDate: null, amount: "100", billingCycle: "monthly" }, // active, no date
    { state: "HIDDEN", nextPaymentDate: "2026-06-18", amount: "100", billingCycle: "monthly" }, // hidden
  ];

  it("splits active and hidden by state", () => {
    const { active, hidden } = partitionSubscriptions(rows, today);
    expect(active).toHaveLength(3);
    expect(hidden).toHaveLength(1);
  });

  it("collects active rows due within the upcoming window", () => {
    const { upcoming } = partitionSubscriptions(rows, today, 30);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].nextPaymentDate).toBe("2026-06-20");
  });

  it("excludes hidden rows from upcoming even if due soon", () => {
    const { upcoming } = partitionSubscriptions(rows, today, 30);
    expect(upcoming.every((r) => r.state === "ACTIVE")).toBe(true);
  });
});
