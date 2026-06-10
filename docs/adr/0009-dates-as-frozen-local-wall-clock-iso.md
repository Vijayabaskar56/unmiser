---
status: accepted
---

# Dates are frozen local wall-clock ISO-8601 strings (no timezone), via date-fns

`lib/dates.ts` wraps **date-fns** (tree-shakeable, immutable, strong period math for budgets /
analytics / behavior features). All timestamps are stored and parsed as **ISO-8601 local
wall-clock with no timezone** (`yyyy-MM-ddTHH:mm:ss`), matching Cashiro's
`ISO_LOCAL_DATE_TIME` / `LocalDateTime` (`Converters.kt:20`).

These are **frozen wall-clock strings, not instants**: a transaction recorded at
`2026-06-08T14:30:00` stays exactly that even if the device timezone later changes. This is
deliberate and faithful to the source — a personal-finance entry is "2:30pm on the 8th", not a
UTC instant to be re-rendered per zone. v1 assumes a single device-local timezone.

Rejected: UTC instants (would re-render past local entries when the user travels and is the
opposite of the source's intent) and dayjs (fine, but less tree-shakeable for the heavy period
math downstream).

## Consequences

- Never append `Z`/offset, never round-trip through UTC. Comparisons are lexicographic on the ISO
  string (sortable) or via date-fns parse.
- If multi-timezone support is ever needed, it is an additive layer, not a reinterpretation of
  stored values.
