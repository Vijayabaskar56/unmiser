import { eq, useLiveQuery } from "@tanstack/react-db";
import { createContext, useContext, type ReactNode } from "react";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { APPEARANCE_DEFAULTS, clampTextScale } from "@/lib/appearance/prefs";

/**
 * Runtime text-size multiplier. The Appearance slider persists a continuous
 * `textScale` (0.85..1.3, 1 = neutral); like the accent, uniwind can't re-theme
 * font sizes at runtime on native, so the scale rides a context that
 * `components/ui/text.tsx` reads to scale every design-system `Text`.
 */
const TextScaleContext = createContext<number>(APPEARANCE_DEFAULTS.textScale);

export function TextScaleProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ s: appSettingsCollection })
        .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceTextStep)),
    [],
  );
  const raw = data?.[0]?.value;
  const scale = raw == null ? APPEARANCE_DEFAULTS.textScale : clampTextScale(Number(raw));
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

export function useTextScale(): number {
  return useContext(TextScaleContext);
}
