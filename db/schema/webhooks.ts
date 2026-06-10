import { integer, primaryKey, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

import { nowIso, uuid } from "../utils";
import {
  WEBHOOK_DATA_TYPES,
  WEBHOOK_LOG_STATUSES,
  WEBHOOK_RANGE_PRESETS,
  WEBHOOK_SYNC_REASONS,
} from "./enums";

export const webhookProfiles = sqliteTable("webhook_profiles", {
  id: text().primaryKey().$defaultFn(uuid),
  name: text().notNull(),
  url: text().notNull(),
  enabled: integer({ mode: "boolean" }).notNull().default(true),
  rangePreset: text({ enum: WEBHOOK_RANGE_PRESETS }).notNull().default("SINCE_LAST_SUCCESS"),
  customStart: text(),
  customEnd: text(),
  dataTypes: text().notNull().default(""), // CSV of WebhookDataType
  headersJson: text().notNull().default("[]"),
  lastError: text(),
  consecutiveFailures: integer().notNull().default(0),
  lastSyncedAt: text(),
  createdAt: text().notNull().$defaultFn(nowIso),
  updatedAt: text().notNull().$defaultFn(nowIso),
});

export const webhookLogs = sqliteTable(
  "webhook_logs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    profileId: text()
      .notNull()
      .references(() => webhookProfiles.id, { onDelete: "cascade" }),
    // Snapshotted from the profile name at delivery time so renames don't rewrite history.
    profileName: text().notNull(),
    syncReason: text({ enum: WEBHOOK_SYNC_REASONS }).notNull(),
    status: text({ enum: WEBHOOK_LOG_STATUSES }).notNull(),
    message: text().notNull(),
    httpStatus: integer(),
    batchCount: integer().notNull().default(0),
    createdAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("index_webhook_logs_profile_id").on(t.profileId),
    index("index_webhook_logs_created_at").on(t.createdAt),
  ],
);

export const webhookCursors = sqliteTable(
  "webhook_cursors",
  {
    profileId: text()
      .notNull()
      .references(() => webhookProfiles.id, { onDelete: "cascade" }),
    dataType: text({ enum: WEBHOOK_DATA_TYPES }).notNull(),
    lastSuccessAt: text(),
    lastRangeEnd: text(),
    updatedAt: text().notNull().$defaultFn(nowIso),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.dataType] }),
    index("index_webhook_cursors_profile_id").on(t.profileId),
  ],
);

export type WebhookProfile = typeof webhookProfiles.$inferSelect;
export type NewWebhookProfile = typeof webhookProfiles.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type WebhookCursor = typeof webhookCursors.$inferSelect;
export type NewWebhookCursor = typeof webhookCursors.$inferInsert;
