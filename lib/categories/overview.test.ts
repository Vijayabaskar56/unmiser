import { describe, expect, it } from "vitest";

import { aggregateByCategory } from "@/lib/categories/overview";

describe("aggregateByCategory", () => {
  it("sums amount and counts non-deleted transactions per category", () => {
    const txns = [
      { categoryId: 1, amount: "100.00", isDeleted: false },
      { categoryId: 1, amount: "50.50", isDeleted: false },
      { categoryId: 2, amount: "9.00", isDeleted: false },
      { categoryId: 1, amount: "999.00", isDeleted: true }, // ignored
    ];
    const m = aggregateByCategory(txns);
    expect(m.get(1)).toEqual({ count: 2, total: "150.5" });
    expect(m.get(2)).toEqual({ count: 1, total: "9" });
  });

  it("skips transactions with no category", () => {
    const m = aggregateByCategory([{ categoryId: null, amount: "5.00", isDeleted: false }]);
    expect(m.size).toBe(0);
  });

  it("is empty for no transactions", () => {
    expect(aggregateByCategory([]).size).toBe(0);
  });
});
