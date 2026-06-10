import { defineConfig } from "drizzle-kit";

// On-device SQLite via expo-sqlite. `driver: "expo"` makes drizzle-kit emit
// a bundled migrations.js (consumed by drizzle-orm/expo-sqlite/migrator) instead
// of trying to connect to a live database. Workflow: edit db/schema.ts → `bun db:generate`.
export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
});
