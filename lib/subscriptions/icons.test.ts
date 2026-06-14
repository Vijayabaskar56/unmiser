import { describe, expect, it } from "vitest";

import { SUBSCRIPTION_FALLBACK_ICON, subscriptionIconId } from "@/lib/subscriptions/icons";

describe("subscriptionIconId", () => {
  it("uses the linked category's sprite icon when present", () => {
    const categoryById = new Map([[1, { iconName: "sprite:film-01", seedKey: null }]]);
    expect(subscriptionIconId({ categoryId: 1 }, categoryById)).toBe("film-01");
  });

  it("resolves a seed category by seedKey", () => {
    const categoryById = new Map([[2, { iconName: null, seedKey: "subscription" }]]);
    expect(subscriptionIconId({ categoryId: 2 }, categoryById)).toBe("repeat-04");
  });

  it("falls back when the subscription has no category", () => {
    expect(subscriptionIconId({ categoryId: null }, new Map())).toBe(SUBSCRIPTION_FALLBACK_ICON);
  });

  it("falls back when the linked category is missing from the map", () => {
    expect(subscriptionIconId({ categoryId: 99 }, new Map())).toBe(SUBSCRIPTION_FALLBACK_ICON);
  });
});
