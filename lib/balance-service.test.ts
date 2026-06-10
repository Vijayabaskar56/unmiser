import { describe, it, expect } from "vitest";
import { calculateBalance, recalculateBalancesAfter, type Reading } from "@/lib/balance-service";

function calculatedRow(over: Partial<Reading> & Pick<Reading, "id" | "timestamp">): Reading {
  return {
    balance: "0.00",
    sourceType: "TRANSACTION_CALCULATED",
    transactionId: over.id,
    transactionAmount: null,
    transactionType: null,
    isCreditCard: false,
    ...over,
  };
}

describe("calculateBalance", () => {
  it("adds income to a normal account balance", () => {
    expect(calculateBalance("100.00", "25.50", "INCOME", false)).toBe("125.50");
  });

  it("a credit-card expense increases the amount owed", () => {
    // On a credit card, the balance represents debt; spending adds to it.
    expect(calculateBalance("200.00", "50.00", "EXPENSE", true)).toBe("250.00");
  });

  it("subtracts an expense from a normal account balance", () => {
    expect(calculateBalance("100.00", "30.00", "EXPENSE", false)).toBe("70.00");
  });

  it("a credit-card income (payment) reduces the amount owed", () => {
    expect(calculateBalance("250.00", "100.00", "INCOME", true)).toBe("150.00");
  });

  it("floors a normal expense exceeding the balance at zero", () => {
    expect(calculateBalance("40.00", "60.00", "EXPENSE", false)).toBe("0.00");
  });

  it("floors a credit-card payment exceeding the owed amount at zero", () => {
    expect(calculateBalance("80.00", "100.00", "INCOME", true)).toBe("0.00");
  });

  it("treats INVESTMENT like an expense on a normal account", () => {
    expect(calculateBalance("100.00", "40.00", "INVESTMENT", false)).toBe("60.00");
  });

  it("leaves a normal-account balance unchanged for TRANSFER and CREDIT", () => {
    expect(calculateBalance("100.00", "40.00", "TRANSFER", false)).toBe("100.00");
    expect(calculateBalance("100.00", "40.00", "CREDIT", false)).toBe("100.00");
  });
});

describe("recalculateBalancesAfter", () => {
  it("recomputes a single calculated expense row from the starting balance", () => {
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        balance: "999.99", // stale, must be overwritten
        transactionAmount: "30.00",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "100.00");

    expect(result[0].balance).toBe("70.00");
  });

  it("cascades a chain of calculated rows in order", () => {
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        transactionAmount: "30.00",
        transactionType: "EXPENSE",
      }),
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        transactionAmount: "200.00",
        transactionType: "INCOME",
      }),
      calculatedRow({
        id: 3,
        timestamp: "2026-01-03T10:00:00Z",
        transactionAmount: "70.00",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "100.00");

    expect(result.map((r) => r.balance)).toEqual(["70.00", "270.00", "200.00"]);
  });

  it("carries a MANUAL anchor's stated balance unchanged and folds downstream from it", () => {
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        transactionAmount: "30.00",
        transactionType: "EXPENSE",
      }),
      // User manually states the true balance here — ground truth.
      {
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        balance: "500.00",
        sourceType: "MANUAL",
        transactionId: null,
        transactionAmount: null,
        transactionType: null,
        isCreditCard: false,
      },
      calculatedRow({
        id: 3,
        timestamp: "2026-01-03T10:00:00Z",
        transactionAmount: "100.00",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "100.00");

    // row1 folds from 100 -> 70; anchor stays 500 (NOT recomputed); row3 folds 500 -> 400.
    expect(result.map((r) => r.balance)).toEqual(["70.00", "500.00", "400.00"]);
  });

  it("treats an SMS-stated balance as a ground-truth anchor even with a transaction", () => {
    const readings: Reading[] = [
      // SMS reported the actual post-transaction balance; do not recompute it.
      {
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        balance: "1234.56",
        sourceType: "TRANSACTION_SMS_BALANCE",
        transactionId: 99,
        transactionAmount: "30.00",
        transactionType: "EXPENSE",
        isCreditCard: false,
      },
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        transactionAmount: "34.56",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "0.00");

    expect(result.map((r) => r.balance)).toEqual(["1234.56", "1200.00"]);
  });

  it("propagates an edited past amount forward only within the same anchor segment", () => {
    // Simulates re-folding after editing row 1's amount from 30 -> 50.
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        transactionAmount: "50.00", // edited amount
        transactionType: "EXPENSE",
      }),
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        transactionAmount: "20.00",
        transactionType: "EXPENSE",
      }),
      // Anchor: a stated balance ends the segment; the edit must NOT cross it.
      {
        id: 3,
        timestamp: "2026-01-03T10:00:00Z",
        balance: "777.00",
        sourceType: "MANUAL_EDIT",
        transactionId: null,
        transactionAmount: null,
        transactionType: null,
        isCreditCard: false,
      },
      calculatedRow({
        id: 4,
        timestamp: "2026-01-04T10:00:00Z",
        transactionAmount: "77.00",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "100.00");

    // 100 -50-> 50 -20-> 30 ; anchor 777 unchanged ; 777 -77-> 700
    expect(result.map((r) => r.balance)).toEqual(["50.00", "30.00", "777.00", "700.00"]);
  });

  it("cascades credit-card spend and payment, increasing then reducing owed", () => {
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        transactionAmount: "100.00",
        transactionType: "EXPENSE",
        isCreditCard: true,
      }),
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        transactionAmount: "40.00",
        transactionType: "INCOME",
        isCreditCard: true,
      }),
    ];

    const result = recalculateBalancesAfter(readings, "200.00");

    // owed 200 +100 spend-> 300 ; -40 payment-> 260
    expect(result.map((r) => r.balance)).toEqual(["300.00", "260.00"]);
  });

  it("does not mutate the input readings (pure)", () => {
    const input: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        balance: "999.99",
        transactionAmount: "30.00",
        transactionType: "EXPENSE",
      }),
    ];
    const snapshot = input[0].balance;

    const result = recalculateBalancesAfter(input, "100.00");

    expect(input[0].balance).toBe(snapshot);
    expect(result[0]).not.toBe(input[0]);
  });

  it("returns an empty list unchanged for no readings", () => {
    expect(recalculateBalancesAfter([], "100.00")).toEqual([]);
  });

  it("preserves decimal precision across a long fold", () => {
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        transactionAmount: "0.10",
        transactionType: "INCOME",
      }),
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        transactionAmount: "0.20",
        transactionType: "INCOME",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "0.00");

    // 0.10 + 0.20 = 0.30 exactly (no binary-float drift).
    expect(result.map((r) => r.balance)).toEqual(["0.10", "0.30"]);
  });

  it("anchors a calculated row whose transaction carries a stated balanceAfter", () => {
    // Mirrors the Kotlin anchor disjunct `row.transactionBalanceAfter != null`
    // (AccountBalanceRepository.kt:181): an SMS-stated post-transaction balance is
    // ground truth and must be CARRIED (not recomputed), even when the balance row's
    // sourceType is TRANSACTION_CALCULATED — and it re-seeds the running balance for
    // the rest of the anchor segment.
    const readings: Reading[] = [
      calculatedRow({
        id: 1,
        timestamp: "2026-01-01T10:00:00Z",
        balance: "5000.00",
        transactionBalanceAfter: "5000.00",
        transactionAmount: "200.00", // would recompute to 800.00 (1000-200) if NOT anchored
        transactionType: "EXPENSE",
      }),
      calculatedRow({
        id: 2,
        timestamp: "2026-01-02T10:00:00Z",
        balance: "0.00",
        transactionAmount: "100.00",
        transactionType: "EXPENSE",
      }),
    ];

    const result = recalculateBalancesAfter(readings, "1000.00");

    // Row 1 is carried as ground truth, NOT recomputed to 800.00.
    expect(result[0].balance).toBe("5000.00");
    // Row 2 recomputes from the anchored 5000.00 (5000 - 100), not from 1000.
    expect(result[1].balance).toBe("4900.00");
  });
});
