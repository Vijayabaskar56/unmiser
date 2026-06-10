---
status: accepted
---

# Transaction delete is a soft-delete + cascade + undo, and soft-deleted rows are retained for sync

Cashiro soft-deletes transactions via an `is_deleted` flag (`TransactionDao.softDeleteTransaction`,
`softDeleteByHash` — `TransactionDao.kt:194-197`). The RN port keeps this:

- **Delete** = an optimistic `update` flipping `isDeleted = true` — never a row removal. All
  list/aggregate live-queries filter `isDeleted = false`.
- **Undo** = a snackbar affordance that flips `isDeleted` back within a window (another optimistic
  update). No separate "trash" screen in v1.
- **Cascade (per ADR-0002):** both delete and undo re-run `recalculateBalancesAfter` for the affected
  account — the deleted transaction's balance delta is removed/restored. Delete's persistence handler
  triggers the cascade; it is not a bare flag write.
- **Retention:** soft-deleted rows are NOT purged. Phase-7 webhook sync must propagate deletions
  (`WebhookPayloadBuilder.kt:247` emits `isDeleted`). A purge/compaction job is deferred.

## Consequences

- `transactionHash` dedup must consider `isDeleted` rows so a re-arriving SMS doesn't resurrect or
  duplicate a deliberately deleted transaction (decide the exact rule when specifying dedup).
- "Delete" through a transfer (two balance legs) cascades both legs' accounts.
