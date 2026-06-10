import { describe, expect, it } from "vitest";
import { categories, appSettings } from "@/db/schema";
import { createTestDb } from "./harness";

describe("test harness", () => {
  it("stands up the full migrated schema with the new columns/tables", async () => {
    const { db, sqlite } = createTestDb();
    // new column from this wave's migration
    await db
      .insert(categories)
      .values({ name: "Food", color: "#fff", seedKey: "food", isIncome: false });
    const rows = await db.select().from(categories);
    expect(rows).toHaveLength(1);
    expect(rows[0].seedKey).toBe("food");
    // new app_settings table exists
    await db.insert(appSettings).values({ key: "mainAccountId", value: "1" });
    const got = await db.select().from(appSettings);
    expect(got[0]).toEqual({ key: "mainAccountId", value: "1" });
    sqlite.close();
  });
});
