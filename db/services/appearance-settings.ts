import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { getSetting, setSetting } from "@/db/services/app-settings";
import {
  type AppearancePrefs,
  appearancePrefsFromMap,
  serializeBool,
  settingKeyFor,
} from "@/lib/appearance/prefs";

// `db` is dependency-injected so this stays driver-agnostic (expo-sqlite in the
// app, better-sqlite3 in tests) — mirrors db/services/notification-settings.ts.
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

const FIELDS = [
  "theme",
  "accentId",
  "textScale",
  "backgroundBlur",
  "compactDensity",
  "tabBarLabels",
] as const;

/** Read all appearance preferences in one call, filling defaults for unset keys. */
export async function getAppearancePrefs(db: Db): Promise<AppearancePrefs> {
  const entries = await Promise.all(
    FIELDS.map(async (f) => [settingKeyFor(f), await getSetting(db, settingKeyFor(f))] as const),
  );
  return appearancePrefsFromMap(Object.fromEntries(entries));
}

export async function setTheme(db: Db, theme: AppearancePrefs["theme"]): Promise<void> {
  await setSetting(db, settingKeyFor("theme"), theme);
}

export async function setAccent(db: Db, accentId: string): Promise<void> {
  await setSetting(db, settingKeyFor("accentId"), accentId);
}

export async function setTextScale(db: Db, scale: number): Promise<void> {
  await setSetting(db, settingKeyFor("textScale"), String(scale));
}

export async function setAppearanceToggle(
  db: Db,
  field: "backgroundBlur" | "compactDensity" | "tabBarLabels",
  value: boolean,
): Promise<void> {
  await setSetting(db, settingKeyFor(field), serializeBool(value));
}
