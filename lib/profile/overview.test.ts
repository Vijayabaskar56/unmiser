import { describe, expect, it } from "vitest";

import {
  monthTotal,
  monthsTracked,
  netWorth,
  transactionCount,
  upcomingSubscriptionCount,
} from "@/lib/profile/overview";

// Identity converter: treat every balance/amount as already in the base currency.
const identity = (amount: string) => amount;

describe("netWorth", () => {
  it("sums the latest balance per account", () => {
    const accounts = [
      { id: 1, currency: "INR" },
      { id: 2, currency: "INR" },
    ];
    const balances = [
      { accountId: 1, balance: "100.00", timestamp: "2026-01-01T00:00:00" },
      { accountId: 1, balance: "150.00", timestamp: "2026-02-01T00:00:00" }, // newer wins
      { accountId: 2, balance: "50.00", timestamp: "2026-01-15T00:00:00" },
    ];
    expect(netWorth(accounts, balances, identity)).toBe("200");
  });

  it("is zero with no accounts or balances", () => {
    expect(netWorth([], [], identity)).toBe("0");
  });

  it("converts each account's balance from its own currency to base", () => {
    const accounts = [
      { id: 1, currency: "INR" },
      { id: 2, currency: "USD" },
    ];
    const balances = [
      { accountId: 1, balance: "100.00", timestamp: "2026-01-01T00:00:00" },
      { accountId: 2, balance: "10.00", timestamp: "2026-01-01T00:00:00" },
    ];
    // USD balances get multiplied by 80, INR passes through.
    const convert = (amount: string, ccy: string) =>
      ccy === "USD" ? String(Number(amount) * 80) : amount;
    expect(netWorth(accounts, balances, convert)).toBe("900");
  });
});

describe("monthTotal", () => {
  const now = new Date("2026-06-14T12:00:00");
  const txns = [
    {
      transactionType: "EXPENSE",
      amount: "30.00",
      dateTime: "2026-06-02T10:00:00",
      isDeleted: false,
      currency: "INR",
    },
    {
      transactionType: "EXPENSE",
      amount: "20.00",
      dateTime: "2026-06-20T10:00:00",
      isDeleted: false,
      currency: "INR",
    },
    {
      transactionType: "INCOME",
      amount: "500.00",
      dateTime: "2026-06-01T10:00:00",
      isDeleted: false,
      currency: "INR",
    },
    {
      transactionType: "EXPENSE",
      amount: "99.00",
      dateTime: "2026-05-30T10:00:00",
      isDeleted: false,
      currency: "INR",
    }, // prior month
    {
      transactionType: "EXPENSE",
      amount: "11.00",
      dateTime: "2026-06-05T10:00:00",
      isDeleted: true,
      currency: "INR",
    }, // deleted
  ];

  it("sums expenses in the current calendar month, excluding deleted and other months", () => {
    expect(monthTotal(txns, "EXPENSE", now, identity)).toBe("50");
  });

  it("sums income in the current calendar month", () => {
    expect(monthTotal(txns, "INCOME", now, identity)).toBe("500");
  });

  it("is zero when nothing matches", () => {
    expect(monthTotal([], "EXPENSE", now, identity)).toBe("0");
  });
});

describe("upcomingSubscriptionCount", () => {
  const now = new Date("2026-06-14T00:00:00");

  it("counts ACTIVE subs due within the next 30 days", () => {
    const subs = [
      { state: "ACTIVE", nextPaymentDate: "2026-06-20" }, // in window
      { state: "ACTIVE", nextPaymentDate: "2026-07-10" }, // in window (26 days)
      { state: "ACTIVE", nextPaymentDate: "2026-08-01" }, // beyond 30 days
      { state: "ACTIVE", nextPaymentDate: "2026-06-01" }, // already past
      { state: "HIDDEN", nextPaymentDate: "2026-06-18" }, // not active
      { state: "ACTIVE", nextPaymentDate: null }, // no date
    ];
    expect(upcomingSubscriptionCount(subs, now)).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(upcomingSubscriptionCount([], now)).toBe(0);
  });
});

describe("transactionCount", () => {
  it("counts non-deleted transactions", () => {
    const txns = [{ isDeleted: false }, { isDeleted: false }, { isDeleted: true }];
    expect(transactionCount(txns)).toBe(2);
  });
});

describe("monthsTracked", () => {
  const now = new Date("2026-06-14T00:00:00");

  it("counts inclusive calendar months from the earliest transaction", () => {
    const txns = [
      { dateTime: "2025-10-05T00:00:00", isDeleted: false }, // earliest → Oct '25..Jun '26 = 9
      { dateTime: "2026-03-05T00:00:00", isDeleted: false },
    ];
    expect(monthsTracked(txns, now)).toBe(9);
  });

  it("ignores deleted transactions when finding the earliest", () => {
    const txns = [
      { dateTime: "2024-01-01T00:00:00", isDeleted: true },
      { dateTime: "2026-06-01T00:00:00", isDeleted: false },
    ];
    expect(monthsTracked(txns, now)).toBe(1);
  });

  it("is zero with no transactions", () => {
    expect(monthsTracked([], now)).toBe(0);
  });
});
