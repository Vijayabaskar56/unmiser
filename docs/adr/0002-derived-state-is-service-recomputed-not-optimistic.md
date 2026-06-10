---
status: accepted
---

# Derived state is service-recomputed at write time, read back via live queries — never optimistically mutated

Account balance is a derived, anchor-segmented running fold over a time-ordered `accountBalances`
series (see `references/Cashiro/.../AccountBalanceRepository.kt:172` `recalculateBalancesAfter`):
walk every reading after timestamp T carrying a running balance; at an **anchor** row
(`MANUAL`/`MANUAL_EDIT`/`SMS_BALANCE`/`TRANSACTION_SMS_BALANCE` — a _stated_ balance) reset the
running balance and stop; at a **calculated** row (`TRANSACTION_CALCULATED`) re-apply the
transaction delta. This is a cumulative/windowed computation.

We verified against the installed `@tanstack/db@0.6.8` source that the live-query builder has joins,
grouped scalar aggregates (`sum`/`count`/`avg`/`min`/`max` + `groupBy`), and `orderBy`/`limit`/
`offset`, but **no ordered-cumulative / window-function primitive** (`query/builder/functions.d.ts:113`,
`query/builder/index.d.ts`; exhaustive search for OVER/PARTITION/LAG/runningTotal/cumulative
returned nothing — `groupBy` is whole-group collapse only). A running balance therefore cannot be
expressed as a live query.

Decision: the entity the user authors (the **Transaction**) is mutated optimistically for instant
list feedback; its persistence handler runs the whole balance cascade imperatively inside a single
Drizzle `db.transaction(...)`. The `accountBalances` data is a **live-query read-projection**
(account ⋈ latest balance row via join + `orderBy(timestamp desc)` + `limit(1)` — all supported),
not an independently optimistically-mutated collection. The same pattern governs all later derived
state: Phase 4 budget-spending rollups, Phase 5 analytics.

## Considered and rejected: optimistic cascade via createOptimisticAction

TanStack DB _does_ support a single transaction with multiple operations
(`createOptimisticAction` for atomic multi-collection mutation; `createTransaction` for manual
batching), with framework-provided all-or-nothing rollback — verified via the shipped
`@tanstack/db#db-core/mutations-optimistic` skill. So an optimistic cascade (compute the fold in a
synchronous `onMutate`, apply N balance-row updates, persist them) is technically viable and would
make balances update in the same tick as the transaction.

We rejected it because `onMutate` must be synchronous and runs on the JS thread. A back-dated edit
or the Phase-2 historical SMS scan (thousands of past inserts) would turn the per-insert fold into
O(n²) synchronous work and freeze the UI. That case _forces_ an off-tick, batched, authoritative
recompute in the persistence layer regardless — which is exactly Option A's path. Option A reuses
that one path for the real-time case too; the optimistic variant would require maintaining a second
cascade implementation that fails on bulk import. The only thing Option A gives up is a few-ms
balance lag on single inserts, which is imperceptible.

## Consequences

- Multi-row cascade atomicity + rollback come from the DB transaction, not hand-rolled N-row
  optimistic rollback — this removes the roadmap's flagged "rollback + balance-cascade" risk from
  the weakest layer.
- The TanStack DB collection factory (Phase 0) stays a clean single-entity optimistic-CRUD
  abstraction; cascades live in a dedicated balance service it calls at persistence time.
- Trade-off accepted: a few-ms window where a new transaction is visible before its account
  balance ticks (local SQLite commit + live-query re-run). Imperceptible.
