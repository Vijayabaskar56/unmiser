import { describe, expect, it } from "vitest";

import { categories, merchantMappings } from "@/db/schema";
import { createTestDb } from "@/db/test-support/harness";

import {
  learnMapping,
  lookupCategoryForMerchant,
  resolveCategory,
} from "@/db/services/merchant-mapping";

async function seedCategory(
  db: ReturnType<typeof createTestDb>["db"],
  name: string,
): Promise<number> {
  const rows = await db
    .insert(categories)
    .values({ name, color: "#000000" })
    .returning({ id: categories.id });
  return rows[0].id;
}

describe("merchant-mapping service", () => {
  it("learns then looks up a mapping (round-trip)", async () => {
    const { db, sqlite } = createTestDb();
    const foodId = await seedCategory(db, "Food");

    await learnMapping(db, "Swiggy", foodId);

    expect(await lookupCategoryForMerchant(db, "Swiggy")).toBe(foodId);

    sqlite.close();
  });

  it("re-learning the same merchant updates without duplicating (merchantName is PK)", async () => {
    const { db, sqlite } = createTestDb();
    const foodId = await seedCategory(db, "Food");
    const travelId = await seedCategory(db, "Travel");

    await learnMapping(db, "Uber", foodId);
    await learnMapping(db, "Uber", travelId);

    expect(await lookupCategoryForMerchant(db, "Uber")).toBe(travelId);

    // exactly one row for the merchant — upsert, not duplicate insert
    const rows = await db.select().from(merchantMappings);
    expect(rows.length).toBe(1);

    sqlite.close();
  });

  it("looks up case-insensitively on the normalized key", async () => {
    const { db, sqlite } = createTestDb();
    const foodId = await seedCategory(db, "Food");

    await learnMapping(db, "Starbucks", foodId);

    expect(await lookupCategoryForMerchant(db, "STARBUCKS")).toBe(foodId);
    expect(await lookupCategoryForMerchant(db, "starbucks")).toBe(foodId);
    expect(await lookupCategoryForMerchant(db, "StArBuCkS")).toBe(foodId);

    // learning a differently-cased spelling updates the same row, not a new one
    const travelId = await seedCategory(db, "Travel");
    await learnMapping(db, "starbucks", travelId);
    expect(await lookupCategoryForMerchant(db, "Starbucks")).toBe(travelId);
    expect((await db.select().from(merchantMappings)).length).toBe(1);

    sqlite.close();
  });

  it("returns null for an unknown merchant", async () => {
    const { db, sqlite } = createTestDb();

    expect(await lookupCategoryForMerchant(db, "Nonexistent")).toBeNull();

    sqlite.close();
  });

  it("resolveCategory prefers a learned mapping over the parser default", async () => {
    const { db, sqlite } = createTestDb();
    const learnedId = await seedCategory(db, "Food");
    const parserId = await seedCategory(db, "Shopping");

    await learnMapping(db, "Amazon", learnedId);

    // learned mapping wins
    expect(
      await resolveCategory(db, {
        cleanedMerchant: "Amazon",
        parserCategoryId: parserId,
      }),
    ).toBe(learnedId);

    // no learned mapping -> falls back to the parser default
    expect(
      await resolveCategory(db, {
        cleanedMerchant: "Flipkart",
        parserCategoryId: parserId,
      }),
    ).toBe(parserId);

    // no learned mapping and no parser default -> null
    expect(
      await resolveCategory(db, {
        cleanedMerchant: "Flipkart",
        parserCategoryId: null,
      }),
    ).toBeNull();

    sqlite.close();
  });
});
