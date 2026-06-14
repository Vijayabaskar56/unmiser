import { describe, expect, it } from "vitest";

import { BANNERS, DEFAULT_BANNER_ID, getBanner } from "@/lib/profile/banners";

describe("banners", () => {
  it("ships a non-empty set of presets with hex colour pairs", () => {
    expect(BANNERS.length).toBeGreaterThan(0);
    for (const b of BANNERS) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.from).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(b.to).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("includes the 'dusk' preset from the design mock", () => {
    expect(BANNERS.map((b) => b.id)).toContain("dusk");
  });

  it("getBanner falls back to the default for an unknown or null id", () => {
    const fallback = getBanner(DEFAULT_BANNER_ID);
    expect(getBanner(null).id).toBe(fallback.id);
    expect(getBanner("nope").id).toBe(fallback.id);
  });
});
