# PRD — Phase 0/1: Foundations & Manual Expense Tracker

> Scope is bounded by `ROADMAP.md` §Phase 0 and §Phase 1. Every decision below is grounded in the
> grilling captured in `docs/adr/0001`–`0015` and `CONTEXT.md`; ADRs are referenced inline so a
> reader can jump to the rationale. This PRD is a planning document — not filed as an issue.

## Problem Statement

Unmiser has a complete Drizzle schema (1:1 with Android Room v51) but **zero financial features**.
A user cannot create an account, add a transaction, see a balance, or categorize spending. Before any
SMS/parser work (Phase 2, the USP) can write into a data substrate, that substrate has to exist and
be usable by hand — including for the Android users who decline the SMS permission. The cross-cutting
primitives every feature depends on (money math, dates, icons, the optimistic persistence pattern)
also don't exist yet, so building features now would mean each one re-inventing them and drifting.

## Solution

Ship the **foundation primitives** once (Phase 0), then the **manual expense tracker** on top of them
(Phase 1): categories with a seeded default set, accounts/cards with balances, and full manual
transaction CRUD with transfers, soft-delete/undo, and search. The result is a self-contained,
offline, single-currency-friendly expense tracker that is also the data substrate the Phase-2 parser
engine will later write into. Derived state (account balances) is computed by an authoritative service
inside the persistence step and read back via live queries, so the hardest invariant lives in the
layer with the strongest rollback story (see ADR-0002).

## User Stories

**Foundations (Phase 0)**

1. As a developer, I want money math (`add/subtract/compare/format`) over BigDecimal strings with an explicit currency argument, so that I never lose precision and never accidentally mix currencies (see ADR-0001).
2. As a developer, I want currency-aware formatting (Indian lakh grouping for INR/NPR; correct decimal places per currency), so that amounts render correctly without depending on Hermes Intl (see ADR-0001).
3. As a developer, I want date helpers that store and parse frozen local wall-clock ISO strings, so that a transaction's timestamp never shifts when the device timezone changes (see ADR-0009).
4. As a developer, I want a single collection factory over the Query-adapter + drizzle pattern with an `afterWrite` hook, so that every table gets optimistic CRUD and derived-state cascades run in the same persistence step (see ADR-0011).
5. As a developer, I want an icon resolver where `iconName` is the single source of truth, so that categories/accounts render the right glyph without depending on Android resource ints (see ADR-0003).
6. As a developer, I want a `__DEV__`-only sample-data loader and one filter helper, so that I can populate realistic data in development without shipping it (see CONTEXT "Sample data").

**Categories (Phase 1)**

7. As a user, I want a default set of ~33 categories and 200+ subcategories on first launch, so that I can categorize spending immediately without setup.
8. As a user, I want to create my own categories and subcategories, so that the taxonomy fits how I think about money.
9. As a user, I want to edit a system category's name/color/icon, so that I can tailor the defaults.
10. As a user, I want to reset an edited system category to its shipped default, so that I can undo my customization even after renaming it (see ADR-0004).
11. As a user, I want each category flagged as income or expense, so that the app sums them correctly.
12. As a user, I want to reorder categories, so that the ones I use most are easiest to reach.
13. As a user, I want a merchant I categorize once to be remembered, so that future transactions from that merchant are auto-categorized (see ADR-0012).

**Accounts & Cards (Phase 1)**

14. As a user, I want a default Cash wallet on first launch, so that I can record cash spending immediately (see CONTEXT "Cash Wallet").
15. As a user, I want to create bank, credit-card, and wallet accounts, so that I can track money wherever it sits.
16. As a user, I want to pick the bank from a canonical list rather than free-text, so that my account matches what SMS parsing will later resolve to (see ADR-0006).
17. As a user, I want to designate a main account, so that it is pre-selected when adding a transaction and drives my base currency (see ADR-0005).
18. As a user, I want cards to link to an account, so that a card transaction updates the right balance and I don't have two balances to reconcile (see ADR-0007).
19. As a user, I want to see each account's current balance and its balance history, so that I understand how my money has moved over time.
20. As a user, I want balances to recalculate correctly when I edit or delete a past transaction, so that my history stays consistent (see ADR-0002).

**Transactions (Phase 1)**

21. As a user, I want to add an expense/income transaction with amount, account, category, merchant, and date, so that I can track my spending.
22. As a user, I want the main account and its currency pre-selected in the add sheet, so that the common case is one tap (see ADR-0005).
23. As a user, I want to record a transfer between two of my accounts, so that moving money doesn't look like spending.
24. As a user, I want a transfer to require both accounts share a currency in v1, so that my balances are never silently corrupted by an unconverted amount (see CONTEXT "Transfer").
25. As a user, I want to edit a transaction, so that I can fix mistakes, with balances re-cascading automatically.
26. As a user, I want to delete a transaction and undo the delete, so that I can correct an accidental removal (see ADR-0008).
27. As a user, I want to search and filter transactions, so that I can find a specific entry.
28. As a user, I want to bulk-select and act on transactions, so that I can clean up many at once.
29. As a user, I want each transaction to carry its own currency, so that foreign entries are recorded faithfully.

## Implementation Decisions

**Schema migrations (do first — these unblock Phase 1):**

- Add `seedKey` (nullable text) to `categories` and `subcategories` — stable identity for system rows; reset matches on it (ADR-0004).
- Add an `app_settings` key-value table (`key` PK, `value`); first entry is `mainAccountId` (ADR-0005).
- Add a canonical bank identifier to `accounts` (column or normalized `bankName` keyed to the manifest registry), funnelled through one bank-resolution function shared by manual-create and future SMS-create (ADR-0006).
- `iconResId` becomes unused at runtime from day one; schedule its drop (and `chatMessages`) for a later migration (ADR-0003).

**Deep modules (encapsulated, isolation-testable, stable interfaces):**

- **`money`** — pure `add/sub/compare/format(amount, ccy)` over BigDecimal strings; decimal.js engine hidden behind the interface; static currency-config map for decimals + grouping (ADR-0001).
- **`dates`** — frozen local wall-clock ISO parse/format/period-math over date-fns (ADR-0009).
- **`balanceService`** — the anchor-segmented running-balance fold (`calculateBalance` + `recalculateBalancesAfter`); pure over an ordered reading list; the crown-jewel invariant (ADR-0002). Card/credit-card sign rules included (ADR-0007).
- **`accountResolver`** — `(canonicalBank, last4) → accountId` with auto-create and partial-last4 fuzzy match (ADR-0006).
- **`dedupHash`** — `MD5(sender | amount2dp | body[:16])`; idempotent, delete-sticky (ADR-0010). (Manual rows synthesize a hash to keep one path.)
- **`seed`** — static category/subcategory + Cash-wallet definitions (seedKey, default name/color/iconName); the source for both the seed migration and the reset function (ADR-0004).
- **`collectionFactory`** — `createDrizzleCollection({ table, getKey, queryFn?, afterWrite? })` over `queryCollectionOptions`; `afterWrite` runs derived services in the same drizzle transaction (ADR-0011).
- **`iconRegistry`** — `iconName → nano-icons glyph` (chrome + categories) with a bundled-WebP fallback for brand logos (ADR-0003).

**Shallow/UI layers (compose the deep modules):**

- Collections per table (transactions, categories, subcategories, accounts, cards, accountBalances read-projection, merchantMappings, app_settings) via the factory.
- Transaction operations: CRUD, transfer (same-currency dual-leg, CONTEXT "Transfer"), soft-delete + undo with cascade (ADR-0008), learned-mapping upsert on user categorization (ADR-0012).
- Screens: Categories (list/CRUD/reorder/reset), Accounts/Manage (CRUD, set-main, balances/history), Transactions (list/search/filter/bulk, detail, add sheet).

**Categorization precedence (live now for manual; rules engine arrives Phase 3):** learned `merchantMapping` > parser/none. Full chain `rules > merchantMapping > parser default` (ADR-0012).

## Testing Decisions

Good tests assert **external behavior**, not implementation details — given inputs to a module's
public interface, assert outputs/observable effects, so refactors don't break tests. Prior art: the
existing `todoCollection` optimistic round-trip is the template for collection persistence tests.

Prioritized for tests (pure, deep, high-consequence):

- **`balanceService`** — exhaustively: income/expense/investment/credit-card deltas, anchor segmentation (MANUAL/SMS-stated readings stop the recompute), edit/delete-in-the-past cascades, transfer dual-leg. This is the roadmap's flagged risk; test it hardest.
- **`money`** — precision, rounding (HALF_EVEN), currency formatting (lakh grouping, 0/2/3-dp currencies), compare.
- **`dates`** — wall-clock freeze (no TZ shift), period boundaries.
- **`dedupHash`** — idempotent re-scan, delete-stickiness.
- **`accountResolver`** — auto-create, partial-last4 unique-suffix resolution, canonical-bank dedup.
- **`collectionFactory`** — optimistic insert/update/delete + rollback on handler throw + `afterWrite` cascade atomicity.

UI screens are not unit-tested in this phase (integration/e2e deferred). TDD (red-green-refactor) is
the expected workflow for the deep modules.

## Out of Scope

- All SMS/parser-engine work and ingestion (Phase 2) — but accounts/transactions/mandate-target shapes are designed to receive it.
- Rules engine and subscriptions (Phase 3); budgets and behavior-change (Phase 4+).
- Cross-currency transfers and multi-currency aggregation/exchange rates (Phase 6) — v1 transfers are same-currency only (CONTEXT "Transfer").
- iOS, AI/chat, PDF import, webhooks/sync (per ROADMAP §6).
- Dropping `iconResId`/`chatMessages` columns (later migration).
- Registry telemetry and the SMS "install a parser" prompt (the minimal `unrecognizedSms` capture is Phase 2; see ADR-0015).

## Further Notes

- **Build order:** schema migrations → `money` + `dates` → `collectionFactory` + `balanceService` → `seed` (categories + Cash wallet) → Categories screen → Accounts screen → Transactions (add/list/detail) → search/bulk/undo. Icons (nano-icons setup + SVG sourcing) can proceed in parallel after the schema work.
- **Dev build is required** (nano-icons config plugin, ADR-0003) — already needed for Phase 2's SMS native module, so no new constraint.
- **`@tanstack/intent` is wired** (`AGENTS.md`): load `@tanstack/db#db-core/*` skills (collection-setup, mutations-optimistic, live-queries, persistence) before TanStack DB work — they are the source of truth for the installed version.
- **Open edges flagged in ADRs** to resolve during build: reset name-collision (ADR-0004), system-category hide-vs-delete (ADR-0004), mandate-without-UMN fallback identity (ADR-0014), refetch scoping per filter as transaction lists grow (ADR-0011).
