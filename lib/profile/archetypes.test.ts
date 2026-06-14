import { describe, expect, it } from "vitest";

import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, getArchetype } from "@/lib/profile/archetypes";

describe("archetypes", () => {
  it("ships the four starter archetypes with stable ids", () => {
    expect(ARCHETYPES.map((a) => a.id)).toEqual(["planner", "saver", "spender", "investor"]);
  });

  it("every archetype carries the fields the profile screen needs", () => {
    for (const a of ARCHETYPES) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.tagline.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("getArchetype resolves a known id", () => {
    expect(getArchetype("saver").name).toBe("The Saver");
  });

  it("getArchetype falls back to the default for an unknown or null id", () => {
    const fallback = getArchetype(DEFAULT_ARCHETYPE_ID);
    expect(getArchetype(null).id).toBe(fallback.id);
    expect(getArchetype("nope").id).toBe(fallback.id);
  });
});
