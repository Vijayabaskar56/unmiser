import { describe, expect, it } from "vitest";

import {
  accounts,
  categories,
  pluginAssets,
  plugins,
  transactions,
  unrecognizedSms,
} from "@/db/schema";
import { installParserBundle } from "@/db/services/extensions";
import { createTestDb, type TestDb } from "@/db/test-support/harness";
import type { ManifestWithFixtures, SmsParserManifest } from "@/lib/parser/types";
import type { RegistryCatalog, RegistryCatalogEntry } from "@/lib/registry/types";
import {
  applyExtensionUpdate,
  checkForUpdates,
  compareVersions,
  markRegistryChecked,
  REGISTRY_LAST_CHECKED_AT_KEY,
  shouldCheckRegistry,
} from "@/lib/registry/updates";

const PLUGIN_ID = "in.test.bank";
const RECEIVED_AT = "2026-06-10T10:00:00";
// Parses HIGH under the v2 manifest below (slice.json's proven pattern set).
const PARSEABLE_BODY = "Rs.450.00 spent on your card XX1234 at SWIGGY on 09/06/26.";
// Amount but no merchant: parses to REVIEW (stays in the queue).
const PARTIAL_BODY = "Rs.20.00 spent on your card XX1234.";

function makeBundle(
  version: string,
  manifestOverrides: Partial<SmsParserManifest> = {},
): ManifestWithFixtures {
  return {
    manifest: {
      schemaVersion: "1.0",
      pluginId: PLUGIN_ID,
      type: "sms-parser",
      name: "Test Bank",
      country: "IN",
      currency: "INR",
      version,
      trust: "bundled",
      dispatch: { senders: ["TESTBK"], dltPatterns: ["^[A-Z]{2}-TESTBK-[A-Z]$"] },
      extract: {
        amount: [{ re: "Rs\\.?\\s*(?<value>[0-9,]+(?:\\.\\d{1,2})?)\\s+spent" }],
        merchant: [{ re: "at\\s+(?<value>[^.\\n]+?)(?:\\s+on|\\.|$)" }],
        accountLast4: [{ re: "card\\s+(?:XX|x|\\*)*(?<value>\\d{4})", takeLast4: true }],
      },
      typeRules: { expense: ["spent", "debited"] },
      cardRules: { includeKeywords: ["card"] },
      cleaning: {
        stripPatterns: ["\\s+on\\s+\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}.*$"],
        minMerchantLength: 2,
      },
      ...manifestOverrides,
    },
    fixtures: [],
  };
}

function makeEntry(overrides: Partial<RegistryCatalogEntry> = {}): RegistryCatalogEntry {
  return {
    pluginId: PLUGIN_ID,
    name: "Test Bank",
    country: "IN",
    currency: "INR",
    version: "2",
    file: "manifests/test-bank.json",
    sha256: "a".repeat(64),
    bytes: 1024,
    ...overrides,
  };
}

function makeCatalog(entries: RegistryCatalogEntry[]): RegistryCatalog {
  return {
    schemaVersion: "1",
    generatedAt: "2026-06-11T00:00:00.000Z",
    signature: null,
    entries,
  };
}

describe("compareVersions", () => {
  it("compares numeric segments numerically", () => {
    expect(compareVersions("2", "1")).toBeGreaterThan(0);
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2", "1.10")).toBeLessThan(0);
    expect(compareVersions("1", "2")).toBeLessThan(0);
  });

  it("treats missing segments as zero", () => {
    expect(compareVersions("1", "1.0")).toBe(0);
    expect(compareVersions("1.0.0", "1")).toBe(0);
    expect(compareVersions("1.0.1", "1")).toBeGreaterThan(0);
  });

  it("is zero for equal versions", () => {
    expect(compareVersions("3.2.1", "3.2.1")).toBe(0);
  });

  it("ranks numeric segments above non-numeric ones", () => {
    expect(compareVersions("1.0", "1.rc")).toBeGreaterThan(0);
    expect(compareVersions("1-beta", "1-alpha")).toBeGreaterThan(0);
  });
});

describe("checkForUpdates", () => {
  it("returns only installed plugins whose catalog version is newer", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeBundle("1"));
    await installParserBundle(
      db,
      makeBundle("2", { pluginId: "in.current.bank", name: "Current Bank" }),
    );

    const catalog = makeCatalog([
      makeEntry({ version: "2" }), // newer than installed "1"
      makeEntry({ pluginId: "in.current.bank", version: "2" }), // same version
      makeEntry({ pluginId: "in.notinstalled.bank", version: "9" }), // not installed
    ]);

    const updates = await checkForUpdates(db, catalog);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      pluginId: PLUGIN_ID,
      name: "Test Bank",
      installedVersion: "1",
      availableVersion: "2",
    });
    // The entry rides along so accepting the update can fetch immediately.
    expect(updates[0].entry.file).toBe("manifests/test-bank.json");
  });

  it("never flags a catalog downgrade as an update", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeBundle("3"));

    const updates = await checkForUpdates(db, makeCatalog([makeEntry({ version: "2" })]));
    expect(updates).toHaveLength(0);
  });

  it("is empty with nothing installed", async () => {
    const { db } = createTestDb();
    expect(await checkForUpdates(db, makeCatalog([makeEntry()]))).toHaveLength(0);
  });
});

describe("registry check throttle (KV prefs)", () => {
  it("allows the first-ever check", async () => {
    const { db } = createTestDb();
    expect(await shouldCheckRegistry(db)).toBe(true);
  });

  it("throttles to once per 24h, then allows again", async () => {
    const { db } = createTestDb();
    const checkedAt = new Date("2026-06-10T10:00:00.000Z");
    await markRegistryChecked(db, checkedAt);

    expect(await shouldCheckRegistry(db, { now: new Date("2026-06-11T09:00:00.000Z") })).toBe(
      false,
    );
    expect(await shouldCheckRegistry(db, { now: new Date("2026-06-11T10:00:00.000Z") })).toBe(true);
  });

  it("a manual check bypasses the throttle", async () => {
    const { db } = createTestDb();
    await markRegistryChecked(db, new Date("2026-06-11T09:59:00.000Z"));

    expect(
      await shouldCheckRegistry(db, { now: new Date("2026-06-11T10:00:00.000Z"), force: true }),
    ).toBe(true);
  });

  it("recovers from a corrupt pref value", async () => {
    const { db } = createTestDb();
    const { setSetting } = await import("@/db/services/app-settings");
    await setSetting(db, REGISTRY_LAST_CHECKED_AT_KEY, "not-a-date");

    expect(await shouldCheckRegistry(db)).toBe(true);
  });
});

async function seedSavePath(db: TestDb): Promise<void> {
  await db.insert(categories).values([
    { name: "Income", color: "#3DDC97", seedKey: "income", isIncome: true },
    { name: "Miscellaneous", color: "#757575", seedKey: "miscellaneous" },
  ]);
  await db.insert(accounts).values({
    bankName: "Test Bank",
    accountLast4: "1234",
    canonicalBank: PLUGIN_ID,
  });
}

describe("applyExtensionUpdate", () => {
  // v1 deliberately cannot parse anything (filter requires a keyword that
  // never occurs), which is how the review rows below piled up.
  const V1 = makeBundle("1", { filter: { requireAnyKeyword: ["never-matches"] } });

  async function seedReviewQueue(db: TestDb): Promise<void> {
    await db.insert(unrecognizedSms).values([
      // Open + matching plugin: reprocessed, now parses HIGH -> saved.
      {
        sender: "JD-TESTBK-S",
        smsBody: PARSEABLE_BODY,
        receivedAt: RECEIVED_AT,
        status: "REJECTED",
        reviewReason: "FILTER_REJECTED",
        pluginId: PLUGIN_ID,
      },
      // Open + matching plugin: reprocessed, still only partial -> stays open.
      {
        sender: "VM-TESTBK-S",
        smsBody: PARTIAL_BODY,
        receivedAt: RECEIVED_AT,
        status: "REJECTED",
        reviewReason: "FILTER_REJECTED",
        pluginId: PLUGIN_ID,
      },
      // Already resolved: must not be reprocessed.
      {
        sender: "JX-TESTBK-S",
        smsBody: "Rs.999.00 spent on your card XX1234 at ZOMATO.",
        receivedAt: RECEIVED_AT,
        status: "REJECTED",
        reviewReason: "FILTER_REJECTED",
        pluginId: PLUGIN_ID,
        resolvedAt: RECEIVED_AT,
      },
      // Soft-deleted: must not be reprocessed.
      {
        sender: "JY-TESTBK-S",
        smsBody: "Rs.111.00 spent on your card XX1234 at UBER.",
        receivedAt: RECEIVED_AT,
        status: "REJECTED",
        reviewReason: "FILTER_REJECTED",
        pluginId: PLUGIN_ID,
        isDeleted: true,
      },
      // Different plugin: out of scope for this update.
      {
        sender: "VM-OTHERB-S",
        smsBody: "Rs.222.00 spent on your card XX1234 at AMAZON.",
        receivedAt: RECEIVED_AT,
        status: "UNRECOGNIZED",
        reviewReason: "NO_PARSER",
        pluginId: "in.other.bank",
      },
    ]);
  }

  it("installs, flips the pointer, and re-runs only the open review queue", async () => {
    const { db } = createTestDb();
    await seedSavePath(db);
    await installParserBundle(db, V1);
    await seedReviewQueue(db);

    const summary = await applyExtensionUpdate(db, {
      bundle: makeBundle("2"),
      checksum: "cafebabe",
    });

    expect(summary).toMatchObject({
      pluginId: PLUGIN_ID,
      version: "2",
      reprocessed: 2,
      saved: 1,
      stillInReview: 1,
      prunedAssets: 0,
    });

    // Pointer flipped; trust follows the install source (registry); the old
    // asset row is retained as the rollback target with the new checksum on v2.
    const [plugin] = await db.select().from(plugins);
    expect(plugin.version).toBe("2");
    expect(plugin.trust).toBe("registry");
    const assets = await db.select().from(pluginAssets).orderBy(pluginAssets.id);
    expect(assets.map((a) => [a.version, a.checksum])).toEqual([
      ["1", null],
      ["2", "cafebabe"],
    ]);

    // Exactly one transaction came out of the queue, stamped with v2.
    const txns = await db.select().from(transactions);
    expect(txns).toHaveLength(1);
    expect(txns[0].sourcePluginId).toBe(PLUGIN_ID);
    expect(txns[0].sourcePluginVersion).toBe("2");
    expect(txns[0].amount).toBe("450.00");

    const reviews = await db.select().from(unrecognizedSms);
    const bySender = new Map(reviews.map((row) => [row.sender, row]));
    // Saved row is resolved now.
    expect(bySender.get("JD-TESTBK-S")?.resolvedAt).not.toBeNull();
    // Partial row stays open, reclassified by the new manifest.
    expect(bySender.get("VM-TESTBK-S")?.resolvedAt).toBeNull();
    expect(bySender.get("VM-TESTBK-S")?.pluginVersion).toBe("2");
    // Resolved / soft-deleted / other-plugin rows are untouched.
    expect(bySender.get("JX-TESTBK-S")?.pluginVersion).toBeNull();
    expect(bySender.get("JY-TESTBK-S")?.isDeleted).toBe(true);
    expect(bySender.get("VM-OTHERB-S")?.status).toBe("UNRECOGNIZED");
  });

  it("never edits already-saved transactions on update", async () => {
    const { db } = createTestDb();
    await seedSavePath(db);
    await installParserBundle(db, makeBundle("1"));

    // v1 already saved this SMS as a transaction (HIGH parse).
    const { processSms } = await import("@/db/services/sms-processing");
    const manifests = [makeBundle("1").manifest];
    const first = await processSms(db, manifests, {
      sender: "JD-TESTBK-S",
      body: PARSEABLE_BODY,
      receivedAt: RECEIVED_AT,
    });
    expect(first.kind).toBe("saved");
    const before = await db.select().from(transactions);

    const summary = await applyExtensionUpdate(db, {
      bundle: makeBundle("2"),
      checksum: "cafebabe",
    });

    // No open review rows for this plugin -> nothing reprocessed, and the
    // saved transaction keeps its original v1 provenance untouched.
    expect(summary.reprocessed).toBe(0);
    const after = await db.select().from(transactions);
    expect(after).toEqual(before);
    expect(after[0].sourcePluginVersion).toBe("1");
  });

  it("preserves a disabled toggle and lazily prunes to two retained versions", async () => {
    const { db } = createTestDb();
    await seedSavePath(db);
    await installParserBundle(db, makeBundle("1"));
    await installParserBundle(db, makeBundle("2"), { source: "registry" });
    const { setExtensionEnabled } = await import("@/db/services/extensions");
    await setExtensionEnabled(db, PLUGIN_ID, false);

    const summary = await applyExtensionUpdate(db, {
      bundle: makeBundle("3"),
      checksum: "feedface",
    });

    expect(summary.prunedAssets).toBe(1);
    const [plugin] = await db.select().from(plugins);
    expect(plugin.enabled).toBe(false);
    expect(plugin.version).toBe("3");
    const versions = (await db.select().from(pluginAssets)).map((a) => a.version).sort();
    expect(versions).toEqual(["2", "3"]);
  });
});
