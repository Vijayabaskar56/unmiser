import { describe, expect, it } from "vitest";

import { parseBatchChunked } from "@/lib/scan/chunked-executor";
import { parseSmsWithManifests, prepareManifests } from "@/lib/parser/engine";
import { bundledParserManifests } from "@/lib/parser/manifests";
import type { SmsInput } from "@/lib/parser/types";

const HDFC_SMS: SmsInput = {
  sender: "VM-HDFCBK-S",
  body: "Rs.1250.00 debited from HDFC Bank A/c XX1234 at AMAZON on 09/06/26. Avl bal:INR 88,750.20",
  receivedAt: "2026-06-09T10:30:00.000Z",
};

const UNKNOWN_SMS: SmsInput = {
  sender: "VK-UNKNOWN-S",
  body: "Rs.100 debited at TEST.",
  receivedAt: "2026-06-09T10:31:00.000Z",
};

describe("parseBatchChunked", () => {
  it("produces the same results as the single-runtime engine (minus the RN-side hash)", async () => {
    const prepared = prepareManifests(bundledParserManifests);
    const records = [HDFC_SMS, UNKNOWN_SMS];

    const results = await parseBatchChunked(prepared, records, undefined, 1);
    expect(results).toHaveLength(2);

    const reference = records.map((input) => parseSmsWithManifests(bundledParserManifests, input));
    for (let i = 0; i < records.length; i += 1) {
      expect(results[i].confidence).toBe(reference[i].confidence);
      expect(results[i].reasons).toEqual(reference[i].reasons);
      expect(results[i].matchedManifest).toEqual(reference[i].matchedManifest);
      if (reference[i].fields) {
        // The prepared core leaves transactionHash for attachTransactionHash
        // (js-md5/decimal.js stay RN-side); everything else must match.
        const { transactionHash: _hash, ...restReference } = reference[i].fields!;
        const { transactionHash: preparedHash, ...restPrepared } = results[i].fields!;
        expect(preparedHash).toBeUndefined();
        expect(restPrepared).toEqual(restReference);
      }
    }
  });

  it("stops parsing when the abort signal fires", async () => {
    const prepared = prepareManifests(bundledParserManifests);
    const controller = new AbortController();
    controller.abort();

    const results = await parseBatchChunked(prepared, [HDFC_SMS, UNKNOWN_SMS], controller.signal);
    expect(results).toEqual([]);
  });

  it("yields between chunks but preserves input order", async () => {
    const prepared = prepareManifests(bundledParserManifests);
    const records = Array.from({ length: 7 }, () => UNKNOWN_SMS);
    const results = await parseBatchChunked(prepared, records, undefined, 2);
    expect(results).toHaveLength(7);
    for (const result of results) {
      expect(result.reasons).toContain("NO_MATCHING_MANIFEST");
    }
  });
});
