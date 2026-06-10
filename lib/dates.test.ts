import { describe, expect, it } from "vitest";
import {
  addPeriod,
  endOfPeriod,
  formatDisplay,
  isWithin,
  nowIso,
  parseIso,
  startOfPeriod,
  toIso,
} from "@/lib/dates";

describe("dates: wall-clock round-trip", () => {
  it("toIso(parseIso(x)) returns the same string with no timezone offset", () => {
    const x = "2026-06-08T14:30:00";
    expect(toIso(parseIso(x))).toBe(x);
    expect(toIso(parseIso(x))).not.toMatch(/[Zz]|[+-]\d\d:\d\d$/);
  });

  it("keeps a stored wall-clock string byte-stable (no tz shift) across many values", () => {
    const stored = [
      "2020-01-01T00:00:00",
      "2026-06-08T14:30:00",
      "2026-12-31T23:59:59",
      "2024-02-29T12:00:00",
      "2026-03-29T02:30:00", // DST-spring-forward wall time in many zones
    ];
    for (const s of stored) {
      expect(toIso(parseIso(s))).toBe(s);
    }
  });

  it("accepts JS/native ISO instants and normalizes them to wall-clock storage", () => {
    expect(toIso(parseIso("2026-06-09T03:18:24.123Z"))).toMatch(/^2026-06-09T\d{2}:\d{2}:24$/);
  });
});

describe("dates: nowIso", () => {
  it("returns a no-timezone wall-clock ISO string that round-trips", () => {
    const s = nowIso();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(toIso(parseIso(s))).toBe(s);
  });
});

describe("dates: formatDisplay", () => {
  it("uses a default human-readable pattern", () => {
    expect(formatDisplay("2026-06-08T14:30:00")).toBe("Jun 8, 2026");
  });

  it("honours a custom pattern", () => {
    expect(formatDisplay("2026-06-08T14:30:00", "yyyy-MM-dd HH:mm")).toBe("2026-06-08 14:30");
    expect(formatDisplay("2026-06-08T14:30:00", "h:mm a")).toBe("2:30 PM");
  });

  it("does not throw for malformed persisted values", () => {
    expect(formatDisplay("not-a-date")).toBe("Invalid date");
  });
});

describe("dates: startOfPeriod", () => {
  it("MONTHLY snaps to the first instant of the month", () => {
    expect(startOfPeriod("2026-06-08T14:30:00", "MONTHLY")).toBe("2026-06-01T00:00:00");
  });

  it("WEEKLY snaps to the start of the week (Monday) at midnight", () => {
    // 2026-06-08 is a Monday; 2026-06-10 (Wed) snaps back to Mon the 8th.
    expect(startOfPeriod("2026-06-10T09:15:00", "WEEKLY")).toBe("2026-06-08T00:00:00");
  });

  it("DAILY snaps to midnight, YEARLY to Jan 1", () => {
    expect(startOfPeriod("2026-06-08T14:30:00", "DAILY")).toBe("2026-06-08T00:00:00");
    expect(startOfPeriod("2026-06-08T14:30:00", "YEARLY")).toBe("2026-01-01T00:00:00");
  });
});

describe("dates: endOfPeriod", () => {
  it("MONTHLY returns the last second of the month", () => {
    expect(endOfPeriod("2026-06-08T14:30:00", "MONTHLY")).toBe("2026-06-30T23:59:59");
    // February in a non-leap year
    expect(endOfPeriod("2025-02-15T00:00:00", "MONTHLY")).toBe("2025-02-28T23:59:59");
  });

  it("WEEKLY returns the last second of the week (Sunday)", () => {
    expect(endOfPeriod("2026-06-08T00:00:00", "WEEKLY")).toBe("2026-06-14T23:59:59");
  });
});

describe("dates: addPeriod", () => {
  it("adds months, preserving time-of-day", () => {
    expect(addPeriod("2026-06-08T14:30:00", "MONTHLY", 1)).toBe("2026-07-08T14:30:00");
  });

  it("clamps to the last day when the target month is shorter", () => {
    expect(addPeriod("2026-01-31T00:00:00", "MONTHLY", 1)).toBe("2026-02-28T00:00:00");
  });

  it("adds weeks, days, and years; supports negative n", () => {
    expect(addPeriod("2026-06-08T14:30:00", "WEEKLY", 2)).toBe("2026-06-22T14:30:00");
    expect(addPeriod("2026-06-08T14:30:00", "DAILY", -1)).toBe("2026-06-07T14:30:00");
    expect(addPeriod("2026-06-08T14:30:00", "YEARLY", 4)).toBe("2030-06-08T14:30:00");
  });
});

describe("dates: isWithin (inclusive bounds)", () => {
  const start = "2026-06-01T00:00:00";
  const end = "2026-06-30T23:59:59";

  it("includes both endpoints", () => {
    expect(isWithin(start, start, end)).toBe(true);
    expect(isWithin(end, start, end)).toBe(true);
  });

  it("includes an interior point and excludes points outside the range", () => {
    expect(isWithin("2026-06-15T12:00:00", start, end)).toBe(true);
    expect(isWithin("2026-05-31T23:59:59", start, end)).toBe(false);
    expect(isWithin("2026-07-01T00:00:00", start, end)).toBe(false);
  });
});

describe("dates: lexicographic sort is chronological", () => {
  it("sorting the ISO strings as plain strings yields chronological order", () => {
    const chronological = [
      "2019-12-31T23:59:59",
      "2020-01-01T00:00:00",
      "2026-06-08T09:00:00",
      "2026-06-08T14:30:00",
      "2026-06-08T14:30:01",
      "2026-12-31T23:59:59",
    ];
    const shuffled = [...chronological].reverse();
    const sorted = [...shuffled].sort(); // default string comparison
    expect(sorted).toEqual(chronological);
  });
});
