import { describe, expect, it } from "vitest";

import {
  ACCENTS,
  accentHex,
  APPEARANCE_DEFAULTS,
  appearancePrefsFromMap,
  clampTextScale,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  settingKeyFor,
} from "@/lib/appearance/prefs";

describe("appearance prefs", () => {
  it("defaults: auto theme, yellow accent, neutral text scale, blur+labels on", () => {
    expect(APPEARANCE_DEFAULTS).toEqual({
      theme: "auto",
      accentId: "yellow",
      textScale: 1,
      backgroundBlur: true,
      compactDensity: false,
      tabBarLabels: true,
    });
  });

  it("parses a settings map, falling back to defaults for unset keys", () => {
    const prefs = appearancePrefsFromMap({
      [settingKeyFor("theme")]: "dark",
      [settingKeyFor("accentId")]: "coral",
      [settingKeyFor("textScale")]: "1.2",
      [settingKeyFor("compactDensity")]: "true",
    });
    expect(prefs.theme).toBe("dark");
    expect(prefs.accentId).toBe("coral");
    expect(prefs.textScale).toBe(1.2);
    expect(prefs.compactDensity).toBe(true);
    // unset → default
    expect(prefs.tabBarLabels).toBe(true);
    expect(prefs.backgroundBlur).toBe(true);
  });

  it("clamps/sanitises bad values to defaults", () => {
    const prefs = appearancePrefsFromMap({
      [settingKeyFor("theme")]: "neon",
      [settingKeyFor("accentId")]: "nope",
      [settingKeyFor("textScale")]: "99",
    });
    expect(prefs.theme).toBe("auto");
    expect(prefs.accentId).toBe("yellow");
    expect(prefs.textScale).toBe(MAX_TEXT_SCALE); // clamped
  });

  it("accentHex resolves a swatch id, falling back to the default", () => {
    expect(accentHex("yellow")).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(accentHex("nope")).toBe(accentHex("yellow"));
    expect(ACCENTS[0].id).toBe("yellow");
  });

  it("clampTextScale clamps into the valid range and defaults non-finite", () => {
    expect(clampTextScale(1)).toBe(1);
    expect(clampTextScale(0.1)).toBe(MIN_TEXT_SCALE);
    expect(clampTextScale(5)).toBe(MAX_TEXT_SCALE);
    expect(clampTextScale(Number.NaN)).toBe(APPEARANCE_DEFAULTS.textScale);
  });
});
