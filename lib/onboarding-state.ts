import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { getSetting, setSetting } from "@/db/services/app-settings";
import { installParserBundle } from "@/db/services/extensions";
import type { SmsProcessOutcome } from "@/db/services/sms-processing";
import { bundledParserBundles } from "@/lib/parser/manifests";
import {
  fetchCatalog,
  fetchManifestBundle,
  type RegistryClientOptions,
} from "@/lib/registry/client";
import type { RegistryCatalog, RegistryCatalogEntry } from "@/lib/registry/types";
import { compareVersions } from "@/lib/registry/updates";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * SMS-setup onboarding state (ROADMAP Phase 2, workstream B).
 *
 * The wizard's completion flag is a KV app preference (ADR-0005) — set both on
 * finishing the wizard AND on "Set up later", so the first-run gate never
 * traps the user. The wizard stays re-runnable from its deep link
 * (`/sms-setup`); every step is idempotent (installs upsert, accounts
 * auto-create, permission requests are safe to repeat).
 */
export const SMS_SETUP_COMPLETED_AT_KEY = "smsSetupCompletedAt";

export interface SmsOnboardingGateInput {
  /** Platform.OS — the wizard is Android-only (SMS ingestion is Android v1). */
  platform: string;
  /** Whether the settings source has loaded; never redirect while loading. */
  isReady: boolean;
  /** The stored `smsSetupCompletedAt` value, or null when unset. */
  completedAt: string | null;
  /** True when the navigator is already inside the (onboarding) group. */
  inOnboardingGroup: boolean;
}

/** Pure first-run gate: should the root layout redirect into the wizard? */
export function shouldShowSmsOnboarding(input: SmsOnboardingGateInput): boolean {
  return (
    input.platform === "android" &&
    input.isReady &&
    input.completedAt === null &&
    !input.inOnboardingGroup
  );
}

export async function getSmsSetupCompletedAt(db: Db): Promise<string | null> {
  return getSetting(db, SMS_SETUP_COMPLETED_AT_KEY);
}

/** Idempotent: re-completing the wizard just refreshes the timestamp. */
export async function markSmsSetupCompleted(db: Db, now: Date = new Date()): Promise<void> {
  await setSetting(db, SMS_SETUP_COMPLETED_AT_KEY, now.toISOString());
}

// ---------------------------------------------------------------------------
// Provider listings: a UI-agnostic union of the registry catalog and the
// bundled manifests, so the wizard and the store screen render one shape.
// ---------------------------------------------------------------------------

export interface ProviderListing {
  pluginId: string;
  name: string;
  /** ISO 3166-1 alpha-2 country code, uppercased. */
  country: string;
  version: string;
  /** Present when the listing came from the registry catalog. */
  registryEntry: RegistryCatalogEntry | null;
}

export function listingsFromCatalog(catalog: RegistryCatalog): ProviderListing[] {
  return catalog.entries.map((entry) => ({
    pluginId: entry.pluginId,
    name: entry.name,
    country: entry.country.toUpperCase(),
    version: entry.version,
    registryEntry: entry,
  }));
}

/** Offline fallback: the manifests compiled into the app binary. */
export function bundledProviderListings(): ProviderListing[] {
  return bundledParserBundles.map((bundle) => ({
    pluginId: bundle.manifest.pluginId,
    name: bundle.manifest.name,
    country: bundle.manifest.country.toUpperCase(),
    version: bundle.manifest.version,
    registryEntry: null,
  }));
}

/** Distinct countries, sorted ascending. */
export function countriesFromListings(listings: ProviderListing[]): string[] {
  return [...new Set(listings.map((listing) => listing.country))].sort();
}

export function providersForCountry(
  listings: ProviderListing[],
  country: string,
): ProviderListing[] {
  const wanted = country.toUpperCase();
  return listings
    .filter((listing) => listing.country === wanted)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive name/pluginId search; blank query returns everything. */
export function filterListings(listings: ProviderListing[], query: string): ProviderListing[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return listings;
  return listings.filter(
    (listing) =>
      listing.name.toLowerCase().includes(needle) ||
      listing.pluginId.toLowerCase().includes(needle),
  );
}

export interface CountryGroup {
  country: string;
  listings: ProviderListing[];
}

/** Groups by country (sorted), listings name-sorted within each group. */
export function groupListingsByCountry(listings: ProviderListing[]): CountryGroup[] {
  return countriesFromListings(listings).map((country) => ({
    country,
    listings: providersForCountry(listings, country),
  }));
}

// Friendly names for the countries currently covered by the store; unknown
// codes fall back to the raw code so new registry countries still render.
const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  CO: "Colombia",
  FR: "France",
  IN: "India",
  OM: "Oman",
  SA: "Saudi Arabia",
  SG: "Singapore",
  TH: "Thailand",
  US: "United States",
};

export function countryDisplayName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export type ProviderInstallState = "not-installed" | "installed" | "update-available";

/**
 * Compares a listing against the installed `plugins` rows. "update-available"
 * only when the listing's version is strictly newer than the installed one.
 */
export function providerInstallState(
  installed: Array<{ pluginId: string; version: string }>,
  listing: Pick<ProviderListing, "pluginId" | "version">,
): ProviderInstallState {
  const plugin = installed.find((row) => row.pluginId === listing.pluginId);
  if (!plugin) return "not-installed";
  return compareVersions(listing.version, plugin.version) > 0 ? "update-available" : "installed";
}

/**
 * Install one provider listing. Registry listings download + checksum-verify
 * via lib/registry; bundled-only listings install the compiled-in bundle.
 * Idempotent — installParserBundle upserts and preserves the enabled toggle.
 */
export async function installProviderListing(
  db: Db,
  listing: ProviderListing,
  registryOptions: RegistryClientOptions = {},
): Promise<void> {
  if (listing.registryEntry) {
    const verified = await fetchManifestBundle(listing.registryEntry, registryOptions);
    await installParserBundle(db, verified.bundle, {
      source: "registry",
      checksum: verified.checksum,
    });
    return;
  }
  const bundled = bundledParserBundles.find(
    (bundle) => bundle.manifest.pluginId === listing.pluginId,
  );
  if (!bundled) {
    throw new Error(`No bundled manifest for extension "${listing.pluginId}"`);
  }
  await installParserBundle(db, bundled, { source: "bundled" });
}

export interface ProviderListingsResult {
  listings: ProviderListing[];
  /** Where the listings came from — "bundled" means the registry was unreachable. */
  source: "registry" | "bundled";
}

/**
 * Catalog with offline fallback: try the registry; on any failure fall back to
 * the bundled manifest set so the wizard works with zero network.
 */
export async function loadProviderListings(
  registryOptions: RegistryClientOptions = {},
): Promise<ProviderListingsResult> {
  try {
    const catalog = await fetchCatalog(registryOptions);
    return { listings: listingsFromCatalog(catalog), source: "registry" };
  } catch {
    return { listings: bundledProviderListings(), source: "bundled" };
  }
}

// ---------------------------------------------------------------------------
// Friendly copy for the production paste-SMS flow (workstream B: permission
// denial is not a dead end — the paste sheet is the fallback path).
// ---------------------------------------------------------------------------

export interface OutcomeCopy {
  title: string;
  detail: string;
}

export function friendlyOutcomeCopy(outcome: SmsProcessOutcome): OutcomeCopy {
  switch (outcome.kind) {
    case "saved":
      return {
        title: "Transaction saved",
        detail: "We recognized this message and added the transaction to your history.",
      };
    case "duplicate":
      return {
        title: "Already recorded",
        detail: "This message matches a transaction you already have, so nothing was added.",
      };
    case "review":
      return {
        title: "Saved for review",
        detail:
          "We couldn't confidently read every detail, so it's waiting in SMS Review for you to confirm.",
      };
    case "rejected":
      return {
        title: "Not a transaction message",
        detail:
          "This doesn't look like a bank transaction SMS. If it should be, the right bank extension may not be installed yet.",
      };
  }
}
