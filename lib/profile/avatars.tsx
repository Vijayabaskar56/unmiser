import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import Avatar0 from "@/assets/illustractions/0.svg";
import Avatar1 from "@/assets/illustractions/1.svg";
import Avatar2 from "@/assets/illustractions/2.svg";
import Avatar3 from "@/assets/illustractions/3.svg";

/**
 * The avatar is derived from the chosen archetype — one illustration per type.
 * Kept out of `lib/profile/archetypes.ts` because `.svg` imports need the Metro
 * transformer, which would break that module's vitest unit tests.
 */
const AVATAR_BY_ARCHETYPE: Record<string, FC<SvgProps>> = {
  planner: Avatar0,
  saver: Avatar1,
  spender: Avatar2,
  investor: Avatar3,
};

export function avatarForArchetype(id: string): FC<SvgProps> {
  return AVATAR_BY_ARCHETYPE[id] ?? Avatar0;
}
