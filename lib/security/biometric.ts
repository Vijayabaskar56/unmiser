import { requireOptionalNativeModule } from "expo-modules-core";
import type * as LocalAuthentication from "expo-local-authentication";

/**
 * Thin, fail-safe wrapper over expo-local-authentication.
 *
 * expo-local-authentication's JS resolves its native module at module-load
 * time, which THROWS ("Cannot find native module 'ExpoLocalAuthentication'") on
 * a dev client built before the dependency was added — crashing the import
 * chain. We first probe with `requireOptionalNativeModule` (returns null without
 * throwing or logging), and only `require()` the JS API when the native side is
 * actually present. So the runtime degrades cleanly to "biometric unavailable"
 * and the PIN path keeps working until the app is rebuilt.
 */
function getModule(): typeof LocalAuthentication | null {
  try {
    if (!requireOptionalNativeModule("ExpoLocalAuthentication")) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-local-authentication") as typeof LocalAuthentication;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      mod.hasHardwareAsync(),
      mod.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/** Returns true only on a successful biometric authentication. */
export async function authenticateBiometric(promptMessage = "Unlock Unmiser"): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    const result = await mod.authenticateAsync({
      promptMessage,
      // PIN is our fallback, not the OS credential — keep the prompt biometric.
      disableDeviceFallback: true,
      cancelLabel: "Use PIN",
    });
    return result.success;
  } catch {
    return false;
  }
}
