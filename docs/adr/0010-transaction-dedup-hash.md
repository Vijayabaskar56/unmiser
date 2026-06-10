---
status: accepted
---

# Transaction dedup: canonical MD5 hash, idempotent re-scan, sticky deletes

Each parsed transaction gets a canonical hash **`MD5(sender | normalizedAmount(2dp) | smsBodyHash[:16])`**,
computed in the parser engine and enforced by the existing `unique(transactionHash)` index (via the
wired crypto polyfill / `expo-crypto` MD5).

- The hash **excludes timestamp and accountLast4**, so a historical re-scan of the same SMS produces
  the same hash and is idempotent.
- **Dedup rule:** before insert, if a row with that hash exists — **including `isDeleted = true`** —
  skip. A re-arriving or re-scanned SMS must never resurrect a deliberately deleted transaction
  (matches Cashiro `SmsReaderWorker.kt:282`).
- `normalizedAmount(2dp)` is fixed at 2 decimal places regardless of the currency's natural decimals
  (it is a hash key, not a display value).

## Consequences

- Real-time ingestion and the one-time historical scan share one dedup path.
- Manual transactions can leave `transactionHash` at its `""` default; the unique index tolerates a
  single empty string only — manual rows must either get a synthetic unique hash or the dedup path
  must apply to SMS-sourced rows only. Decide when wiring manual insert (lean: synthesize a hash for
  all rows to keep one code path).
