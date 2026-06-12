import { and, desc, eq, notInArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  pluginAssets,
  plugins,
  transactionRules,
  type NewPlugin,
  type NewPluginAsset,
  type Plugin,
} from "@/db/schema";
import { saveRule } from "@/db/services/rule-ops";
import { bundledParserBundles } from "@/lib/parser/manifests";
import { smsParserManifestSchema } from "@/lib/parser/manifest-schema";
import type { ManifestWithFixtures, SmsParserManifest } from "@/lib/parser/types";
import { rulePackSchema, type RulePack } from "@/lib/rules/rule-pack";
import * as v from "valibot";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Where an install came from. Trust is assigned by install source, NOT by the
 * manifest's own `trust` field (which is author-controlled and therefore
 * non-authoritative — a registry manifest claiming "bundled" must not gain
 * bundled trust by self-declaration). ROADMAP Phase 2 workstream A.
 */
export type InstallSource = "bundled" | "registry";

function trustForSource(source: InstallSource): Plugin["trust"] {
  return source === "bundled" ? "bundled" : "registry";
}

export interface InstallParserBundleOptions {
  /**
   * Explicit enable/disable. When omitted: fresh installs are enabled, and
   * updates of an existing plugin PRESERVE the user's current toggle.
   */
  enabled?: boolean;
  source?: InstallSource;
  /** Verified SHA-256 (registry installs); null for bundled installs. */
  checksum?: string | null;
}

export interface InstallRulePackOptions {
  enabled?: boolean;
  source?: InstallSource;
  checksum?: string | null;
}

/**
 * Install or update one parser extension. The `plugins` row is the identity +
 * active-version pointer; the `(pluginId, version)` row in `plugin_assets` is
 * the immutable payload for that version. On a version bump the old asset row
 * is kept (rollback = flip `plugins.version` back; see
 * `setActiveExtensionVersion` / `prunePluginAssets`).
 */
export async function installParserBundle(
  db: Db,
  bundle: ManifestWithFixtures,
  options: InstallParserBundleOptions = {},
): Promise<void> {
  const { enabled, source = "bundled", checksum = null } = options;
  const manifest = smsParserManifestSchema.parse(bundle.manifest);
  const trust = trustForSource(source);
  const pluginRow: NewPlugin = {
    pluginId: manifest.pluginId,
    type: manifest.type,
    name: manifest.name,
    country: manifest.country,
    version: manifest.version,
    trust,
    enabled: enabled ?? true,
  };
  await db
    .insert(plugins)
    .values(pluginRow)
    .onConflictDoUpdate({
      target: plugins.pluginId,
      set: {
        name: manifest.name,
        country: manifest.country,
        version: manifest.version,
        trust,
        // Omitting `enabled` preserves the user's existing toggle on update.
        ...(enabled === undefined ? {} : { enabled }),
        updatedAt: new Date().toISOString(),
      },
    });

  const assetRow: NewPluginAsset = {
    pluginId: manifest.pluginId,
    version: manifest.version,
    manifestJson: JSON.stringify(manifest),
    fixturesJson: JSON.stringify(bundle.fixtures),
    checksum,
  };
  await db
    .insert(pluginAssets)
    .values(assetRow)
    .onConflictDoUpdate({
      target: [pluginAssets.pluginId, pluginAssets.version],
      set: {
        manifestJson: assetRow.manifestJson,
        fixturesJson: assetRow.fixturesJson,
        checksum,
      },
    });
}

export async function installRulePack(
  db: Db,
  packInput: unknown,
  options: InstallRulePackOptions = {},
): Promise<void> {
  const { enabled = true, source = "registry", checksum = null } = options;
  const pack: RulePack = v.parse(rulePackSchema, packInput);
  const trust = trustForSource(source);

  await db
    .insert(plugins)
    .values({
      pluginId: pack.pluginId,
      type: "rule",
      name: pack.name,
      country: pack.country,
      version: pack.version,
      trust,
      enabled,
    })
    .onConflictDoUpdate({
      target: plugins.pluginId,
      set: {
        name: pack.name,
        country: pack.country,
        version: pack.version,
        trust,
        ...(options.enabled === undefined ? {} : { enabled }),
        updatedAt: new Date().toISOString(),
      },
    });

  await db
    .insert(pluginAssets)
    .values({
      pluginId: pack.pluginId,
      version: pack.version,
      manifestJson: JSON.stringify(pack),
      fixturesJson: "[]",
      checksum,
    })
    .onConflictDoUpdate({
      target: [pluginAssets.pluginId, pluginAssets.version],
      set: { manifestJson: JSON.stringify(pack), fixturesJson: "[]", checksum },
    });

  const existing = await db.select().from(transactionRules);
  const existingById = new Map(existing.map((rule) => [rule.id, rule]));
  for (const rule of pack.rules) {
    const stableId = `${pack.pluginId}:${rule.id}`;
    const current = existingById.get(stableId);
    if (current?.isActive || (current && !current.isSystemTemplate)) continue;
    await saveRule(db, {
      id: stableId,
      name: rule.name,
      description: rule.description ?? `${pack.name} template`,
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions,
      isActive: false,
      isSystemTemplate: true,
    });
  }
}

export async function installBundledParserExtensions(db: Db): Promise<void> {
  for (const bundle of bundledParserBundles) {
    await installParserBundle(db, bundle, { enabled: true, source: "bundled" });
  }
}

export async function setExtensionEnabled(
  db: Db,
  pluginId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(plugins)
    .set({ enabled, updatedAt: new Date().toISOString() })
    .where(eq(plugins.pluginId, pluginId));
}

/**
 * Point a plugin at an already-downloaded version (rollback / roll-forward
 * without re-fetching). Throws if no `plugin_assets` row exists for the
 * target `(pluginId, version)` — the pointer must never dangle.
 */
export async function setActiveExtensionVersion(
  db: Db,
  pluginId: string,
  version: string,
): Promise<void> {
  const assets = await db
    .select({ id: pluginAssets.id })
    .from(pluginAssets)
    .where(and(eq(pluginAssets.pluginId, pluginId), eq(pluginAssets.version, version)))
    .limit(1);
  if (assets.length === 0) {
    throw new Error(`No installed asset for extension "${pluginId}" version "${version}"`);
  }
  await db
    .update(plugins)
    .set({ version, updatedAt: new Date().toISOString() })
    .where(eq(plugins.pluginId, pluginId));
}

/**
 * Lazy retention: keep the active version plus the most recent other version
 * (rollback target) and delete the rest. Returns the pruned count.
 */
export async function prunePluginAssets(db: Db, pluginId: string): Promise<number> {
  const pluginRows = await db
    .select({ version: plugins.version })
    .from(plugins)
    .where(eq(plugins.pluginId, pluginId))
    .limit(1);
  if (pluginRows.length === 0) return 0;
  const activeVersion = pluginRows[0].version;

  const assets = await db
    .select({ id: pluginAssets.id, version: pluginAssets.version })
    .from(pluginAssets)
    .where(eq(pluginAssets.pluginId, pluginId))
    .orderBy(desc(pluginAssets.id));

  const keepIds: number[] = [];
  const active = assets.find((asset) => asset.version === activeVersion);
  if (active) keepIds.push(active.id);
  const newestOther = assets.find((asset) => asset.version !== activeVersion);
  if (newestOther) keepIds.push(newestOther.id);

  const stale = assets.filter((asset) => !keepIds.includes(asset.id));
  if (stale.length === 0) return 0;
  await db
    .delete(pluginAssets)
    .where(and(eq(pluginAssets.pluginId, pluginId), notInArray(pluginAssets.id, keepIds)));
  return stale.length;
}

/**
 * The manifests the parser actually runs. The join matches `plugin_assets` on
 * BOTH pluginId AND the plugin's active `version` pointer — joining on
 * pluginId alone loaded every retained version after an update and
 * double-dispatched the same SMS.
 */
export async function loadEnabledParserManifests(db: Db): Promise<SmsParserManifest[]> {
  const rows = await db
    .select({
      manifestJson: pluginAssets.manifestJson,
    })
    .from(pluginAssets)
    .innerJoin(
      plugins,
      and(eq(pluginAssets.pluginId, plugins.pluginId), eq(pluginAssets.version, plugins.version)),
    )
    .where(eq(plugins.enabled, true));

  return rows.map((row) => smsParserManifestSchema.parse(JSON.parse(row.manifestJson)));
}
