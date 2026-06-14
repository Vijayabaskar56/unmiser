/**
 * Banner presets — the cover art behind the profile header. Stored by id in
 * app_settings (`profile.bannerId`). Each preset is a two-stop gradient rendered
 * with react-native-svg (see the BannerView component); no image files ship.
 *
 * Pure data only (no SVG imports) so it can be unit-tested without Metro.
 */
export interface Banner {
  id: string;
  name: string;
  from: string;
  to: string;
}

export const BANNERS: readonly Banner[] = [
  { id: "dusk", name: "Dusk", from: "#b8a6e0", to: "#f4d9c6" },
  { id: "paper", name: "Paper", from: "#e3e1d5", to: "#cdcbbf" },
  { id: "moss", name: "Moss", from: "#9bbf8f", to: "#d6e0c2" },
  { id: "ember", name: "Ember", from: "#e8a87c", to: "#e0578a" },
  { id: "tide", name: "Tide", from: "#7fb5d6", to: "#bfe0e3" },
  { id: "ink", name: "Ink", from: "#3a382f", to: "#86847a" },
] as const;

export const DEFAULT_BANNER_ID = BANNERS[0].id;

/** Resolve a banner by id, falling back to the default for null/unknown. */
export function getBanner(id: string | null | undefined): Banner {
  return BANNERS.find((b) => b.id === id) ?? BANNERS[0];
}
