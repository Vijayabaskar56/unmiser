import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/db/schema";

// Node test harness: an in-memory SQLite DB with the real generated migrations
// applied, wrapped in drizzle. expo-sqlite is native-only, so unit tests for the
// persistence/cascade layer run against better-sqlite3 instead. The schema and
// migrations are identical to what ships on-device.
const MIGRATIONS_DIR = join(__dirname, "..", "..", "drizzle");

export type TestDb = BetterSQLite3Database<typeof schema>;

export interface TestHarness {
  db: TestDb;
  sqlite: Database.Database;
}

export function createTestDb(): TestHarness {
  const sqlite = new Database(":memory:");
  // Apply migrations with FK enforcement off (CREATE order is dependency-naive),
  // then turn it on so tests exercise referential integrity.
  sqlite.pragma("foreign_keys = OFF");
  const migrationDirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => /^\d{14}_/.test(d))
    .sort();
  for (const dir of migrationDirs) {
    const sql = readFileSync(join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle({ client: sqlite, schema });
  return { db, sqlite };
}
