import { BTreeIndex, createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { pluginAssets, plugins, type Plugin, type PluginAsset } from "@/db/schema";
import { queryClient } from "@/lib/query-client";

export const pluginCollection = createCollection(
  queryCollectionOptions<Plugin>({
    queryKey: ["plugins"],
    queryClient,
    getKey: (plugin) => plugin.id,
    queryFn: async () => db.select().from(plugins),
  }),
);

// Backs the extensions screen's orderBy(name) live query.
pluginCollection.createIndex((plugin) => plugin.name, { indexType: BTreeIndex });

export const enabledPluginAssetCollection = createCollection(
  queryCollectionOptions<PluginAsset>({
    queryKey: ["enabled_plugin_assets"],
    queryClient,
    getKey: (asset) => asset.id,
    queryFn: async () =>
      db
        .select({
          id: pluginAssets.id,
          pluginId: pluginAssets.pluginId,
          version: pluginAssets.version,
          manifestJson: pluginAssets.manifestJson,
          fixturesJson: pluginAssets.fixturesJson,
          checksum: pluginAssets.checksum,
          createdAt: pluginAssets.createdAt,
        })
        .from(pluginAssets)
        // Join on (pluginId, version): plugins.version is the active-version
        // pointer, and old asset rows are retained for rollback after an
        // update — pluginId alone would surface both versions at once.
        .innerJoin(
          plugins,
          and(
            eq(pluginAssets.pluginId, plugins.pluginId),
            eq(pluginAssets.version, plugins.version),
          ),
        )
        .where(eq(plugins.enabled, true)),
  }),
);
