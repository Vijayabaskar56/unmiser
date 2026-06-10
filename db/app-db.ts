import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db } from "./index";
import type * as schema from "./schema";

/**
 * Driver-agnostic bridge for the services layer.
 *
 * The persistence services (app-settings, seed, transaction-ops) declare their
 * `db` parameter as the test harness's `TestDb` (a better-sqlite3 drizzle
 * instance) because that is the flavour their unit tests inject. At runtime the
 * app injects the expo-sqlite drizzle instance instead. Both expose the same
 * await-style query-builder surface used by those services (select/insert/
 * update/delete/onConflict…), so they are interchangeable AT RUNTIME — but their
 * TypeScript types differ in the relations generic, so a direct pass is a type
 * error.
 *
 * `appDb` is the single, documented place that reconciles that: the global expo
 * `db` re-typed as the service-expected shape. Keeping the cast here (rather than
 * scattered at every call site) means there is exactly one seam to revisit if the
 * services are ever re-typed to a shared driver-agnostic interface.
 */
export const appDb = db as unknown as BetterSQLite3Database<typeof schema>;
