import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { nowIso } from "../utils";
import {
  EXTENSION_TRUST_TIERS,
  EXTENSION_TYPES,
  SMS_REVIEW_REASONS,
  SMS_REVIEW_STATUSES,
} from "./enums";

/**
 * Installed extension manifests. Product UI says "Extensions"; schema keeps the
 * shorter plugin naming established by the roadmap/TanStack DB layer.
 */
export const plugins = sqliteTable(
  "plugins",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    pluginId: text().notNull(),
    type: text({ enum: EXTENSION_TYPES }).notNull(),
    name: text().notNull(),
    country: text().notNull(),
    version: text().notNull(),
    trust: text({ enum: EXTENSION_TRUST_TIERS }).notNull(),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    installedAt: text().notNull().$defaultFn(nowIso),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("index_plugins_plugin_id").on(t.pluginId),
    index("index_plugins_country").on(t.country),
    index("index_plugins_enabled").on(t.enabled),
  ],
);

export const pluginAssets = sqliteTable(
  "plugin_assets",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    pluginId: text().notNull(),
    version: text().notNull(),
    manifestJson: text().notNull(),
    fixturesJson: text().notNull().default("[]"),
    checksum: text(),
    createdAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("index_plugin_assets_plugin_id_version").on(t.pluginId, t.version),
    index("index_plugin_assets_plugin_id").on(t.pluginId),
  ],
);

/**
 * SMS Review queue: bank-like SMS messages that need attention because they
 * could not be safely saved as transactions.
 */
export const unrecognizedSms = sqliteTable(
  "unrecognized_sms",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    sender: text().notNull(),
    smsBody: text().notNull(),
    receivedAt: text().notNull(),
    status: text({ enum: SMS_REVIEW_STATUSES }).notNull().default("UNRECOGNIZED"),
    reviewReason: text({ enum: SMS_REVIEW_REASONS }).notNull().default("NO_PARSER"),
    pluginId: text(),
    pluginVersion: text(),
    parserConfidence: text(),
    parsedFieldsJson: text(),
    rawMatchesJson: text(),
    reported: integer({ mode: "boolean" }).notNull().default(false),
    resolvedAt: text(),
    isDeleted: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("index_unrecognized_sms_sender_sms_body").on(t.sender, t.smsBody),
    index("index_unrecognized_sms_status").on(t.status),
    index("index_unrecognized_sms_plugin_id").on(t.pluginId),
  ],
);

export type Plugin = typeof plugins.$inferSelect;
export type NewPlugin = typeof plugins.$inferInsert;
export type PluginAsset = typeof pluginAssets.$inferSelect;
export type NewPluginAsset = typeof pluginAssets.$inferInsert;
export type UnrecognizedSms = typeof unrecognizedSms.$inferSelect;
export type NewUnrecognizedSms = typeof unrecognizedSms.$inferInsert;
