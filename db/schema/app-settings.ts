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
  // Numeric notification config: quiet-hours window (local hours 0–23; start ==
  // end means "off") and the large-transaction alert threshold (major units).
  notifyQuietStart: "notify.quietStart",
  notifyQuietEnd: "notify.quietEnd",
  notifyLargeThreshold: "notify.largeThreshold",
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
  // App-lock (see lib/security + App lock screen). The PIN itself is NEVER here
  // — its salted hash lives in expo-secure-store (ADR-0005: secrets off the KV
  // store). These are non-secret config: `appLockEnabled` is the master switch,
  // `appLockBiometric` opts into fingerprint/face unlock, `appLockTimeoutMinutes`
  // is the background grace before a re-lock ("0" = lock immediately; options
  // 0/1/5/15/30 mirror Cashiro). Booleans stored as "true"/"false".
  appLockEnabled: "security.appLockEnabled",
  appLockBiometric: "security.appLockBiometric",
  appLockTimeoutMinutes: "security.appLockTimeoutMinutes",
  // Selected app language (a locale code from lib/i18n; defaults to "en"). The
  // i18n layer applies it live via a context, like the accent/theme.
  appLanguage: "app.language",
} as const;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
