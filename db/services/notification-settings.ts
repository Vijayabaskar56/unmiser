import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { getSetting, setSetting } from "@/db/services/app-settings";
import {
  type NotificationPrefs,
  NOTIFICATION_FIELDS,
  notificationPrefsFromMap,
  serializeBool,
  settingKeyFor,
} from "@/lib/notifications/prefs";

// `db` is dependency-injected so this module stays driver-agnostic (expo-sqlite
// in the app, better-sqlite3 in tests) — mirroring db/services/app-settings.ts.
type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Read all notification preferences in one call, filling defaults for unset
 * keys. Screens normally read these reactively via the app-settings collection;
 * this getter exists for non-reactive callers (the notification dispatcher and
 * scheduler) and tests.
 */
export async function getNotificationPrefs(db: Db): Promise<NotificationPrefs> {
  const entries = await Promise.all(
    NOTIFICATION_FIELDS.map(
      async (field) => [settingKeyFor(field), await getSetting(db, settingKeyFor(field))] as const,
    ),
  );
  return notificationPrefsFromMap(Object.fromEntries(entries));
}

/** Upsert a single notification preference (stored as "true"/"false"). */
export async function setNotificationPref(
  db: Db,
  field: keyof NotificationPrefs,
  value: boolean,
): Promise<void> {
  await setSetting(db, settingKeyFor(field), serializeBool(value));
}
