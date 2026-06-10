import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Key-value app preferences, read reactively via a TanStack DB live query.
// Singleton facts about the app live here, not as columns on domain tables —
// e.g. `mainAccountId` (an accounts.id). Secrets do NOT go here (secure-store).
// See ADR-0005.
export const appSettings = sqliteTable("app_settings", {
  key: text().primaryKey(),
  value: text(), // string or JSON; interpreted per key
});

export const APP_SETTING_KEYS = {
  mainAccountId: "mainAccountId",
} as const;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
