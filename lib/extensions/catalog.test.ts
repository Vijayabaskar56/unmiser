import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatVersion,
  parsedCountsByPlugin,
  placeholderMeta,
  statusBadge,
} from "./catalog";

describe("parsedCountsByPlugin", () => {
  const accounts = [
    { id: 1, canonicalBank: "in.hdfc.bank" },
    { id: 2, canonicalBank: "in.icici.bank" },
    { id: 3, canonicalBank: null },
  ];

  it("counts non-deleted transactions by the account's plugin", () => {
    const txns = [
      { accountId: 1, isDeleted: false },
      { accountId: 1, isDeleted: false },
      { accountId: 2, isDeleted: false },
      { accountId: 1, isDeleted: true }, // excluded
      { accountId: 3, isDeleted: false }, // no plugin
      { accountId: null, isDeleted: false }, // unattributed
    ];
    expect(parsedCountsByPlugin(accounts, txns)).toEqual({
      "in.hdfc.bank": 2,
      "in.icici.bank": 1,
    });
  });

  it("returns an empty map when nothing matches", () => {
    expect(parsedCountsByPlugin([], [{ accountId: 9, isDeleted: false }])).toEqual({});
  });
});

describe("statusBadge", () => {
  it("prefers a pending update over live/paused", () => {
    expect(statusBadge(true, "4")).toEqual({ kind: "update", label: "UPDATE v4" });
    expect(statusBadge(false, "v2")).toEqual({ kind: "update", label: "UPDATE v2" });
  });

  it("is LIVE when enabled and PAUSED when disabled", () => {
    expect(statusBadge(true)).toEqual({ kind: "live", label: "LIVE" });
    expect(statusBadge(false, null)).toEqual({ kind: "paused", label: "PAUSED" });
  });
});

describe("formatVersion", () => {
  it("normalises to a leading v", () => {
    expect(formatVersion("3")).toBe("v3");
    expect(formatVersion("v4")).toBe("v4");
    expect(formatVersion("V2")).toBe("v2");
  });
});

describe("formatBytes", () => {
  it("formats across unit boundaries", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3 * 1024)).toBe("3.0 kB");
    expect(formatBytes(50 * 1024)).toBe("50 kB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("placeholderMeta", () => {
  it("is deterministic and in range", () => {
    const a = placeholderMeta("in.hdfc.bank");
    const b = placeholderMeta("in.hdfc.bank");
    expect(a).toEqual(b);
    expect(Number(a.rating)).toBeGreaterThanOrEqual(4);
    expect(Number(a.rating)).toBeLessThanOrEqual(5);
    expect(a.license).toBe("MIT");
  });
});
