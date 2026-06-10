import { describe, expect, it } from "vitest";

import { resolveIcon } from "./icon-registry";

/**
 * These assert the PURE resolver behavior via the public interface. In the
 * Phase-0 scaffold nano-icons is not linked (so `type_*` resolves to the chip
 * fallback) and no brand WebPs are bundled (so `ic_brand_*` also falls back).
 * The fallback letter derivation is the load-bearing behavior to lock in.
 */
describe("resolveIcon", () => {
  it("falls back to a letter chip when no iconName is given, using the label", () => {
    const r = resolveIcon({ iconName: null, label: "Food" });
    expect(r).toEqual({ kind: "fallback", letter: "F" });
  });

  it("derives the fallback letter from the label, uppercased", () => {
    expect(resolveIcon({ label: "salary" }).kind).toBe("fallback");
    expect(resolveIcon({ label: "salary" })).toMatchObject({ letter: "S" });
  });

  it("derives a semantic letter from a type_ iconName when no label", () => {
    // nano font isn't linked in the scaffold, so this falls back; the letter
    // should come from the semantic stem, not the "type_" prefix.
    const r = resolveIcon({ iconName: "type_food_stuffed_flatbread" });
    expect(r).toEqual({ kind: "fallback", letter: "F" });
  });

  it("derives a semantic letter from an ic_brand_ iconName when no label", () => {
    const r = resolveIcon({ iconName: "ic_brand_swiggy" });
    // No bundled WebP yet -> fallback, letter from brand stem.
    expect(r).toEqual({ kind: "fallback", letter: "S" });
  });

  it("returns '?' when nothing usable is available", () => {
    expect(resolveIcon({})).toEqual({ kind: "fallback", letter: "?" });
    expect(resolveIcon({ iconName: "   ", label: "  " })).toEqual({
      kind: "fallback",
      letter: "?",
    });
  });

  it("prefers the label over the iconName stem for the fallback letter", () => {
    const r = resolveIcon({ iconName: "type_finance_bank", label: "Wallet" });
    expect(r).toEqual({ kind: "fallback", letter: "W" });
  });
});
