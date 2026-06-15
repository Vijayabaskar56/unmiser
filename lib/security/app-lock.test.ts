import { describe, expect, it } from "vitest";

import { APP_SETTING_KEYS } from "@/db/schema/app-settings";
import {
  APP_LOCK_DEFAULTS,
  cooldownSeconds,
  parseAppLockPrefs,
  shouldRelock,
  timeoutLabel,
} from "./app-lock";

describe("parseAppLockPrefs", () => {
  it("falls back to defaults on an empty map", () => {
    expect(parseAppLockPrefs({})).toEqual(APP_LOCK_DEFAULTS);
  });

  it("reads enabled/biometric/timeout from the map", () => {
    expect(
      parseAppLockPrefs({
        [APP_SETTING_KEYS.appLockEnabled]: "true",
        [APP_SETTING_KEYS.appLockBiometric]: "true",
        [APP_SETTING_KEYS.appLockTimeoutMinutes]: "5",
      }),
    ).toEqual({ enabled: true, biometric: true, timeoutMinutes: 5 });
  });

  it("ignores an out-of-range timeout", () => {
    expect(
      parseAppLockPrefs({ [APP_SETTING_KEYS.appLockTimeoutMinutes]: "7" }).timeoutMinutes,
    ).toBe(APP_LOCK_DEFAULTS.timeoutMinutes);
  });
});

describe("shouldRelock", () => {
  const now = 1_000_000_000;

  it("locks immediately when timeout is 0", () => {
    expect(shouldRelock(0, now - 1, now)).toBe(true);
  });

  it("locks when backgroundedAt is unknown", () => {
    expect(shouldRelock(5, null, now)).toBe(true);
  });

  it("stays unlocked within the grace window", () => {
    expect(shouldRelock(5, now - 4 * 60_000, now)).toBe(false);
  });

  it("re-locks once the grace window elapses", () => {
    expect(shouldRelock(5, now - 5 * 60_000, now)).toBe(true);
    expect(shouldRelock(1, now - 61_000, now)).toBe(true);
  });
});

describe("timeoutLabel", () => {
  it("renders each option", () => {
    expect(timeoutLabel(0)).toBe("Immediately");
    expect(timeoutLabel(1)).toBe("After 1 minute");
    expect(timeoutLabel(15)).toBe("After 15 minutes");
  });
});

describe("cooldownSeconds", () => {
  it("is free below the threshold", () => {
    expect(cooldownSeconds(0)).toBe(0);
    expect(cooldownSeconds(4)).toBe(0);
  });

  it("triggers only at each multiple of 5, escalating and capping", () => {
    expect(cooldownSeconds(5)).toBe(30);
    expect(cooldownSeconds(6)).toBe(0); // between thresholds
    expect(cooldownSeconds(10)).toBe(60);
    expect(cooldownSeconds(15)).toBe(300);
    expect(cooldownSeconds(20)).toBe(300); // capped
  });
});
