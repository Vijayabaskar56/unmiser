import type { ImageSourcePropType } from "react-native";

import { isBrandName, resolveBrandAsset } from "./icons/brand-map";
import { isCategoryGlyph } from "./icons/category-glyphmap";
import { getNanoIconComponent } from "./icons/nano-icon";

/**
 * Icon resolution registry — the single place that turns an `iconName` string
 * (the source of truth, per ADR-0003) into a render decision.
 *
 * This module is JSX-free and `react-native`-runtime-free (it only imports a
 * `type`), so the pure `resolveIcon` can be unit-tested under Node/vitest. The
 * actual rendering lives in `icon-registry.tsx` / `components/icon.tsx`.
 *
 * Three layers, three render paths:
 *   B. category icons  ("type_*")     -> nano-icons glyph  (vector, recolorable)
 *   C. brand logos     ("ic_brand_*") -> bundled WebP <Image>
 *   fallback           (anything else / asset missing) -> colored letter chip
 *
 * App CHROME (back, gear, plus — layer A) does NOT go through here; use
 * `@expo/vector-icons` directly. This registry is for entity icons.
 */

export type ResolvedIcon =
  | { kind: "nano"; name: string }
  | { kind: "brand"; source: ImageSourcePropType }
  | { kind: "fallback"; letter: string };

export type ResolveIconInput = {
  iconName?: string | null;
  /** Display name of the entity, used to derive the fallback letter. */
  label?: string | null;
};

/**
 * Pure resolver: decides which render path an `iconName` takes.
 */
export function resolveIcon({ iconName, label }: ResolveIconInput): ResolvedIcon {
  const name = iconName?.trim();

  if (name) {
    // Layer B: category vector glyph, only when both the glyph exists in the
    // generated map AND the nano-icons font is actually linked at runtime.
    if (isCategoryGlyph(name) && getNanoIconComponent() != null) {
      return { kind: "nano", name };
    }
    // Layer C: bundled brand logo, only when a WebP is actually wired up.
    if (isBrandName(name)) {
      const source = resolveBrandAsset(name);
      if (source) return { kind: "brand", source };
    }
  }

  return { kind: "fallback", letter: fallbackLetter(label, name) };
}

function fallbackLetter(label?: string | null, iconName?: string | null): string {
  const fromLabel = label?.trim();
  if (fromLabel) return fromLabel.charAt(0).toUpperCase();
  // Derive something readable from the icon name as a last resort, e.g.
  // "type_food_stuffed_flatbread" -> "F", "ic_brand_swiggy" -> "S".
  const semantic = iconName
    ?.replace(/^type_/, "")
    .replace(/^ic_brand_/, "")
    .trim();
  if (semantic) return semantic.charAt(0).toUpperCase();
  return "?";
}
