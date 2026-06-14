/**
 * Maps a category to a UI-sprite icon id (ADR-0003 sprite layer). Resolution:
 *   1. a user-chosen `sprite:<id>` stored in iconName wins,
 *   2. else a curated icon for the seed category (by stable seedKey),
 *   3. else a neutral default.
 *
 * This avoids migrating the legacy `type_*` iconName values: existing seed
 * categories render via the seedKey map; new/edited ones store `sprite:<id>`.
 * The sprite has no food/pet glyphs, so a few categories fall back by design —
 * users can repick from the full icon picker.
 */
const SEED_ICON: Record<string, string> = {
  food: "face-smile",
  transport: "car-01",
  shopping: "shopping-bag-03",
  groceries: "shopping-cart-03",
  home: "home-05",
  entertainment: "film-01",
  events: "ticket-01",
  travel: "plane",
  medical: "medical-cross",
  personal: "user-01",
  fitness: "activity-heart",
  services: "tool-01",
  bill: "receipt",
  subscription: "repeat-04",
  emi: "calendar-check-01",
  "credit-bill": "credit-card-01",
  investment: "bar-chart-04",
  support: "life-buoy-01",
  insurance: "umbrella-03",
  tax: "scales-01",
  "top-up": "coins-01",
  children: "users-01",
  business: "briefcase-01",
  "self-transfer": "repeat-04",
  savings: "piggy-bank-01",
  gift: "gift-01",
  lent: "coins-hand",
  donation: "heart-hand",
  "hidden-charges": "percent-03",
  "cash-withdrawal": "bank-note-01",
  income: "currency-rupee",
};

export const DEFAULT_CATEGORY_ICON = "tag-01";
export const SPRITE_ICON_PREFIX = "sprite:";

export function categoryIconId(category: {
  iconName?: string | null;
  seedKey?: string | null;
}): string {
  const name = category.iconName?.trim();
  if (name?.startsWith(SPRITE_ICON_PREFIX)) return name.slice(SPRITE_ICON_PREFIX.length);
  if (category.seedKey && SEED_ICON[category.seedKey]) return SEED_ICON[category.seedKey];
  return DEFAULT_CATEGORY_ICON;
}
