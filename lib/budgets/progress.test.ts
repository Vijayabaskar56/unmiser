import { describe, expect, it } from "vitest";

import type { Budget, BudgetCategoryLimit, Category, Transaction } from "@/db/schema";
import { buildBudgetProgress } from "@/lib/budgets/progress";

const budget: Budget = {
  id: 1,
  name: "Food",
  amount: "1000.00",
  year: 2026,
  month: 6,
  currency: "INR",
  isActive: true,
  createdAt: "2026-06-01T00:00:00",
  updatedAt: "2026-06-01T00:00:00",
  startDate: "2026-06-01T00:00:00",
  endDate: "2026-06-30T23:59:59",
  periodType: "MONTHLY",
  trackType: "ALL_TRANSACTIONS",
  budgetType: "EXPENSE",
  accountIds: "",
  color: "#15140f",
  isSample: false,
};

const category: Category = {
  id: 10,
  name: "Food",
  color: "#15140f",
  iconResId: 0,
  iconName: "",
  description: "",
  isSystem: true,
  isIncome: false,
  displayOrder: 1,
  seedKey: "food",
  createdAt: "2026-06-01T00:00:00",
  updatedAt: "2026-06-01T00:00:00",
};

const limit: BudgetCategoryLimit = {
  id: 100,
  budgetId: 1,
  categoryId: 10,
  categoryName: "Food",
  limitAmount: "1000.00",
  createdAt: "2026-06-01T00:00:00",
  updatedAt: "2026-06-01T00:00:00",
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
  };
}

describe("buildBudgetProgress", () => {
  it("sums matching expense transactions inside the active period", () => {
    const rows = buildBudgetProgress({
      budgets: [budget],
      limits: [limit],
      categories: [category],
      transactions: [
        txn({ id: 1, amount: "250.00" }),
        txn({ id: 2, amount: "150.00", transactionHash: "hash-2" }),
        txn({ id: 3, amount: "999.00", categoryId: 99, transactionHash: "hash-3" }),
        txn({
          id: 4,
          amount: "999.00",
          dateTime: "2026-05-10T12:00:00",
          transactionHash: "hash-4",
        }),
        txn({ id: 5, amount: "999.00", transactionType: "INCOME", transactionHash: "hash-5" }),
      ],
      at: "2026-06-15T12:00:00",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].spent).toBe("400.00");
    expect(rows[0].remaining).toBe("600.00");
    expect(rows[0].percentUsed).toBe(40);
    expect(rows[0].recommendedDailySpending).toBe("37.50");
  });

  it("marks over-limit budgets", () => {
    const rows = buildBudgetProgress({
      budgets: [budget],
      limits: [limit],
      categories: [category],
      transactions: [txn({ amount: "1200.00" })],
      at: "2026-06-15T12:00:00",
    });

    expect(rows[0].remaining).toBe("0.00");
    expect(rows[0].status).toBe("over");
  });
});
