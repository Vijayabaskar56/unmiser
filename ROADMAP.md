# Unmiser — Product Roadmap

> Status as of 2026-06-08. This roadmap turns the Cashiro (Android/Kotlin) audit into a sequenced plan for the React Native port. It is anchored by two non-negotiable product pillars and the owner's fixed product decisions.
>
> **Scope: v1 targets Android only. iOS is deferred to a later release.** The plugin _engine_ stays platform-agnostic (it accepts `(sender, body)` from any source), so iOS support later is an ingestion-adapter add-on — but no iOS work is in the v1 plan.

---

## 1. Vision & Product Pillars

**Pillar 1 — The Extension/Plugin Layer (the USP).** Cashiro's value lives in its 98 bank-specific SMS parsers across 14+ countries — but as 98 hand-written Kotlin classes that ship inside the app, that approach does not scale and ties every bank fix to an app-store release. Unmiser replaces that with a **typed, declarative plugin layer**: a single interpreter engine runs downloadable data manifests (regex + field maps), and users install only the few bank parsers they actually need (a 2-bank user installs 2 plugins, not 98). New banks and format fixes ship as manifest updates into the local DB — no store review, working offline after download. This is the differentiator and the first priority after foundations.

**Pillar 2 — Behavior Change.** The audit's harshest finding is that Cashiro has excellent _visualization_ but almost no _behavioral intervention_: the only proactive signal it ships is `recommendedDailySpending`. Unmiser treats behavior change as a first-class pillar, not a reporting afterthought. The app must interrupt harmful patterns _before/during_ spending moments (pre-spend nudges, budget-pacing alerts, cashflow runway, anomaly detection) and reinforce positive habits (weekly ritual, savings-goal gain framing, monthly report card) using established behavioral principles — loss aversion, choice architecture, salience, commitment devices, gain framing.

---

## 2. Where We Are Now

The RN port (Expo SDK 56, Drizzle ORM 1.0-rc, TanStack DB 0.6.5, React 19, RN 0.85.3, TypeScript 6, Bun) has **foundations done, zero financial features built**.

| Built                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Full DB schema**               | 1:1 Drizzle port of Android Room v51 — 13 tables, ~527 LOC (`db/schema/*`): transactions, categories/subcategories, merchantMappings, accounts, accountBalances, cards, budgets, budgetCategoryLimits, subscriptions, transactionRules/ruleApplications, exchangeRates, unrecognizedSms, chatMessages, webhooks (profiles/logs/cursors). Amounts as TEXT (BigDecimal strings), dates ISO-8601 TEXT, booleans INTEGER. |
| **Relations**                    | `db/relations.ts` (176 LOC) — all FKs mapped for Drizzle v1 relational queries.                                                                                                                                                                                                                                                                                                                                       |
| **Migrations**                   | `useMigrations` hook runs bundled migrations on startup; dev-only auto-reset on baseline conflict. Baseline (288 LOC) + todos extension.                                                                                                                                                                                                                                                                              |
| **TanStack DB optimistic layer** | Working `todoCollection` demo (`db/collections/todos.ts`) — optimistic insert/update/delete over Drizzle persistence with rollback. Crypto polyfill (`lib/polyfills.ts`) wired for `randomUUID`.                                                                                                                                                                                                                      |
| **App skeleton**                 | expo-router drawer+tabs (~395 LOC), theme system (heroui-native + uniwind), Drizzle Studio dev plugin. One demo screen (todos).                                                                                                                                                                                                                                                                                       |

**Not built:** every financial feature — no transactions UI, no SMS/parser engine, no accounts, no categories/seed data, no budgets, no subscriptions, no rules engine, no exchange rates, no webhooks, no behavior-change features, no icon mapping (Android `iconResId` ints need mapping to RN icon names).

---

## 3. Architecture: The Plugin System

### 3.1 The typed-plugin model

A **plugin** is a typed, declarative capability the user installs. Two plugin _types_, each with a different trust tier:

| Plugin type  | What it does                                                                                      | Data flow                                                          | Trust tier                                                                          | Status                               |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------ |
| `sms-parser` | Interprets a bank's SMS into a `ParsedTransaction`                                                | Pure function over a **local string** → no network, no credentials | **Safe-by-construction** → open install / community registry                        | **BUILD FIRST**                      |
| `api-source` | Pulls transactions from an external source (brokers via official APIs, PF via Account Aggregator) | **Outbound network calls with user credentials**                   | **Vetted/allowlisted only** → secrets in secure-store (Keychain); exfiltration risk | **DESIGN type now, IMPLEMENT LATER** |

Scraping-style sources may remain **built-in** rather than installable plugins. The `sms-parser` model is **engine-first and extension-driven**: the app ships the generic interpreter, while bank-specific behavior lives in manifests. When Cashiro's Kotlin parsers need gnarly branches (HDFC-style ordered merchant waterfalls, SBI-style post-parse overrides), Unmiser should evolve the manifest DSL/interpreter primitives instead of shipping app-bundled bank parser code.

### 3.2 `sms-parser` manifest schema (sketch)

A manifest is downloaded into the local DB and interpreted offline. It encodes what the Cashiro audit calls "pure declarative" parser logic — sender dispatch, extraction regexes with named captures, keyword maps, filters, validation.

```jsonc
{
  "schemaVersion": "1.0",
  "pluginId": "in.hdfc.bank",
  "type": "sms-parser",
  "name": "HDFC Bank (India)",
  "country": "IN",
  "currency": "INR", // BankParser.getCurrency() default
  "version": "3", // bump ships fixes without store review
  "trust": "community",

  "dispatch": {
    // canHandle(sender)
    "senders": ["HDFCBK", "HDFCBN"],
    "dltPatterns": ["^[A-Z]{2}-HDFC.*$"],
  },

  "filter": {
    // isTransactionMessage()
    "excludeKeywords": [
      "otp",
      "one time password",
      "offer",
      "has requested",
      "is due",
      "e-mandate!",
      "will be debited",
    ],
    "requireAnyKeyword": ["debited", "credited", "withdrawn", "spent"],
  },

  "extract": {
    // ordered regex lists, named captures
    "amount": [
      { "re": "Rs\\.?\\s*(?<value>[0-9,]+(?:\\.\\d{2})?)" },
      { "re": "INR\\s*(?<value>[0-9,]+(?:\\.\\d{2})?)" },
    ],
    "merchant": [
      { "re": "to\\s+(?<value>[^.\\n]+?)(?:\\s+on|\\s+Ref|\\s+UPI)" },
      { "re": "VPA\\s+[^@\\s]+@[^\\s]+\\s*\\((?<value>[^)]+)\\)" },
    ],
    "balance": [{ "re": "Avl bal:INR\\s*(?<value>[0-9,]+(?:\\.\\d{2})?)" }],
    "reference": [{ "re": "(?:Ref|UPI)[:\\s]+(?<value>[A-Z0-9]+)" }],
    "accountLast4": [{ "re": "A/c\\s+(?:[Xx\\*]*)?(?<value>\\d+)", "takeLast4": true }],
  },

  "typeRules": {
    // extractTransactionType()
    "investmentKeywords": ["ICCL", "NSCCL", "Groww", "Zerodha", "SIP", "mutual fund"],
    "expenseKeywords": ["debited", "withdrawn", "spent", "charged"],
    "incomeKeywords": ["credited", "deposited", "refund", "cashback"],
    "creditCardKeywords": ["block cc", "block pcc"],
  },

  "cleaning": {
    // cleanMerchantName()
    "stripPatterns": [
      "\\s*\\(.*?\\)\\s*$",
      "\\s+Ref\\s+No.*",
      "\\s+UPI.*",
      "\\s+PVT\\.?\\s*LTD\\.?",
    ],
    "minMerchantLength": 2,
    "commonWords": ["USING", "VIA", "THROUGH", "TO", "FROM"],
  },

  "mandate": {
    // optional: parseEMandateSubscription()
    "detectKeyword": "E-Mandate!",
    "amount": "Rs\\.?\\s*(?<value>[0-9,]+)\\s+will\\s+be\\s+deducted",
    "date": "deducted\\s+on\\s+(?<value>\\d{2}/\\d{2}/\\d{2})",
    "merchant": "For\\s+(?<value>[^\\n]+?)\\s+mandate",
    "umn": "UMN\\s+(?<value>[a-zA-Z0-9@]+)",
    "dateFormat": "dd/MM/yy",
  },

  "pipeline": [], // optional declarative conditional steps for gnarly formats
}
```

### 3.3 The interpreter engine — responsibilities

One engine runs every manifest. It owns:

- **Dispatch**: match incoming SMS sender against installed manifests' `dispatch` (first match wins, mirroring `BankParserFactory`).
- **Filter**: apply `excludeKeywords`/`requireAnyKeyword` (the `isTransactionMessage` waterfall).
- **Extraction**: run ordered named-capture regexes for amount/merchant/balance/reference/account, with `takeLast4` and validation (length ≥ 2, has letters, not a VPA, not all digits — the `isValidMerchantName` rules).
- **Classification**: investment-first keyword check, then expense/income/credit (mirrors `extractTransactionType`).
- **Cleaning**: apply `stripPatterns`/`commonWords`.
- **Card-vs-account**: exclusion-list then inclusion-list (the `detectIsCard` logic) — declarative.
- **Dedup**: compute the canonical hash `MD5(sender | normalizedAmount(2dp) | smsBodyHash[:16])` and skip on existing `transactionHash`.
- **Mandate/subscription**: when `mandate` block present, emit a `MandateInfo` (amount, nextDeductionDate, merchant, umn) for the subscription pipeline.
- **Conditional pipeline**: run declarative conditional steps for gnarly bank formats (ordered extraction branches, post-parse overrides, fallback values) without bank-specific app code.

This satisfies the audit's port strategy while avoiding Cashiro's compiled-parser monolith: simple parsers work with basic regex maps; mid/maximal parsers use richer manifest pipeline primitives rather than app-shipped bank classes.

### 3.4 `api-source` manifest (future, sketch)

```jsonc
{
  "type": "api-source",
  "pluginId": "broker.zerodha.kite",
  "trust": "vetted", // allowlisted only — never open install
  "auth": { "method": "oauth", "secretsKeys": ["accessToken", "apiSecret"] },
  "endpoints": { "transactions": { "url": "...", "method": "GET", "cursorParam": "from" } },
  "mapping": {
    "amount": "$.net_amount",
    "merchant": "$.tradingsymbol",
    "date": "$.order_timestamp",
  },
}
```

Secrets (`accessToken`, `apiSecret`) live in **expo-secure-store / Keychain**, never in the DB or manifest. `api-source` plugins are vetted/allowlisted because they make outbound calls with user credentials (exfiltration risk).

### 3.5 Installed plugins in the DB / TanStack DB

- A new `plugins` table (manifest JSON, type, version, trust tier, enabled, installedAt) plus a `plugin_assets` blob for the downloaded manifest body. Installed-plugin state and parsed-data state are managed by the **TanStack DB optimistic-transaction layer** (same pattern as the `todoCollection` demo); **drizzle/expo-sqlite is the relational store**. Both are already wired.
- Manifests download into the local DB and the app **works offline after download**; a version bump on a manifest re-syncs that one bank's parser without an app-store release.
- `unrecognizedSms` (already in schema) captures messages no installed manifest handles — feeding the "install the parser you need" loop and registry telemetry.

### 3.6 SMS ingestion — Android v1 (iOS deferred)

**v1 is Android-only**, which sidesteps the hardest ingestion problem: Android allows `READ_SMS`/`RECEIVE_SMS`, so the app can read bank SMS directly. The engine is fed `(sender, body)` from a native module:

| Source (v1, Android) | Ingestion path                                                                   | Notes                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Real-time**        | Native module: `RECEIVE_SMS` broadcast → engine on arrival.                      | Mirrors Cashiro's `SmsBroadcastReceiver`. Requires a custom native module (not Expo Go; dev build / EAS). |
| **Historical**       | One-time `READ_SMS` scan on first run / opt-in re-scan, batched into the engine. | Mirrors Cashiro's `SmsReaderWorker`.                                                                      |

**Deliberately decoupled for the future:** the engine accepts `(sender, body)` from _any_ source, so when iOS comes later its ingestion (paste / Share Sheet / forwarding inbox — no background read on iOS) is an additive adapter that reuses the same manifests and interpreter. No iOS ingestion is built in v1. A manual "paste an SMS" entry point is cheap and can be included on Android too as a fallback for users who decline the SMS permission.

---

## 4. Phased Roadmap

Ordering: foundations (done) → sms-parser plugin layer (USP) early → core financial features → behavior change → exchange rates + webhooks/sync → api-source (later). Two behavior-change features are pulled forward into Phase 4 so the second pillar is never fully deferred.

| Phase | Goal (one line)                                                                |
| ----- | ------------------------------------------------------------------------------ |
| **0** | Foundations & data primitives (mostly done; finish the cross-cutting plumbing) |
| **1** | Core data UI: categories (+seed), accounts/cards, manual transactions          |
| **2** | **The `sms-parser` plugin engine + ingestion (the USP)**                       |
| **3** | Rules engine + subscriptions/mandates                                          |
| **4** | Budgets + first behavior-change nudges                                         |
| **5** | Analytics/reports + full behavior-change pillar                                |
| **6** | Multi-currency exchange rates                                                  |
| **7** | Webhooks / sync / export                                                       |
| **8** | `api-source` plugins (vetted)                                                  |

### Phase 0 — Foundations & Data Primitives

- **GOAL:** Make the schema usable by every feature: money/date helpers, icon mapping, TanStack DB collection pattern, sample-data flag.
- **SCOPE:**
  - Decimal handling for TEXT BigDecimal amounts (decimal.js/big.js) + currency formatting (Indian lakh grouping for INR/NPR).
  - Date utilities (date-fns/Day.js) for ISO-8601 TEXT.
  - Icon mapping layer: Android `iconResId`/`iconName` → RN icon set; icon picker.
  - Reusable TanStack DB collection factory (generalize the `todoCollection` demo) for core tables.
  - `isSample` seed/filter utility.
- **KEY DELIVERABLES:** `lib/money.ts`, `lib/dates.ts`, icon-name map, collection factory, sample-data loader.
- **DEPENDENCIES:** None (builds on existing schema/migrations/TanStack layer).
- **WHY NOW:** Every downstream feature reads money/dates/icons; doing it once avoids per-feature drift.

### Phase 1 — Categories, Accounts & Manual Transactions

- **GOAL:** A usable manual expense tracker before any SMS work.
- **SCOPE:**
  - Categories/subcategories CRUD; **seed 33 default categories + 200+ subcategories** (system flag + `default_*` reset columns); income-vs-expense flag, display order.
  - Learned merchant mappings (`merchantMappings`).
  - Accounts/cards: types (bank/credit/wallet), card↔account linking via `accountLast4`, default Cash wallet, main-account designation, account-last4 resolution.
  - Account **balance time-series** (`accountBalances` with `sourceType`: MANUAL/TRANSACTION_CALCULATED/…), recalculate-after-edit cascade.
  - Transactions: CRUD, soft-delete + undo, transfer (from/to dual balance update), per-transaction currency, search/filter, edit flows, bulk select.
- **KEY DELIVERABLES:** Categories screen + seed migration, Accounts/Manage screen, Transactions list/detail/add screens, collections for each.
- **DEPENDENCIES:** Phase 0.
- **WHY NOW:** This is the manual-entry core (no SMS needed) and the data substrate the parser engine writes into; it also covers Android users who decline the SMS permission.

### Phase 2 — The `sms-parser` Plugin Engine (USP)

- **GOAL:** Ship one interpreter engine + installable parser extensions; users install only the banks/providers they need.
- **SCOPE:**
  - Pure interpreter engine (§3.3): dispatch, filter, extraction (named captures), classification hints, cleaning, card-vs-account, dedup hash, confidence/reasons, mandate emit.
  - Manifest schema + validation; declarative pipeline primitives (`when`, ordered extractors, field overrides, fallback values, skip/reject gates, post-parse cleanup) so HDFC/SBI-style complexity extends the engine instead of adding bank-specific app code.
  - Manifest fixtures for every bundled/registry manifest; registry manifests require schema + fixture validation and production integrity metadata.
  - Extension storage (`plugins`/`plugin_assets`) with install/update/enable/disable/remove via TanStack DB. User-facing copy says "Extensions"; code/schema may keep `plugin` naming.
  - SMS Setup Onboarding: country selection → available provider extensions → user bank/account/card details → SMS permission → full historical scan. Production installs user-selected provider extensions; dev builds may install default/broader bundled manifests for stress testing.
  - **Ingestion (Android v1 only):** Android SMS Adapter (Nitro Module or similar) for real-time `RECEIVE_SMS` + full historical `READ_SMS` scan, emitting normalized SMS records into the same parser orchestration path. iOS ingestion remains out of v1.
  - Parser orchestration: batching/cancel for full scan, oldest-to-newest processing where possible, dedup before save, account/card-last4 resolution, transaction writes, `SMS_BALANCE` account-balance writes, SMS Review writes, notifications/toasts, scan summary.
  - Automatic save for high-confidence background parses; SMS Review for low-confidence, unknown-account, unrecognized, and other unsafe cases. Successful auto-saves keep parser provenance but not the full SMS body.
  - Manual paste-SMS fallback: dev-facing harness with raw matches/debug output, plus a simpler production fallback for users who deny SMS permission or want to test a missed SMS.
  - Owner-maintained parser registry: browse/install/update approved manifests only; installed extensions work offline; updates reprocess unresolved SMS Review Items but do not auto-edit already-saved transactions.
  - Parser reports: local review queue stays on-device; user-confirmed manual report may include sender, SMS body, manifest id/version, parse status/reason, and app version.
  - Author 10–20 seed manifests (start with simple/mid banks: Slice, JioPay, Bangkok Bank, Bank of India); use HDFC/SBI-style cases to harden the manifest pipeline primitives rather than adding built-in bank fallbacks.
- **IMPLEMENTATION MILESTONES:**
  1. Engine + manifest schema + paste-SMS harness + 2–3 bundled manifests.
  2. Android SMS Adapter + onboarding SMS permission + full historical scan + realtime receive.
  3. Owner-maintained registry browsing/install/update + integrity metadata + reversible update behavior.
- **KEY DELIVERABLES:** Engine package, manifest validator, manifest fixture runner, extension install/onboarding UI, SMS Review screen, Android SMS Adapter (`RECEIVE_SMS` + full `READ_SMS` scan), scan summary, background notifications, paste-SMS fallback, seed manifests, owner-maintained registry path.
- **SUCCESS CRITERIA:** A user can select country/provider extensions in onboarding, grant SMS permission, run a full historical scan, auto-save high-confidence transactions, review unresolved SMS, receive realtime background saves, and keep parsing offline with installed extensions.
- **DEPENDENCIES:** Phases 0–1 (writes transactions/accounts/mandates).
- **WHY NOW:** It is the USP; it must come immediately after the data substrate exists, and it de-risks the riskiest architectural bet early.

### Phase 3 — Rules Engine + Subscriptions/Mandates

- **GOAL:** Automate categorization/blocking and track recurring payments.
- **SCOPE:**
  - Rules engine: conditions DSL (8 fields × 17 operators), actions DSL (SET/APPEND/PREPEND/CLEAR/BLOCK), priority order, subcategory→parent auto-resolution, real-time apply in the ingestion pipeline, batch apply-to-past, `ruleApplications` audit log, system templates.
  - Subscriptions: E-Mandate/UPI-Mandate creation from the engine's `MandateInfo`, UMN-based dedup, ACTIVE/HIDDEN lifecycle + reactivation, standard + custom billing cycles (`custom_COUNT_UNIT_ENDDATE`), next-payment prediction, transaction→subscription matching (5% tolerance), monthly-equivalent normalization, category auto-determination.
- **KEY DELIVERABLES:** Rule engine + CreateRule UI, subscriptions screen + mandate pipeline hooked into Phase 2.
- **DEPENDENCIES:** Phase 2 (rules run during SMS processing; mandates come from the engine).
- **WHY NOW:** Both consume the parser pipeline directly; they make auto-captured data trustworthy and surface recurring spend (a behavior-change input).

### Phase 4 — Budgets + First Behavior-Change Nudges

- **GOAL:** Budgeting with per-category limits, plus the earliest proactive behavioral signals.
- **SCOPE:**
  - Budgets: periods (DAILY/WEEKLY/MONTHLY/YEARLY/CUSTOM), expense vs savings, track modes (ALL vs ADDED_ONLY), per-category limits, account scoping, real-time progress + `recommendedDailySpending`, history/trends.
  - **Behavior change (early — pillar 2 not deferred):**
    - **Budget Pacing Alerts** (loss aversion) — leverages existing `daysRemaining`/`percentUsed`.
    - **Pre-Spend Nudge** (choice architecture) — show budget impact in the Add Transaction sheet before save.
- **KEY DELIVERABLES:** Budgets list/detail/wizard, category-limit tracking, pacing-alert + pre-spend-nudge integrations.
- **DEPENDENCIES:** Phases 1 & 3 (transactions, categories; subscriptions for ADDED_ONLY logic).
- **WHY NOW:** Budgets unlock the cheapest, highest-impact nudges (pacing/pre-spend reuse budget math), proving pillar 2 mid-roadmap.

### Phase 5 — Analytics/Reports + Full Behavior-Change Pillar

- **GOAL:** Spending insight visualizations and the complete behavioral intervention set.
- **SCOPE:**
  - Analytics: spending trends (line/bar/heatmap), category breakdown, top merchants, summary card, period selection + custom range, type filtering, balance trend chart.
  - Behavior change (see §5 for full list): Category Creep Detection, Cashflow Runway, Smart Home Warnings, Weekly Ritual, Savings-Goal gain framing, Anomaly Detection, Subscription Pause Suggestions, Recurring Audit, Monthly Report Card (+ nice-to-haves: streaks, auto-adjust, impulse timer).
- **KEY DELIVERABLES:** Analytics screen, home behavior widgets, scheduled-insight jobs (weekly/monthly), small new tables (weekly_goals, monthly_report, streak_state).
- **DEPENDENCIES:** Phases 1–4 (transactions, budgets, subscriptions data).
- **WHY NOW:** Behavior features need accumulated trends/budgets; this delivers the differentiated second pillar in depth once data exists.

### Phase 6 — Multi-Currency Exchange Rates

- **GOAL:** Convert and aggregate across currencies.
- **SCOPE:** Free exchange-rate provider (fawazahmed0 currency-api, jsdelivr primary + cloudflare fallback), 3-tier cache (memory→`exchangeRates` table→API) with expiry, USD-intermediate cross-rates, base-currency config (main-account driven), auto-refresh triggers centralized in one manager.
- **KEY DELIVERABLES:** Rate provider + conversion service, currency picker, centralized refresh.
- **DEPENDENCIES:** Phases 1, 4, 5 (accounts/budgets/analytics consume conversions).
- **WHY NOW:** Conversion is cross-cutting but not blocking single-currency users; centralize after the consumers exist to avoid redundant fetches.

### Phase 7 — Webhooks / Sync / Export

- **GOAL:** Push data out and back up/restore.
- **SCOPE:** Webhook profiles + data-type selection, **cursor tracking / incremental sync** (successAt == rangeEnd invariant), payload batching (250/batch), delivery with retry + redirect handling, interval/scheduled modes, logging; CSV export; full ZIP backup/restore with FULL/MASKED/ANONYMOUS privacy levels and merge/replace import.
- **KEY DELIVERABLES:** Webhook sync manager + scheduler, export/backup/import.
- **DEPENDENCIES:** Phases 1–5 (needs the data to sync/export).
- **WHY NOW:** Power-user/portability layer; valuable but lower priority than core + behavior pillars.

### Phase 8 — `api-source` Plugins (Vetted)

- **GOAL:** Implement the second plugin type for broker/PF data via official APIs / Account Aggregator.
- **SCOPE:** `api-source` manifest interpreter, OAuth/credential flows with secrets in Keychain, allowlist/vetting registry, mapping into the same transaction pipeline; first integrations (e.g. a broker via official API, PF via AA).
- **KEY DELIVERABLES:** `api-source` engine, secure-store integration, vetting/allowlist, 1–2 reference integrations.
- **DEPENDENCIES:** Phase 2 (shared plugin/engine model), Phase 6 (multi-currency for foreign holdings).
- **WHY NOW:** Highest trust/security surface and most external dependencies; design the type early (Phase 2/3) but implement last.

---

## 5. Behavior-Change Features (Pillar 2 Detail)

From the behavior-change-design audit. Priority: **Core** = ships in Phase 4–5; **Important** = Phase 5; **Nice-to-have** = Phase 5+.

| Feature                                     | Behavioral principle                                | Data it needs                                                                                                                                     | Priority       |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Budget Pacing Alerts**                    | Loss aversion (warn before overspend)               | `BudgetWithSpending` (currentSpending, amount, daysRemaining); burn-rate projection at 50/75/90/100% thresholds, alert only if projected > amount | Core (P4)      |
| **Pre-Spend Nudge**                         | Choice architecture (consequence at decision point) | Current budget for txn category; `(currentSpending + newAmount)/amount` shown in Add sheet                                                        | Core (P4)      |
| **Category Creep Detection**                | Awareness before autopilot baseline                 | Current-month vs trailing-3-month category avg; alert if deviation > 30% AND abs diff > threshold                                                 | Core (P5)      |
| **Cashflow Runway Projection**              | Scarcity + temporal framing                         | Sum non-credit `accountBalances` (liquid); daily burn = last-30d expenses / 30; runway = balance/burn; warn < 30 days                             | Core (P5)      |
| **Smart Spend Warnings (Home)**             | Salience at habitual check-in                       | Count budgets where projected > amount AND daysRemaining > 5; surface on home                                                                     | Core (P5)      |
| **Weekly Spending Ritual**                  | Commitment device (scheduled reflection)            | Last-7d transactions grouped by category; top categories, biggest expense; new `weekly_goals` table                                               | Core (P5)      |
| **Savings Goal Progress Framing**           | Gain framing / positive reinforcement               | `budgetType = SAVINGS`; invert to "saved X of Y"; milestone table (25/50/75%)                                                                     | Important (P5) |
| **Merchant Spending Context**               | Anchoring at point-of-entry                         | `MerchantData` aggregates (avg/min/max/last visit) shown in add/detail                                                                            | Important (P5) |
| **Transaction Anomaly Detection**           | Salience (make outliers visible)                    | Compare txn amount to merchant avg (>2×) / category weekly avg (>3×); `is_anomaly` flag + home count                                              | Important (P5) |
| **Subscription Pause Suggestions**          | Inertia override (surface hidden waste)             | `subscriptions` + cross-ref transactions; flag if category unused for 2+ billing cycles; show annual waste                                        | Important (P5) |
| **Recurring Transaction Audit**             | Forcing function (quarterly re-confirm)             | `isRecurring` txns / subscriptions grouped by merchant; monthly-equivalent total; quarterly prompt                                                | Important (P5) |
| **Monthly Behavior Report Card**            | Accountability + self social-proof                  | Month-end `BudgetWithSpending` graded A–F; vs last month; 2 action items; `monthly_report` table                                                  | Important (P5) |
| **Streak Tracking (zero-spend days)**       | Gamification / consistency                          | Non-essential-category txns; consecutive zero-discretionary days; `streak_state` in prefs                                                         | Nice-to-have   |
| **Category Budget Auto-Adjust Suggestions** | Nudge toward realistic goals                        | 3-month per-category utilization; suggest reallocation if <70% vs >110%                                                                           | Nice-to-have   |
| **Impulse Delay Timer**                     | Cooling-off (disrupt hot-state)                     | Discretionary category + amount > ₹1000; 60s timer + alternative framing in Add sheet                                                             | Nice-to-have   |

---

## 6. Explicitly Out of Scope

- **Offline / on-device AI (Cashiro's chat).** No AI features. The entire `chat` package, MediaPipe/Qwen LLM inference, model download manager, `AiContextRepository` system-prompt generation, token management, and `chatMessages` UI are excluded. (The `chatMessages` table exists in the ported schema but stays unused / can be dropped in a later migration.)
- **iOS — the entire platform is out of scope for v1.** No iOS build, no iOS ingestion (paste/Share Sheet/forwarding), no cross-platform SMS abstraction work. The engine stays source-agnostic so iOS is an additive adapter later, but zero iOS effort ships in v1.
- **Android-only mechanisms deferred:** Quick Settings tiles (`AddTransactionTileService` etc.), boot-receiver semantics, and RCS/MMS parsing. (The core `RECEIVE_SMS` broadcast + `READ_SMS` historical scan ARE in scope — see Phase 2.)
- **PDF statement import** (GPay/PhonePe via PDFBox) — separate from the parser USP; not in this roadmap.
- **Sample-data management as a shipped feature** — `isSample` is a dev/seed utility only.

---

## 7. Risks & Open Questions

| Risk / Question                               | Why it matters                                                                                                                                                                                               | Mitigation / open decision                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Android SMS native module**                 | v1 reads SMS via `RECEIVE_SMS`/`READ_SMS`; needs a custom native module (not Expo Go) and Play Store SMS-permission justification (restricted permission — Play requires a declared core use case + review). | Build the native module behind the source-agnostic engine boundary; prepare the Play SMS-permission declaration early. Include a manual "paste SMS" fallback so the app works even if the permission is denied/rejected.              |
| **iOS (deferred)**                            | Out of v1 scope; revisit post-v1.                                                                                                                                                                            | Engine accepts `(sender, body)` from any source, so iOS becomes an additive ingestion adapter (paste/Share Sheet/forwarding) with no engine rework. **Open (later):** which iOS ingestion gives the lowest-friction feel.             |
| **Declarative expressiveness limits**         | Audit: ~18% of banks (HDFC 9-step merchant waterfall, SBI/AMEX `parse()` post-processing) don't reduce cleanly to regex + maps.                                                                              | Hybrid model: `fallbackToBuiltin` hook lets the engine dispatch gnarly banks to native code. **Open:** how rich should the manifest's conditional rules get before we just write a built-in?                                          |
| **`api-source` trust & security**             | Outbound calls with user credentials → exfiltration risk; this is the dangerous plugin type.                                                                                                                 | Vetted/allowlisted only (never open install); secrets in Keychain/secure-store, never DB/manifest. **Open:** who runs the vetting/allowlist, and what's the review bar?                                                               |
| **Banks changing SMS formats**                | A silent format change breaks a parser; Cashiro's fix meant an app release.                                                                                                                                  | Manifests are versioned and downloaded into the local DB — ship a fixed manifest without store review, offline after download. **Open:** detection — use `unrecognizedSms` telemetry / parse-confidence to flag drift?                |
| **Plugin registry & distribution**            | Community `sms-parser` plugins need hosting, discovery, install, update, and trust signals.                                                                                                                  | Need a registry (manifest catalog) + signing/integrity for downloaded manifests. **Open:** hosting (static CDN vs API), manifest signing, community-submission/review flow, and how `community` vs `vetted` trust is surfaced in-app. |
| **Decimal/precision**                         | Amounts are TEXT BigDecimal strings; JS floats lose precision.                                                                                                                                               | Standardize on decimal.js/big.js in Phase 0; never use raw `number` for money.                                                                                                                                                        |
| **TanStack DB ↔ Drizzle invariants at scale** | Only the todos demo exercises the optimistic layer; financial collections add cascades (transfer dual-balance, recalculate-after-edit).                                                                      | Generalize the collection factory early (Phase 0) and test rollback + balance-cascade edge cases (the audit flags `recalculateBalancesAfter` as complex).                                                                             |

---

_Files referenced (current RN port): `/Users/vijayabaskar/work/unmiser/db/schema/_`, `/Users/vijayabaskar/work/unmiser/db/relations.ts`, `/Users/vijayabaskar/work/unmiser/db/collections/todos.ts`, `/Users/vijayabaskar/work/unmiser/db/use-migrations.ts`, `/Users/vijayabaskar/work/unmiser/lib/polyfills.ts`.\*
