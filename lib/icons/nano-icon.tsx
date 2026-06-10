import type { ComponentType } from "react";

import { type CategoryGlyphName } from "./category-glyphmap";

/**
 * Wrapper over the `react-native-nano-icons` generated icon component
 * (ADR-0003 layer B).
 *
 * `react-native-nano-icons` is a build-time SVG -> `.ttf` pipeline that needs a
 * dev build / prebuild and ships a native font. It is **NOT installed** in this
 * Phase-0 scaffold, and its config plugin has been removed from `app.json` so
 * `expo` commands resolve. Therefore this module **must not import or require
 * the package in any form** — Metro rejects a dynamic `require(variable)`, and a
 * static `require("react-native-nano-icons")` fails to bundle while the package
 * is absent. Until it is wired, `getNanoIconComponent()` returns `null` and the
 * `<Icon>` component falls back to its colored chip.
 *
 * TO ENABLE (after `bun add react-native-nano-icons`, re-adding the app.json
 * plugin, sourcing the SVGs, and producing a dev build that regenerates the
 * glyphmap json) — replace the body below with the static wiring:
 *
 *   import { createNanoIconSet } from "react-native-nano-icons";
 *   import glyphMap from "../../assets/icons/nanoicons/UnmiserCategoryIcons.glyphmap.json";
 *   const NanoIcon = createNanoIconSet(glyphMap);
 *   export function getNanoIconComponent(): NanoIconComponent | null { return NanoIcon; }
 *
 * See assets/icons/README.md for the full bring-up sequence.
 */

export type NanoIconProps = {
  name: CategoryGlyphName;
  size?: number;
  color?: string;
};

type NanoIconComponent = ComponentType<NanoIconProps>;

export function getNanoIconComponent(): NanoIconComponent | null {
  // Scaffold: nano-icons is not installed; force the chip fallback in <Icon>.
  return null;
}
