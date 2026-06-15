import Constants from "expo-constants";

/**
 * Single source for the app version + build number, read from the Expo config
 * (`app.json` → `expo.version` / `expo.android.versionCode`). Replaces the
 * values that were hardcoded in About + Developer (see phase-4-ui-backlog §6).
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

export const BUILD_NUMBER: string = String(
  Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? "0",
);
