# Phase-1 UI/data backlog (from dogfooding 2026-06-08)

> **STATUS (build complete, 2026-06-09):** Phase-1 build surface is done. New services
> `category-ops` (9 tests), `account-ops` (10 tests) + the existing `transaction-ops`; screens for
> category/subcategory CRUD, account CRUD, and transactions (merchant + subcategory inputs,
> transfer with cross-currency block, search, type-filter, bulk soft-delete, tap-to-detail/edit).
> `tsc` clean, **152 tests**. Remaining = polish/assets only: a real date picker (edit uses a raw
> ISO input), nano-icon assets (chips until sourced), and rebuilding the transactions table in a
> migration so `accountId`'s FK carries `ON DELETE SET NULL` at the DB level (currently handled in
> `deleteAccount` by explicitly nulling the column). Device QA is the user's.

The Phase-1 screens are functional-but-minimal scaffolds. Real gaps found while using them,
with their true status (data vs display vs missing-feature):

## 1. Transaction → account is not stored on the transaction row ✅ FIXED (schema)

- **Was:** `addTransaction` wrote the account only onto the (deletable) `accountBalances` reading, so a
  soft-deleted transaction lost its account entirely.
- **Fixed:** added an `accountId` integer FK on `transactions` (→ `accounts.id`, `onDelete: set null`,
  indexed; migration `20260608105256_daily_epoch`). `addTransaction` and `transfer` (source leg) now
  persist it; covered by a test. Survives soft-delete.
- **Still TODO (UI/ergonomics):** display the account on the list row + detail; have
  `editTransaction`/`softDeleteTransaction` derive `accountId`/`isCreditCard` from the row instead of
  requiring the caller to re-supply them.

## 2. No edit / delete transaction UI

- **Status:** services exist (`editTransaction`, `softDeleteTransaction`, `undoDelete`), no UI.
- **Fix:** a transaction-detail screen (tap a row) with edit + delete-with-undo. Edit must re-supply
  `accountId`/`isCreditCard` (or fix #1 so they're derivable from the row).

## 3. Transaction has no merchant

- **Status:** the Add form hardcodes `merchantName: ""`. No input.
- **Fix:** add a merchant field to Add/edit; later, autocomplete + learned-mapping (`merchant-mapping`
  service exists, ADR-0012) to auto-fill the category.

## 4. No create / edit category

- **Status:** Categories screen is read-only. `resetCategory` exists; there is no `createCategory`/
  `editCategory` service yet.
- **Fix:** create/edit category service + UI (name, color, icon, income flag), respecting system vs
  user rows + reset (ADR-0004).

## 5. Subcategories not surfaced

- **Status:** 215 subcategories are seeded but shown nowhere — no subcategory picker in Add, no
  subcategory list under a category.
- **Fix:** subcategory picker in Add (filtered by chosen category), subcategory list/CRUD under a
  category. (Schema: `subcategories.categoryId`, `subcategoryId` on transactions.)

## 6. UX note — floor-at-zero on cash

- Spending ₹100 from a ₹0 Cash wallet shows ₹0.00, not −₹100 (ported `calculateBalance` floors
  non-credit accounts at 0 — ADR-0002). Faithful to Cashiro; confirm it's the desired behavior for a
  cash wallet, or allow negative for wallets.

## Also: display

- Transaction list rows show only type/date/amount — add merchant, category, and account once #1/#3 land.
