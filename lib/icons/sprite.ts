import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import { extractSymbol, listSymbolIds } from "./sprite-extract";

// Custom `.sprite` asset (metro.config.js assetExts) — the 1.85MB UI icon sheet.
// Relative (not "@/") so Metro asset resolution doesn't depend on path-alias handling.
import spriteAsset from "../../assets/icons/ui-sprite.sprite";

/**
 * Runtime sprite loader (ADR-0003, Option B). The sprite is bundled as an asset,
 * NOT JS, so it doesn't bloat the bundle. We read its text once (lazily, on the
 * first icon used), then extract `<symbol>`s by id on demand and cache each.
 *
 * Memory: the sprite text (~1.85MB) is retained after first load so later ids
 * resolve without re-reading; per-icon results are cached in `iconCache`.
 */
let spriteTextPromise: Promise<string> | null = null;
const iconCache = new Map<string, string | null>();
let idsCache: string[] | null = null;

function loadSpriteText(): Promise<string> {
  if (!spriteTextPromise) {
    spriteTextPromise = (async () => {
      const asset = Asset.fromModule(spriteAsset);
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error("ui-sprite: asset has no localUri after download");
      return new File(asset.localUri).text();
    })();
  }
  return spriteTextPromise;
}

/** Standalone `<svg>` string for a sprite icon id, or null if absent. Cached. */
export async function getIconSvg(id: string): Promise<string | null> {
  const cached = iconCache.get(id);
  if (cached !== undefined) return cached;
  const svg = extractSymbol(await loadSpriteText(), id);
  iconCache.set(id, svg);
  return svg;
}

/** Every icon id in the sprite (for the picker). Computed once, cached. */
export async function getAllIconIds(): Promise<string[]> {
  if (idsCache) return idsCache;
  idsCache = listSymbolIds(await loadSpriteText());
  return idsCache;
}
