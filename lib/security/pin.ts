import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Secure PIN storage for App-lock. The PIN is NEVER stored in plaintext and
 * NEVER in the app_settings KV store (ADR-0005: secrets live in the OS
 * keystore). We keep a per-install random salt + SHA-256(salt + pin) in
 * expo-secure-store, and compare hashes on unlock.
 *
 * 4-digit numeric PIN (matches the App-lock design). A 4-digit space is small,
 * so the real defence is the OS keystore + the attempt lockout in
 * `lib/security/app-lock.ts`, not hash strength.
 */
const PIN_KEY = "unmiser.appLock.pin";

export const PIN_LENGTH = 4;

/** True for an exactly-`PIN_LENGTH` all-digits string. */
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** Persist a new PIN (overwrites any existing). Throws on malformed input. */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN must be ${PIN_LENGTH} digits`);
  }
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(saltBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_KEY, `${salt}:${hash}`);
}

/** Whether a PIN has been set on this device. */
export async function hasPin(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PIN_KEY)) != null;
}

/** Constant-shape verify: returns false for malformed input or no stored PIN. */
export async function verifyPin(pin: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  const sep = stored.indexOf(":");
  if (sep < 0) return false;
  const salt = stored.slice(0, sep);
  const expected = stored.slice(sep + 1);
  const actual = await hashPin(pin, salt);
  return actual === expected;
}

/** Remove the stored PIN (used when App-lock is disabled). */
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}
