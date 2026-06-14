import { describe, expect, it } from "vitest";

import { categoryIconId } from "@/lib/categories/icons";

describe("categoryIconId", () => {
  it("uses a user-chosen sprite id (sprite: prefix) verbatim", () => {
    expect(categoryIconId({ iconName: "sprite:gift-01", seedKey: "food" })).toBe("gift-01");
  });

  it("maps a seed category to its curated sprite id", () => {
    expect(categoryIconId({ iconName: "type_food_x", seedKey: "transport" })).toBe("car-01");
    expect(categoryIconId({ iconName: "", seedKey: "groceries" })).toBe("shopping-cart-03");
  });

  it("falls back to a default for unknown/empty", () => {
    const fallback = categoryIconId({ iconName: "", seedKey: null });
    expect(fallback.length).toBeGreaterThan(0);
    expect(categoryIconId({ iconName: "type_legacy_glyph", seedKey: "no-such-seed" })).toBe(
      fallback,
    );
  });
});
