// Scan checkpoint/resume (ROADMAP Phase 2 workstream D): the cursor (raw SMS
// offset, oldest-to-newest) plus running totals are persisted to the ADR-0005
// KV prefs table after every page, so an OS-killed or cancelled scan resumes
// ("Resume scan 4,000/5,300") instead of restarting. Dedup makes a restart
// safe; the checkpoint makes it fast.

export const SCAN_CHECKPOINT_KEY = "smsScanCheckpoint";

export interface ScanCheckpoint {
  /** Raw inbox offset of the next unprocessed row (native rows, pre-filter). */
  offset: number;
  processed: number;
  saved: number;
  review: number;
  rejected: number;
  /** Raw inbox total at the time the scan started. */
  total: number;
  updatedAt: string;
}

export interface ScanCheckpointStore {
  load(): Promise<ScanCheckpoint | null>;
  save(checkpoint: ScanCheckpoint): Promise<void>;
  clear(): Promise<void>;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Parse a persisted checkpoint value. Returns null for unset, empty (the
 * "cleared" sentinel — the KV service has no delete), or malformed payloads,
 * so a corrupt pref degrades to "no resume offered", never a crash.
 */
export function parseScanCheckpoint(raw: string | null): ScanCheckpoint | null {
  if (raw === null || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    !isNonNegativeInt(candidate.offset) ||
    !isNonNegativeInt(candidate.processed) ||
    !isNonNegativeInt(candidate.saved) ||
    !isNonNegativeInt(candidate.review) ||
    !isNonNegativeInt(candidate.rejected) ||
    !isNonNegativeInt(candidate.total) ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    offset: candidate.offset,
    processed: candidate.processed,
    saved: candidate.saved,
    review: candidate.review,
    rejected: candidate.rejected,
    total: candidate.total,
    updatedAt: candidate.updatedAt,
  };
}

export function serializeScanCheckpoint(checkpoint: ScanCheckpoint): string {
  return JSON.stringify(checkpoint);
}

/** Minimal KV surface (db/services/app-settings getSetting/setSetting). */
export interface KvSettings {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/**
 * Checkpoint store over the app_settings KV table. Clearing writes the empty
 * string (the KV service is upsert-only); `parseScanCheckpoint` treats empty
 * as "no checkpoint".
 */
export function createKvScanCheckpointStore(kv: KvSettings): ScanCheckpointStore {
  return {
    async load() {
      return parseScanCheckpoint(await kv.get(SCAN_CHECKPOINT_KEY));
    },
    async save(checkpoint) {
      await kv.set(SCAN_CHECKPOINT_KEY, serializeScanCheckpoint(checkpoint));
    },
    async clear() {
      await kv.set(SCAN_CHECKPOINT_KEY, "");
    },
  };
}
