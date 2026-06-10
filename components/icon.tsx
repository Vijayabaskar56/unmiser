import { Text, View } from "react-native";

import { renderResolvedIcon } from "@/lib/icon-render";
import { resolveIcon } from "@/lib/icon-registry";

/**
 * Unified entity icon (category / subcategory / account) — ADR-0003 layers B/C
 * plus a graceful fallback.
 *
 * `iconName` is the source of truth (`type_*` -> nano-icons vector glyph,
 * `ic_brand_*` -> bundled WebP logo). When the real asset isn't available yet
 * (the nano-icons font isn't linked, or the brand WebP hasn't been bundled),
 * this renders a colored chip with the first letter of `fallback`/name so the
 * UI stays legible. The public props are stable across that transition.
 *
 * ASSET GAP (deliberate, Phase-0): the ~233 curated category SVGs and the
 * `ic_brand_*` WebP logos have NOT been ported yet. Drop SVGs into
 * `assets/icons/categories/` (then regenerate the glyphmap), and brand logos
 * into `assets/icons/brands/` (then add a static `require` to
 * `lib/icons/brand-map.ts`). Until then everything resolves to the chip.
 *
 * App CHROME icons (back/gear/plus) use `@expo/vector-icons` directly, not this.
 */
export function Icon({
  iconName,
  color,
  fallback,
  size = 36,
}: {
  iconName?: string | null;
  color?: string | null;
  fallback?: string;
  size?: number;
}) {
  const resolved = resolveIcon({ iconName, label: fallback });

  if (resolved.kind !== "fallback") {
    const glyph = renderResolvedIcon(resolved, {
      size: Math.round(size * 0.66),
      // Recolor vector glyphs to read on the colored chip; brand logos ignore.
      color: resolved.kind === "nano" ? "#ffffff" : undefined,
    });
    if (glyph) {
      return (
        <View
          accessibilityLabel={iconName ?? undefined}
          style={chipStyle(size, resolved.kind === "brand" ? null : color)}
        >
          {glyph}
        </View>
      );
    }
  }

  const letter = resolved.kind === "fallback" ? resolved.letter : "?";
  return (
    <View accessibilityLabel={iconName ?? undefined} style={chipStyle(size, color)}>
      <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

function chipStyle(size: number, color?: string | null) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color ?? "#888888",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };
}
