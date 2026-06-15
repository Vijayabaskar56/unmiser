/**
 * Pure view-model helpers for the unified Extensions screen (Installed /
 * Discover tabs + detail). Kept UI-agnostic and dependency-free so the logic
 * is unit-tested without a renderer.
 *
 * Rating / installs / license are NOT in the registry catalog yet (only
 * `bytes`). They are surfaced as deterministic *placeholder* values so the UI
 * looks populated; real metadata is a Phase-4 backlog item (registry schema).
 */

export interface AccountLike {
  id: number;
  /** The pluginId the account is attributed to (accounts.canonicalBank). */
  canonicalBank: string | null;
}

export interface TransactionLike {
  accountId: number | null;
  isDeleted: boolean;
}

/**
 * "Messages parsed" per extension, derived from the transactions attributed to
 * accounts whose `canonicalBank` matches the pluginId. Soft-deleted rows are
 * excluded. Returns a plain map keyed by pluginId.
 */
export function parsedCountsByPlugin(
  accounts: AccountLike[],
  transactions: TransactionLike[],
): Record<string, number> {
  const pluginByAccount = new Map<number, string>();
  for (const account of accounts) {
    if (account.canonicalBank) pluginByAccount.set(account.id, account.canonicalBank);
  }
  const counts: Record<string, number> = {};
  for (const txn of transactions) {
    if (txn.isDeleted || txn.accountId == null) continue;
    const pluginId = pluginByAccount.get(txn.accountId);
    if (!pluginId) continue;
    counts[pluginId] = (counts[pluginId] ?? 0) + 1;
  }
  return counts;
}

export type StatusKind = "update" | "live" | "paused";

export interface StatusBadge {
  kind: StatusKind;
  label: string;
}

/**
 * The status pill on an installed-extension card. A pending update outranks the
 * live/paused state (the design shows "UPDATE v4" in place of "LIVE").
 */
export function statusBadge(enabled: boolean, pendingVersion?: string | null): StatusBadge {
  if (pendingVersion) {
    return { kind: "update", label: `UPDATE ${formatVersion(pendingVersion)}` };
  }
  return enabled ? { kind: "live", label: "LIVE" } : { kind: "paused", label: "PAUSED" };
}

/** Normalises a version to a leading-`v` short form, e.g. "4" / "v4" → "v4". */
export function formatVersion(version: string): string {
  const trimmed = version.trim();
  return /^v/i.test(trimmed) ? trimmed.toLowerCase() : `v${trimmed}`;
}

/** Human file size from a byte count (catalog `bytes`); null → em dash. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} kB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export interface PlaceholderMeta {
  /** 4.0–5.0, one decimal. */
  rating: string;
  /** e.g. "1,240". */
  installs: string;
  license: string;
}

/**
 * Deterministic placeholder marketplace metadata, derived from the pluginId so
 * the numbers are stable across renders (no Math.random). Replace once the
 * registry carries real rating/installs/license — see phase-4-ui-backlog.md.
 */
export function placeholderMeta(pluginId: string): PlaceholderMeta {
  const seed = hashString(pluginId);
  const rating = (4 + (seed % 11) / 10).toFixed(1); // 4.0 .. 5.0
  const installs = 200 + (seed % 9800); // 200 .. 9,999
  return {
    rating,
    installs: installs.toLocaleString(),
    license: "MIT",
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
