import { APP_SETTING_KEYS } from "@/db/schema";

/**
 * On-device notification preferences. Pure model + (de)serialisation, kept free
 * of any DB/native imports so it stays unit-testable. The DB service
 * (`db/services/notification-settings.ts`) reads/writes these through
 * `app_settings`; the screen reads them reactively via the app-settings
 * collection and `notificationPrefsFromMap`.
 */
export interface NotificationPrefs {
  /** Master switch — when off, nothing is delivered. */
  pushEnabled: boolean;
  everyTransaction: boolean;
  largeTransaction: boolean;
  /** Persisted, but inert until the Budgets feature ships (schema-only today). */
  budgetWarnings: boolean;
  subscriptionRenewals: boolean;
  unrecognisedSms: boolean;
  weeklyReview: boolean;
}

/** Defaults mirror the Notifications screen design (large/budget/subs/unrec on). */
export const NOTIFICATION_DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  everyTransaction: false,
  largeTransaction: true,
  budgetWarnings: true,
  subscriptionRenewals: true,
  unrecognisedSms: true,
  weeklyReview: false,
};

const KEY_BY_FIELD: Record<keyof NotificationPrefs, string> = {
  pushEnabled: APP_SETTING_KEYS.notifyPushEnabled,
  everyTransaction: APP_SETTING_KEYS.notifyEveryTransaction,
  largeTransaction: APP_SETTING_KEYS.notifyLargeTransaction,
  budgetWarnings: APP_SETTING_KEYS.notifyBudgetWarnings,
  subscriptionRenewals: APP_SETTING_KEYS.notifySubscriptionRenewals,
  unrecognisedSms: APP_SETTING_KEYS.notifyUnrecognisedSms,
  weeklyReview: APP_SETTING_KEYS.notifyWeeklyReview,
};

export const NOTIFICATION_FIELDS = Object.keys(KEY_BY_FIELD) as (keyof NotificationPrefs)[];

/** The `app_settings.key` backing a given pref field. */
export function settingKeyFor(field: keyof NotificationPrefs): string {
  return KEY_BY_FIELD[field];
}

export function serializeBool(value: boolean): string {
  return value ? "true" : "false";
}

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/**
 * Build typed prefs from a `key -> value` map (e.g. flattened from a live query
 * over the app-settings collection), filling in defaults for unset keys.
 */
export function notificationPrefsFromMap(map: Record<string, string | null>): NotificationPrefs {
  const out = { ...NOTIFICATION_DEFAULTS };
  for (const field of NOTIFICATION_FIELDS) {
    out[field] = parseBool(map[KEY_BY_FIELD[field]], NOTIFICATION_DEFAULTS[field]);
  }
  return out;
}

// --- delivery policy constants ---

/** "Large transactions · over ₹5,000" — the threshold in major currency units. */
export const LARGE_TRANSACTION_THRESHOLD = 5000;

/** "Quiet hours · 10pm – 8am" — instant notifications are suppressed in-window. */
export const QUIET_HOURS = { startHour: 22, endHour: 8 } as const;

/**
 * Whether `date`'s local hour falls inside the quiet-hours window. The default
 * window wraps midnight (22:00–08:00), so the check is a union of two ranges.
 */
export function isWithinQuietHours(
  date: Date,
  quiet: { startHour: number; endHour: number } = QUIET_HOURS,
): boolean {
  const hour = date.getHours();
  if (quiet.startHour > quiet.endHour) {
    return hour >= quiet.startHour || hour < quiet.endHour;
  }
  return hour >= quiet.startHour && hour < quiet.endHour;
}
