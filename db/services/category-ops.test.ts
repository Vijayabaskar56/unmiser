import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accountBalances, accounts, categories, subcategories, transactions } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-support/harness";

import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  editCategory,
  editSubcategory,
} from "@/db/services/category-ops";

// ---- seed helpers -------------------------------------------------------

async function seedAccount(db: TestDb): Promise<number> {
  const [row] = await db
    .insert(accounts)
    .values({ bankName: "HDFC", accountLast4: "1234", isCreditCard: false, currency: "INR" })
    .returning();
  return row.id;
}

async function seedTransaction(db: TestDb, accountId: number, categoryId: number) {
  await db.insert(accountBalances).values({
    accountId,
    balance: "100.00",
    timestamp: "2026-01-01T09:00:00Z",
    sourceType: "MANUAL",
  });
  await db.insert(transactions).values({
    amount: "30.00",
    merchantName: "Shop",
    categoryId,
    accountId,
    transactionType: "EXPENSE",
    dateTime: "2026-01-01T10:00:00Z",
    transactionHash: "hash-1",
  });
}

function allCategories(db: TestDb) {
  return db.select().from(categories);
}

function allSubcategories(db: TestDb) {
  return db.select().from(subcategories);
}

// ---- category CRUD ------------------------------------------------------

describe("createCategory", () => {
  it("inserts a user category (isSystem=false, seedKey=null) and returns its id", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createCategory(db, {
      name: "Coffee",
      color: "#A1887F",
      iconName: "type_coffee",
      description: "Caffeine",
      isIncome: false,
      displayOrder: 5,
    });

    const rows = await allCategories(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].name).toBe("Coffee");
    expect(rows[0].color).toBe("#A1887F");
    expect(rows[0].iconName).toBe("type_coffee");
    expect(rows[0].description).toBe("Caffeine");
    expect(rows[0].isIncome).toBe(false);
    expect(rows[0].displayOrder).toBe(5);
    // Always a user row: never a system/seed row.
    expect(rows[0].isSystem).toBe(false);
    expect(rows[0].seedKey).toBeNull();

    sqlite.close();
  });

  it("defaults optional fields (iconName/description/displayOrder) sensibly", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createCategory(db, { name: "Salary", color: "#4CAF50", isIncome: true });

    const [row] = await db.select().from(categories).where(eq(categories.id, id));
    expect(row.isIncome).toBe(true);
    expect(row.iconName).toBe("");
    expect(row.description).toBe("");
    expect(row.isSystem).toBe(false);

    sqlite.close();
  });
});

describe("editCategory", () => {
  it("updates name/color/isIncome", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createCategory(db, { name: "Food", color: "#FF7043", isIncome: false });

    await editCategory(db, id, { name: "Groceries", color: "#66BB6A", isIncome: true });

    const [row] = await db.select().from(categories).where(eq(categories.id, id));
    expect(row.name).toBe("Groceries");
    expect(row.color).toBe("#66BB6A");
    expect(row.isIncome).toBe(true);

    sqlite.close();
  });
});

describe("deleteCategory", () => {
  it("deletes a category that has no transactions", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createCategory(db, { name: "Temp", color: "#000000", isIncome: false });

    await deleteCategory(db, id);

    expect(await allCategories(db)).toHaveLength(0);

    sqlite.close();
  });

  it("throws when a transaction references the category (RESTRICT) and leaves it intact", async () => {
    const { db, sqlite } = createTestDb();
    const accountId = await seedAccount(db);
    const id = await createCategory(db, { name: "Used", color: "#000000", isIncome: false });
    await seedTransaction(db, accountId, id);

    await expect(deleteCategory(db, id)).rejects.toThrow(/in use/i);

    // The category survives — the guard fired before any delete.
    expect((await allCategories(db)).map((c) => c.id)).toContain(id);

    sqlite.close();
  });

  it("cascade-deletes the category's subcategories when it is removed", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createCategory(db, { name: "Parent", color: "#000000", isIncome: false });
    await createSubcategory(db, { categoryId: id, name: "Child" });

    await deleteCategory(db, id);

    expect(await allCategories(db)).toHaveLength(0);
    expect(await allSubcategories(db)).toHaveLength(0);

    sqlite.close();
  });
});

// ---- subcategory CRUD ---------------------------------------------------

describe("createSubcategory", () => {
  it("inserts a user subcategory belonging to its category and returns its id", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await createCategory(db, {
      name: "Food",
      color: "#FF7043",
      isIncome: false,
    });

    const id = await createSubcategory(db, {
      categoryId,
      name: "Restaurants",
      iconName: "type_restaurant",
      color: "#EF5350",
    });

    const rows = await allSubcategories(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].categoryId).toBe(categoryId);
    expect(rows[0].name).toBe("Restaurants");
    expect(rows[0].iconName).toBe("type_restaurant");
    expect(rows[0].color).toBe("#EF5350");
    expect(rows[0].isSystem).toBe(false);

    sqlite.close();
  });
});

describe("editSubcategory", () => {
  it("updates a subcategory's name/color", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await createCategory(db, {
      name: "Food",
      color: "#FF7043",
      isIncome: false,
    });
    const id = await createSubcategory(db, { categoryId, name: "Old" });

    await editSubcategory(db, id, { name: "New", color: "#123456" });

    const [row] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    expect(row.name).toBe("New");
    expect(row.color).toBe("#123456");

    sqlite.close();
  });
});

describe("deleteSubcategory", () => {
  it("removes the subcategory, leaving its parent category", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await createCategory(db, {
      name: "Food",
      color: "#FF7043",
      isIncome: false,
    });
    const id = await createSubcategory(db, { categoryId, name: "Gone" });

    await deleteSubcategory(db, id);

    expect(await allSubcategories(db)).toHaveLength(0);
    // Parent category untouched.
    expect((await allCategories(db)).map((c) => c.id)).toContain(categoryId);

    sqlite.close();
  });
});
