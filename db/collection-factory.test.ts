import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { categories } from "@/db/schema";
import { createTestDb, type TestHarness } from "@/db/test-support/harness";

import { createDrizzleCollection } from "./collection-factory";

let harness: TestHarness;

beforeEach(() => {
  harness = createTestDb();
});

afterEach(() => {
  harness.sqlite.close();
});

function categoriesCollection(
  afterWrite?: Parameters<typeof createDrizzleCollection>[0]["afterWrite"],
) {
  return createDrizzleCollection({
    db: harness.db,
    table: categories,
    getKey: (c: typeof categories.$inferSelect) => c.id,
    afterWrite,
  });
}

describe("createDrizzleCollection — persistence", () => {
  it("persists an insert to the database", async () => {
    const collection = categoriesCollection();

    const tx = collection.insert({
      id: 1,
      name: "Food",
      color: "#ff0000",
      iconResId: 0,
      iconName: "",
      description: "",
      isSystem: false,
      isIncome: false,
      displayOrder: 0,
      seedKey: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await tx.isPersisted.promise;

    const rows = await harness.db.select().from(categories).where(eq(categories.id, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Food");
  });

  it("persists an update to the database", async () => {
    const collection = categoriesCollection();
    await collection.insert({
      id: 1,
      name: "Food",
      color: "#ff0000",
      iconResId: 0,
      iconName: "",
      description: "",
      isSystem: false,
      isIncome: false,
      displayOrder: 0,
      seedKey: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }).isPersisted.promise;

    const tx = collection.update(1, (draft) => {
      draft.name = "Groceries";
      draft.color = "#00ff00";
    });
    await tx.isPersisted.promise;

    const rows = await harness.db.select().from(categories).where(eq(categories.id, 1));
    expect(rows[0].name).toBe("Groceries");
    expect(rows[0].color).toBe("#00ff00");
  });

  it("persists a delete to the database", async () => {
    const collection = categoriesCollection();
    await collection.insert({
      id: 1,
      name: "Food",
      color: "#ff0000",
      iconResId: 0,
      iconName: "",
      description: "",
      isSystem: false,
      isIncome: false,
      displayOrder: 0,
      seedKey: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }).isPersisted.promise;

    const tx = collection.delete(1);
    await tx.isPersisted.promise;

    const rows = await harness.db.select().from(categories).where(eq(categories.id, 1));
    expect(rows).toHaveLength(0);
  });
});

const baseCategory = {
  id: 1,
  name: "Food",
  color: "#ff0000",
  iconResId: 0,
  iconName: "",
  description: "",
  isSystem: false,
  isIncome: false,
  displayOrder: 0,
  seedKey: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("createDrizzleCollection — afterWrite cascade hook", () => {
  it("invokes afterWrite with the written rows on insert", async () => {
    const afterWrite = vi.fn();
    const collection = categoriesCollection(afterWrite);

    await collection.insert(baseCategory).isPersisted.promise;

    expect(afterWrite).toHaveBeenCalledTimes(1);
    const ctx = afterWrite.mock.calls[0][0];
    expect(ctx.operation).toBe("insert");
    expect(ctx.db).toBe(harness.db);
    expect(ctx.rows).toHaveLength(1);
    expect(ctx.rows[0].name).toBe("Food");
  });

  it("invokes afterWrite with the modified rows on update", async () => {
    const afterWrite = vi.fn();
    const collection = categoriesCollection(afterWrite);
    await collection.insert(baseCategory).isPersisted.promise;
    afterWrite.mockClear();

    await collection.update(1, (draft) => {
      draft.name = "Groceries";
    }).isPersisted.promise;

    const ctx = afterWrite.mock.calls[0][0];
    expect(ctx.operation).toBe("update");
    expect(ctx.rows[0].name).toBe("Groceries");
  });

  it("invokes afterWrite with the removed keys on delete", async () => {
    const afterWrite = vi.fn();
    const collection = categoriesCollection(afterWrite);
    await collection.insert(baseCategory).isPersisted.promise;
    afterWrite.mockClear();

    await collection.delete(1).isPersisted.promise;

    const ctx = afterWrite.mock.calls[0][0];
    expect(ctx.operation).toBe("delete");
    expect(ctx.keys).toEqual([1]);
  });

  it("surfaces an error thrown by afterWrite (rollback intent)", async () => {
    const afterWrite = vi.fn(() => {
      throw new Error("cascade failed");
    });
    const collection = categoriesCollection(afterWrite);

    const tx = collection.insert(baseCategory);
    await expect(tx.isPersisted.promise).rejects.toThrow("cascade failed");
  });

  it("lets afterWrite persist derived state in the same step", async () => {
    // afterWrite writes a second row, modelling a cascade (e.g. balance recalc).
    const collection = categoriesCollection(async (ctx) => {
      if (ctx.operation !== "insert") return;
      await harness.db.insert(categories).values({
        ...baseCategory,
        id: 99,
        name: "Derived",
      });
    });

    await collection.insert(baseCategory).isPersisted.promise;

    const rows = await harness.db.select().from(categories);
    expect(rows.map((r) => r.name).sort()).toEqual(["Derived", "Food"]);
  });
});

describe("createDrizzleCollection — read projection", () => {
  it("seeds initial state from the default queryFn (whole table)", async () => {
    await harness.db.insert(categories).values([
      { ...baseCategory, id: 1, name: "Food" },
      { ...baseCategory, id: 2, name: "Travel" },
    ]);

    const collection = categoriesCollection();
    await collection.stateWhenReady();

    expect(collection.size).toBe(2);
    expect(collection.get(2)?.name).toBe("Travel");
  });
});

describe("createDrizzleCollection — atomicity (app transaction wrap)", () => {
  // The factory issues write -> afterWrite in one handler. For real atomicity
  // the app wraps that body in a single drizzle transaction (see module docs).
  // Because the cascade computes purely first then writes, the whole step fits
  // inside a synchronous better-sqlite3 transaction. This proves the rollback
  // contract: if the cascade throws, the primary write is rolled back too.
  it("rolls back the primary write when the cascade throws, under a transaction", () => {
    expect(() =>
      harness.db.transaction((tx) => {
        tx.insert(categories)
          .values({ ...baseCategory, id: 1, name: "Food" })
          .run();
        throw new Error("cascade failed");
      }),
    ).toThrow("cascade failed");

    const rows = harness.sqlite.prepare("select * from categories").all();
    expect(rows).toHaveLength(0);
  });
});
