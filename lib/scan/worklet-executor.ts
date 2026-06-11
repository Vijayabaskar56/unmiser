// Dedicated background worklet runtime executor (ROADMAP Phase 2 workstream
// D): page batches cross to a `createWorkletRuntime` worker (NOT the UI
// runtime), the unchanged zod-free engine core (`parsePreparedSmsWithManifests`,
// see lib/parser/engine.ts) parses them there, and the results return to the
// RN runtime via `scheduleOnRN`. DB writes stay RN-side.
//
// Spike status (2026-06): zod validation and js-md5/decimal.js hashing were
// hoisted OUT of the parse core (prepareManifests / attachTransactionHash run
// RN-side) because none of them can be workletized without the experimental
// Bundle Mode. The remaining risk — closure-capture of the engine's helper
// graph onto the worker runtime — can only be proven on-device, so callers
// must wrap this executor with `parseBatchWithWorkletFallback` (index.ts),
// which probes once and falls back to the chunked RN-side executor loudly.

import { createWorkletRuntime, scheduleOnRN, scheduleOnRuntime } from "react-native-worklets";
import type { WorkletRuntime } from "react-native-worklets";

import { parsePreparedSmsWithManifests } from "@/lib/parser/engine";
import type { ParserResult, SmsInput, SmsParserManifest } from "@/lib/parser/types";

let runtime: WorkletRuntime | null = null;

function getScanRuntime(): WorkletRuntime {
  runtime ??= createWorkletRuntime({ name: "unmiser-sms-scan" });
  return runtime;
}

/** Parse one page batch on the background worklet runtime. */
export function parseBatchOnWorkletRuntime(
  manifests: SmsParserManifest[],
  records: SmsInput[],
): Promise<ParserResult[]> {
  return new Promise<ParserResult[]>((resolve, reject) => {
    const onDone = (results: ParserResult[]) => resolve(results);
    const onError = (message: string) => reject(new Error(message));
    try {
      scheduleOnRuntime(
        getScanRuntime(),
        (batchManifests: SmsParserManifest[], batchRecords: SmsInput[]) => {
          "worklet";
          try {
            const results = batchRecords.map((record) =>
              parsePreparedSmsWithManifests(batchManifests, record),
            );
            scheduleOnRN(onDone, results);
          } catch (error) {
            scheduleOnRN(onError, error instanceof Error ? error.message : "worklet parse failed");
          }
        },
        manifests,
        records,
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error("worklet schedule failed"));
    }
  });
}

const PROBE_TIMEOUT_MS = 3000;

const PROBE_RECORD: SmsInput = {
  sender: "VM-PROBE-S",
  body: "probe",
  receivedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * One-shot capability probe: runs a synthetic parse on the worker runtime
 * with a timeout (a worklet that fails to serialize or throws before
 * scheduling back would otherwise hang the scan forever).
 */
export async function probeWorkletParse(manifests: SmsParserManifest[]): Promise<boolean> {
  try {
    const probe = parseBatchOnWorkletRuntime(manifests, [PROBE_RECORD]);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("worklet probe timed out")), PROBE_TIMEOUT_MS);
    });
    const results = await Promise.race([probe, timeout]);
    return Array.isArray(results) && results.length === 1;
  } catch {
    return false;
  }
}
