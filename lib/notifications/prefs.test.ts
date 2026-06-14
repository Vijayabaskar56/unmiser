import { describe, expect, it } from "vitest";

import { APP_SETTING_KEYS } from "@/db/schema";
import {
  NOTIFICATION_DEFAULTS,
  isWithinQuietHours,
  notificationPrefsFromMap,
  QUIET_HOURS,
  serializeBool,
  settingKeyFor,
} from "@/lib/notifications/prefs";

describe("notificationPrefsFromMap", () => {
  it("returns defaults for an empty map", () => {
    expect(notificationPrefsFromMap({})).toEqual(NOTIFICATION_DEFAULTS);
  });

  it("parses stored 'true'/'false' over the defaults", () => {
    const prefs = notificationPrefsFromMap({
      [APP_SETTING_KEYS.notifyEveryTransaction]: "true", // default false
      [APP_SETTING_KEYS.notifyLargeTransaction]: "false", // default true
    });
    expect(prefs.everyTransaction).toBe(true);
    expect(prefs.largeTransaction).toBe(false);
    // Untouched keys keep their defaults.
    expect(prefs.pushEnabled).toBe(true);
    expect(prefs.weeklyReview).toBe(false);
  });

  it("falls back to the default for malformed values", () => {
    const prefs = notificationPrefsFromMap({
      [APP_SETTING_KEYS.notifyPushEnabled]: "yes",
      [APP_SETTING_KEYS.notifySubscriptionRenewals]: null,
    });
    expect(prefs.pushEnabled).toBe(NOTIFICATION_DEFAULTS.pushEnabled);
    expect(prefs.subscriptionRenewals).toBe(NOTIFICATION_DEFAULTS.subscriptionRenewals);
  });
});

describe("settingKeyFor / serializeBool", () => {
  it("maps fields to their app-settings keys", () => {
    expect(settingKeyFor("pushEnabled")).toBe(APP_SETTING_KEYS.notifyPushEnabled);
    expect(settingKeyFor("weeklyReview")).toBe(APP_SETTING_KEYS.notifyWeeklyReview);
  });

  it("serializes booleans as text", () => {
    expect(serializeBool(true)).toBe("true");
    expect(serializeBool(false)).toBe("false");
  });
});

describe("isWithinQuietHours", () => {
  it("treats the default 10pm–8am window as wrapping midnight", () => {
    expect(isWithinQuietHours(new Date("2026-06-14T23:30:00"))).toBe(true); // 11:30pm
    expect(isWithinQuietHours(new Date("2026-06-14T07:00:00"))).toBe(true); // 7am
    expect(isWithinQuietHours(new Date("2026-06-14T22:00:00"))).toBe(true); // 10pm edge (inclusive)
    expect(isWithinQuietHours(new Date("2026-06-14T08:00:00"))).toBe(false); // 8am edge (exclusive)
    expect(isWithinQuietHours(new Date("2026-06-14T13:00:00"))).toBe(false); // 1pm
  });

  it("handles a same-day window that does not wrap", () => {
    const window = { startHour: 9, endHour: 17 };
    expect(isWithinQuietHours(new Date("2026-06-14T12:00:00"), window)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-06-14T18:00:00"), window)).toBe(false);
  });

  it("exposes the design window constant", () => {
    expect(QUIET_HOURS).toEqual({ startHour: 22, endHour: 8 });
  });
});
