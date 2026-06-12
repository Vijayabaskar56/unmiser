import { describe, expect, it } from "vitest";

import { triageScanResult } from "@/lib/scan/triage";
import type { ParserResult, SmsInput } from "@/lib/parser/types";

const BANK_INPUT: SmsInput = {
  sender: "VM-HDFCBK-S",
  body: "Rs.100.00 debited from A/c XX1234 at AMAZON",
  receivedAt: "2026-06-11T10:00:00.000Z",
};

const NOISE_INPUT: SmsInput = {
  sender: "AX-PROMO", // no -T/-S suffix → fails the capture gate
  body: "Get 50% discount today!",
  receivedAt: "2026-06-11T10:00:00.000Z",
};

const MANIFEST_REF = {
  pluginId: "in.hdfc.bank",
  version: "1.0.0",
  name: "HDFC Bank",
  currency: "INR",
};

function result(partial: Partial<ParserResult>): ParserResult {
  return { confidence: "REJECTED", reasons: [], rawMatches: [], ...partial };
}

describe("triageScanResult", () => {
  // Mirrors processSms's early branches (db/services/sms-processing.ts):
  // identical inputs must produce identical save/review/reject outcomes.

  it("drops unmatched SMS that fail the capture gate", () => {
    const r = result({ reasons: ["NO_MATCHING_MANIFEST"] });
    expect(triageScanResult(r, NOISE_INPUT)).toBe("drop");
  });

  it("persists unmatched SMS that pass the capture gate (UNRECOGNIZED review)", () => {
    const r = result({ reasons: ["NO_MATCHING_MANIFEST"] });
    expect(triageScanResult(r, BANK_INPUT)).toBe("persist");
  });

  it("drops filter-rejected matches that fail the capture gate", () => {
    const r = result({ matchedManifest: MANIFEST_REF, reasons: ["FILTER_REJECTED"] });
    expect(triageScanResult(r, NOISE_INPUT)).toBe("drop");
  });

  it("persists filter-rejected matches that pass the capture gate (REJECTED review)", () => {
    const r = result({ matchedManifest: MANIFEST_REF, reasons: ["FILTER_REJECTED"] });
    expect(triageScanResult(r, BANK_INPUT)).toBe("persist");
  });

  it("persists every parse that produced fields, regardless of sender shape", () => {
    const fields = { currency: "INR", bankName: "HDFC Bank", isFromCard: false, amount: "100.00" };
    const high = result({ confidence: "HIGH", matchedManifest: MANIFEST_REF, fields });
    const review = result({
      confidence: "REVIEW",
      matchedManifest: MANIFEST_REF,
      fields,
      reasons: ["MISSING_MERCHANT"],
    });
    // A matched manifest with fields must reach processSms even when the
    // sender lacks a DLT suffix — the capture gate only guards review noise.
    expect(triageScanResult(high, NOISE_INPUT)).toBe("persist");
    expect(triageScanResult(review, NOISE_INPUT)).toBe("persist");
  });
});
