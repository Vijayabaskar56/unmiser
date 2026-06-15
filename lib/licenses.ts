/**
 * Open-source dependencies bundled into the app, grouped for the Licenses
 * screen. License field uses SPDX identifiers; this is the runtime stack the
 * shipped app actually links against (dev tooling like oxlint/vitest is
 * omitted — it isn't part of the binary).
 */
export interface LicenseEntry {
  name: string;
  license: SpdxId;
  /** Project homepage / repo, opened when the row is tapped. */
  url: string;
}

export type SpdxId = "MIT" | "Apache-2.0" | "BSD-3-Clause" | "OFL-1.1";

export const LICENSES: LicenseEntry[] = [
  { name: "React Native", license: "MIT", url: "https://github.com/facebook/react-native" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Expo", license: "MIT", url: "https://github.com/expo/expo" },
  { name: "Expo Router", license: "MIT", url: "https://github.com/expo/expo" },
  {
    name: "React Native Reanimated",
    license: "MIT",
    url: "https://github.com/software-mansion/react-native-reanimated",
  },
  {
    name: "React Native Gesture Handler",
    license: "MIT",
    url: "https://github.com/software-mansion/react-native-gesture-handler",
  },
  {
    name: "React Native Screens",
    license: "MIT",
    url: "https://github.com/software-mansion/react-native-screens",
  },
  {
    name: "React Native SVG",
    license: "MIT",
    url: "https://github.com/software-mansion/react-native-svg",
  },
  {
    name: "@gorhom/bottom-sheet",
    license: "MIT",
    url: "https://github.com/gorhom/react-native-bottom-sheet",
  },
  {
    name: "Keyboard Controller",
    license: "MIT",
    url: "https://github.com/kirillzyusko/react-native-keyboard-controller",
  },
  { name: "@legendapp/list", license: "MIT", url: "https://github.com/LegendApp/legend-list" },
  { name: "HeroUI Native", license: "MIT", url: "https://github.com/heroui-inc/heroui-native" },
  { name: "TanStack DB", license: "MIT", url: "https://github.com/TanStack/db" },
  { name: "TanStack Query", license: "MIT", url: "https://github.com/TanStack/query" },
  {
    name: "Drizzle ORM",
    license: "Apache-2.0",
    url: "https://github.com/drizzle-team/drizzle-orm",
  },
  { name: "Nitro Modules", license: "MIT", url: "https://github.com/mrousavy/nitro" },
  { name: "date-fns", license: "MIT", url: "https://github.com/date-fns/date-fns" },
  { name: "decimal.js", license: "MIT", url: "https://github.com/MikeMcl/decimal.js" },
  { name: "Valibot", license: "MIT", url: "https://github.com/fabian-hiller/valibot" },
  { name: "Zod", license: "MIT", url: "https://github.com/colinhacks/zod" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "Uniwind", license: "MIT", url: "https://github.com/uniwind/uniwind" },
  { name: "js-md5", license: "BSD-3-Clause", url: "https://github.com/emn178/js-md5" },
  {
    name: "Hanken Grotesk (font)",
    license: "OFL-1.1",
    url: "https://github.com/google/fonts/tree/main/ofl/hankengrotesk",
  },
  {
    name: "Space Mono (font)",
    license: "OFL-1.1",
    url: "https://github.com/googlefonts/spacemono",
  },
];

/** Where each license's canonical full text lives (SPDX). */
export const LICENSE_URLS: Record<SpdxId, string> = {
  MIT: "https://opensource.org/license/mit",
  "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
  "BSD-3-Clause": "https://opensource.org/license/bsd-3-clause",
  "OFL-1.1": "https://openfontlicense.org",
};
