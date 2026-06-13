# Unmiser

Personal expense tracker. React Native (Expo) port of the Android/Kotlin **Cashiro** app
(referenced at `/Users/vijayabaskar/work/references/Cashiro`). The product's two pillars are a
declarative **SMS-parser plugin layer** (the USP) and proactive **behavior-change** nudges.
See `ROADMAP.md`.

## Language

**Transaction**:
A single money movement of one **Type** (INCOME, EXPENSE, CREDIT, TRANSFER, INVESTMENT), in one
**Currency**, against one **Account**. Stored with `amount` as a BigDecimal string.

**Transfer**:
A **Transaction** of type TRANSFER that moves money between two **Accounts** (source + target),
applying equal-and-opposite balance deltas. In v1 both accounts MUST share the same **Currency**
(enforced by a guard the original Kotlin lacked — it silently mis-added cross-currency legs).
Cross-currency transfers are deferred to Phase 6 (multi-currency).

**Account**:
A place money sits — bank, credit card, or wallet. Carries its own **Currency**, icon, and (for
credit) a credit limit. Identified for SMS matching by `(bankName, accountLast4)`.
_Avoid_: "wallet" as a synonym for Account — a wallet is one _kind_ of Account (`isWallet`).

**Card**:
A resolution alias mapping a card last-4 to a balance-bearing **Account** (debit → its bank Account;
credit → an `isCreditCard` Account). Cards never hold the authoritative balance; `lastBalance` is a
presentation cache. See ADR-0007.
_Avoid_: treating a Card as a separate balance owner.

**Cash Wallet**:
The default seeded **Account** (`isWallet = true`, `seedKey = "cash"`) present on first launch and
the initial **Main Account**, so the app is usable with zero setup.

**Account Balance**:
A timestamped balance reading for an **Account** (a time-series row, not a single mutable field),
tagged with a `sourceType` (MANUAL, TRANSACTION, SMS_BALANCE, CARD_LINK). The latest row is the
current balance.

**Category** / **Subcategory**:
A user-facing grouping for **Transactions** (Subcategory nests under Category). Either **system**
(shipped, `isSystem = true`, identified by a stable `seedKey`) or **user-created**
(`isSystem = false`, `seedKey = NULL`). Both kinds are editable; system ones can be **reset** to
their shipped defaults via `seedKey`. Income-vs-expense is a Category flag (`isIncome`).
_Avoid_: "tag", "label" — those are not modeled.

**Merchant Mapping**:
A learned association from a merchant name → a **Category**, used to auto-categorize future
**Transactions** from the same merchant.

**Parsed Transaction Preview**:
A parser output shown for human review before becoming a saved **Transaction**, used for paste-SMS
testing, low-confidence parsing, and ambiguous messages.

**Automatic SMS Transaction**:
A **Transaction** created directly from a background SMS parse without human confirmation, allowed
only for installed/enabled parser manifests that produce a high-confidence result.

**SMS Transaction Provenance**:
The minimal source metadata kept on an SMS-created **Transaction** for debugging and deduplication:
parser id/version, sender, received time, and transaction hash, excluding the full SMS body.

**Bundled Parser Manifest**:
A parser manifest shipped with the app and installed into local storage to prove the interpreter,
ingestion, and review flow before remote distribution exists.

**Registry Parser Manifest**:
A parser manifest discovered or updated from a remote catalog after the bundled-manifest path is
working.

**Rule Extension**:
An installable, non-executable rule pack that provides inactive rule templates for **Transactions**,
such as assigning categories based on amount, merchant text, or fixed recurring values.

**Transaction Automation Pipeline**:
The ordered path every **Transaction** save follows once raw facts are known: parser/default
category hints, learned **Merchant Mapping**, active rules by priority, save, rule audit logging, then
subscription/mandate effects. A blocking rule stops the save before subscription matching.

**Rule Action**:
An automation effect that may change categorization or presentation fields on a **Transaction** in
v1, or block the save entirely. Rule actions do not change **Transaction** type in v1.

**Blocked Automated Transaction**:
A parsed automated-source transaction that matched a blocking rule before save. It is kept as an
**SMS Review Item** with the blocking rule identity so the user can inspect, override, edit the rule,
or delete the item.

**Apply-to-Past**:
A user-triggered batch run of one or more rules over existing non-deleted **Transactions**, with a
preview count before changes are written and **Rule Application** audit rows after changes are made.

**Rule Application**:
An audit record for a rule that changed a **Transaction**, storing the rule identity and each changed
field's before/after value. Matching rules that make no effective change do not create audit rows.

**System Rule Template**:
A shipped inactive rule row that users can enable or duplicate to automate common categorization or
blocking patterns.

**User Rule**:
A locally created or edited rule owned by the user, evaluated by the same rules engine as system
templates and installed rule packs.

**Rule Builder**:
The user-facing rule editor: flat condition rows, action rows, priority, active toggle, and preview
match count. Raw JSON editing and nested condition groups are not part of v1.

**Mandate-Sourced Subscription**:
A **Subscription** created or updated from parser-emitted mandate details. A mandate notice predicts
future payment; it is not itself a saved **Transaction**.

**Recurring Transaction**:
A **Transaction** marked by the user or detected by the app as part of a repeated payment pattern.
Recurring Transactions can be bundled and proposed as a **Subscription**.

**Recurring Pattern Suggestion**:
An app-detected group of similar **Transactions** that may represent a **Subscription**, requiring
user confirmation before a Subscription is created.

**Subscription Review**:
A review area within the Subscriptions screen for ambiguous recurring-pattern suggestions and
ambiguous Transaction-to-Subscription matches.

**Upcoming Subscription Payment**:
A predicted future payment for an active **Subscription**, derived from mandate/manual next date or
from cadence inferred from linked recurring Transactions.

**Fallback Subscription Identity**:
The dedup key for mandate-sourced subscriptions that do not include a UMN, built from normalized
merchant, normalized amount, Currency, provider/bank, and billing cycle when available.

**Manifest Pipeline Primitive**:
A generic interpreter capability used by parser manifests to express complex bank formats, such as
ordered extraction branches, conditional overrides, fallback values, and mandate detection.

**Manifest Fixture**:
A sample SMS plus expected parser output used to prove a parser manifest before it can be bundled or
published through the registry.

**Reversible Manifest Update**:
A versioned parser update that can be retained, replaced, or rolled back if it performs worse than
the currently installed manifest.

**Review Reprocess**:
Re-running a newer parser manifest over unresolved **SMS Review Items**, without automatically
editing already-saved **Transactions**.

**Manual Parser Report**:
A user-confirmed report containing sender, SMS body, manifest id/version, parse status/reason, and
app version, used to improve parser manifests.

**Owner-maintained Parser Registry**:
The v1 remote catalog for parser manifests, controlled by the Unmiser maintainer even when community
submissions are accepted through review.

**Installed Extension**:
An extension manifest stored locally so its capability works offline until disabled or uninstalled.

**SMS Setup Onboarding**:
The onboarding flow where the user grants SMS permission, provides/selects bank details, and the app
installs only the parser manifests relevant to that user in production.

**Available Extension**:
A parser manifest offered during onboarding for the user's selected country, before the user chooses
which bank/account/card parsers to install.

**Provider Parser Extension**:
A parser extension installed for a financial provider, covering that provider's sender IDs and DLT
variants rather than a single sender string.

**Extension**:
The user-facing name for an installable product capability such as a provider parser or future rule
pack.
_Avoid_: "plugin" in product UI.

**Full Historical SMS Scan**:
An opt-in setup scan over all accessible historical SMS messages, used to backfill transactions and
stress-test installed parsers rather than limiting the first run to a short date window.

**SMS Scan Summary**:
The completion result of a historical scan, including saved transactions, skipped duplicates, and
review items that need user action.

**High-confidence SMS Parse**:
A parser result safe enough to auto-save because the sender matched an installed manifest, required
fields were extracted, no duplicate exists, and no ambiguity flags were raised.

**Review-confidence SMS Parse**:
A parser result that appears financial but is not safe to save automatically, so it becomes an
**SMS Review Item**.

**Rejected SMS Parse**:
A parser result that should not become a **Transaction**, either because the message is non-financial
or failed the parser's transaction filters.

**Merchant Category Learning**:
The user choice to apply a merchant/category association to future **Transactions** from the same
cleaned merchant, optionally updating existing matching Transactions as well.

**SMS Review Item**:
A captured bank-like SMS that needs attention because it could not be safely saved as a
**Transaction**.

**Unrecognized SMS**:
An **SMS Review Item** where no installed/enabled parser manifest could handle the message.

**Account Resolution Required**:
An **SMS Review Item** where the parser found an account/card last-4 that matches multiple existing
same-bank **Accounts**/**Cards**, so the user must choose the correct target before it can be saved.
No-match confident parses auto-create the **Account** per ADR-0006.

**Background Parse Notification**:
A user-facing alert for a real SMS parsed in the background, including successful automatic saves
and cases that require review.

**Notification Privacy Setting**:
The user's choice for how much transaction detail background parse notifications show, with
privacy-light content as the default.

**Test Parse Toast**:
A lightweight confirmation shown during paste-SMS/parser testing instead of a background-style
notification.

**Parser Result**:
The normalized output of the parser engine, including extracted fields, confidence, reasons,
matched manifest, debug-only raw matches, and optional mandate info.

**Paste SMS Harness**:
A dev-facing parser test surface that shows parsed fields, confidence, reasons, raw matches, and the
transaction preview that would be saved.

**Paste SMS Fallback**:
A production user flow for manually pasting an SMS when permission is denied or a message was missed,
without exposing the full dev/debug harness.

**Android SMS Adapter**:
The native Android boundary that reads historical SMS and listens for new SMS, then emits normalized
records to the parser orchestration layer without parsing or writing finance data itself.

**Main Account**:
The single **Account** a user designates as primary. Stored as the app preference `mainAccountId`
(an `accounts.id`) in the `app_settings` KV table — NOT a column on `accounts`. Drives the default
account/currency in the Add sheet and the base **Currency** for cross-currency aggregation
(`currencyOf(mainAccountId)`). See ADR-0005.

**Currency**:
An ISO code (default `INR`) stored as a sibling column next to every amount, never folded into the
amount value. Money math takes currency as an explicit argument; see ADR-0001.

**Sample data** (`isSample`):
A dev/seed-only marker on rows, never a shipped feature (ROADMAP §5 "Out of Scope"). A `__DEV__`-gated loader
inserts `isSample = true` rows; one shared filter helper excludes them and sample loading is compiled
out of production. Not surfaced in the UI.

## Relationships

- A **Transaction** belongs to exactly one **Account** (TRANSFER references two: source + target).
- A **Parsed Transaction Preview** may become one **Transaction** after human confirmation.
- An **Automatic SMS Transaction** is created from exactly one installed/enabled parser manifest.
- An SMS-created **Transaction** keeps **SMS Transaction Provenance**, not the full SMS body.
- Phase 2 proves parsing with **Bundled Parser Manifests** before adding **Registry Parser
  Manifests**.
- v1 **Registry Parser Manifests** come only from the **Owner-maintained Parser Registry**, not
  arbitrary user-supplied URLs.
- Registry manifests require integrity metadata before production remote install; bundled/dev
  manifests still require schema validation and fixtures.
- An **Installed Extension** works offline; network is needed only for registry browsing and updates.
- Disabling an **Installed Extension** prevents realtime and historical parsing without removing it.
- Uninstalling an **Installed Extension** does not delete Transactions already created by it.
- Parser manifests extract transaction facts; **Rule Extensions** and user rules own classification
  and categorization behavior after facts are parsed.
- The **Transaction Automation Pipeline** runs for SMS, paste-SMS, manual entry, and apply-to-past
  flows so the same automation rules produce the same result everywhere.
- Subscription matching observes the final saved **Transaction** after merchant mapping and rules
  have run; it does not run before blocking rules.
- v1 **Rule Actions** do not mutate **Transaction** type; type corrections are human edits or parser
  manifest fixes because type drives balance and budget semantics.
- v1 **Rule Actions** may mutate categorization and presentation fields such as Category,
  Subcategory, merchant name, description, recurring flag, billing cycle, and optionally Account.
  They must not mutate amount, Currency, date/time, Transaction type, transaction hash, source
  provenance, or balance fields.
- v1 rules may inspect more fields than they can mutate, including amount, merchant, category,
  subcategory, Account/bank, Transaction type, Currency, description, source, SMS sender, date/time
  parts, recurring flag, and billing cycle.
- A blocking rule on an automated source creates a **Blocked Automated Transaction** instead of
  silently discarding it. Manual entry shows immediate feedback instead of creating an SMS Review
  row.
- **Apply-to-Past** excludes soft-deleted Transactions by default, never rewrites source provenance
  or dedup fields, and defaults to filling uncategorized/gap fields before overwriting user work.
- Active rules execute in ascending priority order; later matching rules may override fields set by
  earlier rules unless an earlier rule blocks the save.
- A **Rule Application** records only effective changes, including field name, before value, after
  value, and action type.
- When a rule sets a Subcategory, the parent Category is auto-resolved. When a later rule sets an
  incompatible Category, the Subcategory is cleared.
- **System Rule Templates** ship inactive and resettable; enabling or duplicating them is a user
  choice.
- Phase 3 includes local **User Rules**, **System Rule Templates**, and installable **Rule
  Extensions**. Rule Extensions are rule packs evaluated by the same local rules engine, not
  executable code.
- **Rule Extensions** use the same local extension registry/storage/update model as parser
  extensions: versioned manifest assets, checksum verification, enabled flag, offline after install,
  and owner-maintained store distribution in v1.
- Installing a **Rule Extension** does not immediately activate its rules. Users enable individual
  rules or duplicate templates into **User Rules**.
- Rule Extension updates do not mutate active or customized **User Rules** automatically; updated
  packs add/update inactive templates and surface the available change.
- Rule conditions may inspect source/provenance fields such as SMS sender, but rule actions cannot
  mutate provenance. Missing source-specific fields make that condition false.
- Rule Extension manifests use `type = "rule"` with their own schema for metadata and rule
  templates; parser manifest pipeline primitives do not apply to rule packs.
- Disabling or uninstalling a Rule Extension affects its pack templates, not user-owned copies
  created from those templates.
- Rule Extensions may include blocking rules, but each blocking rule must be explicitly enabled by
  the user. Bulk/pack activation must not silently activate blocking rules.
- Rules run before every Transaction commit path: manual save, paste-SMS save, historical SMS scan,
  realtime SMS listener save, apply-to-past, and later automated import paths.
- Manual transaction entry previews rule effects before save; rule actions apply only when the user
  commits the save.
- If a user edits a rule-controlled field before saving, that explicit edit overrides conflicting
  rule actions for that Transaction only. Apply-to-past can overwrite user edits only when the user
  opts in.
- A **Mandate-Sourced Subscription** is deduped by UMN when present; otherwise it uses **Fallback
  Subscription Identity** and never merges fallback identities across different providers/banks.
- A mandate SMS creates or updates a **Subscription** only; the actual debit creates the
  **Transaction** and may later match that Subscription.
- A hidden Subscription reactivates automatically on a fresh mandate. A matching debit for a hidden
  Subscription should surface a review prompt or badge rather than silently reactivating it.
- A Subscription's Category/Subcategory comes first from a matched Transaction after rules, then
  **Merchant Mapping**, then a system Subscriptions category.
- Phase 3 stores billing cycle as the existing `billingCycle` text value, including preset/custom
  encodings; helper services own parsing and formatting so UI does not inspect the raw encoding.
- Users can create a **Subscription** manually, mark an existing **Transaction** as recurring to
  create or link a Subscription, or accept an app suggestion built from bundled recurring
  Transactions.
- The app may bundle similar **Recurring Transactions** and ask whether they represent a recurring
  payment/Subscription; it should not silently create a user-visible Subscription from that pattern.
- Transaction-to-Subscription matching uses amount tolerance and date/merchant/provider plausibility.
  Ambiguous matches go to review rather than auto-linking.
- A **Recurring Pattern Suggestion** is created only after at least two similar Transactions with the
  same normalized merchant, Currency, plausible category context, amount within tolerance, and a
  plausible weekly/monthly/yearly date gap.
- Marking a Transaction as recurring opens a confirmation flow prefilled from that Transaction;
  saving creates or links a Subscription and links the Transaction as a known payment.
- A saved Subscription payment is linked directly from the Transaction in v1 because a payment
  belongs to at most one Subscription.
- Ambiguous recurring-pattern suggestions and ambiguous subscription matches belong in
  **Subscription Review**, not **SMS Review**.
- User-facing Subscription removal is **Hide** for mandate-sourced or transaction-linked
  Subscriptions. A manually created Subscription with no linked Transactions can be hard-deleted as
  cleanup.
- A merchant/provider/cadence-stable amount change remains the same Subscription. The expected
  amount updates after user confirmation or after two consecutive matched payments at the new
  amount.
- Phase 3 shows **Upcoming Subscription Payments** for the next 30 days by default, plus a full list
  view.
- Phase 3 uses in-app Subscription badges/sections only; local/push notification behavior is deferred
  to Phase 4/5 nudges.
- Bank-specific SMS behavior lives in parser manifests using **Manifest Pipeline Primitives**; v1
  avoids app-shipped bank parser fallback code.
- Parser manifests are declarative data only, not executable JavaScript or user code.
- A parser manifest requires passing **Manifest Fixtures** before it can be bundled or registry
  published.
- **Reversible Manifest Updates** protect users from parser regressions by retaining or rolling back
  a previous installed version.
- Manifest updates trigger **Review Reprocess** for unresolved review items, not automatic edits to
  already-saved Transactions.
- **SMS Review Items** remain local until the user resolves or deletes them; nothing leaves the
  device without **Manual Parser Report** confirmation.
- Production **SMS Setup Onboarding** installs user-specific parser manifests based on bank details;
  development builds may include default bundled manifests for parser stress testing.
- **SMS Setup Onboarding** is split into separate screens, including country selection and
  country-specific **Available Extensions**.
- User-facing copy says **Extension**; implementation may still use `plugin` where schema/code
  already does.
- Onboarding can complete with SMS enabled and extensions installed, with SMS denied/skipped for
  manual mode, or in a dev/test mode using bundled manifests.
- v1 parser architecture is multi-country, while Phase 2 implementation starts India-first and uses
  a small set of non-India fixtures to prove the shape.
- Users install **Provider Parser Extensions**; one provider extension can parse SMS for multiple
  local Accounts/Cards at that provider.
- A **Full Historical SMS Scan** runs during setup after permission so installed parsers can backfill
  as much existing SMS history as Android exposes.
- A **Full Historical SMS Scan** runs in batches and can be cancelled, but review items are gathered
  during the scan and shown in the **SMS Scan Summary** after parsing completes.
- Realtime Android SMS ingestion and historical scan feed the same parser engine input shape.
- The **Android SMS Adapter** may be implemented with Nitro Modules or another native-module
  approach, but its domain boundary stays ingestion-only.
- The parser engine returns a **Parser Result** and stays independent of persistence/UI.
- Debug-only raw parser matches are shown in the **Paste SMS Harness** but not stored on successful
  Transactions.
- **Paste SMS Harness** and **Paste SMS Fallback** are separate surfaces: one for development/debug,
  one for production fallback entry.
- Historical scans process oldest-to-newest where possible so balance history and dedup are
  predictable.
- **Background Parse Notifications** default to privacy-light content, with detail controlled by the
  **Notification Privacy Setting**.
- Denying SMS permission does not block the user from continuing with manual tracking and paste-SMS
  flows.
- A **High-confidence SMS Parse** may create an **Automatic SMS Transaction**.
- A **Review-confidence SMS Parse** creates an **SMS Review Item**.
- A **Rejected SMS Parse** is ignored unless it is useful as an **Unrecognized SMS** signal.
- Unknown account/card last-4 values auto-create an **Account** when the parse is high-confidence
  and resolves to no existing same-bank Account/Card; only ambiguous suffix matches require user
  review.
- An SMS available-balance value creates an **Account Balance** row with `sourceType = SMS_BALANCE`
  when the **Account** is resolved.
- **Merchant Category Learning** may apply to future matching Transactions and optionally update
  existing matching Transactions from the same cleaned merchant.
- An **SMS Review Item** is not created for a successfully auto-saved background SMS in v1.
- **Unrecognized SMS** and **Account Resolution Required** are statuses/reasons within the same
  SMS review queue.
- The user-facing review screen is **SMS Review**, not "Unrecognized SMS".
- **Account Resolution Required** prevents save until the user chooses the referenced **Account**.
- Transaction source must distinguish MANUAL, SMS, IMPORT, and later API_SOURCE.
- An **Account** has many **Account Balance** readings; the newest is "the balance".
- Every monetary value pairs an `amount` (BigDecimal string) with a **Currency** column.

## Flagged ambiguities

- "amount + currency" — resolved as two decoupled fields (a bare string + a sibling currency arg),
  NOT a wrapped `Money` value object. See ADR-0001.
- Cross-currency transfer — resolved: out of scope for v1 (guard rejects it); revisit in Phase 6.
- **"plugin" vs "skill"** — two distinct downloadable-capability concepts that must NOT be blurred:
  - **Bank-parser manifest** ("plugin"): declarative regex/field-maps, consumed by the **Unmiser
    app** at runtime, stored in local SQLite (`plugins`/`plugin_assets`), downloaded from a parser
    registry. "Stale" = a bank changed its SMS format. (`docs/plugin-architecture.md`.)
  - **Agent Skill** (`@tanstack/intent`): markdown/YAML procedural knowledge, consumed by an **AI
    coding agent** at dev time, shipped inside an npm package and auto-discovered from
    `node_modules`. "Stale" = a referenced source doc drifted.
  - They rhyme (versioned, discoverable, beat a monolith/cutoff) but target different consumers and
    live in different places. `@tanstack/intent` is a candidate vehicle ONLY for the second
    (contributor knowledge about authoring manifests), never for runtime manifest distribution.
- **`iconResId` vs `iconName`** — the schema carries both on categories/accounts. Resolved:
  `iconName` (string) is the single source of truth; `iconResId` (Android `R.drawable` int) is
  migration-only baggage, dropped later. Icons render via nano-icons (SVG, layers A/B) with a
  bundled-WebP fallback for brand logos (layer C). See ADR-0003.
