import { describe, expect, it } from "vitest";

import { lastParsedAt, relativeTime, reviewStatus } from "@/lib/accounts/overview";

describe("relativeTime", () => {
  const now = new Date("2026-06-14T12:00:00");

  it("reports recent times in m/h/d", () => {
    expect(relativeTime("2026-06-14T11:58:00", now)).toBe("2m ago");
    expect(relativeTime("2026-06-14T09:00:00", now)).toBe("3h ago");
    expect(relativeTime("2026-06-12T12:00:00", now)).toBe("2d ago");
  });

  it("collapses sub-minute deltas to 'just now'", () => {
    expect(relativeTime("2026-06-14T11:59:30", now)).toBe("just now");
  });

  it("returns 'never' for null", () => {
    expect(relativeTime(null, now)).toBe("never");
  });
});

describe("lastParsedAt", () => {
  it("returns the most recent non-null timestamp", () => {
    expect(
      lastParsedAt(["2026-06-10T00:00:00", null, "2026-06-14T08:00:00", "2026-06-12T00:00:00"]),
    ).toBe("2026-06-14T08:00:00");
  });

  it("returns null when there are no timestamps", () => {
    expect(lastParsedAt([])).toBeNull();
    expect(lastParsedAt([null, null])).toBeNull();
  });
});

describe("reviewStatus", () => {
  it("is ALL OK when the review queue is empty", () => {
    expect(reviewStatus(0)).toEqual({ label: "ALL OK", ok: true });
  });

  it("counts pending items otherwise", () => {
    expect(reviewStatus(3)).toEqual({ label: "3 TO REVIEW", ok: false });
    expect(reviewStatus(1)).toEqual({ label: "1 TO REVIEW", ok: false });
  });
});
