import { and, eq, isNull } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { plugins, unrecognizedSms } from "@/db/schema";
import { getSetting, setSetting } from "@/db/services/app-settings";
import {
  installParserBundle,
  loadEnabledParserManifests,
  prunePluginAssets,
} from "@/db/services/extensions";
import { processSms, type SmsProcessOutcome } from "@/db/services/sms-processing";
import type { VerifiedRegistryBundle } from "@/lib/registry/client";
import type { RegistryCatalog, RegistryCatalogEntry } from "@/lib/registry/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Numeric-aware compare of dotted string versions ("2" > "1", "1.10" > "1.9",
 * missing segments count as 0; non-numeric segments fall back to string
 * compare, and numeric segments sort after non-numeric ones — "1.0" > "1.rc").
 * Returns <0 / 0 / >0 like a comparator.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split(/[.-]/);
  const bParts = b.split(/[.-]/);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const aPart = aParts[i] ?? "0";
    const bPart = bParts[i] ?? "0";
    const aNum = /^\d+$/.test(aPart) ? Number(aPart) : null;
    const bNum = /^\d+$/.test(bPart) ? Number(bPart) : null;
    if (aNum !== null && bNum !== null) {
      if (aNum !== bNum) return aNum - bNum;
    } else if (aNum !== null || bNum !== null) {
      // Numeric beats non-numeric ("1.0" > "1.rc").
      return aNum !== null ? 1 : -1;
    } else if (aPart !== bPart) {
      return aPart < bPart ? -1 : 1;
    }
  }
  return 0;
}

export interface ExtensionUpdate {
  pluginId: string;
  name: string;
  installedVersion: string;
  availableVersion: string;
  /** Catalog entry to feed straight into fetchManifestBundle on accept. */
  entry: RegistryCatalogEntry;
}

/**
 * Diff the registry catalog against installed plugins. Pure detection —
 * updates are surfaced to the user and NEVER auto-applied.
 */
export async function checkForUpdates(
  db: Db,
  catalog: RegistryCatalog,
): Promise<ExtensionUpdate[]> {
  const installed = await db
    .select({ pluginId: plugins.pluginId, name: plugins.name, version: plugins.version })
    .from(plugins);

  const byPluginId = new Map(catalog.entries.map((entry) => [entry.pluginId, entry]));
  const updates: ExtensionUpdate[] = [];
  for (const plugin of installed) {
    const entry = byPluginId.get(plugin.pluginId);
    if (!entry) continue;
    if (compareVersions(entry.version, plugin.version) > 0) {
      updates.push({
        pluginId: plugin.pluginId,
        name: plugin.name,
        installedVersion: plugin.version,
        availableVersion: entry.version,
        entry,
      });
    }
  }
  return updates;
}

/** KV prefs key (ADR-0005) holding the last automatic catalog check, ISO. */
export const REGISTRY_LAST_CHECKED_AT_KEY = "registryLastCheckedAt";

export const REGISTRY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Throttle for the automatic on-foreground catalog check: at most once per
 * 24h. A manual "Check for updates" tap passes `force: true` to bypass.
 */
export async function shouldCheckRegistry(
  db: Db,
  options: { now?: Date; force?: boolean } = {},
): Promise<boolean> {
  const { now = new Date(), force = false } = options;
  if (force) return true;
  const raw = await getSetting(db, REGISTRY_LAST_CHECKED_AT_KEY);
  if (raw === null) return true;
  const last = Date.parse(raw);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= REGISTRY_CHECK_INTERVAL_MS;
}

export async function markRegistryChecked(db: Db, now: Date = new Date()): Promise<void> {
  await setSetting(db, REGISTRY_LAST_CHECKED_AT_KEY, now.toISOString());
}

export interface ApplyUpdateSummary {
  pluginId: string;
  version: string;
  /** Open review rows re-run through the parser. */
  reprocessed: number;
  /** Review rows the new manifest converted into saved transactions. */
  saved: number;
  /** Review rows that remain in review (possibly with updated status). */
  stillInReview: number;
  /** Pruned plugin_assets rows (lazy keep-last-2 retention). */
  prunedAssets: number;
}

/**
 * Apply one already-downloaded, checksum-verified update:
 *
 * 1. installs the new version (old plugin_assets row kept; pointer flips),
 * 2. prunes retained assets to active + one rollback target,
 * 3. re-runs ONLY the open review queue for this plugin (`unrecognized_sms`
 *    where pluginId matches, resolvedAt is null, not soft-deleted) through
 *    processSms with the freshly loaded enabled manifests.
 *
 * It never edits already-saved `transactions` rows — they keep their
 * `sourcePluginVersion` stamp; only the review queue still holds raw SMS
 * bodies to re-parse.
 */
export async function applyExtensionUpdate(
  db: Db,
  verified: Pick<VerifiedRegistryBundle, "bundle" | "checksum">,
): Promise<ApplyUpdateSummary> {
  const { bundle, checksum } = verified;
  const pluginId = bundle.manifest.pluginId;

  // `enabled` omitted on purpose: an update must not flip the user's toggle.
  await installParserBundle(db, bundle, { source: "registry", checksum });
  const prunedAssets = await prunePluginAssets(db, pluginId);

  const manifests = await loadEnabledParserManifests(db);
  const openRows = await db
    .select({
      sender: unrecognizedSms.sender,
      smsBody: unrecognizedSms.smsBody,
      receivedAt: unrecognizedSms.receivedAt,
    })
    .from(unrecognizedSms)
    .where(
      and(
        eq(unrecognizedSms.pluginId, pluginId),
        isNull(unrecognizedSms.resolvedAt),
        eq(unrecognizedSms.isDeleted, false),
      ),
    );

  let saved = 0;
  let stillInReview = 0;
  for (const row of openRows) {
    const outcome: SmsProcessOutcome = await processSms(db, manifests, {
      sender: row.sender,
      body: row.smsBody,
      receivedAt: row.receivedAt,
    });
    if (outcome.kind === "saved" || outcome.kind === "duplicate" || outcome.kind === "mandate") {
      saved += 1;
    } else stillInReview += 1;
  }

  return {
    pluginId,
    version: bundle.manifest.version,
    reprocessed: openRows.length,
    saved,
    stillInReview,
    prunedAssets,
  };
}
