// Wiring for the singleton SMS scan task (ROADMAP Phase 2 workstream D).
// This module touches native + DB modules and is therefore only imported
// from app code, never from unit tests (which target the pure modules:
// scan-task.ts, checkpoint.ts, triage.ts, chunked-executor.ts).

import { appDb } from "@/db/app-db";
import { loadEnabledParserManifests } from "@/db/services/extensions";
import { getSetting, setSetting } from "@/db/services/app-settings";
import { processSms } from "@/db/services/sms-processing";
import { getHistoricalSmsCount, getHistoricalSmsPage } from "@/lib/android-sms-adapter";
import { createKvScanCheckpointStore } from "@/lib/scan/checkpoint";
import { parseBatchChunked } from "@/lib/scan/chunked-executor";
import { createScanTask, type ScanPersistOutcome } from "@/lib/scan/scan-task";
import { triageScanResult } from "@/lib/scan/triage";
import { parseBatchOnWorkletRuntime, probeWorkletParse } from "@/lib/scan/worklet-executor";
import type { ParserResult, SmsInput, SmsParserManifest } from "@/lib/parser/types";

export type ScanEngineMode = "worklet" | "chunked" | "unknown";

let engineMode: ScanEngineMode = "unknown";

/** Which executor the last/current scan ended up using (mock-UI display). */
export function getScanEngineMode(): ScanEngineMode {
  return engineMode;
}

/**
 * Worklet-first batch parser with a loud one-shot fallback: the first batch
 * probes the background worklet runtime; if the engine cannot run there
 * (closure-capture/serialization failure — see worklet-executor.ts spike
 * notes) every subsequent batch uses the chunked RN-runtime executor.
 */
async function parseBatchWithWorkletFallback(
  manifests: SmsParserManifest[],
  records: SmsInput[],
  signal: AbortSignal,
): Promise<ParserResult[]> {
  if (engineMode === "unknown") {
    const workletOk = await probeWorkletParse(manifests);
    engineMode = workletOk ? "worklet" : "chunked";
    if (!workletOk) {
      console.warn(
        "[scan] background worklet runtime cannot run the parser engine; " +
          "falling back to chunked RN-thread parsing",
      );
    }
  }
  if (engineMode === "worklet") {
    try {
      return await parseBatchOnWorkletRuntime(manifests, records);
    } catch (error) {
      engineMode = "chunked";
      console.warn("[scan] worklet batch failed; switching to chunked parsing", error);
    }
  }
  return parseBatchChunked(manifests, records, signal);
}

/**
 * RN-side persistence for one parsed record. Triage drops the records
 * `processSms` would silently reject (no DB round-trip); survivors go through
 * the real `processSms` (which re-parses on the RN runtime — the persistence
 * split lives in db/services/sms-processing.ts, outside this module's
 * ownership, so the parse runs twice for the small persisted fraction).
 */
async function persistScanRecord(
  record: SmsInput,
  result: ParserResult,
): Promise<ScanPersistOutcome> {
  if (triageScanResult(result, record) === "drop") return "rejected";
  const manifests = await cachedManifests();
  const outcome = await processSms(appDb, manifests, record);
  if (outcome.kind === "saved") return "saved";
  if (outcome.kind === "mandate") return "mandate";
  if (outcome.kind === "review") return "review";
  return "rejected"; // duplicate + rejected both count as skipped
}

// Manifests are loaded once per scan run by the task; persist re-uses the
// same set instead of hitting the plugins join per record.
let manifestCache: SmsParserManifest[] | null = null;

async function cachedManifests(): Promise<SmsParserManifest[]> {
  manifestCache ??= await loadEnabledParserManifests(appDb);
  return manifestCache;
}

const checkpointStore = createKvScanCheckpointStore({
  get: (key) => getSetting(appDb, key),
  set: (key, value) => setSetting(appDb, key, value),
});

export const smsScanTask = createScanTask({
  getTotalCount: () => getHistoricalSmsCount(),
  fetchPage: async (offset, limit) => {
    // preScreen=false: let the manifest engine decide which messages are
    // transactions. The native coarse keyword gate (SmsPreScreen) was dropping
    // ~79% of real txns before they crossed the bridge — notably the dominant
    // HDFC "Sent Rs… From HDFC Bank A/C… To…" UPI debit, whose body contains
    // none of the gate's keywords. Persistence is still gated downstream
    // (shouldCaptureUnrecognizedSms), so non-bank noise is dropped after parse.
    const page = await getHistoricalSmsPage(offset, limit, false);
    return { records: page.records, scanned: page.scanned };
  },
  loadManifests: async () => {
    manifestCache = await loadEnabledParserManifests(appDb);
    return manifestCache;
  },
  parseBatch: parseBatchWithWorkletFallback,
  persist: persistScanRecord,
  checkpoint: checkpointStore,
  onSettled: () => {
    manifestCache = null;
  },
});

/**
 * Clear the scan parse cache (Developer options → Clear parse cache): drop the
 * resume checkpoint, the cached manifest set, and the engine-mode probe so the
 * next scan recounts and reloads from scratch. Dedup keeps a fresh full scan
 * safe. Refreshes the scan task so any "Resume scan" affordance disappears.
 */
export async function clearParseCache(): Promise<void> {
  manifestCache = null;
  engineMode = "unknown";
  await checkpointStore.clear();
  await smsScanTask.refreshResumeAvailable();
}

export type { ScanTaskState, ScanPhase } from "@/lib/scan/scan-task";
