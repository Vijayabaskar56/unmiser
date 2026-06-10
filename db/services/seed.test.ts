import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { accounts, categories, subcategories } from "@/db/schema";
import { SEED_CASH_ACCOUNT, SEED_CATEGORIES, SEED_SUBCATEGORIES } from "@/db/seed/categories";
import { resetCategory, seedDefaults } from "@/db/services/seed";
import { createTestDb, type TestHarness } from "@/db/test-support/harness";

describe("seedDefaults", () => {
  let harness: TestHarness;

  afterEach(() => {
    harness?.sqlite.close();
  });

  it("inserts every default category and subcategory", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const cats = await db.select().from(categories);
    const subs = await db.select().from(subcategories);

    expect(cats).toHaveLength(SEED_CATEGORIES.length);
    expect(subs).toHaveLength(SEED_SUBCATEGORIES.length);
  });

  it("marks seeded categories and subcategories as system rows with seedKeys", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const cats = await db.select().from(categories);
    for (const c of cats) {
      expect(c.isSystem).toBe(true);
      expect(c.seedKey).toBeTruthy();
    }
  });

  it("is idempotent — running twice does not duplicate rows", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);
    await seedDefaults(db);

    const cats = await db.select().from(categories);
    const subs = await db.select().from(subcategories);

    expect(cats).toHaveLength(SEED_CATEGORIES.length);
    expect(subs).toHaveLength(SEED_SUBCATEGORIES.length);
  });

  it("gives every category a unique seedKey", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const cats = await db.select().from(categories);
    const keys = cats.map((c) => c.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the verbatim per-category description from the seed", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const cats = await db.select().from(categories);
    const bySeedKey = (key: string) => cats.find((c) => c.seedKey === key);

    expect(bySeedKey("food")?.description).toBe("Eating out, Swiggy, Zomato etc.");
    expect(bySeedKey("transport")?.description).toBe("Uber, Ola and other modes of transport.");
    expect(bySeedKey("income")?.description).toBe("Generic income");

    // Every seeded category must carry a non-empty description.
    for (const c of cats) {
      expect(c.description).toBeTruthy();
    }
  });

  it("preserves income vs expense flags from the seed", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const income = (await db.select().from(categories)).find((c) => c.seedKey === "income");
    const food = (await db.select().from(categories)).find((c) => c.seedKey === "food");

    expect(income?.isIncome).toBe(true);
    expect(food?.isIncome).toBe(false);
  });

  it("creates the Cash wallet account with isWallet = true", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const cash = (await db.select().from(accounts)).find(
      (a) =>
        a.bankName === SEED_CASH_ACCOUNT.bankName &&
        a.accountLast4 === SEED_CASH_ACCOUNT.accountLast4,
    );

    expect(cash).toBeDefined();
    expect(cash?.isWallet).toBe(true);
  });

  it("does not duplicate the Cash wallet on a second run", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);
    await seedDefaults(db);

    const wallets = (await db.select().from(accounts)).filter(
      (a) => a.bankName === SEED_CASH_ACCOUNT.bankName,
    );
    expect(wallets).toHaveLength(1);
  });

  it("skips a seedKey that already exists without touching the existing row", async () => {
    harness = createTestDb();
    const { db } = harness;

    // Pre-insert "food" with a user-edited name; seed should not overwrite it.
    await db.insert(categories).values({
      name: "My Food",
      color: "#000000",
      iconName: "custom",
      isSystem: true,
      seedKey: "food",
    });

    await seedDefaults(db);

    const food = (await db.select().from(categories)).filter((c) => c.seedKey === "food");
    expect(food).toHaveLength(1);
    expect(food[0].name).toBe("My Food");
  });
});

describe("resetCategory", () => {
  let harness: TestHarness;

  afterEach(() => {
    harness?.sqlite.close();
  });

  it("restores name, color and iconName from the seed after a rename", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);

    const before = (await db.select().from(categories)).find((c) => c.seedKey === "food")!;
    // User renames and recolors the system category.
    await db
      .update(categories)
      .set({ name: "Munchies", color: "#000000", iconName: "wrong_icon" })
      .where(eq(categories.id, before.id));

    await resetCategory(db, "food");

    const after = (await db.select().from(categories)).find((c) => c.id === before.id)!;
    expect(after.name).toBe("Food & Drinks");
    expect(after.color).toBe("#FC8019");
    expect(after.iconName).toBe("type_food_stuffed_flatbread");
  });

  it("returns false and changes nothing for an unknown seedKey", async () => {
    harness = createTestDb();
    const { db } = harness;

    await seedDefaults(db);
    const result = await resetCategory(db, "not-a-real-key");
    expect(result).toBe(false);
  });

  it("returns false when the seedKey is known but no row carries it", async () => {
    harness = createTestDb();
    const { db } = harness;

    // No seedDefaults run — "food" is a valid seed key but no row exists.
    const result = await resetCategory(db, "food");
    expect(result).toBe(false);
  });
});
