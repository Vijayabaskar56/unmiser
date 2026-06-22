import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  accountBalances,
  accounts,
  budgetCategoryLimits,
  budgets,
  cards,
  categories,
  merchantMappings,
  ruleApplications,
  subcategories,
  subscriptions,
  transactionRules,
  transactions,
  unrecognizedSms,
} from "@/db/schema";
import { deleteAllData } from "@/db/services/data-ops";
import { nowIso } from "@/db/utils";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export const FINANCIAL_BACKUP_FORMAT_VERSION = 1;

export const FINANCIAL_BACKUP_TABLES = [
  "accounts",
  "accountBalances",
  "cards",
  "categories",
  "subcategories",
  "merchantMappings",
  "transactions",
  "budgets",
  "budgetCategoryLimits",
  "subscriptions",
  "transactionRules",
  "ruleApplications",
  "unrecognizedSms",
] as const;

export type FinancialBackupTable = (typeof FINANCIAL_BACKUP_TABLES)[number];
export type FinancialBackupMode = "FULL" | "MASKED" | "ANONYMOUS";

export interface FinancialBackup {
  meta: {
    app: "unmiser";
    formatVersion: number;
    exportedAt: string;
    mode: FinancialBackupMode;
    appVersion: string;
  };
  data: Record<FinancialBackupTable, unknown[]>;
}

export interface BackupDryRun {
  ok: boolean;
  formatVersion?: number;
  mode?: FinancialBackupMode;
  exportedAt?: string;
  counts: Record<FinancialBackupTable, number>;
  errors: string[];
}

export const TRANSACTION_CSV_COLUMNS = [
  "id",
  "dateTime",
  "transactionType",
  "amount",
  "currency",
  "merchantName",
  "categoryId",
  "subcategoryId",
  "accountId",
  "paymentMethod",
  "sourceType",
  "isRecurring",
  "subscriptionId",
  "description",
] as const;

type CsvColumn = (typeof TRANSACTION_CSV_COLUMNS)[number];

export async function exportTransactionsCsv(db: Db): Promise<string> {
  const rows = (await db.select().from(transactions)) as Array<Record<CsvColumn, unknown>>;
  const sorted = rows.sort((a, b) => compareDesc(String(a.dateTime), String(b.dateTime)));
  return [
    TRANSACTION_CSV_COLUMNS.join(","),
    ...sorted.map((row) => TRANSACTION_CSV_COLUMNS.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

export async function createFinancialBackup(
  db: Db,
  options: { mode?: FinancialBackupMode; appVersion?: string; exportedAt?: string } = {},
): Promise<FinancialBackup> {
  const mode = options.mode ?? "FULL";
  const data = {
    accounts: await db.select().from(accounts),
    accountBalances: await db.select().from(accountBalances),
    cards: await db.select().from(cards),
    categories: await db.select().from(categories),
    subcategories: await db.select().from(subcategories),
    merchantMappings: await db.select().from(merchantMappings),
    transactions: await db.select().from(transactions),
    budgets: await db.select().from(budgets),
    budgetCategoryLimits: await db.select().from(budgetCategoryLimits),
    subscriptions: await db.select().from(subscriptions),
    transactionRules: await db.select().from(transactionRules),
    ruleApplications: await db.select().from(ruleApplications),
    unrecognizedSms: await db.select().from(unrecognizedSms),
  };

  return {
    meta: {
      app: "unmiser",
      formatVersion: FINANCIAL_BACKUP_FORMAT_VERSION,
      exportedAt: options.exportedAt ?? nowIso(),
      mode,
      appVersion: options.appVersion ?? "0.0.0",
    },
    data: mode === "FULL" ? data : transformBackupData(data, mode),
  };
}

export function serializeFinancialBackup(backup: FinancialBackup): string {
  return JSON.stringify(backup, null, 2);
}

export async function restoreFinancialBackupReplace(
  db: Db,
  input: string | FinancialBackup,
): Promise<BackupDryRun> {
  const dryRun = dryRunFinancialBackupRestore(input);
  if (!dryRun.ok) {
    throw new Error(`Invalid financial backup: ${dryRun.errors.join(" ")}`);
  }

  const backup = typeof input === "string" ? (JSON.parse(input) as FinancialBackup) : input;
  if (backup.meta.mode !== "FULL") {
    throw new Error(
      "Only FULL backups can be restored. Create a full backup before replacing data.",
    );
  }

  await deleteAllData(db);
  await insertRows(db, accounts, backup.data.accounts);
  await insertRows(db, categories, backup.data.categories);
  await insertRows(db, subcategories, backup.data.subcategories);
  await insertRows(db, cards, backup.data.cards);
  await insertRows(db, merchantMappings, backup.data.merchantMappings);
  await insertRows(db, subscriptions, backup.data.subscriptions);
  await insertRows(db, budgets, backup.data.budgets);
  await insertRows(db, budgetCategoryLimits, backup.data.budgetCategoryLimits);
  await insertRows(db, transactions, backup.data.transactions);
  await insertRows(db, transactionRules, backup.data.transactionRules);
  await insertRows(db, ruleApplications, backup.data.ruleApplications);
  await insertRows(db, accountBalances, backup.data.accountBalances);
  await insertRows(db, unrecognizedSms, backup.data.unrecognizedSms);

  return dryRun;
}

export function dryRunFinancialBackupRestore(input: string | unknown): BackupDryRun {
  const errors: string[] = [];
  const parsed = typeof input === "string" ? parseJson(input, errors) : input;
  const counts = emptyCounts();

  if (!isRecord(parsed)) {
    return { ok: false, counts, errors: [...errors, "Backup must be a JSON object."] };
  }

  const meta = parsed.meta;
  if (!isRecord(meta)) {
    errors.push("Backup meta is missing.");
  } else {
    if (meta.app !== "unmiser") errors.push("Backup is not an Unmiser backup.");
    if (meta.formatVersion !== FINANCIAL_BACKUP_FORMAT_VERSION) {
      errors.push(`Unsupported backup format version: ${String(meta.formatVersion)}.`);
    }
    if (!isBackupMode(meta.mode)) errors.push("Backup mode is invalid.");
    if (typeof meta.exportedAt !== "string") errors.push("Backup exportedAt is missing.");
  }

  const data = parsed.data;
  if (!isRecord(data)) {
    errors.push("Backup data is missing.");
  } else {
    for (const table of FINANCIAL_BACKUP_TABLES) {
      const rows = data[table];
      if (!Array.isArray(rows)) {
        errors.push(`Backup table ${table} is missing or not an array.`);
      } else {
        counts[table] = rows.length;
      }
    }
  }

  return {
    ok: errors.length === 0,
    formatVersion:
      isRecord(meta) && typeof meta.formatVersion === "number" ? meta.formatVersion : undefined,
    mode: isRecord(meta) && isBackupMode(meta.mode) ? meta.mode : undefined,
    exportedAt: isRecord(meta) && typeof meta.exportedAt === "string" ? meta.exportedAt : undefined,
    counts,
    errors,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function compareDesc(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function parseJson(input: string, errors: string[]): unknown {
  try {
    return JSON.parse(input);
  } catch (e) {
    errors.push(`Backup JSON is invalid: ${e instanceof Error ? e.message : String(e)}.`);
    return null;
  }
}

function emptyCounts(): Record<FinancialBackupTable, number> {
  return Object.fromEntries(FINANCIAL_BACKUP_TABLES.map((table) => [table, 0])) as Record<
    FinancialBackupTable,
    number
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBackupMode(value: unknown): value is FinancialBackupMode {
  return value === "FULL" || value === "MASKED" || value === "ANONYMOUS";
}

async function insertRows(db: Db, table: any, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(table).values(rows as any[]);
}

function transformBackupData(
  data: Record<FinancialBackupTable, unknown[]>,
  mode: Exclude<FinancialBackupMode, "FULL">,
): Record<FinancialBackupTable, unknown[]> {
  const labeler = createLabeler();
  return {
    accounts: data.accounts.map((row, i) =>
      mapRecord(row, {
        bankName: mode === "MASKED" ? "Masked bank" : `Account ${i + 1}`,
        canonicalBank: mode === "MASKED" ? null : `bank-${i + 1}`,
        accountLast4: "0000",
      }),
    ),
    accountBalances: data.accountBalances.map((row) =>
      mapRecord(row, {
        smsSource: null,
      }),
    ),
    cards: data.cards.map((row, i) =>
      mapRecord(row, {
        cardLast4: "0000",
        bankName: mode === "MASKED" ? "Masked bank" : `Card issuer ${i + 1}`,
        nickname: null,
        lastBalanceSource: null,
      }),
    ),
    categories:
      mode === "MASKED"
        ? data.categories
        : data.categories.map((row) =>
            mapRecord(row, {
              name: labeler("category", readId(row)),
              description: "",
              seedKey: null,
            }),
          ),
    subcategories:
      mode === "MASKED"
        ? data.subcategories
        : data.subcategories.map((row) =>
            mapRecord(row, {
              name: labeler("subcategory", readId(row)),
              seedKey: null,
            }),
          ),
    merchantMappings: data.merchantMappings.map((row) =>
      mapRecord(row, {
        merchantName:
          mode === "MASKED"
            ? maskString(readString(row, "merchantName"))
            : labeler("merchant", row),
        categoryName:
          mode === "MASKED" ? readString(row, "categoryName") : labeler("category", readId(row)),
      }),
    ),
    transactions: data.transactions.map((row) =>
      mapRecord(row, {
        merchantName:
          mode === "MASKED"
            ? maskString(readString(row, "merchantName"))
            : labeler("merchant", row),
        categoryName:
          mode === "MASKED" ? readString(row, "categoryName") : labeler("category", readId(row)),
        subcategoryName:
          mode === "MASKED"
            ? readString(row, "subcategoryName")
            : labeler("subcategory", readId(row)),
        description: mode === "MASKED" ? maskNullable(row, "description") : null,
        smsBody: null,
        bankName: mode === "MASKED" ? "Masked bank" : "Bank",
        smsSender: null,
        accountNumber: null,
        transactionHash:
          mode === "MASKED" ? readString(row, "transactionHash") : `tx-${readId(row)}`,
        sourcePluginId: null,
        sourcePluginVersion: null,
        fromAccount: null,
        toAccount: null,
        attachments: "",
      }),
    ),
    budgets: data.budgets.map((row, i) =>
      mode === "MASKED"
        ? mapRecord(row, { accountIds: "" })
        : mapRecord(row, { name: `Budget ${i + 1}`, accountIds: "" }),
    ),
    budgetCategoryLimits:
      mode === "MASKED"
        ? data.budgetCategoryLimits
        : data.budgetCategoryLimits.map((row) =>
            mapRecord(row, { categoryName: labeler("category", readId(row)) }),
          ),
    subscriptions: data.subscriptions.map((row) =>
      mapRecord(row, {
        merchantName:
          mode === "MASKED"
            ? maskString(readString(row, "merchantName"))
            : labeler("merchant", row),
        bankName: mode === "MASKED" ? "Masked bank" : "Bank",
        umn: null,
        categoryName:
          mode === "MASKED" ? readString(row, "categoryName") : labeler("category", readId(row)),
        subcategoryName:
          mode === "MASKED"
            ? readString(row, "subcategoryName")
            : labeler("subcategory", readId(row)),
        smsBody: null,
      }),
    ),
    transactionRules: data.transactionRules.map((row, i) =>
      mapRecord(row, {
        name: mode === "MASKED" ? maskString(readString(row, "name")) : `Rule ${i + 1}`,
        description: null,
        conditions: mode === "MASKED" ? readString(row, "conditions") : "{}",
        actions: mode === "MASKED" ? readString(row, "actions") : "[]",
      }),
    ),
    ruleApplications:
      mode === "MASKED"
        ? data.ruleApplications
        : data.ruleApplications.map((row, i) =>
            mapRecord(row, { ruleName: `Rule ${i + 1}`, fieldsModified: "[]" }),
          ),
    unrecognizedSms: data.unrecognizedSms.map((row) =>
      mapRecord(row, {
        sender: null,
        smsBody: "",
        pluginId: null,
        pluginVersion: null,
        parserConfidence: null,
        parsedFieldsJson: mode === "MASKED" ? readString(row, "parsedFieldsJson") : "{}",
        rawMatchesJson: mode === "MASKED" ? readString(row, "rawMatchesJson") : "[]",
      }),
    ),
  };
}

function mapRecord(row: unknown, patch: Record<string, unknown>): unknown {
  return isRecord(row) ? { ...row, ...patch } : row;
}

function createLabeler(): (kind: string, key: unknown) => string {
  const counters = new Map<string, number>();
  const labels = new Map<string, string>();
  return (kind, key) => {
    const scopedKey = `${kind}:${String(key ?? "")}`;
    const existing = labels.get(scopedKey);
    if (existing) return existing;
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    const label = `${titleCase(kind)} ${next}`;
    labels.set(scopedKey, label);
    return label;
  };
}

function readId(row: unknown): unknown {
  return isRecord(row) ? row.id : row;
}

function readString(row: unknown, key: string): string | null {
  if (!isRecord(row)) return null;
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function maskNullable(row: unknown, key: string): string | null {
  const value = readString(row, key);
  return value ? maskString(value) : null;
}

function maskString(value: string | null): string | null {
  if (!value) return value;
  return value.length <= 2 ? "**" : `${value.slice(0, 1)}***`;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
