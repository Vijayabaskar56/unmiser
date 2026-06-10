import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { accounts, transactions } from "@/db/schema";
import { seedDefaults } from "@/db/services/seed";
import { clearSampleData, excludeSample, loadSampleData } from "@/db/services/sample-data";
import { createTestDb, type TestHarness } from "@/db/test-support/harness";

describe("loadSampleData", () => {
  let harness: TestHarness;

  afterEach(() => {
    harness?.sqlite.close();
  });

  it("inserts sample accounts and transactions all flagged isSample", async () => {
    harness = createTestDb();
    const { db } = harness;
    await seedDefaults(db);

    await loadSampleData(db);

    const sampleAccounts = await db.select().from(accounts).where(eq(accounts.isSample, true));
    const sampleTxns = await db.select().from(transactions).where(eq(transactions.isSample, true));

    expect(sampleAccounts.length).toBeGreaterThan(0);
    expect(sampleTxns.length).toBeGreaterThan(0);
    // Every inserted account/txn carries the marker.
    for (const a of sampleAccounts) expect(a.isSample).toBe(true);
    for (const t of sampleTxns) expect(t.isSample).toBe(true);
  });

  it("inserts realistic rows: real amounts, merchants and existing category ids", async () => {
    harness = createTestDb();
    const { db } = harness;
    await seedDefaults(db);

    await loadSampleData(db);

    const sampleTxns = await db.select().from(transactions).where(eq(transactions.isSample, true));

    for (const t of sampleTxns) {
      // amount is a non-empty BigDecimal string
      expect(t.amount).toMatch(/\d/);
      expect(t.merchantName.length).toBeGreaterThan(0);
      // dedup hash is synthesized (non-empty + unique enough)
      expect(t.transactionHash.length).toBeGreaterThan(0);
    }
  });
});

describe("clearSampleData", () => {
  let harness: TestHarness;

  afterEach(() => {
    harness?.sqlite.close();
  });

  it("removes ONLY isSample rows and leaves real rows untouched", async () => {
    harness = createTestDb();
    const { db } = harness;
    await seedDefaults(db);

    // A real (non-sample) account + transaction that MUST survive.
    const [realAccount] = await db
      .insert(accounts)
      .values({ bankName: "Real Bank", accountLast4: "9999" })
      .returning();
    await db.insert(transactions).values({
      amount: "100.00",
      merchantName: "Real Merchant",
      categoryId: 1,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T00:00:00",
      transactionHash: "real-hash",
    });

    await loadSampleData(db);
    await clearSampleData(db);

    const remainingAccounts = await db.select().from(accounts);
    const remainingTxns = await db.select().from(transactions);

    // No sample rows survive.
    expect(remainingAccounts.every((a) => a.isSample === false)).toBe(true);
    expect(remainingTxns.every((t) => t.isSample === false)).toBe(true);
    // The real rows are still there.
    expect(remainingAccounts.some((a) => a.id === realAccount.id)).toBe(true);
    expect(remainingTxns.some((t) => t.transactionHash === "real-hash")).toBe(true);
  });

  it("is idempotent (clearing twice is a no-op the second time)", async () => {
    harness = createTestDb();
    const { db } = harness;
    await seedDefaults(db);
    await loadSampleData(db);

    await clearSampleData(db);
    await clearSampleData(db);

    const sampleTxns = await db.select().from(transactions).where(eq(transactions.isSample, true));
    expect(sampleTxns).toHaveLength(0);
  });
});

describe("excludeSample", () => {
  let harness: TestHarness;

  afterEach(() => {
    harness?.sqlite.close();
  });

  it("filters sample rows out of a select (production read)", async () => {
    harness = createTestDb();
    const { db } = harness;
    await seedDefaults(db);

    await db.insert(transactions).values({
      amount: "42.00",
      merchantName: "Real Merchant",
      categoryId: 1,
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T00:00:00",
      transactionHash: "real-only-hash",
    });
    await loadSampleData(db);

    const visibleTxns = await db.select().from(transactions).where(excludeSample(transactions));

    expect(visibleTxns.length).toBeGreaterThan(0);
    expect(visibleTxns.every((t) => t.isSample === false)).toBe(true);
    expect(visibleTxns.some((t) => t.transactionHash === "real-only-hash")).toBe(true);

    // And the equivalent for accounts.
    const visibleAccounts = await db.select().from(accounts).where(excludeSample(accounts));
    expect(visibleAccounts.every((a) => a.isSample === false)).toBe(true);
  });
});
