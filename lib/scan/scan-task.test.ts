import { describe, expect, it } from "vitest";

import { parsePreparedSmsWithManifests } from "@/lib/parser/engine";
import {
  createScanTask,
  type ScanPage,
  type ScanPersistOutcome,
  type ScanTaskDeps,
} from "@/lib/scan/scan-task";
import type { ScanCheckpoint, ScanCheckpointStore } from "@/lib/scan/checkpoint";
import type { SmsInput } from "@/lib/parser/types";

function record(i: number): SmsInput {
  return {
    sender: `VM-TEST-S`,
    body: `Rs.${i} debited`,
    receivedAt: "2026-06-11T10:00:00.000Z",
  };
}

function memoryCheckpointStore(): ScanCheckpointStore & { value: ScanCheckpoint | null } {
  const store = {
    value: null as ScanCheckpoint | null,
    async load() {
      return store.value;
    },
    async save(checkpoint: ScanCheckpoint) {
      store.value = checkpoint;
    },
    async clear() {
      store.value = null;
    },
  };
  return store;
}

interface HarnessOptions {
  totalRecords: number;
  pageSize?: number;
  /** Outcome per absolute record index. */
  outcomeFor?: (index: number) => ScanPersistOutcome;
  /** Native pre-screen simulation: indices dropped before crossing the bridge. */
  nativeDrops?: Set<number>;
  persistHook?: (index: number) => void | Promise<void>;
  failPageAt?: number;
}

function createHarness(options: HarnessOptions) {
  const pageSize = options.pageSize ?? 10;
  const checkpoint = memoryCheckpointStore();
  const persisted: number[] = [];
  let settledCount = 0;

  const deps: ScanTaskDeps = {
    getTotalCount: async () => options.totalRecords,
    fetchPage: async (offset, limit): Promise<ScanPage> => {
      if (options.failPageAt !== undefined && offset >= options.failPageAt) {
        throw new Error("native page read failed");
      }
      const end = Math.min(offset + limit, options.totalRecords);
      const records: SmsInput[] = [];
      for (let i = offset; i < end; i += 1) {
        if (options.nativeDrops?.has(i)) continue;
        records.push(record(i));
      }
      return { records, scanned: Math.max(end - offset, 0) };
    },
    loadManifests: async () => [],
    // The unit harness fakes the executor; the executor itself is covered by
    // chunked-executor.test.ts against the real engine.
    parseBatch: async (_manifests, records) =>
      records.map(() => ({ confidence: "REJECTED" as const, reasons: [], rawMatches: [] })),
    persist: async (rec) => {
      const index = Number(/Rs\.(\d+)/.exec(rec.body)![1]);
      await options.persistHook?.(index);
      persisted.push(index);
      return options.outcomeFor?.(index) ?? "saved";
    },
    checkpoint,
    pageSize,
    onSettled: () => {
      settledCount += 1;
    },
  };

  const task = createScanTask(deps);
  return {
    task,
    checkpoint,
    persisted,
    getSettledCount: () => settledCount,
  };
}

describe("scan task store", () => {
  it("starts idle and notifies subscribers on every state change", async () => {
    const { task } = createHarness({ totalRecords: 5 });
    expect(task.getState()).toMatchObject({ phase: "idle", running: false, processed: 0 });

    let notifications = 0;
    const unsubscribe = task.subscribe(() => {
      notifications += 1;
    });
    await task.start();
    expect(notifications).toBeGreaterThan(0);

    const seen = notifications;
    unsubscribe();
    await task.start();
    expect(notifications).toBe(seen);
  });

  it("scans all pages oldest-to-newest and tallies outcomes", async () => {
    const { task, persisted, checkpoint, getSettledCount } = createHarness({
      totalRecords: 25,
      pageSize: 10,
      outcomeFor: (i) => (i % 5 === 0 ? "saved" : i % 5 === 1 ? "review" : "rejected"),
    });

    const state = await task.start();
    expect(state.phase).toBe("completed");
    expect(state.running).toBe(false);
    expect(state.processed).toBe(25);
    expect(state.total).toBe(25);
    expect(state.saved).toBe(5);
    expect(state.review).toBe(5);
    expect(state.rejected).toBe(15);
    expect(persisted).toEqual([...Array(25).keys()]); // strictly oldest-to-newest
    expect(checkpoint.value).toBeNull(); // cleared on natural completion
    expect(state.resumeAvailable).toBe(false);
    expect(getSettledCount()).toBe(1);
  });

  it("counts native pre-screen drops as processed + rejected", async () => {
    const { task, persisted } = createHarness({
      totalRecords: 10,
      pageSize: 10,
      nativeDrops: new Set([1, 2, 3, 4]),
      outcomeFor: () => "saved",
    });

    const state = await task.start();
    expect(state.processed).toBe(10); // raw rows, including dropped ones
    expect(state.rejected).toBe(4);
    expect(state.saved).toBe(6);
    expect(persisted).toEqual([0, 5, 6, 7, 8, 9]);
  });

  it("cancel aborts between records, keeps the checkpoint, and offers resume", async () => {
    const harness = createHarness({
      totalRecords: 30,
      pageSize: 10,
      persistHook: (index) => {
        // Cancel mid-way through the second page (after page 1 checkpointed).
        if (index === 12) harness.task.cancel();
      },
      outcomeFor: () => "saved",
    });

    const state = await harness.task.start();
    expect(state.phase).toBe("cancelled");
    expect(state.running).toBe(false);
    expect(state.resumeAvailable).toBe(true);
    // Page 2 was interrupted: only page 1 (10 records) is checkpointed.
    expect(harness.checkpoint.value).toMatchObject({ offset: 10, processed: 10 });
    expect(harness.persisted.at(-1)).toBe(12);
  });

  it("resumes from the checkpoint cursor instead of restarting", async () => {
    const { task, checkpoint, persisted } = createHarness({
      totalRecords: 30,
      pageSize: 10,
      outcomeFor: () => "saved",
    });
    checkpoint.value = {
      offset: 20,
      processed: 20,
      saved: 17,
      review: 2,
      rejected: 1,
      total: 30,
      updatedAt: "2026-06-11T10:00:00.000Z",
    };

    expect(await task.refreshResumeAvailable()).toBe(true);
    expect(task.getState()).toMatchObject({
      resumeAvailable: true,
      processed: 20,
      total: 30,
      saved: 17,
    });

    const state = await task.start({ resume: true });
    expect(state.phase).toBe("completed");
    expect(state.processed).toBe(30);
    expect(state.saved).toBe(27); // 17 carried + 10 new
    expect(persisted).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    expect(checkpoint.value).toBeNull();
  });

  it("start without resume discards a stale checkpoint", async () => {
    const { task, checkpoint, persisted } = createHarness({
      totalRecords: 5,
      outcomeFor: () => "saved",
    });
    checkpoint.value = {
      offset: 3,
      processed: 3,
      saved: 3,
      review: 0,
      rejected: 0,
      total: 5,
      updatedAt: "2026-06-11T10:00:00.000Z",
    };

    const state = await task.start({ resume: false });
    expect(persisted).toEqual([0, 1, 2, 3, 4]);
    expect(state.saved).toBe(5);
  });

  it("keeps the checkpoint and reports the error when a page read fails", async () => {
    const { task, checkpoint } = createHarness({
      totalRecords: 30,
      pageSize: 10,
      failPageAt: 20,
      outcomeFor: () => "saved",
    });

    const state = await task.start();
    expect(state.phase).toBe("error");
    expect(state.error).toBe("native page read failed");
    expect(state.running).toBe(false);
    expect(state.resumeAvailable).toBe(true);
    expect(checkpoint.value).toMatchObject({ offset: 20, processed: 20, saved: 20 });
  });

  it("ignores start() while already running", async () => {
    const harness = createHarness({
      totalRecords: 20,
      pageSize: 10,
      persistHook: async (index) => {
        if (index === 5) {
          // Re-entrant start must be a no-op, not a second concurrent loop.
          await harness.task.start();
        }
      },
      outcomeFor: () => "saved",
    });

    const state = await harness.task.start();
    expect(state.processed).toBe(20);
    expect(harness.persisted).toEqual([...Array(20).keys()]);
  });

  it("parses through the real engine shape when wired to the prepared parser", () => {
    // Sanity: the store's parseBatch contract matches the engine's worklet
    // entry point (manifests + records in, ParserResult[] out).
    const results = [record(1)].map((input) => parsePreparedSmsWithManifests([], input));
    expect(results[0].confidence).toBe("REJECTED");
    expect(results[0].reasons).toContain("NO_MATCHING_MANIFEST");
  });
});
