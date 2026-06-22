import { describe, expect, it } from "vitest";

import {
  accountBalances,
  accounts,
  appSettings,
  budgetCategoryLimits,
  budgets,
  categories,
  merchantMappings,
  plugins,
  transactions,
} from "@/db/schema";
import {
  createFinancialBackup,
  dryRunFinancialBackupRestore,
  exportTransactionsCsv,
  restoreFinancialBackupReplace,
  serializeFinancialBackup,
} from "@/db/services/export-ops";
import { createTestDb } from "@/db/test-support/harness";

async function seedExportData(db: ReturnType<typeof createTestDb>["db"]) {
  const [account] = await db
    .insert(accounts)
    .values({
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      isCreditCard: false,
    })
    .returning();
  const [category] = await db
    .insert(categories)
    .values({ name: "Food", color: "#15140f", isIncome: false })
    .returning();
  await db.insert(merchantMappings).values({
    merchantName: "Corner Cafe",
    categoryId: category.id,
    categoryName: category.name,
  });
  const [txn] = await db
    .insert(transactions)
    .values({
      amount: "42.50",
      merchantName: "Corner, Cafe",
      categoryId: category.id,
      accountId: account.id,
      transactionType: "EXPENSE",
      dateTime: "2026-06-15T10:00:00",
      description: 'chai "large"',
      transactionHash: "hash-1",
      currency: "INR",
    })
    .returning();
  await db.insert(accountBalances).values({
    accountId: account.id,
    balance: "957.50",
    timestamp: "2026-06-15T10:00:00",
    transactionId: txn.id,
    sourceType: "TRANSACTION",
  });
  const [budget] = await db
    .insert(budgets)
    .values({
      name: "Food guardrail",
      amount: "1000.00",
      year: 2026,
      month: 6,
      startDate: "2026-06-01T00:00:00",
      endDate: "2026-06-30T23:59:59",
    })
    .returning();
  await db.insert(budgetCategoryLimits).values({
    budgetId: budget.id,
    categoryId: category.id,
    categoryName: category.name,
    limitAmount: "1000.00",
  });
}

describe("exportTransactionsCsv", () => {
  it("exports stable transaction columns and escapes CSV cells", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);

    const csv = await exportTransactionsCsv(db);

    expect(csv.split("\n")[0]).toBe(
      "id,dateTime,transactionType,amount,currency,merchantName,categoryId,subcategoryId,accountId,paymentMethod,sourceType,isRecurring,subscriptionId,description",
    );
    expect(csv).toContain('"Corner, Cafe"');
    expect(csv).toContain('"chai ""large"""');

    sqlite.close();
  });
});

describe("financial backup", () => {
  it("serializes financial data and dry-runs row counts", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);

    const backup = await createFinancialBackup(db, {
      appVersion: "1.0.0-test",
      exportedAt: "2026-06-17T12:00:00.000Z",
    });
    const dryRun = dryRunFinancialBackupRestore(serializeFinancialBackup(backup));

    expect(backup.meta).toMatchObject({
      app: "unmiser",
      formatVersion: 1,
      mode: "FULL",
      appVersion: "1.0.0-test",
    });
    expect(dryRun.ok).toBe(true);
    expect(dryRun.counts.accounts).toBe(1);
    expect(dryRun.counts.transactions).toBe(1);
    expect(dryRun.counts.budgets).toBe(1);
    expect(dryRun.counts.budgetCategoryLimits).toBe(1);
    expect(dryRun.counts.merchantMappings).toBe(1);

    sqlite.close();
  });

  it("creates masked backups with sensitive SMS and account fields removed", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);

    const backup = await createFinancialBackup(db, {
      mode: "MASKED",
      appVersion: "1.0.0-test",
      exportedAt: "2026-06-17T12:00:00.000Z",
    });
    const account = backup.data.accounts[0] as Record<string, unknown>;
    const transaction = backup.data.transactions[0] as Record<string, unknown>;

    expect(backup.meta.mode).toBe("MASKED");
    expect(account.accountLast4).toBe("0000");
    expect(transaction.merchantName).toBe("C***");
    expect(transaction.description).toBe("c***");
    expect(transaction.smsBody).toBeNull();
    expect(dryRunFinancialBackupRestore(backup).ok).toBe(true);

    sqlite.close();
  });

  it("creates anonymous backups with deterministic labels and no restore path", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);

    const backup = await createFinancialBackup(db, {
      mode: "ANONYMOUS",
      appVersion: "1.0.0-test",
      exportedAt: "2026-06-17T12:00:00.000Z",
    });
    const account = backup.data.accounts[0] as Record<string, unknown>;
    const transaction = backup.data.transactions[0] as Record<string, unknown>;
    const category = backup.data.categories[0] as Record<string, unknown>;

    expect(account.bankName).toBe("Account 1");
    expect(category.name).toBe("Category 1");
    expect(transaction.merchantName).toBe("Merchant 1");
    expect(transaction.description).toBeNull();
    expect(transaction.transactionHash).toBe(`tx-${transaction.id}`);
    await expect(restoreFinancialBackupReplace(db, backup)).rejects.toThrow(/only full backups/i);

    sqlite.close();
  });

  it("reports missing tables during dry-run validation", () => {
    const dryRun = dryRunFinancialBackupRestore({
      meta: {
        app: "unmiser",
        formatVersion: 1,
        mode: "FULL",
        exportedAt: "2026-06-17T12:00:00.000Z",
      },
      data: { accounts: [] },
    });

    expect(dryRun.ok).toBe(false);
    expect(dryRun.errors).toContain("Backup table transactions is missing or not an array.");
  });

  it("replace-restores financial rows and preserves settings/extensions", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);
    const backup = await createFinancialBackup(db, {
      appVersion: "1.0.0-test",
      exportedAt: "2026-06-17T12:00:00.000Z",
    });

    await db.insert(appSettings).values({ key: "profile.name", value: "Vijay" });
    await db.insert(plugins).values({
      pluginId: "in.hdfc.bank",
      type: "sms-parser",
      name: "HDFC",
      country: "IN",
      version: "1.0.0",
      trust: "bundled",
    });
    await db.insert(categories).values({ id: 99, name: "Temp", color: "#999", isIncome: false });

    const result = await restoreFinancialBackupReplace(db, backup);

    expect(result.ok).toBe(true);
    expect(await db.select().from(appSettings)).toHaveLength(1);
    expect(await db.select().from(plugins)).toHaveLength(1);

    const restoredCategories = await db.select().from(categories);
    const restoredTransactions = await db.select().from(transactions);
    const restoredBalances = await db.select().from(accountBalances);
    const restoredLimits = await db.select().from(budgetCategoryLimits);

    expect(restoredCategories.map((category) => category.name)).toEqual(["Food"]);
    expect(restoredTransactions).toHaveLength(1);
    expect(restoredTransactions[0].categoryId).toBe(restoredCategories[0].id);
    expect(restoredBalances[0].transactionId).toBe(restoredTransactions[0].id);
    expect(restoredLimits[0].categoryId).toBe(restoredCategories[0].id);

    sqlite.close();
  });

  it("refuses invalid backups before mutating existing data", async () => {
    const { db, sqlite } = createTestDb();
    await seedExportData(db);

    await expect(
      restoreFinancialBackupReplace(db, {
        meta: {
          app: "unmiser",
          formatVersion: 999,
          mode: "FULL",
          exportedAt: "2026-06-17T12:00:00.000Z",
          appVersion: "bad",
        },
        data: {
          accounts: [],
        },
      } as never),
    ).rejects.toThrow(/invalid financial backup/i);

    expect(await db.select().from(transactions)).toHaveLength(1);
    expect(await db.select().from(categories)).toHaveLength(1);

    sqlite.close();
  });
});
