import { describe, expect, it } from "vitest";

import {
  add,
  compare,
  formatCompact,
  isZero,
  multiply,
  negate,
  format,
  normalize2dp,
  subtract,
} from "@/lib/money";

describe("money — float-free precision", () => {
  it("adds 0.1 + 0.2 to exactly 0.3 with no binary float drift", () => {
    expect(add("0.1", "0.2")).toBe("0.3");
  });

  it("subtracts without float drift (0.3 - 0.1 -> 0.2)", () => {
    expect(subtract("0.3", "0.1")).toBe("0.2");
  });
});

describe("money — multiply rounds HALF_EVEN to 2dp", () => {
  it("rounds a tie down to the even neighbour (2.125 -> 2.12)", () => {
    expect(multiply("2.125", "1")).toBe("2.12");
  });

  it("rounds a tie up to the even neighbour (2.135 -> 2.14)", () => {
    expect(multiply("2.135", "1")).toBe("2.14");
  });

  it("accepts a numeric factor (10.00 * 3 -> 30.00)", () => {
    expect(multiply("10.00", 3)).toBe("30.00");
  });
});

describe("money — sign and comparison", () => {
  it("negates a positive amount", () => {
    expect(negate("12.50")).toBe("-12.5");
  });

  it("negates a negative amount back to positive", () => {
    expect(negate("-12.50")).toBe("12.5");
  });

  it("compares less-than as -1", () => {
    expect(compare("1.00", "2.00")).toBe(-1);
  });

  it("compares greater-than as 1", () => {
    expect(compare("2.00", "1.00")).toBe(1);
  });

  it("treats differently-scaled equal amounts as 0", () => {
    expect(compare("1000", "1000.00")).toBe(0);
  });

  it("reports zero regardless of scale", () => {
    expect(isZero("0")).toBe(true);
    expect(isZero("0.00")).toBe(true);
    expect(isZero("0.01")).toBe(false);
  });
});

describe("money — normalize2dp (canonical dedup hash form)", () => {
  it("renders 1000 and 1000.00 to the same canonical string", () => {
    expect(normalize2dp("1000")).toBe("1000.00");
    expect(normalize2dp("1000.00")).toBe("1000.00");
  });

  it("rounds extra precision to 2dp with HALF_EVEN (2.125 -> 2.12)", () => {
    expect(normalize2dp("2.125")).toBe("2.12");
  });
});

describe("money — format: USD Western thousands grouping", () => {
  it("groups thousands and shows 2 decimals with the $ symbol", () => {
    expect(format("1234567.5", "USD")).toBe("$1,234,567.50");
  });

  it("formats small amounts without grouping", () => {
    expect(format("9.99", "USD")).toBe("$9.99");
  });

  it("prefixes negatives with a minus before the symbol", () => {
    expect(format("-1234.5", "USD")).toBe("-$1,234.50");
  });
});

describe("money — format: INR lakh/crore grouping", () => {
  it("groups with the Indian system (12,34,567.50) and ₹ symbol", () => {
    expect(format("1234567.5", "INR")).toBe("₹12,34,567.50");
  });

  it("does not group below one thousand", () => {
    expect(format("999.5", "INR")).toBe("₹999.50");
  });

  it("groups a crore-scale amount (1,23,45,678.00)", () => {
    expect(format("12345678", "INR")).toBe("₹1,23,45,678.00");
  });
});

describe("money — format: zero-decimal currency (JPY)", () => {
  it("shows no decimal point and Western grouping", () => {
    expect(format("1234567", "JPY")).toBe("¥1,234,567");
  });

  it("rounds a fractional input to whole yen HALF_EVEN (2500.5 -> 2500)", () => {
    expect(format("2500.5", "JPY")).toBe("¥2,500");
  });
});

describe("money — format: three-decimal currency (BHD)", () => {
  it("shows three decimals with the dinar symbol", () => {
    expect(format("1234.5", "BHD")).toBe("BD1,234.500");
  });

  it("rounds extra precision to 3dp HALF_EVEN (1.2345 -> 1.234)", () => {
    expect(format("1.2345", "BHD")).toBe("BD1.234");
  });
});

describe("formatCompact", () => {
  it("shows amounts under 1000 in full", () => {
    expect(formatCompact("612", "INR")).toBe("₹612");
    expect(formatCompact("0", "INR")).toBe("₹0");
  });

  it("abbreviates thousands with k (one decimal, trailing .0 dropped)", () => {
    expect(formatCompact("9400", "INR")).toBe("₹9.4k");
    expect(formatCompact("6500", "INR")).toBe("₹6.5k");
    expect(formatCompact("2000", "INR")).toBe("₹2k");
  });

  it("uses lakh (L) and crore (Cr) for larger Indian magnitudes", () => {
    expect(formatCompact("192000", "INR")).toBe("₹1.9L");
    expect(formatCompact("12000000", "INR")).toBe("₹1.2Cr");
  });

  it("keeps the sign for negatives", () => {
    expect(formatCompact("-480", "INR")).toBe("-₹480");
  });
});
