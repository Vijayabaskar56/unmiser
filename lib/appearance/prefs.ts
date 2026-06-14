import { APP_SETTING_KEYS } from "@/db/schema";

/**
 * Appearance preferences. Pure model + (de)serialisation, free of DB/native
 * imports so it stays unit-testable. The DB service
 * (`db/services/appearance-settings.ts`) reads/writes through `app_settings`;
 * the screen reads them reactively via the app-settings collection.
 *
 * Scope (Phase 4): `theme` and `tabBarLabels` are applied live; `accentId` and
 * `textStep` are persisted and reflected in the screen's Preview, but app-wide
 * application is deferred (no runtime override for the static accent token /
 * global font scale yet).
 */
export type ThemeMode = "light" | "dark" | "auto";

export interface AppearancePrefs {
  theme: ThemeMode;
  accentId: string;
  /** Font-size multiplier (MIN_TEXT_SCALE..MAX_TEXT_SCALE); 1 is neutral. */
  textScale: number;
  backgroundBlur: boolean;
  compactDensity: boolean;
  tabBarLabels: boolean;
}

/** Selectable accent swatches; the first is the default (brand yellow). */
export const ACCENTS: readonly { id: string; hex: string }[] = [
  { id: "yellow", hex: "#e9e83f" },
  { id: "lime", hex: "#9acd32" },
  { id: "coral", hex: "#f4623a" },
  { id: "blue", hex: "#4a9be8" },
] as const;

export const APPEARANCE_DEFAULTS: AppearancePrefs = {
  theme: "auto",
  accentId: "yellow",
  textScale: 1,
  backgroundBlur: true,
  compactDensity: false,
  tabBarLabels: true,
};

/** Continuous text-size range for the Appearance slider. */
export const MIN_TEXT_SCALE = 0.85;
export const MAX_TEXT_SCALE = 1.3;

/** Clamp a raw text scale into the valid range. */
export function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return APPEARANCE_DEFAULTS.textScale;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, scale));
}

const KEY_BY_FIELD: Record<keyof AppearancePrefs, string> = {
  theme: APP_SETTING_KEYS.appearanceTheme,
  accentId: APP_SETTING_KEYS.appearanceAccent,
  textScale: APP_SETTING_KEYS.appearanceTextStep,
  backgroundBlur: APP_SETTING_KEYS.appearanceBackgroundBlur,
  compactDensity: APP_SETTING_KEYS.appearanceCompactDensity,
  tabBarLabels: APP_SETTING_KEYS.appearanceTabBarLabels,
};

export function settingKeyFor(field: keyof AppearancePrefs): string {
  return KEY_BY_FIELD[field];
}

export function serializeBool(value: boolean): string {
  return value ? "true" : "false";
}

/** Hex for an accent id, falling back to the default (yellow). */
export function accentHex(id: string | null | undefined): string {
  return (ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]).hex;
}

export function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/**
 * Decode the tab-bar-labels preference from its raw `app_settings` value
 * (defaults ON). Keeps the typed model in one place so screens don't re-implement
 * the `!== "false"` shorthand.
 */
export function parseTabBarLabels(value: string | null | undefined): boolean {
  return parseBool(value, APPEARANCE_DEFAULTS.tabBarLabels);
}

/** Build prefs from a raw `app_settings` key→value map (defaults fill the gaps). */
export function appearancePrefsFromMap(
  map: Record<string, string | null | undefined>,
): AppearancePrefs {
  const theme = map[KEY_BY_FIELD.theme];
  const accentId = map[KEY_BY_FIELD.accentId];
  const scaleRaw = map[KEY_BY_FIELD.textScale];

  return {
    theme:
      theme === "light" || theme === "dark" || theme === "auto" ? theme : APPEARANCE_DEFAULTS.theme,
    accentId: ACCENTS.some((a) => a.id === accentId) ? accentId! : APPEARANCE_DEFAULTS.accentId,
    textScale: scaleRaw == null ? APPEARANCE_DEFAULTS.textScale : clampTextScale(Number(scaleRaw)),
    backgroundBlur: parseBool(map[KEY_BY_FIELD.backgroundBlur], APPEARANCE_DEFAULTS.backgroundBlur),
    compactDensity: parseBool(map[KEY_BY_FIELD.compactDensity], APPEARANCE_DEFAULTS.compactDensity),
    tabBarLabels: parseBool(map[KEY_BY_FIELD.tabBarLabels], APPEARANCE_DEFAULTS.tabBarLabels),
  };
}
