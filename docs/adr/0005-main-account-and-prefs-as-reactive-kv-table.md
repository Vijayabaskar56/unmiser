---
status: accepted
---

# Main account is an app preference (`accounts.id`), and app prefs live in a reactive `app_settings` KV table

The roadmap relies on a "main account" (default for the Add sheet; base-currency driver for Phase-6
aggregation), but the ported `accounts` table has no `isMain` column. Cashiro stored it as a
SharedPreferences key `"main_account"` (`ManageAccountsViewModel.kt:153`), read reactively and used
to (a) pre-select the account + currency in the Add Transaction sheet (`AddViewModel.kt:124-131`)
and (b) derive the base currency from that account's currency
(`CurrencyRepository.baseCurrencyCode`, `kt:42-46`).

Decisions:

- **Main account is a preference, not a column.** "Exactly one main account" is a singleton fact
  about the app, not a per-row property; a boolean column would force policing a "only one true"
  invariant on every write (racey with the optimistic layer). The preference is one slot holding
  one value.
- **The stored value is `accounts.id`** (an int), not Cashiro's composite `"${bankName}_${accountLast4}"`
  string — the RN model already normalized account identity to the autoincrement `id`
  (`accountBalances.accountId` FK), which is stabler than the mutable composite.
- **It governs both:** the default account + currency in the Add sheet (Phase 1), and the base
  currency as `currencyOf(mainAccountId)` for Phase-6 aggregation. Base currency is derived, never
  duplicated.
- **App preferences live in a small `app_settings` key-value table in SQLite**, read via a TanStack
  DB live query. Cashiro drove the UI from a reactive `Flow` on this pref; a KV table reuses the
  existing reactive collection layer (ADR-0002) instead of introducing MMKV/AsyncStorage as a
  second, non-DB reactive source. It is also the home for later prefs (`streak_state`, base-currency
  override, etc.).

## Consequences

- New `app_settings` table (`key` PK, `value` text/JSON). `mainAccountId` is its first entry.
- On account deletion, a reset step must clear/repoint `mainAccountId` if it referenced the deleted
  account (Cashiro's logic checks this — `ManageAccountsViewModel.kt:537`).
- Setting the main account in Cashiro also writes a balance row with `sourceType = "MAIN_ACCOUNT_SYNC"`
  (`kt:171`); preserve or consciously drop that behavior when building the Accounts screen.
- Secrets (Phase-8 `api-source` credentials) do NOT go here — those use secure-store/Keychain.
