# Icon assets (ADR-0003)

`iconName` (string on categories / subcategories / accounts) is the **source of
truth** for icons. Resolution lives in `lib/icon-registry.tsx` and is surfaced by
`<Icon name=… />` in `components/icon.tsx`.

Three layers, three sources:

| Layer             | iconName shape | Source                                                       | Render path                     |
| ----------------- | -------------- | ------------------------------------------------------------ | ------------------------------- |
| A. App chrome     | n/a            | `@expo/vector-icons`                                         | used directly, NOT via `<Icon>` |
| B. Category icons | `type_*`       | `react-native-nano-icons` font built from `categories/*.svg` | nano glyph                      |
| C. Brand logos    | `ic_brand_*`   | bundled WebP in `brands/`                                    | `<Image>`                       |

Anything unresolved falls back to a colored letter chip (see `resolveIcon`).

## `categories/` — curated emoji SVGs (layer B)

Drop one SVG per `type_*` icon here. The filename (without `.svg`) becomes the
glyph name and **must equal the seed `iconName`** (see `db/seed/categories.ts`),
e.g. `type_food_stuffed_flatbread.svg`.

These SVGs are compiled into a `.ttf` font by the `react-native-nano-icons`
config plugin. The plugin only runs in a **dev build / prebuild**, not in Expo Go.

> **NOTE:** the plugin entry was **removed from `app.json`** so the app builds
> today (the package isn't installed yet — an unresolved config plugin makes every
> `expo` command fail). Re-add it when you install `react-native-nano-icons`:
>
> ```jsonc
> // app.json → expo.plugins
> [
>   "react-native-nano-icons",
>   { "iconSets": [{ "name": "UnmiserCategoryIcons", "directory": "./assets/icons/categories" }] },
> ]
> ```

After adding/removing SVGs, regenerate `lib/icons/category-glyphmap.ts` via the
nano-icons generator and run `npx tsc --noEmit`.

## `brands/` — bundled brand logos (layer C)

Drop raster `ic_brand_*.webp` (or `.png`) logos here, then add a **static**
`require()` to `lib/icons/brand-map.ts` (Metro can't bundle dynamic requires).

## ASSET-SOURCING GAP (Phase-0)

The real catalog has **~176 `type_*` category icons and ~30 `ic_brand_*` brand
logos** referenced by the seed data, originally **raster `.webp`** files in the
Android app (`references/Cashiro/.../res/drawable-nodpi/`). Per ADR-0003 we are
**re-sourcing** category icons as open-license emoji SVGs (OpenMoji / Fluent
Emoji / Twemoji) — a deliberate mild redesign, not a 1:1 port — and bundling a
small WebP set for brand logos.

What ships today is a **scaffold**: 6 placeholder SVGs in `categories/` matching
the placeholder glyphmap, **no** brand WebPs, and a resolver that gracefully
falls back to a chip for everything not yet sourced. To complete the layer:

1. Source the ~176 category emoji SVGs, name each file after its `type_*`
   `iconName`, drop into `categories/`, regenerate the glyphmap.
2. Source the ~30 brand WebPs, drop into `brands/`, wire each into `brand-map.ts`.
3. `react-native-nano-icons` must be installed, the `app.json` plugin entry
   re-added (see NOTE above), and a dev build produced (it is a native build-time
   pipeline; it is intentionally NOT installed in this scaffold — `lib/icons/
nano-icon.tsx` loads it defensively so the JS bundle still runs).
