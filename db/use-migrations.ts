import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";

import migrations from "../drizzle/migrations";
import { db, expoDb } from "./index";
import { installBundledParserExtensions } from "./services/extensions";
import { seedDefaults } from "./services/seed";

export interface MigrationState {
  success: boolean;
  error?: Error;
}

/**
 * Dev-only: drop every user table (incl. drizzle's bookkeeping) so a changed
 * schema baseline can re-apply from scratch. Pre-release we keep a single
 * baseline migration and reset the local DB instead of writing incremental
 * migrations — so when the baseline changes, the device's old tables conflict
 * with the new `CREATE TABLE`s. Wiping is safe here: there's no real data yet.
 */
function resetLocalDatabase() {
  const tables = expoDb.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  expoDb.execSync("PRAGMA foreign_keys = OFF");
  for (const { name } of tables) {
    expoDb.execSync(`DROP TABLE IF EXISTS "${name}"`);
  }
  expoDb.execSync("PRAGMA foreign_keys = ON");
}

/**
 * Runs the bundled drizzle migrations once on mount.
 *
 * Replaces drizzle-orm v1's built-in `useMigrations` hook, whose type signature
 * still requires the legacy `{ journal }` shape that drizzle-kit v1 no longer
 * emits. The async `migrate()` accepts the current `{ migrations }` shape.
 */
export function useMigrations(): MigrationState {
  const [state, setState] = useState<MigrationState>({ success: false });

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await migrate(db, migrations);
      } catch (error) {
        // In dev, a stale baseline on the device collides with the new schema.
        // Reset and re-apply once. A genuinely broken migration will throw
        // again on the retry and surface normally (so this never masks bugs).
        if (__DEV__) {
          console.warn("[db] migration failed — resetting local DB (dev only):", error);
          resetLocalDatabase();
          await migrate(db, migrations);
        } else {
          throw error;
        }
      }
      // Ensure the default categories/subcategories + Cash wallet exist so the
      // app is usable on first launch (ADR-0004). Idempotent: skips any seedKey
      // already present, so it is safe to run after every successful migration.
      await seedDefaults(db);
      // Phase 2 dev/prod baseline: bundled parser extensions are local/offline
      // install units. Idempotent upsert, so safe after every migration.
      await installBundledParserExtensions(db);
    };

    run()
      .then(() => {
        if (active) setState({ success: true });
      })
      .catch((error: unknown) => {
        if (active) setState({ success: false, error: error as Error });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
