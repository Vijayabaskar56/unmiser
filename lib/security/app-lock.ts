import { APP_SETTING_KEYS } from "@/db/schema/app-settings";

/**
 * Pure App-lock model: preferences parsing + the re-lock gate decision. No
 * native/IO here so it is unit-tested directly. Storage of the PIN lives in
 * `lib/security/pin.ts`; the React wiring + AppState listener live in
 * `lib/security/use-app-lock.tsx`.
 *
 * Behaviour follows Cashiro: a background-grace timeout in minutes (0 = lock
 * immediately), default 1 minute, App-lock off by default. Unlike Cashiro
 * (device-credential only) the unmiser design uses a custom 4-digit PIN as the
 * primary factor, with biometric as an opt-in convenience.
 */
export const LOCK_TIMEOUT_OPTIONS = [0, 1, 5, 15, 30] as const;
export type LockTimeoutMinutes = (typeof LOCK_TIMEOUT_OPTIONS)[number];

export interface AppLockPrefs {
  enabled: boolean;
  biometric: boolean;
  timeoutMinutes: LockTimeoutMinutes;
}

export const APP_LOCK_DEFAULTS: AppLockPrefs = {
  enabled: false,
  biometric: false,
  timeoutMinutes: 1,
};

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value === "true";
}

function parseTimeout(value: string | null | undefined): LockTimeoutMinutes {
  const n = Number(value);
  return (LOCK_TIMEOUT_OPTIONS as readonly number[]).includes(n)
    ? (n as LockTimeoutMinutes)
    : APP_LOCK_DEFAULTS.timeoutMinutes;
}

/** Decode App-lock prefs from a raw `app_settings` key→value map. */
export function parseAppLockPrefs(map: Record<string, string | null>): AppLockPrefs {
  return {
    enabled: parseBool(map[APP_SETTING_KEYS.appLockEnabled], APP_LOCK_DEFAULTS.enabled),
    biometric: parseBool(map[APP_SETTING_KEYS.appLockBiometric], APP_LOCK_DEFAULTS.biometric),
    timeoutMinutes: parseTimeout(map[APP_SETTING_KEYS.appLockTimeoutMinutes]),
  };
}

/**
 * Should the app re-lock when returning to the foreground? `backgroundedAt` is
 * the epoch-ms when the app last went to the background (null = unknown, so we
 * lock to be safe). Timeout 0 always re-locks.
 */
export function shouldRelock(
  timeoutMinutes: number,
  backgroundedAt: number | null,
  now: number,
): boolean {
  if (timeoutMinutes <= 0) return true;
  if (backgroundedAt == null) return true;
  return now - backgroundedAt >= timeoutMinutes * 60_000;
}

/** Human label for the timeout picker / subtitle. */
export function timeoutLabel(minutes: number): string {
  if (minutes <= 0) return "Immediately";
  if (minutes === 1) return "After 1 minute";
  return `After ${minutes} minutes`;
}

/** Wrong-PIN attempts allowed before the first cooldown kicks in. */
export const MAX_FREE_ATTEMPTS = 5;

/**
 * Cooldown (seconds) to enforce *at* a given cumulative wrong-attempt count.
 * Returns 0 except at each multiple of MAX_FREE_ATTEMPTS, where it escalates
 * 30s → 60s → 5min (capped). In-memory only — a cold start re-locks anyway, so
 * we don't persist the attempt counter.
 */
export function cooldownSeconds(attempts: number): number {
  if (attempts < MAX_FREE_ATTEMPTS || attempts % MAX_FREE_ATTEMPTS !== 0) return 0;
  const tier = attempts / MAX_FREE_ATTEMPTS - 1; // 5→0, 10→1, 15→2 …
  return [30, 60, 300][Math.min(tier, 2)];
}
