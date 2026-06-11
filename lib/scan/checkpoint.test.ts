import { describe, expect, it } from "vitest";

import {
  createKvScanCheckpointStore,
  parseScanCheckpoint,
  SCAN_CHECKPOINT_KEY,
  serializeScanCheckpoint,
  type ScanCheckpoint,
} from "@/lib/scan/checkpoint";

const CHECKPOINT: ScanCheckpoint = {
  offset: 4000,
  processed: 4000,
  saved: 310,
  review: 120,
  rejected: 3570,
  total: 5300,
  updatedAt: "2026-06-11T10:00:00.000Z",
};

describe("scan checkpoint", () => {
  it("round-trips through serialize/parse", () => {
    expect(parseScanCheckpoint(serializeScanCheckpoint(CHECKPOINT))).toEqual(CHECKPOINT);
  });

  it("treats null and empty string (the cleared sentinel) as no checkpoint", () => {
    expect(parseScanCheckpoint(null)).toBeNull();
    expect(parseScanCheckpoint("")).toBeNull();
    expect(parseScanCheckpoint("   ")).toBeNull();
  });

  it("rejects malformed payloads instead of crashing", () => {
    expect(parseScanCheckpoint("not json")).toBeNull();
    expect(parseScanCheckpoint("42")).toBeNull();
    expect(parseScanCheckpoint("null")).toBeNull();
    expect(parseScanCheckpoint(JSON.stringify({ offset: 1 }))).toBeNull();
    expect(parseScanCheckpoint(JSON.stringify({ ...CHECKPOINT, offset: -1 }))).toBeNull();
    expect(parseScanCheckpoint(JSON.stringify({ ...CHECKPOINT, offset: 1.5 }))).toBeNull();
    expect(parseScanCheckpoint(JSON.stringify({ ...CHECKPOINT, saved: "310" }))).toBeNull();
    expect(parseScanCheckpoint(JSON.stringify({ ...CHECKPOINT, updatedAt: 7 }))).toBeNull();
  });

  it("stores, loads, and clears through the KV surface", async () => {
    const kv = new Map<string, string>();
    const store = createKvScanCheckpointStore({
      get: async (key) => kv.get(key) ?? null,
      set: async (key, value) => {
        kv.set(key, value);
      },
    });

    expect(await store.load()).toBeNull();
    await store.save(CHECKPOINT);
    expect(kv.has(SCAN_CHECKPOINT_KEY)).toBe(true);
    expect(await store.load()).toEqual(CHECKPOINT);

    await store.clear();
    // Upsert-only KV: clear writes the empty sentinel rather than deleting.
    expect(kv.get(SCAN_CHECKPOINT_KEY)).toBe("");
    expect(await store.load()).toBeNull();
  });
});
