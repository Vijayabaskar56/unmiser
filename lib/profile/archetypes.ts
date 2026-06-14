/**
 * Financial archetypes — the user's chosen money "personality". This is pillar 2
 * (behaviour change): later phases branch nudges on the selected archetype, so
 * the id stored in app_settings (`profile.archetype`) is a durable signal.
 *
 * The avatar illustration is *derived* from the archetype (one face per type) —
 * see `lib/profile/avatars.tsx` for the id→SVG mapping. This module stays free of
 * `.svg` imports so it can be unit-tested without the Metro SVG transformer.
 *
 * `accent` is a decorative tint (avatar ring + archetype chip), NOT a theme
 * override — the app keeps its single editorial yellow accent everywhere else.
 */
export interface Archetype {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
}

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: "planner",
    name: "The Planner",
    tagline: "Every rupee has a job",
    description:
      "You think in budgets and forecasts. Structure keeps your money calm — you like knowing where each rupee is headed before it moves.",
    accent: "#5b8def",
  },
  {
    id: "saver",
    name: "The Saver",
    tagline: "Safety first",
    description:
      "You build buffers and sleep better for it. Security matters more than the upside, and a growing cushion is its own reward.",
    accent: "#1f7a3d",
  },
  {
    id: "spender",
    name: "The Spender",
    tagline: "Live a little",
    description:
      "You spend for the moment and the people in it. Money is meant to be enjoyed — the trick is making room for that without the regret.",
    accent: "#e0578a",
  },
  {
    id: "investor",
    name: "The Investor",
    tagline: "Make money work",
    description:
      "You think in returns and time horizons. Idle cash feels wasted — you'd rather it compound while you get on with life.",
    accent: "#d98a2b",
  },
] as const;

export const DEFAULT_ARCHETYPE_ID = ARCHETYPES[0].id;

/** Resolve an archetype by id, falling back to the default for null/unknown. */
export function getArchetype(id: string | null | undefined): Archetype {
  return ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0];
}
