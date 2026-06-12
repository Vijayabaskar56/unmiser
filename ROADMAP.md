# Unmiser — Product Roadmap

> Status as of 2026-06-12. This roadmap turns the Cashiro (Android/Kotlin) audit into a sequenced plan for the React Native port. It is anchored by two non-negotiable product pillars and the owner's fixed product decisions.
>
> **Scope: v1 targets Android only. iOS is deferred to a later release.** The plugin _engine_ stays platform-agnostic (it accepts `(sender, body)` from any source), so iOS support later is an ingestion-adapter add-on — but no iOS work is in the v1 plan.

---

## 1. Vision & Product Pillars

**Pillar 1 — The Extension/Plugin Layer (the USP).** Cashiro's value lives in its 98 bank-specific SMS parsers across 14+ countries — but as 98 hand-written Kotlin classes that ship inside the app, that approach does not scale and ties every bank fix to an app-store release. Unmiser replaces that with a **typed, declarative plugin layer**: a single interpreter engine runs downloadable data manifests (regex + field maps), and users install only the few bank parsers they actually need (a 2-bank user installs 2 plugins, not 98). New banks and format fixes ship as manifest updates into the local DB — no store review, working offline after download. This is the differentiator and the first priority after foundations.

**Pillar 2 — Behavior Change.** The audit's harshest finding is that Cashiro has excellent _visualization_ but almost no _behavioral intervention_: the only proactive signal it ships is `recommendedDailySpending`. Unmiser treats behavior change as a first-class pillar, not a reporting afterthought. The app must interrupt harmful patterns _before/during_ spending moments (pre-spend nudges, budget-pacing alerts, cashflow runway, anomaly detection) and reinforce positive habits (weekly ritual, savings-goal gain framing, monthly report card) using established behavioral principles — loss aversion, choice architecture, salience, commitment devices, gain framing.

---

## 2. Where We Are Now

The RN port (Expo SDK 56, Drizzle ORM 1.0-rc, TanStack DB 0.6.5, React 19, RN 0.85.3, TypeScript 6, Bun) has **Phases 0–3 done** — foundations, the manual tracker, the full SMS-parser plugin layer (the USP), and the rules/subscriptions automation layer. Phase 4 onward is unstarted.

| Phase                               | State   | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 0 — Foundations**           | ✅ Done | Full 1:1 Drizzle port of Android Room v51 (`db/schema/*`), relations (`db/relations.ts`), bundled migrations (`useMigrations`, dev-only auto-reset), generalized TanStack DB collection factory + per-table collections, balance-cascade service, money/date helpers, `isSample` utility. Crypto polyfill (`lib/polyfills.ts`) for `randomUUID`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Phase 1 — Manual tracker**        | ✅ Done | Categories/subcategories CRUD, accounts/cards CRUD (card↔account linking, default Cash wallet, main-account), account balance time-series + recalculate-after-edit cascade, transactions (add/edit/transfer/soft-delete + undo, per-txn currency, search/filter/bulk select). expo-router drawer+tabs, theme system (heroui-native + uniwind), Drizzle Studio dev plugin. 152 tests.                                                                                                                                                                                                                                                                                                                                                             |
| **Phase 2 — SMS-parser USP**        | ✅ Done | Engine (worklet-safe core), manifest schema/validation, fixtures, extension storage, Android Nitro SMS module (+ native coarse pre-screen), registry (jsDelivr catalog + checksum install + update model), onboarding wizard, off-thread worklet scan with checkpoint/resume, ADR-0006 auto-create, paste-SMS production fallback, 12 bundled manifests via store allowlist. Device-verified 2026-06-12 on a real ~5.3k inbox: 161 SMS transactions auto-saved, 92 open review rows (exit criterion: low hundreds ✅), worklet runtime confirmed (no JS-thread fallback).                                                                                                                                                                        |
| **Phase 3 — Rules + subscriptions** | ✅ Done | Rules DSL/interpreter + audit log, system rule templates, rule-pack install path, transaction automation pipeline (merchant mapping → rules → save → audit → subscription matching), `BLOCKED_BY_RULE` and `MANDATE_PARSE_FAILED` SMS Review paths, HDFC e-mandate parsing, mandate-sourced subscriptions with UMN/fallback dedup, transaction→subscription matching, manual recurring link, Rules and Subscriptions tabs. Device-verified 2026-06-12: mandate create/dedup/failure, Swiggy rule audit, BLOCK review with rule identity, apply-to-past audit, subscription payment link, hide/reactivate, full scan completion with 166 transactions / 4 subscriptions / 96 open review rows, and no worklet runtime/fallback errors. 316 tests. |

**Not built:** Phase 4+ — no budgets, no behavior-change features, no analytics/reports, no exchange rates, no webhooks/sync/export, no `api-source` plugins. Phase 2 nice-to-haves deferred: realtime `RECEIVE_SMS` end-to-end device test (wiring verified; needs a real incoming SMS), on-device update-apply with a real version bump (unit-tested e2e), manifest signing (checksum-only in v1; catalog `signature` field reserved). Phase 3 recurring-pattern mining remains intentionally deferred to Phase 5.

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

| Phase | Goal (one line)                                                       | Status         |
| ----- | --------------------------------------------------------------------- | -------------- |
| **0** | Foundations & data primitives                                         | ✅ Done        |
| **1** | Core data UI: categories (+seed), accounts/cards, manual transactions | ✅ Done        |
| **2** | **The `sms-parser` plugin engine + ingestion (the USP)**              | ✅ Done        |
| **3** | Rules engine + subscriptions/mandates                                 | ✅ Done        |
| **4** | Budgets + first behavior-change nudges                                | ⬜ Not started |
| **5** | Analytics/reports + full behavior-change pillar                       | ⬜ Not started |
| **6** | Multi-currency exchange rates                                         | ⬜ Not started |
| **7** | Webhooks / sync / export                                              | ⬜ Not started |
| **8** | `api-source` plugins (vetted)                                         | ⬜ Not started |

### Phase 0 — Foundations & Data Primitives ✅ Done

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

### Phase 1 — Categories, Accounts & Manual Transactions ✅ Done

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

### Phase 2 — The `sms-parser` Plugin Engine (USP) ✅ Done

- **STATUS (device-verified 2026-06-12):** All three milestones complete. Real-inbox verification on I2223 (~5.3k messages): wizard first-run gate → live-catalog country/provider selection → registry install with checksum verify (`in.boi.bank`, trust=registry, sha256 matches catalog) → permission flow → off-thread worklet scan (no JS-thread fallback; UI responsive throughout) with checkpoint **resume** mid-inbox → **161 SMS transactions auto-saved**, 4 accounts auto-created per ADR-0006 (incl. credit-card detection), **92 open review rows (exit criterion "low hundreds" ✅)** → update check against live catalog → production paste sheet saves against the auto-created account. One on-device bug found+fixed during verification: worklet-marked functions are NOT hoisted (closure capture at definition point), so `lib/parser/engine.ts` is now in strict topological order — see the in-file warning comment. Per-deliverable:
  - ✅ **Interpreter engine** — dispatch, filter, named-capture extraction, classification, cleaning, card-vs-account, dedup hash, confidence/reasons, mandate emit. `lib/parser/engine.ts` (344 LOC), `types.ts`, `sms-filter.ts` (ADR-0015 capture gate), `lib/dedup-hash.ts`.
  - ✅ **Manifest schema + validation** — Zod schema + generated JSON Schema + declarative pipeline primitives (`rejectWhen`, `extractFieldWhen`, `setFieldWhen`, `fallbackField`, `confidenceWhen`). `lib/parser/manifest-schema.ts`, `manifest.schema.json`, `scripts/{generate-manifest-schema,validate-manifest}.ts`.
  - ✅ **Fixtures + fixture runner** — `lib/parser/fixtures.ts`; 18 fixtures across the 5 bundled manifests run through the real engine.
  - ✅ **Extension storage + CRUD** — `plugins`/`plugin_assets` tables (`db/schema/sms.ts`), TanStack DB collections (`db/collections/extensions.ts`), install/update/enable/disable (`db/services/extensions.ts`).
  - ✅ **Android SMS adapter** — Nitro module (`packages/react-native-cashrio-sms/`): `RECEIVE_SMS` realtime (multipart), `READ_SMS` historical scan with pagination, permission flow, notifications. JS wrapper `lib/android-sms-adapter.ts`.
  - ✅ **Parser orchestration** — `db/services/sms-processing.ts` (266 LOC, 23 tests): batching, dedup-before-save, last4 resolution (`lib/account-resolver.ts`), transaction + `SMS_BALANCE` + review writes, notifications, scan summary. (Cancel is a basic ref-flag, not full async task mgmt.)
  - ✅ **Auto-save / SMS Review split** — HIGH confidence auto-saves; REVIEW/REJECTED/NO_PARSER captured in `unrecognizedSms` with status + reason.
  - ✅ **Manual paste-SMS harness** — `app/(tabs)/extensions.tsx`, runs the same `processSms()` path.
  - ✅ **SMS Setup Onboarding** — guided wizard `app/(onboarding)/sms-setup/` (country → providers from live catalog → optional account enrichment → per-permission degradation → scan with resume), first-run gate on `smsSetupCompletedAt` (ADR-0005 KV), re-runnable from the Store tab; the dev harness stays on `app/(tabs)/extensions.tsx`.
  - ✅ **Owner-maintained registry** — `lib/registry/` (jsDelivr catalog fetch, checksum-verified install, trust-by-install-source, 24h-throttled update check, reprocess-review-queue-on-update), Store tab browse/search/install/update UI; CI catalog pipeline live in `unmiser-extensions` (`index.json`, 99 entries).
  - ✅ **Seed manifests (12 bundled + 99 in store)** — `scripts/sync-bundled-manifests.ts` allowlist pulls byte-identical files from the store: HDFC, IOB, SBI, JioPay, Slice, ICICI, Axis, Kotak, PNB, BoB, Airtel Payments Bank, CRED. Other 87 install on demand from the registry.
  - ✅ **Scan hardening** — `lib/scan/`: singleton observable scan task, dedicated `createWorkletRuntime` executor (chunked RN-thread fallback retained as a guarded escape hatch), native Kotlin coarse pre-screen (manifest-independent, drops ~95% pre-bridge), KV checkpoint with resume, `AbortController` cancel.
- **DECIDED DESIGN (grilling 2026-06-11; all shipped as decided).** Four workstreams; kept as the design record. Exit criterion at the end — met on device 2026-06-12.

  **A. Owner-maintained registry (jsDelivr + catalog).**
  - **Distribution:** the existing `unmiser-extensions` GitHub repo (99 manifests) is the registry. The app reads it over **jsDelivr CDN**, not GitHub raw (CDN caching, no rate limits, immutable `@<commit>` pinning).
  - **Catalog:** a CI step in `unmiser-extensions` generates `index.json` on every push to `main` — one entry per bank (`pluginId`, `name`, `country`, `currency`, `version`, `sha256`, byte size). The app fetches `index.json` to populate the browse list, then fetches `manifests/<bank>.json` only on install. Browse needs network; installed extensions cache to the DB and work offline after download.
  - **Integrity:** **SHA-256 checksum only for v1.** CI puts `sha256` per manifest in the catalog; on install/update the app re-hashes the body, rejects on mismatch, stores the verified hash in `plugin_assets.checksum`. **Signing deferred** — reserve a catalog `signature` field + keep the DB column; implement when community submissions or `api-source` arrive.
  - **Trust by install source, not manifest field:** the install path sets the DB `trust` value (`bundled` when installed from `bundledParserBundles`, `registry` when fetched). The manifest's own `trust` field is non-authoritative. In-app copy is provenance, not a scare badge ("Built-in" vs "Installed from store"); both are owner-authored + fixture-validated. `community`/`vetted` stay reserved enum values (third-party submissions; `api-source`).
  - **Update model:** keep **both** `plugin_assets` rows on a version bump; `plugins.version` is the single active-version pointer, and **every load joins `plugin_assets` on `(pluginId, version)`** — this fixes the handoff bug where a version bump loaded both versions and double-dispatched. Rollback = flip the pointer (no re-download); prune to last 2 lazily. **Detection is pull-based:** on app foreground (throttled ≤ once/24h) + a manual "Check for updates" tap, diff catalog `version` vs installed; surface "Updates available (N)"; **never auto-apply.** **Reprocess-on-update:** updating re-runs only the **open review queue** (`unrecognized_sms` where `pluginId` matches and `resolvedAt is null`) through the new manifest; it **never** edits already-saved `transactions` (they keep their `sourcePluginVersion` stamp). This is why saved transactions don't retain the raw SMS body — only the review queue does.

  **B. Guided onboarding wizard.**
  - Dedicated route group `app/(onboarding)/sms-setup/`, both a **first-run gate** (prefs flag `smsSetupCompletedAt`, ADR-0005 KV; Android-only; skippable "set up later") and **re-runnable** from Settings → "SMS & Extensions." Steps are idempotent.
  - **Keep `app/(tabs)/extensions.tsx` as the power-user/management surface** (toggles, review queue, dev paste harness). The wizard is the guided path; the tab is the management path.
  - **Account step is optional enrichment, not a gate** — per **ADR-0006 auto-create**. Flip `sms-processing.ts` to auto-create accounts on confident parses (fixes the current ADR/implementation drift that produced the 910 stale `ACCOUNT_RESOLUTION_REQUIRED` rows); the wizard step only adds display name / icon / opening balance. `ACCOUNT_RESOLUTION_REQUIRED` shrinks to genuinely-ambiguous suffix matches (the `resolveAccountLast4` "many" case).
  - **Permission is a soft enhancement, never a dead end.** Deny → wizard completes and promotes a clean production **"Add from SMS" paste sheet** (parse → confirm); the dev raw-matches harness stays `__DEV__`-gated. `READ_SMS` / `RECEIVE_SMS` degrade independently (scan without realtime, or vice versa). The "Play rejects the restricted permission entirely → no-SMS build variant" scenario is **deferred** until Play review actually forces it.

  **C. Default-bundled manifest set (offline cold-start, not coverage).** With A in place, bundling is only about the zero-network first parse. Ship **~10–12 reach-selected** manifests (India majors — HDFC, SBI, ICICI, Axis, Kotak, PNB, BoB — + dominant UPI/PPI wallets + the current HDFC/IOB/SBI/JioPay/Slice). The other ~87 stay registry-only. **Bundled files are the same files as the store**, copied by a build-time allowlist that pulls from `unmiser-extensions` (no fork/drift); Q4's foreground update flow catches a bundled-vs-store version gap.

  **D. Harden the scan — native-driven, off-thread, foreground-only.** Replace the inline `while`/`cancelScanRef` loop in `extensions.tsx`:
  - **Threading:** Nitro reads SMS pages off-thread; the **unchanged TS engine runs on a dedicated background worklet runtime (`createWorkletRuntime` — NOT the UI runtime, which is the UI thread)**; results post back to the RN runtime via `scheduleOnRN` for batched DB writes. RN JS thread + UI thread both stay clear. Foreground-only — no app-closed/WorkManager execution in v1 (realtime `RECEIVE_SMS` already covers closed-app capture for new messages). _Spike risk:_ `js-md5` + `decimal.js` aren't worklet-marked — dedup hash / amount normalization may need to run RN-side or be reimplemented as worklets.
  - **Native coarse pre-screen:** the Nitro module applies the **manifest-independent** ADR-0015 gate (`shouldCaptureUnrecognizedSms`-style sender-shape + "money moved" heuristic) to drop the obvious 80–90% before anything crosses into the worklet. It must **not** evaluate manifest dispatch/filter regexes (that stays the one TS engine's authority — no Kotlin fork of manifest semantics).
  - **State + cancel:** a singleton **scan-task store** (`{ phase, processed, total, saved, review, running, cancel() }`) that both the wizard's final step and the Extensions tab observe; cancel via `AbortController`. **Checkpoint the cursor** (last processed timestamp/offset) to the KV table each page so an OS-killed scan **resumes** ("Resume scan 4,000/5,300") rather than restarting; dedup makes restart safe, checkpoint makes it fast.

  **EXIT CRITERION:** a real ~5k-message inbox scan auto-saves high-confidence transactions and leaves the review queue in the **low hundreds, not thousands** (the handoff's 4k+ `UNRECOGNIZED` noise is resolved-by-consequence via auto-create + native pre-screen + the ADR-0015 gate — no separate noise-aging mechanism). Engine stays the single TS source of truth; the worklet runs the same code the fixtures validate.

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

### Phase 3 — Rules Engine + Subscriptions/Mandates ✅ Done

- **GOAL:** Automate categorization/blocking and track recurring payments.
- **STATUS (device-verified 2026-06-12):** Phase 3 is complete. Combined gates passed:
  `bunx tsc --noEmit`, `bun run test` (316 tests), `bun run check`, and store-repo
  `bun run validate` (`OK: 99 bundles, 668 fixtures, 0 failures`). On I2223
  (`com.vijayabaskar56.unmiser`), the Phase 3 UAT path and DB pulls proved mandate creation,
  UMN dedup, malformed mandate review, rule application/audit, BLOCK review, apply-to-past,
  subscription payment matching, and hide/reactivate. Latest device evidence after the scan:
  `transactions=166`, `subscriptions=4`, open SMS Review rows `96`, latest linked payment
  `MATCHMEUAT-175011` with `subscriptionId=4` and `isRecurring=1`, latest BLOCK review includes
  `blockedRuleId=uat-block-test-block`, and `/tmp/unmiser-dev.log` had no
  `undefined is not a function`, `Property ... doesn't exist`, scan fallback, or migration errors.
- **EXECUTION PLAN:** `docs/phase-3-plan.md` — self-contained handoff for the executing agent
  (workstreams + file ownership, tooling/skills, gates, on-device verification protocol, traps).
- **DECIDED (grilling 2026-06-12):**
  1. **Mandate emit is a Phase-2 leftover that Phase 3 builds first.** The engine has NO `MandateInfo` / manifest `mandate` block today, and bundled manifests' `excludeKeywords` ("e-mandate!", "will be debited") filter-reject mandate SMS before any mandate logic could see them. Therefore: mandate detection runs **after dispatch, before filter** in `parsePreparedSms` (worklet-safe regexes; `detectKeyword` gate then mandate extractors), date normalization (`dateFormat` → ISO) runs **RN-side** post-parse (the `attachTransactionHash` pattern). Cross-repo work: zod manifest schema + `manifest.schema.json` regen in the app AND vendored engine/schema sync in `unmiser-extensions`; every manifest gaining a `mandate` block needs a mandate fixture, plus a pre-screen/triage fixture proving mandate SMS survive the native gate and scan triage.
  2. **Unparseable mandate → SMS Review**, new reason `MANDATE_PARSE_FAILED` (detect keyword hit but amount/date/UMN extraction failed). Never silently dropped — a mandate the user never sees is a subscription they don't know exists, and review-reprocess-on-manifest-update can rescue these later.
  3. **Automatic recurring-pattern mining is deferred to Phase 5** (it needs months of accumulated data to beat noise; P3 users have weeks). Phase 3 ships the **Subscription Review surface** + manual "mark as recurring → create/link subscription"; mandate-sourced subscriptions are the high-precision P3 path. Mining slots into the existing review surface in Phase 5 without rework.
- **SCOPE:**
  - One common milestone: rules, rule extensions, subscriptions, and mandates ship together because they share the same transaction automation pipeline. (Automatic recurring-pattern suggestions: deferred to Phase 5 — see DECIDED #3.)
  - Transaction automation pipeline: parser/default category hints → learned merchant mapping → active rules by priority → save → `ruleApplications` audit log → subscription/mandate effects. The same pipeline runs before every commit path: manual save, paste-SMS save, historical scan, realtime SMS listener, apply-to-past, and later import paths.
  - Rules engine: conditions DSL (inspect amount, merchant, category/subcategory, account/bank, type, currency, description, source/provenance, SMS sender, date/time parts, recurring flag, billing cycle), actions DSL (SET/APPEND/PREPEND/CLEAR/BLOCK), priority order where later rules may override earlier non-blocking fields, subcategory→parent auto-resolution, incompatible-category clears subcategory, batch apply-to-past with preview, `ruleApplications` audit log storing changed field before/after/action type, and system templates.
  - v1 rule-action limits: rules may mutate categorization/presentation fields (`categoryId`, `subcategoryId`, merchant name, description, recurring flag, billing cycle, optionally account), but not amount, currency, datetime, transaction type, transaction hash, source provenance, or balance fields. Type corrections remain human edits or parser/manifest fixes.
  - Blocking semantics: `BLOCK` prevents save. Manual entry shows immediate feedback; automated sources create an SMS Review item with `BLOCKED_BY_RULE`, rule identity, and parsed preview so the user can inspect, override, edit the rule, or delete the item.
  - Rule Builder UI: flat condition rows, action rows, priority, active toggle, and preview match count. No raw JSON editing or nested condition groups in v1. Manual entry previews rule effects before save; explicit user edits override conflicting rule actions for that transaction only.
  - Rule Extensions: `type = "rule"` extension manifests using the same registry/storage/checksum/version/offline model as parser extensions. They contain inactive rule templates only; installing a pack does not activate rules. Users enable individual rules or duplicate them into user-owned rules. Updates do not mutate customized/active user rules. Blocking rules from packs require explicit per-rule enablement and cannot be activated silently by "enable all."
  - Subscriptions: E-Mandate/UPI-Mandate creation from the engine's `MandateInfo`, UMN-based dedup, fallback identity when UMN is missing (normalized merchant + amount + currency + provider/bank + billing cycle when available), ACTIVE/HIDDEN lifecycle, new-mandate reactivation, standard + custom billing cycles stored in existing `billingCycle` text with helpers hiding the raw encoding, next-payment prediction, transaction→subscription matching (5% tolerance + date/merchant/provider plausibility), monthly-equivalent normalization, and category auto-determination from final matched transaction → merchant mapping → system Subscriptions category.
  - Subscription creation paths: mandate SMS creates/updates a subscription only, never a transaction; users can create subscriptions manually; users can mark any transaction as recurring to create/link a subscription. (Automatic bundling of similar recurring transactions into a suggestion: Phase 5.)
  - Subscription review: ambiguous recurring-pattern suggestions and ambiguous transaction matches live in the Subscriptions screen, not SMS Review. A direct transaction→subscription link is added in v1 because one payment belongs to at most one subscription.
  - Subscription UI/lifecycle: hide, not hard-delete, mandate-sourced or transaction-linked subscriptions; allow hard delete only for manually created subscriptions with no linked transactions. Show next-30-days upcoming payments by default plus a full list. In-app badges/sections only; notification behavior is deferred to Phase 4/5.
- **KEY DELIVERABLES:** Engine `mandate` block + `MandateInfo` emit (incl. store-repo schema sync), rule engine + Rule Builder UI, rule-extension install/update flow, transaction automation pipeline integration (manual + paste + scan + realtime + apply-to-past), SMS Review handling for `BLOCKED_BY_RULE` and `MANDATE_PARSE_FAILED`, subscriptions screen with review/upcoming sections, transaction↔subscription matching + manual recurring linking.
- **DEPENDENCIES:** Phase 2 (rules run during SMS processing; mandates come from the engine).
- **SUCCESS CRITERIA:** A real or seeded dataset can install a rule extension, create/edit a user rule, preview/apply it to past non-deleted transactions, run rules during manual and SMS saves, block automated saves into SMS Review, create subscriptions from mandate info/manual/recurring transaction flows, match payments to subscriptions, and show upcoming payments plus subscription review.
- **TEST COVERAGE:** Unit tests for rule DSL validation/evaluation, subscription identity/matching/cycle helpers; service tests for pipeline order, rule audit logs, blocking behavior, apply-to-past; at least one integration test from parsed SMS → rules → save → subscription match.
- **EXPECTED SCHEMA CHANGES:** Minimal: likely `transactions.subscriptionId`, SMS review reason/status support for `BLOCKED_BY_RULE`, and any small rule-template provenance fields needed for Rule Extensions. Billing cycle normalization is explicitly deferred.
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
