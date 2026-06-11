import { describe, expect, it } from "vitest";

import { pluginAssets, plugins } from "@/db/schema";
import {
  installParserBundle,
  loadEnabledParserManifests,
  prunePluginAssets,
  setActiveExtensionVersion,
  setExtensionEnabled,
} from "@/db/services/extensions";
import { createTestDb } from "@/db/test-support/harness";
import type { ManifestWithFixtures, SmsParserManifest } from "@/lib/parser/types";

function makeTestBundle(
  version: string,
  manifestOverrides: Partial<SmsParserManifest> = {},
): ManifestWithFixtures {
  return {
    manifest: {
      schemaVersion: "1.0",
      pluginId: "in.test.bank",
      type: "sms-parser",
      name: "Test Bank",
      country: "IN",
      currency: "INR",
      version,
      trust: "bundled",
      dispatch: { senders: ["TESTBK"], dltPatterns: ["^[A-Z]{2}-TESTBK-[A-Z]$"] },
      extract: {
        amount: [{ re: "Rs\\.?\\s*(?<value>[0-9,]+(?:\\.\\d{1,2})?)\\s+spent" }],
      },
      typeRules: { expense: ["spent"] },
      ...manifestOverrides,
    },
    fixtures: [],
  };
}

describe("installParserBundle trust by install source", () => {
  it("defaults to bundled trust", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));

    const [row] = await db.select().from(plugins);
    expect(row.trust).toBe("bundled");
  });

  it("sets registry trust for store installs", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"), { source: "registry" });

    const [row] = await db.select().from(plugins);
    expect(row.trust).toBe("registry");
  });

  it("ignores the manifest's own (non-authoritative) trust field", async () => {
    const { db } = createTestDb();
    // A registry-fetched manifest claiming "bundled" must not gain it.
    await installParserBundle(db, makeTestBundle("1", { trust: "community" }), {
      source: "bundled",
    });

    const [row] = await db.select().from(plugins);
    expect(row.trust).toBe("bundled");
  });
});

describe("installParserBundle checksum + enabled semantics", () => {
  it("stores the verified checksum on the asset row (null for bundled)", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await installParserBundle(db, makeTestBundle("2"), {
      source: "registry",
      checksum: "abc123",
    });

    const assets = await db.select().from(pluginAssets).orderBy(pluginAssets.id);
    expect(assets.map((a) => a.checksum)).toEqual([null, "abc123"]);
  });

  it("preserves the user's enabled toggle on update when enabled is omitted", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await setExtensionEnabled(db, "in.test.bank", false);

    await installParserBundle(db, makeTestBundle("2"), { source: "registry" });

    const [row] = await db.select().from(plugins);
    expect(row.enabled).toBe(false);
    expect(row.version).toBe("2");
  });

  it("applies an explicit enabled flag on update", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await setExtensionEnabled(db, "in.test.bank", false);

    await installParserBundle(db, makeTestBundle("2"), { enabled: true });

    const [row] = await db.select().from(plugins);
    expect(row.enabled).toBe(true);
  });
});

describe("loadEnabledParserManifests (pluginId, version) join", () => {
  it("loads only the active version after an update, not every retained asset", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await installParserBundle(db, makeTestBundle("2"), { source: "registry" });

    // Both asset rows are retained (rollback target)...
    const assets = await db.select().from(pluginAssets);
    expect(assets).toHaveLength(2);

    // ...but the loader must follow the active-version pointer only —
    // joining on pluginId alone double-dispatched every SMS here.
    const manifests = await loadEnabledParserManifests(db);
    expect(manifests).toHaveLength(1);
    expect(manifests[0].version).toBe("2");
  });

  it("excludes disabled plugins", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await setExtensionEnabled(db, "in.test.bank", false);

    expect(await loadEnabledParserManifests(db)).toHaveLength(0);
  });
});

describe("setActiveExtensionVersion (rollback)", () => {
  it("flips the pointer back to a retained version without re-download", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await installParserBundle(db, makeTestBundle("2"), { source: "registry" });

    await setActiveExtensionVersion(db, "in.test.bank", "1");

    const [row] = await db.select().from(plugins);
    expect(row.version).toBe("1");
    const manifests = await loadEnabledParserManifests(db);
    expect(manifests[0].version).toBe("1");
  });

  it("rejects a dangling pointer (no asset for that version)", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));

    await expect(setActiveExtensionVersion(db, "in.test.bank", "9")).rejects.toThrow(
      /No installed asset/,
    );
  });
});

describe("prunePluginAssets", () => {
  it("keeps the active version plus the newest rollback target", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await installParserBundle(db, makeTestBundle("2"));
    await installParserBundle(db, makeTestBundle("3"));

    const pruned = await prunePluginAssets(db, "in.test.bank");

    expect(pruned).toBe(1);
    const versions = (await db.select().from(pluginAssets)).map((a) => a.version).sort();
    expect(versions).toEqual(["2", "3"]);
  });

  it("keeps the active version even when it is not the newest row", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    await installParserBundle(db, makeTestBundle("2"));
    await installParserBundle(db, makeTestBundle("3"));
    await setActiveExtensionVersion(db, "in.test.bank", "1");

    const pruned = await prunePluginAssets(db, "in.test.bank");

    expect(pruned).toBe(1);
    const versions = (await db.select().from(pluginAssets)).map((a) => a.version).sort();
    // Active ("1") + newest other ("3"); "2" is pruned.
    expect(versions).toEqual(["1", "3"]);
  });

  it("is a no-op with two or fewer versions or an unknown plugin", async () => {
    const { db } = createTestDb();
    await installParserBundle(db, makeTestBundle("1"));
    expect(await prunePluginAssets(db, "in.test.bank")).toBe(0);
    expect(await prunePluginAssets(db, "in.unknown.bank")).toBe(0);
  });
});
