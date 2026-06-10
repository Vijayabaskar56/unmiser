---
status: accepted
---

# SMS transactions auto-create accounts, resolved by canonical bank id + partial-last4 match

Cashiro keyed accounts by the composite `(bankName, accountLast4)` materialized lazily — an account
effectively existed the moment an SMS for it arrived — and used `resolveAccountLast4`
(`AccountBalanceRepository.kt:41-52`) to fuzzy-match a partial last-4 fragment to the unique
existing account ending with those digits. The RN port normalized account identity to
`accounts.id` (with `accountBalances.accountId` FK), forcing an explicit resolution decision.

Decisions:

- **Auto-create.** A parsed `(bankName, accountLast4)` with no match upserts a new `accounts` row on
  the existing `unique(bankName, accountLast4)` index. The zero-setup "install a parser → accounts
  populate themselves" flow is the USP's payoff; requiring pre-registration (attach-to-existing-only)
  would bury users in an unassigned-triage queue. That unassigned bucket is kept only as the
  fallback for genuinely ambiguous parses, not the default.
- **Port `resolveAccountLast4`** partial-last4 fuzzy match (unique-suffix → resolve; 0 or many → keep
  the fragment).
- **Canonical bank id, not free-text `bankName`.** Auto-create keys on bank identity, and the parser
  label (`"HDFC Bank (India)"`) and a user's typed account name (`"HDFC"`) would otherwise diverge
  and silently create duplicates (splitting balances). Resolution uses a canonical bank identifier
  derived from the manifest (`pluginId`/`country`), and manual account creation in Phase 1 must pick
  the bank from the same canonical list rather than free-text. Rejected: free-text + a post-hoc
  "merge accounts" action — deduping after the fact is lossy.

## Consequences

- The `accounts` table needs a stable canonical bank id (a column or a normalized `bankName` keyed
  to the manifest registry). Manual-create and SMS-create must funnel through one bank-resolution
  function.
- Auto-create is Phase-2 behavior, but the resolution helper + canonical bank list are Phase-1
  substrate (manual accounts use them too).
