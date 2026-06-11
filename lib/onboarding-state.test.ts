import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { plugins } from "@/db/schema";
import { getSetting } from "@/db/services/app-settings";
import { createTestDb } from "@/db/test-support/harness";
import {
  bundledProviderListings,
  countriesFromListings,
  countryDisplayName,
  filterListings,
  friendlyOutcomeCopy,
  getSmsSetupCompletedAt,
  groupListingsByCountry,
  installProviderListing,
  listingsFromCatalog,
  markSmsSetupCompleted,
  providerInstallState,
  providersForCountry,
  shouldShowSmsOnboarding,
  SMS_SETUP_COMPLETED_AT_KEY,
  type ProviderListing,
} from "@/lib/onboarding-state";
import type { Sha256Hex } from "@/lib/registry/checksum";
import type { RegistryCatalog, RegistryCatalogEntry } from "@/lib/registry/types";

const nodeSha256: Sha256Hex = async (body) =>
  createHash("sha256").update(body, "utf8").digest("hex");

function makeListing(overrides: Partial<ProviderListing> = {}): ProviderListing {
  return {
    pluginId: "in.test.bank",
    name: "Test Bank",
    country: "IN",
    version: "1",
    registryEntry: null,
    ...overrides,
  };
}

describe("shouldShowSmsOnboarding (first-run gate)", () => {
  const base = {
    platform: "android",
    isReady: true,
    completedAt: null,
    inOnboardingGroup: false,
  };

  it("redirects on Android when setup was never completed", () => {
    expect(shouldShowSmsOnboarding(base)).toBe(true);
  });

  it("never redirects off Android (SMS ingestion is Android v1)", () => {
    expect(shouldShowSmsOnboarding({ ...base, platform: "ios" })).toBe(false);
    expect(shouldShowSmsOnboarding({ ...base, platform: "web" })).toBe(false);
  });

  it("never redirects while the settings source is still loading", () => {
    expect(shouldShowSmsOnboarding({ ...base, isReady: false })).toBe(false);
  });

  it("does not redirect once smsSetupCompletedAt is set ('Set up later' included)", () => {
    expect(shouldShowSmsOnboarding({ ...base, completedAt: "2026-06-12T00:00:00.000Z" })).toBe(
      false,
    );
  });

  it("does not redirect while already inside the onboarding group (no loop)", () => {
    expect(shouldShowSmsOnboarding({ ...base, inOnboardingGroup: true })).toBe(false);
  });
});

describe("smsSetupCompletedAt prefs flag (ADR-0005 KV)", () => {
  it("round-trips and is idempotent on re-completion", async () => {
    const { db } = createTestDb();
    expect(await getSmsSetupCompletedAt(db)).toBeNull();

    await markSmsSetupCompleted(db, new Date("2026-06-12T01:00:00.000Z"));
    expect(await getSmsSetupCompletedAt(db)).toBe("2026-06-12T01:00:00.000Z");

    // Re-running the wizard just refreshes the timestamp; no duplicate rows.
    await markSmsSetupCompleted(db, new Date("2026-06-12T02:00:00.000Z"));
    expect(await getSetting(db, SMS_SETUP_COMPLETED_AT_KEY)).toBe("2026-06-12T02:00:00.000Z");
  });
});

describe("provider listings", () => {
  it("maps catalog entries to listings with uppercased countries", () => {
    const catalog: RegistryCatalog = {
      schemaVersion: "1",
      generatedAt: "2026-06-12T00:00:00.000Z",
      signature: null,
      entries: [
        {
          pluginId: "th.bangkok.bank",
          name: "Bangkok Bank",
          country: "th",
          currency: "THB",
          version: "2",
          file: "manifests/bangkok-bank.json",
          sha256: "a".repeat(64),
          bytes: 100,
        },
      ],
    };
    const listings = listingsFromCatalog(catalog);
    expect(listings).toHaveLength(1);
    expect(listings[0].country).toBe("TH");
    expect(listings[0].registryEntry?.file).toBe("manifests/bangkok-bank.json");
  });

  it("derives bundled fallback listings from the compiled-in manifests", () => {
    const listings = bundledProviderListings();
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => listing.registryEntry === null)).toBe(true);
    expect(listings.some((listing) => listing.country === "IN")).toBe(true);
  });

  it("lists distinct sorted countries and filters providers per country", () => {
    const listings = [
      makeListing({ pluginId: "in.a", country: "IN", name: "Zed Bank" }),
      makeListing({ pluginId: "th.b", country: "TH" }),
      makeListing({ pluginId: "in.c", country: "IN", name: "Alpha Bank" }),
    ];
    expect(countriesFromListings(listings)).toEqual(["IN", "TH"]);
    const india = providersForCountry(listings, "in");
    expect(india.map((listing) => listing.name)).toEqual(["Alpha Bank", "Zed Bank"]);
  });

  it("groups by country with name-sorted listings", () => {
    const groups = groupListingsByCountry([
      makeListing({ pluginId: "th.b", country: "TH" }),
      makeListing({ pluginId: "in.a", country: "IN" }),
    ]);
    expect(groups.map((group) => group.country)).toEqual(["IN", "TH"]);
    expect(groups[0].listings[0].pluginId).toBe("in.a");
  });

  it("filters by name or pluginId, case-insensitively; blank returns all", () => {
    const listings = [
      makeListing({ pluginId: "in.hdfc.bank", name: "HDFC Bank" }),
      makeListing({ pluginId: "in.sbi.bank", name: "State Bank of India" }),
    ];
    expect(filterListings(listings, "hdfc")).toHaveLength(1);
    expect(filterListings(listings, "in.sbi")).toHaveLength(1);
    expect(filterListings(listings, "  ")).toHaveLength(2);
    expect(filterListings(listings, "nope")).toHaveLength(0);
  });

  it("renders friendly country names with a raw-code fallback", () => {
    expect(countryDisplayName("in")).toBe("India");
    expect(countryDisplayName("ZZ")).toBe("ZZ");
  });
});

describe("providerInstallState", () => {
  const installed = [{ pluginId: "in.test.bank", version: "1.2" }];

  it("is not-installed when no plugins row exists", () => {
    expect(providerInstallState([], makeListing())).toBe("not-installed");
  });

  it("is installed when the catalog version is not newer", () => {
    expect(providerInstallState(installed, makeListing({ version: "1.2" }))).toBe("installed");
    expect(providerInstallState(installed, makeListing({ version: "1.0" }))).toBe("installed");
  });

  it("is update-available when the catalog version is strictly newer", () => {
    expect(providerInstallState(installed, makeListing({ version: "1.10" }))).toBe(
      "update-available",
    );
  });
});

describe("installProviderListing", () => {
  it("installs a bundled-only listing with bundled trust, idempotently", async () => {
    const { db } = createTestDb();
    const bundled = bundledProviderListings()[0];

    await installProviderListing(db, bundled);
    await installProviderListing(db, bundled); // wizard re-run: upsert, no throw

    const rows = await db.select().from(plugins);
    expect(rows).toHaveLength(1);
    expect(rows[0].pluginId).toBe(bundled.pluginId);
    expect(rows[0].trust).toBe("bundled");
  });

  it("downloads, checksum-verifies, and installs a registry listing", async () => {
    const { db } = createTestDb();
    const bundledSource = bundledProviderListings()[0];
    const sourceBundle = (await import("@/lib/parser/manifests")).bundledParserBundles.find(
      (bundle) => bundle.manifest.pluginId === bundledSource.pluginId,
    )!;
    const body = JSON.stringify(sourceBundle);
    const sha256 = await nodeSha256(body);

    const entry: RegistryCatalogEntry = {
      pluginId: sourceBundle.manifest.pluginId,
      name: sourceBundle.manifest.name,
      country: sourceBundle.manifest.country,
      currency: "INR",
      version: sourceBundle.manifest.version,
      file: "manifests/test.json",
      sha256,
      bytes: body.length,
    };
    const listing = makeListing({
      pluginId: entry.pluginId,
      version: entry.version,
      registryEntry: entry,
    });

    const fetchFn = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    await installProviderListing(db, listing, {
      fetchFn,
      baseUrl: "https://registry.test",
      sha256: nodeSha256,
    });

    const rows = await db.select().from(plugins);
    expect(rows).toHaveLength(1);
    expect(rows[0].trust).toBe("registry");
  });

  it("rejects registry listings whose body fails the checksum", async () => {
    const { db } = createTestDb();
    const entry: RegistryCatalogEntry = {
      pluginId: "in.test.bank",
      name: "Test Bank",
      country: "IN",
      currency: "INR",
      version: "1",
      file: "manifests/test.json",
      sha256: "a".repeat(64),
      bytes: 10,
    };
    const fetchFn = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;

    await expect(
      installProviderListing(db, makeListing({ registryEntry: entry }), {
        fetchFn,
        baseUrl: "https://registry.test",
        sha256: nodeSha256,
      }),
    ).rejects.toThrow(/Checksum mismatch/);
    expect(await db.select().from(plugins)).toHaveLength(0);
  });

  it("throws a clear error for an unknown bundled-only pluginId", async () => {
    const { db } = createTestDb();
    await expect(
      installProviderListing(db, makeListing({ pluginId: "xx.unknown" })),
    ).rejects.toThrow(/No bundled manifest/);
  });
});

describe("friendlyOutcomeCopy", () => {
  const result = { reasons: [], confidence: "HIGH" } as never;

  it("maps every outcome kind to user-facing copy", () => {
    expect(friendlyOutcomeCopy({ kind: "saved", transactionId: 1, result }).title).toBe(
      "Transaction saved",
    );
    expect(friendlyOutcomeCopy({ kind: "duplicate", transactionId: 1, result }).title).toBe(
      "Already recorded",
    );
    expect(
      friendlyOutcomeCopy({ kind: "review", reviewId: 1, result, status: "LOW_CONFIDENCE" }).title,
    ).toBe("Saved for review");
    expect(friendlyOutcomeCopy({ kind: "rejected", result }).title).toBe(
      "Not a transaction message",
    );
  });
});
