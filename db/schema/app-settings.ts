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
  // User profile (ADR-0005). The avatar is derived from the archetype, so it has
  // no key of its own. Banner is a preset id (see lib/profile/banners).
  profileName: "profile.name",
  profileArchetype: "profile.archetype",
  profileBannerId: "profile.bannerId",
  // On-device notification preferences (see lib/notifications + Notifications
  // screen). Each is a boolean stored as "true"/"false"; `notifyPushEnabled` is
  // the master switch that gates the rest.
  notifyPushEnabled: "notify.push",
  notifyEveryTransaction: "notify.everyTransaction",
  notifyLargeTransaction: "notify.largeTransaction",
  notifyBudgetWarnings: "notify.budgetWarnings",
  notifySubscriptionRenewals: "notify.subscriptionRenewals",
  notifyUnrecognisedSms: "notify.unrecognisedSms",
  notifyWeeklyReview: "notify.weeklyReview",
  // Appearance (see lib/appearance + Appearance screen). theme is light|dark|auto;
  // accent is a swatch id; textStep is "0".."4"; the rest are booleans. Theme +
  // tab-bar labels are applied live; accent/text-size/blur/density persist and
  // are reflected in the screen's Preview (app-wide application is deferred).
  appearanceTheme: "appearance.theme",
  appearanceAccent: "appearance.accent",
  appearanceTextStep: "appearance.textStep",
  appearanceBackgroundBlur: "appearance.backgroundBlur",
  appearanceCompactDensity: "appearance.compactDensity",
  appearanceTabBarLabels: "appearance.tabBarLabels",
} as const;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
