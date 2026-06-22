import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  createFinancialBackup,
  dryRunFinancialBackupRestore,
  exportTransactionsCsv,
  type BackupDryRun,
  type FinancialBackupMode,
  serializeFinancialBackup,
} from "@/db/services/export-ops";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export interface ExportedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface PickedBackup {
  uri: string;
  name: string;
  text: string;
  dryRun: BackupDryRun;
}

export async function createTransactionsCsvFile(db: Db, date = new Date()): Promise<ExportedFile> {
  const name = `unmiser-transactions-${formatDate(date)}.csv`;
  const file = new File(Paths.cache, name);
  file.write(await exportTransactionsCsv(db));
  return { uri: file.uri, name, mimeType: "text/csv" };
}

export async function createFinancialBackupFile(
  db: Db,
  options: { mode: FinancialBackupMode; appVersion: string; date?: Date },
): Promise<ExportedFile> {
  const date = options.date ?? new Date();
  const modeSlug = options.mode.toLowerCase();
  const name = `unmiser-backup-${modeSlug}-${formatDate(date)}.json`;
  const file = new File(Paths.cache, name);
  const backup = await createFinancialBackup(db, {
    mode: options.mode,
    appVersion: options.appVersion,
    exportedAt: date.toISOString(),
  });
  file.write(serializeFinancialBackup(backup));
  return { uri: file.uri, name, mimeType: "application/json" };
}

export async function shareExportedFile(file: ExportedFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: file.mimeType,
    UTI: file.mimeType === "text/csv" ? "public.comma-separated-values-text" : "public.json",
    dialogTitle: file.name,
  });
}

export async function pickFinancialBackupFile(): Promise<PickedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/json", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const text = await new File(asset.uri).text();
  return {
    uri: asset.uri,
    name: asset.name,
    text,
    dryRun: dryRunFinancialBackupRestore(text),
  };
}

export function summarizeBackupDryRun(dryRun: BackupDryRun): string {
  return [
    `${dryRun.counts.transactions} transactions`,
    `${dryRun.counts.accounts} accounts`,
    `${dryRun.counts.categories} categories`,
    `${dryRun.counts.budgets} budgets`,
    `${dryRun.counts.subscriptions} subscriptions`,
  ].join("\n");
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
