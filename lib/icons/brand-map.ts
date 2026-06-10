import type { ImageSourcePropType } from "react-native";

/**
 * Brand / merchant logo registry (ADR-0003 layer C).
 *
 * The long tail of `ic_brand_*` logos (Swiggy, Indian banks, streaming apps —
 * see `db/seed/categories.ts`) is irreducibly raster: no open SVG set covers
 * it. We bundle WebP (or PNG) files under `assets/icons/brands/` and render
 * them as `<Image>`. `iconName` ("ic_brand_swiggy") maps to a `require()`d
 * asset here.
 *
 * `require()` paths must be static literals so Metro can bundle them — this map
 * therefore has to be maintained by hand (or codegen'd) as logos are added.
 *
 * ASSET GAP: the real WebP logos are not yet ported from the Android app
 * (`res/drawable-nodpi/ic_brand_*.webp`). Until a logo is dropped in and wired
 * here, the brand name falls through to the chip fallback in `resolveIcon`.
 * Add entries as:
 *   ic_brand_swiggy: require("../../assets/icons/brands/ic_brand_swiggy.webp"),
 */
export const brandMap: Record<string, ImageSourcePropType> = {
  // No brand logos bundled yet — see ASSET GAP above.
};

export function isBrandName(name: string): boolean {
  return name.startsWith("ic_brand_");
}

export function resolveBrandAsset(name: string): ImageSourcePropType | undefined {
  return brandMap[name];
}
