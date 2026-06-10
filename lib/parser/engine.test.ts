import { describe, expect, it } from "vitest";

import { parseSmsWithManifests } from "@/lib/parser/engine";
import { validateManifestFixtures } from "@/lib/parser/fixtures";
import { bundledParserBundles, bundledParserManifests } from "@/lib/parser/manifests";

describe("sms parser engine", () => {
  it("passes all bundled manifest fixtures", () => {
    const failures = bundledParserBundles.flatMap(validateManifestFixtures);
    expect(failures).toEqual([]);
  });

  it("returns rejected when no manifest matches the sender", () => {
    const result = parseSmsWithManifests(bundledParserManifests, {
      sender: "VK-UNKNOWN-S",
      receivedAt: "2026-06-09T10:30:00.000Z",
      body: "Rs.100 debited at TEST.",
    });

    expect(result.confidence).toBe("REJECTED");
    expect(result.reasons).toContain("NO_MATCHING_MANIFEST");
  });

  it("sends missing merchant parses to review", () => {
    const result = parseSmsWithManifests(bundledParserManifests, {
      sender: "JD-SLICE-S",
      receivedAt: "2026-06-09T10:31:00.000Z",
      body: "Rs.100.00 spent on your Slice card XX1234.",
    });

    expect(result.confidence).toBe("REVIEW");
    expect(result.reasons).toContain("MISSING_MERCHANT");
  });
});
