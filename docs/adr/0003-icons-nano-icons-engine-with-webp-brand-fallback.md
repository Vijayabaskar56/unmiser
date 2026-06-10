---
status: accepted
---

# Icons: `iconName` is the source of truth, rendered via nano-icons (SVG) with a WebP brand-logo fallback

The Drizzle schema carries both `iconResId` (Android `R.drawable` int) and `iconName` (string) on
categories/subcategories/accounts. Android already treats `iconName` as primary (it seeds
`iconResId`, derives `iconName` via `getIdentifier`, and resolution prefers the name — see
`references/Cashiro/.../IconResolutionUtils.kt` and `CategoryMapping.kt:1145`). We make `iconName`
the **single source of truth**; `iconResId` is migration-only baggage, droppable in a later
migration alongside the unused `chatMessages` table.

Cashiro's actual icon catalog is **754 raster `.webp` files** in `res/drawable-nodpi/` — illustrated
emoji-style category icons (`type_*`) plus India-specific merchant/bank logos (`ic_brand_*`). The
icon need is **three layers**, each with a different best tool:

- **A. App chrome** (back, gear, plus, chevrons): `@expo/vector-icons` (already installed) or
  nano-icons.
- **B. Category / subcategory** (~233, emoji-style): **`react-native-nano-icons`** over a curated
  folder of **open-license emoji SVGs** (OpenMoji / Fluent Emoji / Twemoji — same aesthetic, open
  license). `iconName` → nano glyph.
- **C. Brand / merchant logos** (`ic_brand_*`, e.g. Swiggy, Indian banks): **bundle raster WebP**,
  rendered as `<Image>`. No SVG library covers this long tail (verified: `simple-icons` has Paytm
  but no Swiggy, no Indian bank logos), so a raster bundle here is irreducible. Top brands may be
  traced to SVG and migrated into nano-icons over time.

## Why nano-icons for A/B

`react-native-nano-icons` (Software Mansion) is a build-time SVG→`.ttf` pipeline + native glyph
renderer: bring-your-own SVG folder, filenames become typed names, **fully offline** (font +
glyphmap bundled, no runtime API), **multi-color** via per-fill glyph layers with runtime recolor,
~4× faster than `react-native-svg` at scale, and you ship only the SVGs you include (no tree-shaking
needed). Its dev-build requirement is already paid for by the Phase-2 SMS native module. Vectors
scale and recolor; raster WebPs cannot.

## Considered and rejected

- **Bundle all 754 Cashiro WebPs + a codegen'd `require`-map** (the faithful port). Rejected as the
  primary path: raster, non-recolorable, slower at list scale, and ships 754 images. Icons are not
  a stated product USP (the plugin layer and behavior-change are), so preserving Cashiro's _exact_
  hand-drawn art is not required — "emoji-style category icons" is. Still the fallback if we ever
  want the fastest zero-re-sourcing port. Retained only for layer C (brand logos).
- **`@expo/vector-icons` to replace the catalog.** Monochrome glyph fonts — wrong visual class for
  colorful illustrated icons, and zero brand-logo coverage. Kept for chrome (A) only.
- **Iconify (`react-native-iconify`, 275K icons by name).** Loads icon data from the Iconify **API
  at runtime** (network) and needs a dev build — violates offline-first. Self-hosting its JSON is
  just bundling with extra steps.
- **Full color-emoji font (e.g. Noto Color Emoji `.ttf`).** ~10 MB for 3,700 glyphs mostly unused;
  nano-icons over a curated SVG subset is smaller and recolorable.

## Consequences

- Re-source ~233 category icons as SVG from an open emoji set + a semantic `category → iconName`
  map. A mild, deliberate visual redesign of the category set, not a 1:1 port.
- Two render paths: nano `<Icon name>` for A/B, `<Image>` for C brand-logo WebPs.
- The Phase-0 "icon-name map" deliverable becomes: (1) the nano-icons config-plugin + curated SVG
  folder + generated glyphmap, and (2) a small bundled WebP set + name map for brand logos.
- `iconResId` is unused at runtime from day one; drop it in a later migration.
