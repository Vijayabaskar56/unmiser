---
status: accepted
---

# Balances live only on accounts; the `cards` table is a resolution alias

The schema has two balance-capable representations: `accounts.isCreditCard` and a separate `cards`
table (`cardLast4`, `cardType`, nullable `accountId`, `lastBalance`). To avoid two sources of truth
for a balance, **balances live only on `accounts`** (via the `accountBalances` time-series,
ADR-0002). The `cards` table is a lightweight **resolution alias**: a parsed card last-4 resolves
through `cards.accountId` to the balance-bearing account.

- **Debit card** → `cards.accountId` points to the linked bank `account`; the delta lands there.
- **Credit card** → resolves to an `account` with `isCreditCard = true`, which already carries the
  credit-card balance math (`calculateBalance`: income reduces owed, expense increases owed, floored
  at 0).
- `detectIsCard` only decides _which_ alias to resolve through; it never creates a parallel balance.

`cards.lastBalance` is treated as presentation cache only, never the authoritative balance.

## Consequences

- Card creation (manual or SMS-detected) must link to or create an `account`; an orphan card with no
  resolvable account is the unassigned-fallback case (ADR-0006).
- "Card-vs-account" detection stays declarative in the parser engine; routing is a lookup, not a
  balance fork.
