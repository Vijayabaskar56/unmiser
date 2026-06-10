import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import { relations } from "./relations";

// Raw expo-sqlite handle — pass this to useDrizzleStudio() for the
// on-device Drizzle Studio dev tool. enableChangeListener powers
// drizzle's useLiveQuery() hook.
export const expoDb = openDatabaseSync("unmiser.db", { enableChangeListener: true });

// Drizzle ORM v1 instance — `relations` (from defineRelations) powers the
// relational query builder (db.query.*). Import `db` everywhere you query.
export const db = drizzle(expoDb, { relations });

export * from "./schema";
export { relations, tables } from "./relations";
