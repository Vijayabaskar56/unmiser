import { eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect } from "react";
import { Uniwind } from "uniwind";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";

/**
 * Applies the persisted Appearance theme preference (light/dark/auto) to
 * uniwind. Reactive via the app-settings live query, so changing the theme on
 * the Appearance screen flips the whole app immediately. "auto" uses uniwind's
 * "system" mode, which follows (and tracks) the OS color scheme.
 *
 * Accent is applied separately (lib/appearance/use-accent) — uniwind native
 * can't override a CSS variable at runtime, and a full precompiled accent theme
 * would have to duplicate heroui's entire token set, so accent rides a context
 * the accent-aware components consume instead.
 */
export function ThemeApplier() {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ s: appSettingsCollection })
        .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceTheme)),
    [],
  );
  const mode = data?.[0]?.value ?? "auto";

  useEffect(() => {
    Uniwind.setTheme(mode === "light" ? "light" : mode === "dark" ? "dark" : "system");
  }, [mode]);

  return null;
}
