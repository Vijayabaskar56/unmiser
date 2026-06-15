import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { APP_SETTING_KEYS } from "@/db/schema";
import { setSetting } from "@/db/services/app-settings";
import { deleteAllData } from "@/db/services/data-ops";
import { clearPin } from "@/lib/security/pin";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * Forgot-PIN recovery. App-lock protects on-device data and there is no account
 * or cloud backup to restore from, so the only safe reset is to erase that data
 * and turn the lock off — exactly what an attacker could NOT do without wiping
 * everything. Wipes all rows, clears the stored PIN, and disables App-lock +
 * biometric. The caller refetches collections + releases the lock overlay.
 */
export async function resetAppLockAndWipe(db: Db): Promise<void> {
  await deleteAllData(db);
  await clearPin();
  await setSetting(db, APP_SETTING_KEYS.appLockEnabled, "false");
  await setSetting(db, APP_SETTING_KEYS.appLockBiometric, "false");
}
