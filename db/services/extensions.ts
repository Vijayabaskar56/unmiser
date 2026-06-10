import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { pluginAssets, plugins, type NewPlugin, type NewPluginAsset } from "@/db/schema";
import { bundledParserBundles } from "@/lib/parser/manifests";
import { smsParserManifestSchema } from "@/lib/parser/manifest-schema";
import type { ManifestWithFixtures, SmsParserManifest } from "@/lib/parser/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export async function installParserBundle(
  db: Db,
  bundle: ManifestWithFixtures,
  enabled = true,
): Promise<void> {
  const manifest = smsParserManifestSchema.parse(bundle.manifest);
  const pluginRow: NewPlugin = {
    pluginId: manifest.pluginId,
    type: manifest.type,
    name: manifest.name,
    country: manifest.country,
    version: manifest.version,
    trust: manifest.trust,
    enabled,
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
        trust: manifest.trust,
        enabled,
        updatedAt: new Date().toISOString(),
      },
    });

  const assetRow: NewPluginAsset = {
    pluginId: manifest.pluginId,
    version: manifest.version,
    manifestJson: JSON.stringify(manifest),
    fixturesJson: JSON.stringify(bundle.fixtures),
  };
  await db
    .insert(pluginAssets)
    .values(assetRow)
    .onConflictDoUpdate({
      target: [pluginAssets.pluginId, pluginAssets.version],
      set: {
        manifestJson: assetRow.manifestJson,
        fixturesJson: assetRow.fixturesJson,
      },
    });
}

export async function installBundledParserExtensions(db: Db): Promise<void> {
  for (const bundle of bundledParserBundles) {
    await installParserBundle(db, bundle, true);
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

export async function loadEnabledParserManifests(db: Db): Promise<SmsParserManifest[]> {
  const rows = await db
    .select({
      manifestJson: pluginAssets.manifestJson,
    })
    .from(pluginAssets)
    .innerJoin(plugins, eq(pluginAssets.pluginId, plugins.pluginId))
    .where(eq(plugins.enabled, true));

  return rows.map((row) => smsParserManifestSchema.parse(JSON.parse(row.manifestJson)));
}
