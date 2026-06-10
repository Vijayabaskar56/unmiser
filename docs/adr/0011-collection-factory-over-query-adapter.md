---
status: accepted
---

# Collection factory generalizes the Query-adapter + drizzle pattern with an afterWrite cascade hook

The working `todoCollection` demo (`db/collections/todos.ts`) uses `queryCollectionOptions`
(TanStack Query adapter) with a drizzle `queryFn` and manual `onInsert`/`onUpdate`/`onDelete`
drizzle handlers; a refetch after each write reconciles optimistic state. We generalize **this**
pattern, not `persistedCollectionOptions`/the expo-sqlite adapter.

`createDrizzleCollection({ table, getKey, queryFn?, afterWrite? })` wraps `queryCollectionOptions`
with standard drizzle insert/update/delete handlers, plus an **`afterWrite` hook that runs
derived-state services (the balance cascade — ADR-0002) inside the same persistence step**, in one
drizzle transaction.

## Why not `persistedCollectionOptions` / expo-sqlite adapter

Drizzle stays the explicit persistence we control, which is exactly what the cascade needs (ADR-0002
requires recomputing balances inside the write). The SQLite-adapter route moves persistence into the
adapter and makes injecting a multi-row cascade awkward. The demo pattern is already wired and
working.

## Consequences

- The demo refetches the whole table after each write. Acceptable now; **scope `queryKey` per
  filter** before transaction lists grow large (flagged follow-up).
- All core tables (transactions, categories, accounts, …) use one factory; derived state is never a
  collection, only an `afterWrite` service + a live-query read-projection.
