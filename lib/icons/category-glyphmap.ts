/**
 * GENERATED-STYLE glyphmap for category icons (ADR-0003 layer B).
 *
 * In production this file is produced by the `react-native-nano-icons` build
 * pipeline: it scans `assets/icons/categories/*.svg`, packs them into a `.ttf`
 * font, and emits a `name -> codepoint` glyphmap. Each SVG filename (sans
 * extension) becomes a typed glyph name, e.g. `type_food_stuffed_flatbread.svg`
 * -> key `"type_food_stuffed_flatbread"`.
 *
 * We don't yet have the ~233 real category SVGs (see ASSET GAP in
 * `lib/icons/README` block at the bottom of `lib/icon-registry.tsx`), so this
 * is a hand-written PLACEHOLDER containing only the few names that have a
 * stand-in SVG checked into `assets/icons/categories/`. Names not present here
 * fall through to the chip fallback in `resolveIcon`.
 *
 * REGENERATION (once the real SVG pack lands):
 *   1. Drop the curated emoji SVGs into `assets/icons/categories/`.
 *   2. Run the nano-icons generator (dev build / prebuild step) — it will
 *      overwrite this file with the full generated map.
 *   3. `npx tsc --noEmit` to confirm the keys line up with seed `iconName`s.
 *
 * The codepoint values are illustrative; the real generator assigns them.
 */
export const categoryGlyphMap = {
  // --- placeholder stand-ins (have an SVG in assets/icons/categories) ---
  type_finance_money_bag: 0xe900,
  type_finance_bank: 0xe901,
  type_food_stuffed_flatbread: 0xe902,
  type_shopping_shopping_bags: 0xe903,
  type_travel_transport_automobile: 0xe904,
  type_health_pill: 0xe905,
} as const;

export type CategoryGlyphName = keyof typeof categoryGlyphMap;

/** Runtime membership check that also narrows the type. */
export function isCategoryGlyph(name: string): name is CategoryGlyphName {
  return Object.prototype.hasOwnProperty.call(categoryGlyphMap, name);
}
