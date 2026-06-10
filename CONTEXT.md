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
An installable rule pack that applies conditions and actions to **Transactions** after parsing or
manual entry, such as assigning categories based on amount, merchant text, or fixed recurring values.

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
An **SMS Review Item** where the parser found an account/card last-4 the app cannot link to an
existing **Account**, so the user must link or create the Account before it can be saved.

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
A dev/seed-only marker on rows, never a shipped feature (ROADMAP §6). A `__DEV__`-gated loader
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
- Unknown account/card last-4 values require user link/create action; accounts are not created
  silently from SMS.
- An SMS available-balance value creates an **Account Balance** row with `sourceType = SMS_BALANCE`
  when the **Account** is resolved.
- **Merchant Category Learning** may apply to future matching Transactions and optionally update
  existing matching Transactions from the same cleaned merchant.
- An **SMS Review Item** is not created for a successfully auto-saved background SMS in v1.
- **Unrecognized SMS** and **Account Resolution Required** are statuses/reasons within the same
  SMS review queue.
- The user-facing review screen is **SMS Review**, not "Unrecognized SMS".
- **Account Resolution Required** prevents save until the user links or creates the referenced
  **Account**.
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
    registry. "Stale" = a bank changed its SMS format. (ROADMAP §3.)
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
