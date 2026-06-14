/**
 * Pure SVG-sprite symbol extractor (ADR-0003, sprite layer / Option B).
 *
 * The UI icon sprite ships as a runtime ASSET (assets/icons/ui-sprite.sprite) —
 * 1,177 `<symbol id="…" viewBox="0 0 24 24">` icons. React Native can't resolve
 * external `<use href="sprite.svg#id">` like the web, so we read the sprite text
 * once and pull a symbol out by id on demand (mirrors the better-form
 * /api/icons endpoint), rendering the result with react-native-svg's SvgXml.
 *
 * This module is the pure, RN-free core so it can be unit-tested.
 */

// Ids in the sprite are kebab/alnum; validate before building a RegExp so a
// caller-supplied id can never inject regex metacharacters.
const SAFE_ID = /^[a-z0-9-]{1,64}$/i;

/**
 * Pull `<symbol id="ID">…</symbol>` out of `sprite` and wrap its inner markup in
 * a standalone `<svg viewBox="0 0 24 24">`, rewriting concrete fill/stroke
 * colours to `currentColor` so the icon recolors via the `color` prop. Returns
 * null for an unknown or unsafe id.
 */
export function extractSymbol(sprite: string, id: string): string | null {
  if (!SAFE_ID.test(id)) return null;
  const match = sprite.match(
    new RegExp(`<symbol[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</symbol>`, "i"),
  );
  if (!match) return null;
  const inner = recolor(match[1]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;
}

/** Every symbol id in the sprite, in document order (for the icon picker). */
export function listSymbolIds(sprite: string): string[] {
  const ids: string[] = [];
  const re = /<symbol[^>]*\bid="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sprite)) !== null) ids.push(m[1]);
  return ids;
}

// Replace explicit fill/stroke colours with currentColor; leave `none` (used for
// stroke-only icons) and structural attrs like fill-rule untouched.
function recolor(markup: string): string {
  return markup
    .replace(/\bfill="(?!none")[^"]*"/gi, 'fill="currentColor"')
    .replace(/\bstroke="(?!none")[^"]*"/gi, 'stroke="currentColor"');
}
