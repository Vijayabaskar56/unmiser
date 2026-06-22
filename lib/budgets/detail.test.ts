import { describe, expect, it } from "vitest";

import type { Budget, BudgetCategoryLimit, Transaction } from "@/db/schema";
import { monthlyHistory, spendComposition } from "@/lib/budgets/detail";

const budget: Budget = {
  id: 1,
  name: "Food",
  amount: "8000.00",
  year: 2026,
  month: 6,
  currency: "INR",
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: "2026-01-01T00:00:00",
  startDate: "2026-06-01T00:00:00",
  endDate: "2026-06-30T23:59:59",
  periodType: "MONTHLY",
  trackType: "ALL_TRANSACTIONS",
  budgetType: "EXPENSE",
  accountIds: "",
  color: "#15140f",
  isSample: false,
};

const limit: BudgetCategoryLimit = {
  id: 100,
  budgetId: 1,
  categoryId: 10,
  categoryName: "Food",
  limitAmount: "8000.00",
  createdAt: "2026-01-01T00:00:00",
  updatedAt: "2026-01-01T00:00:00",
};

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    amount: "250.00",
    merchantName: "Shop",
    categoryId: 10,
    subcategoryId: null,
    categoryName: null,
    subcategoryName: null,
    transactionType: "EXPENSE",
    paymentMethod: null,
    parseConfidence: null,
    dateTime: "2026-06-10T12:00:00",
    description: null,
    smsBody: null,
    bankName: null,
    smsSender: null,
    accountId: null,
    accountNumber: null,
    balanceAfter: null,
    transactionHash: "hash",
    sourceType: "MANUAL",
    sourcePluginId: null,
    sourcePluginVersion: null,
    sourceReceivedAt: null,
    isRecurring: false,
    subscriptionId: null,
    isDeleted: false,
    createdAt: "2026-06-10T12:00:00",
    updatedAt: "2026-06-10T12:00:00",
    currency: "INR",
    fromAccount: null,
    toAccount: null,
    billingCycle: null,
    attachments: "",
    isSample: false,
    flagged: false,
    ...overrides,
  } as Transaction;
}

describe("spendComposition", () => {
  it("groups in-window spend by merchant, biggest first, folding the rest into Other", () => {
    const slices = spendComposition({
      budget,
      limits: [limit],
      topN: 2,
      at: "2026-06-15T12:00:00",
      transactions: [
        txn({ id: 1, merchantName: "Swiggy", amount: "480.00" }),
        txn({ id: 2, merchantName: "Dominos", amount: "650.00", transactionHash: "h2" }),
        txn({ id: 3, merchantName: "Zomato", amount: "100.00", transactionHash: "h3" }),
        txn({ id: 4, merchantName: "ThirdWave", amount: "50.00", transactionHash: "h4" }),
        // out of window / wrong category — excluded
        txn({ id: 5, merchantName: "Old", amount: "999.00", dateTime: "2026-05-01T12:00:00" }),
        txn({ id: 6, merchantName: "Other cat", amount: "999.00", categoryId: 99 }),
      ],
    });

    expect(slices.map((s) => s.label)).toEqual(["Dominos", "Swiggy", "Other"]);
    expect(slices[0].amount).toBe("650.00");
    expect(slices[2].amount).toBe("150.00");
  });
});

describe("monthlyHistory", () => {
  it("returns trailing months oldest→newest with the current month flagged", () => {
    const rows = monthlyHistory({
      budget,
      limits: [limit],
      months: 3,
      at: "2026-06-15T12:00:00",
      transactions: [
        txn({ id: 1, amount: "8640.00", dateTime: "2026-05-10T12:00:00" }), // over
        txn({ id: 2, amount: "4000.00", dateTime: "2026-06-10T12:00:00" }), // current, under
      ],
    });

    expect(rows.map((r) => r.label)).toEqual(["Apr", "May", "Jun"]);
    expect(rows[1].over).toBe(true);
    expect(rows[2].isCurrent).toBe(true);
    expect(rows[2].spent).toBe("4000.00");
    expect(rows[2].percent).toBe(50);
  });
});
