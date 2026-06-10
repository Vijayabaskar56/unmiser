import { db } from "@/db/index";
import { type AppSetting, appSettings } from "@/db/schema";
import { createDrizzleCollection } from "../collection-factory";

/**
 * Reactive key-value app preferences (ADR-0005). Keyed by `key`. Read via live
 * queries; written through the optimistic CRUD layer like any other collection.
 */
export const appSettingsCollection = createDrizzleCollection<AppSetting>({
  db,
  table: appSettings,
  getKey: (row) => row.key,
});
