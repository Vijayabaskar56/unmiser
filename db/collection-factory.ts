import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { type Column, eq, getTableColumns, getTableName, type Table } from "drizzle-orm";

import { queryClient } from "@/lib/query-client";

/**
 * The kind of write a single `afterWrite` invocation describes. Mirrors the
 * three drizzle handlers wired into the collection.
 */
export type WriteOperation = "insert" | "update" | "delete";

/**
 * Payload handed to `afterWrite` after the drizzle write(s) for a transaction
 * have been issued, but *inside the same persistence step*. This is where
 * derived-state services (e.g. the balance cascade — ADR-0002) run so they
 * commit atomically with the primary write.
 *
 * - `insert`/`update` carry the persisted `rows` (the modified row objects).
 * - `delete` carries the `keys` that were removed.
 */
export type AfterWriteContext<TRow> =
  | { db: unknown; operation: "insert"; rows: TRow[] }
  | { db: unknown; operation: "update"; rows: TRow[] }
  | { db: unknown; operation: "delete"; keys: unknown[] };

export interface DrizzleCollectionConfig<TRow extends object> {
  /** Injected drizzle db instance (expo-sqlite in app, better-sqlite3 in tests). */
  db: any;
  /** The drizzle table this collection persists to. */
  table: Table;
  /** Extracts the stable primary key from a row. */
  getKey: (row: TRow) => string | number;
  /**
   * Read projection. Defaults to `db.select().from(table)` — the whole table.
   * Override to scope by filter (see ADR-0011 follow-up).
   */
  queryFn?: () => Promise<TRow[]>;
  /**
   * Runs after the drizzle write(s) for a transaction, in the same step. Use it
   * to cascade derived state. If it throws, the error surfaces from the handler
   * so the optimistic change rolls back (and, when wrapped in a transaction, the
   * write is rolled back too).
   */
  afterWrite?: (ctx: AfterWriteContext<TRow>) => void | Promise<void>;
}

/** Finds the single-column primary key for a table. */
function primaryKeyColumn(table: Table): Column {
  const columns = getTableColumns(table) as Record<string, Column>;
  for (const column of Object.values(columns)) {
    if (column.primary) return column;
  }
  throw new Error(
    `createDrizzleCollection: table "${getTableName(table)}" has no single-column primary key`,
  );
}

/**
 * A factory that wraps any drizzle table in a TanStack DB collection — ADR-0011.
 *
 * Reads come from `queryFn` (drizzle select). Writes go through the optimistic
 * transaction layer: `collection.insert/update/delete` apply instantly in
 * memory, then these handlers persist to the injected db and invoke
 * `afterWrite` so derived-state services run in the same persistence step.
 * After each handler the query refetches, reconciling optimistic state.
 *
 * Driver-agnostic: the `db` is injected, never imported.
 *
 * Atomicity: a handler issues the primary write then `afterWrite` (the cascade)
 * back-to-back. To make the pair all-or-nothing the app wraps the body in a
 * single drizzle transaction, e.g.
 *
 *   onInsert: ({ transaction }) =>
 *     db.transaction((tx) => {            // sync callback on better-sqlite3
 *       tx.insert(table).values(rows).run();
 *       cascade(tx, rows);                // pure compute already done; writes only
 *     });
 *
 * Because the balance cascade (ADR-0002, `recalculateBalancesAfter`) is pure —
 * it computes the new readings first, then emits writes — the whole step fits
 * inside a *synchronous* better-sqlite3 transaction callback. If the cascade
 * throws, the primary write rolls back with it; the thrown error also propagates
 * out of the handler so the optimistic change is rolled back (see tests).
 */
export function createDrizzleCollection<TRow extends object>(
  config: DrizzleCollectionConfig<TRow>,
) {
  const { db, table, getKey, queryFn, afterWrite } = config;
  const pk = primaryKeyColumn(table);
  const tableName = getTableName(table);

  return createCollection(
    queryCollectionOptions<TRow>({
      queryKey: [tableName],
      queryClient,
      getKey,
      queryFn: queryFn ?? (async () => db.select().from(table)),
      onInsert: async ({ transaction }) => {
        const rows = transaction.mutations.map((m) => m.modified as TRow);
        await db.insert(table).values(rows);
        if (afterWrite) {
          await afterWrite({ db, operation: "insert", rows });
        }
      },
      onUpdate: async ({ transaction }) => {
        const rows: TRow[] = [];
        for (const m of transaction.mutations) {
          await db.update(table).set(m.changes).where(eq(pk, m.key));
          rows.push(m.modified as TRow);
        }
        if (afterWrite) {
          await afterWrite({ db, operation: "update", rows });
        }
      },
      onDelete: async ({ transaction }) => {
        const keys = transaction.mutations.map((m) => m.key);
        for (const key of keys) {
          await db.delete(table).where(eq(pk, key));
        }
        if (afterWrite) {
          await afterWrite({ db, operation: "delete", keys });
        }
      },
    }),
  );
}
