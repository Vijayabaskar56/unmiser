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
  // Numeric config (configurable as of Phase-4 §5).
  /** Quiet-hours window, minutes-of-day 0–1439. `start === end` means off. */
  quietStartMin: number;
  quietEndMin: number;
  /** Large-transaction alert threshold, in major currency units. */
  largeThreshold: number;
}

/** The boolean (toggle) subset of the prefs — the keys backed by a true/false. */
export type NotificationToggleField =
  | "pushEnabled"
  | "everyTransaction"
  | "largeTransaction"
  | "budgetWarnings"
  | "subscriptionRenewals"
  | "unrecognisedSms"
  | "weeklyReview";

/** Defaults mirror the Notifications screen design (large/budget/subs/unrec on). */
export const NOTIFICATION_DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  everyTransaction: false,
  largeTransaction: true,
  budgetWarnings: true,
  subscriptionRenewals: true,
  unrecognisedSms: true,
  weeklyReview: false,
  quietStartMin: 22 * 60, // 10:00 pm
  quietEndMin: 8 * 60, // 8:00 am
  largeThreshold: 5000,
};

const KEY_BY_FIELD: Record<NotificationToggleField, string> = {
  pushEnabled: APP_SETTING_KEYS.notifyPushEnabled,
  everyTransaction: APP_SETTING_KEYS.notifyEveryTransaction,
  largeTransaction: APP_SETTING_KEYS.notifyLargeTransaction,
  budgetWarnings: APP_SETTING_KEYS.notifyBudgetWarnings,
  subscriptionRenewals: APP_SETTING_KEYS.notifySubscriptionRenewals,
  unrecognisedSms: APP_SETTING_KEYS.notifyUnrecognisedSms,
  weeklyReview: APP_SETTING_KEYS.notifyWeeklyReview,
};

export const NOTIFICATION_FIELDS = Object.keys(KEY_BY_FIELD) as NotificationToggleField[];

/** The `app_settings.key` backing a given boolean pref field. */
export function settingKeyFor(field: NotificationToggleField): string {
  return KEY_BY_FIELD[field];
}

function parseMinute(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 1439 ? n : fallback;
}

function parseThreshold(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
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
  out.quietStartMin = parseMinute(
    map[APP_SETTING_KEYS.notifyQuietStart],
    NOTIFICATION_DEFAULTS.quietStartMin,
  );
  out.quietEndMin = parseMinute(
    map[APP_SETTING_KEYS.notifyQuietEnd],
    NOTIFICATION_DEFAULTS.quietEndMin,
  );
  out.largeThreshold = parseThreshold(
    map[APP_SETTING_KEYS.notifyLargeThreshold],
    NOTIFICATION_DEFAULTS.largeThreshold,
  );
  return out;
}

/** "10:00 pm", "8:30 am" — a 12-hour clock label for a 0–1439 minute-of-day. */
export function formatTime(minuteOfDay: number): string {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(m / 60);
  const minute = m % 60;
  const period = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/** Quiet-hours summary for the screen: "10:00 pm – 8:00 am", or "Off". */
export function quietHoursLabel(startMin: number, endMin: number): string {
  if (startMin === endMin) return "Off";
  return `${formatTime(startMin)} – ${formatTime(endMin)}`;
}

/**
 * Whether `date` falls inside the quiet-hours window, by minute-of-day. The
 * window may wrap midnight (e.g. 22:00–08:00). `start === end` means the window
 * is empty (quiet hours off), so nothing is ever suppressed.
 */
export function isWithinQuietHours(
  date: Date,
  window: { startMin: number; endMin: number },
): boolean {
  if (window.startMin === window.endMin) return false;
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  if (window.startMin > window.endMin) {
    return minuteOfDay >= window.startMin || minuteOfDay < window.endMin;
  }
  return minuteOfDay >= window.startMin && minuteOfDay < window.endMin;
}
