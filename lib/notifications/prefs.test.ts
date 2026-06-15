import { describe, expect, it } from "vitest";

import { APP_SETTING_KEYS } from "@/db/schema";
import {
  NOTIFICATION_DEFAULTS,
  formatTime,
  isWithinQuietHours,
  notificationPrefsFromMap,
  quietHoursLabel,
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
  const DEFAULT_WINDOW = { startMin: 22 * 60, endMin: 8 * 60 }; // 10pm–8am

  it("treats the default 10pm–8am window as wrapping midnight", () => {
    expect(isWithinQuietHours(new Date("2026-06-14T23:30:00"), DEFAULT_WINDOW)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-06-14T07:00:00"), DEFAULT_WINDOW)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-06-14T22:00:00"), DEFAULT_WINDOW)).toBe(true); // inclusive start
    expect(isWithinQuietHours(new Date("2026-06-14T08:00:00"), DEFAULT_WINDOW)).toBe(false); // exclusive end
    expect(isWithinQuietHours(new Date("2026-06-14T13:00:00"), DEFAULT_WINDOW)).toBe(false);
  });

  it("handles a same-day window that does not wrap", () => {
    const window = { startMin: 9 * 60, endMin: 17 * 60 };
    expect(isWithinQuietHours(new Date("2026-06-14T12:00:00"), window)).toBe(true);
    expect(isWithinQuietHours(new Date("2026-06-14T18:00:00"), window)).toBe(false);
  });

  it("treats an empty window (start === end) as off", () => {
    const window = { startMin: 480, endMin: 480 };
    expect(isWithinQuietHours(new Date("2026-06-14T08:00:00"), window)).toBe(false);
    expect(isWithinQuietHours(new Date("2026-06-14T23:00:00"), window)).toBe(false);
  });
});

describe("formatTime / quietHoursLabel", () => {
  it("formats minute-of-day on a 12-hour clock", () => {
    expect(formatTime(22 * 60)).toBe("10:00 pm");
    expect(formatTime(8 * 60 + 30)).toBe("8:30 am");
    expect(formatTime(0)).toBe("12:00 am");
    expect(formatTime(12 * 60)).toBe("12:00 pm");
  });

  it("labels the window, or 'Off' when empty", () => {
    expect(quietHoursLabel(22 * 60, 8 * 60)).toBe("10:00 pm – 8:00 am");
    expect(quietHoursLabel(480, 480)).toBe("Off");
  });
});
