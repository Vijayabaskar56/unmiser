import { describe, expect, it } from "vitest";

import {
  accounts,
  appSettings,
  categories,
  plugins,
  subscriptions,
  transactions,
  webhookLogs,
  webhookProfiles,
} from "@/db/schema";
import { createTestDb } from "@/db/test-support/harness";
import { deleteAllData } from "@/db/services/data-ops";

async function seedEverything(db: ReturnType<typeof createTestDb>["db"]) {
  const [category] = await db
    .insert(categories)
    .values({ name: "Food", color: "#111" })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({ bankName: "HDFC", accountLast4: "4410", sourceKind: "BANK" })
    .returning();
  await db.insert(transactions).values({
    accountId: account.id,
    categoryId: category.id,
    merchantName: "Swiggy",
    amount: "480.00",
    transactionType: "EXPENSE",
    dateTime: "2026-06-11T00:00:00Z",
    transactionHash: "swiggy-jun",
  });
  await db
    .insert(subscriptions)
    .values({ merchantName: "Netflix", amount: "499", categoryId: category.id });
  const [profile] = await db
    .insert(webhookProfiles)
    .values({ name: "Local", url: "http://localhost" })
    .returning();
  await db.insert(webhookLogs).values({
    profileId: profile.id,
    profileName: "Local",
    syncReason: "MANUAL",
    status: "SUCCESS",
    message: "ok",
  });

  // Preserved config:
  await db.insert(appSettings).values({ key: "profile.name", value: "Vijay" });
  await db.insert(plugins).values({
    pluginId: "in.hdfc.bank",
    type: "sms-parser",
    name: "HDFC",
    country: "IN",
    version: "1.0.0",
    trust: "bundled",
  });
}

describe("deleteAllData", () => {
  it("wipes every financial/automation table", async () => {
    const { db, sqlite } = createTestDb();
    await seedEverything(db);

    await deleteAllData(db);

    for (const table of [
      transactions,
      accounts,
      categories,
      subscriptions,
      webhookProfiles,
      webhookLogs,
    ]) {
      const rows = await db.select().from(table);
      expect(rows).toHaveLength(0);
    }
    sqlite.close();
  });

  it("preserves app settings and installed plugins", async () => {
    const { db, sqlite } = createTestDb();
    await seedEverything(db);

    await deleteAllData(db);

    expect(await db.select().from(appSettings)).toHaveLength(1);
    expect(await db.select().from(plugins)).toHaveLength(1);
    sqlite.close();
  });
});
