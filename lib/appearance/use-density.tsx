import { eq, useLiveQuery } from "@tanstack/react-db";
import { createContext, useContext, type ReactNode } from "react";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { APPEARANCE_DEFAULTS, parseBool } from "@/lib/appearance/prefs";

/**
 * Runtime compact-density flag. The Appearance "compact density" toggle persists
 * `compactDensity`; like the accent/text-scale, it rides a context that the
 * design-system `Card` reads to tighten its padding + gaps app-wide (uniwind
 * can't re-theme spacing at runtime on native).
 */
const DensityContext = createContext<boolean>(APPEARANCE_DEFAULTS.compactDensity);

export function DensityProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery((q) =>
    q
      .from({ s: appSettingsCollection })
      .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceCompactDensity)),
  );
  const compact = parseBool(data?.[0]?.value, APPEARANCE_DEFAULTS.compactDensity);
  return <DensityContext.Provider value={compact}>{children}</DensityContext.Provider>;
}

/** True when compact density is on. */
export function useDensity(): boolean {
  return useContext(DensityContext);
}
