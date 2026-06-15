import { eq, useLiveQuery } from "@tanstack/react-db";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { setSetting } from "@/db/services/app-settings";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { translate, type TranslateParams } from "@/lib/i18n/translate";
import { DEFAULT_LOCALE, isSupportedLocale, type LocaleCode } from "@/lib/i18n/translations";

interface I18nContextValue {
  locale: LocaleCode;
  /** Translate a dotted key in the current locale (en fallback). */
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
});

/**
 * App-wide i18n. The selected locale is read reactively from `app.language` in
 * app_settings (like the accent/theme), so changing it on the Language screen
 * re-renders every `useT()` consumer immediately — no reload.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery((q) =>
    q.from({ s: appSettingsCollection }).where(({ s }) => eq(s.key, APP_SETTING_KEYS.appLanguage)),
  );
  const raw = data?.[0]?.value;
  const locale: LocaleCode = isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key, params) => translate(locale, key, params) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current locale + a bound `t()`. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Convenience: just the bound `t()`. */
export function useT(): I18nContextValue["t"] {
  return useContext(I18nContext).t;
}

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/** Persist the selected app language (a locale code). */
export async function setAppLanguage(db: Db, code: LocaleCode): Promise<void> {
  await setSetting(db, APP_SETTING_KEYS.appLanguage, code);
}
