import { eq, useLiveQuery } from "@tanstack/react-db";
import { createContext, useContext, type ReactNode } from "react";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { APPEARANCE_DEFAULTS, parseBool } from "@/lib/appearance/prefs";

/**
 * Runtime "background blur" flag. The Appearance toggle persists
 * `backgroundBlur`; overlays (bottom sheets, modals) read it via
 * `useBackgroundBlur()` to render a blurred backdrop instead of a flat dim. The
 * blur itself is feature-detected at the component level (expo-blur is native;
 * a runtime without it degrades to the flat dim).
 */
const BackgroundBlurContext = createContext<boolean>(APPEARANCE_DEFAULTS.backgroundBlur);

export function BackgroundBlurProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ s: appSettingsCollection })
        .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceBackgroundBlur)),
    [],
  );
  const blur = parseBool(data?.[0]?.value, APPEARANCE_DEFAULTS.backgroundBlur);
  return <BackgroundBlurContext.Provider value={blur}>{children}</BackgroundBlurContext.Provider>;
}

/** True when the background-blur preference is on. */
export function useBackgroundBlur(): boolean {
  return useContext(BackgroundBlurContext);
}
