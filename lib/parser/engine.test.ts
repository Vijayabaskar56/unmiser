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
    // PNB is used here (not Slice) because Slice now mirrors Cashiro's
    // SliceParser default of merchant="Slice"; PNB has no merchant fallback, so
    // a bare debit alert with no payee still exercises the MISSING_MERCHANT path.
    const result = parseSmsWithManifests(bundledParserManifests, {
      sender: "VM-PNBSMS-S",
      receivedAt: "2026-06-09T10:31:00.000Z",
      body: "Ac XX1234 Debited with Rs.5000.00, 20-02-2026 07:47:16. Aval Bal Rs.27000.00 CR.",
    });

    expect(result.confidence).toBe("REVIEW");
    expect(result.reasons).toContain("MISSING_MERCHANT");
  });

  it("extracts HDFC mandate notices before transaction filtering", () => {
    const result = parseSmsWithManifests(bundledParserManifests, {
      sender: "VM-HDFCBK-S",
      receivedAt: "2026-06-09T10:31:00.000Z",
      body: "E-Mandate! Rs.1,499 will be deducted on 15/07/26, 09:00:00 For NETFLIX mandate UMN HDFCUMN12345",
    });

    expect(result.confidence).toBe("HIGH");
    expect(result.reasons).toContain("MANDATE_DETECTED");
    expect(result.fields).toBeUndefined();
    expect(result.mandate).toMatchObject({
      amount: "1499",
      nextDeductionDate: "2026-07-15",
      merchant: "NETFLIX",
      umn: "HDFCUMN12345",
      currency: "INR",
      pluginId: "in.hdfc.bank",
      provider: "HDFC Bank",
    });
  });

  it("flags mandate parse failure when a detected mandate is missing required fields", () => {
    const result = parseSmsWithManifests(bundledParserManifests, {
      sender: "VM-HDFCBK-S",
      receivedAt: "2026-06-09T10:31:00.000Z",
      body: "E-Mandate! Rs.1,499 will be deducted soon For NETFLIX mandate UMN HDFCUMN12345",
    });

    expect(result.confidence).toBe("REVIEW");
    expect(result.reasons).toContain("MANDATE_DETECTED");
    expect(result.mandate).toBeUndefined();
    expect(result.mandateParseFailed?.reasons).toContain("missing_date");
  });
});
