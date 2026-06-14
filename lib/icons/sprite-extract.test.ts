import { describe, expect, it } from "vitest";

import { extractSymbol, listSymbolIds } from "@/lib/icons/sprite-extract";

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg"><defs>
<symbol xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="cart"><path fill-rule="evenodd" fill="#15140f" d="M1 2H3"/></symbol>
<symbol viewBox="0 0 24 24" id="coffee-cup"><path fill="none" stroke="#111111" d="M3 4"/></symbol>
</defs></svg>`;

describe("extractSymbol", () => {
  it("returns a standalone <svg> wrapping the symbol's inner markup", () => {
    const svg = extractSymbol(SPRITE, "cart");
    expect(svg).not.toBeNull();
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('d="M1 2H3"');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("rewrites concrete fill colours to currentColor (so it recolors)", () => {
    const svg = extractSymbol(SPRITE, "cart")!;
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toContain("#15140f");
    // structural fill-rule is preserved
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it("rewrites stroke colours but preserves fill=none", () => {
    const svg = extractSymbol(SPRITE, "coffee-cup")!;
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain("#111111");
  });

  it("returns null for an unknown id", () => {
    expect(extractSymbol(SPRITE, "nope")).toBeNull();
  });

  it("returns null for an unsafe id rather than building a bad regex", () => {
    expect(extractSymbol(SPRITE, 'cart"](.*)')).toBeNull();
  });
});

describe("listSymbolIds", () => {
  it("lists every symbol id in document order", () => {
    expect(listSymbolIds(SPRITE)).toEqual(["cart", "coffee-cup"]);
  });
});
