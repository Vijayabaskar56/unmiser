import { eq, useLiveQuery } from "@tanstack/react-db";
import { createContext, useContext, type ReactNode } from "react";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { accentHex } from "@/lib/appearance/prefs";

/**
 * Runtime accent colour. uniwind can't re-theme a CSS variable at runtime on
 * native (and a precompiled accent theme would have to duplicate heroui's whole
 * token set), so the accent rides a context instead of the static `bg-accent`
 * class. The provider runs ONE live query; accent-aware components read the hex
 * via `useAccent()` and apply it as `backgroundColor`. `accent-foreground` stays
 * ink across accents, so paired text keeps the `text-accent-foreground` class.
 */
const AccentContext = createContext<string>(accentHex(null));

export function AccentProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ s: appSettingsCollection })
        .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceAccent)),
    [],
  );
  const accent = accentHex(data?.[0]?.value);
  return <AccentContext.Provider value={accent}>{children}</AccentContext.Provider>;
}

export function useAccent(): string {
  return useContext(AccentContext);
}

/**
 * The runtime accent fill for accent-variant primitives. uniwind can't drive
 * `bg-accent` at runtime on native, so accent-aware components (Button, Chip,
 * Badge) paint the background here instead. Non-accent variants get `undefined`
 * so their className-driven fill wins.
 */
export function accentBackground(
  variant: string,
  accent: string,
): { backgroundColor: string } | undefined {
  return variant === "accent" ? { backgroundColor: accent } : undefined;
}
