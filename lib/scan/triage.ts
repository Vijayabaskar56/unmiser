import { shouldCaptureUnrecognizedSms } from "@/lib/parser/sms-filter";
import type { ParserResult, SmsInput } from "@/lib/parser/types";

// Off-thread triage: the worklet (or chunked) executor parses every record,
// and this decides — without touching the DB — which records `processSms`
// must persist. It mirrors processSms's own early-return branches exactly
// (db/services/sms-processing.ts), so skipping a "drop" record produces the
// same outcome processSms would have ({ kind: "rejected" }) while saving the
// RN-side re-parse + DB round-trip for the 80–90% noise case.

export type ScanTriageDecision = "drop" | "persist";

export function triageScanResult(result: ParserResult, input: SmsInput): ScanTriageDecision {
  // processSms branch 1: no manifest matched → review only if the ADR-0015
  // capture gate passes, otherwise silently rejected.
  if (!result.matchedManifest) {
    return shouldCaptureUnrecognizedSms(input.sender, input.body) ? "persist" : "drop";
  }
  // processSms branch 2: manifest matched but filter-rejected / fieldless —
  // same capture gate applies (a promo from a bank sender is noise).
  if (result.confidence === "REJECTED" || !result.fields) {
    return shouldCaptureUnrecognizedSms(input.sender, input.body) ? "persist" : "drop";
  }
  // Everything else (saveable, review-worthy, account-resolution) needs the DB.
  return "persist";
}
