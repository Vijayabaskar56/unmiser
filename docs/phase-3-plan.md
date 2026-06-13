# Phase 3 Execution Plan — Rules Engine + Subscriptions/Mandates

> Self-contained handoff for the executing agent. Written 2026-06-12 after the Phase 3 design
> grilling. Decisions are LOCKED — do not re-litigate; if reality contradicts a decision, stop and
> surface it instead of silently deviating.

## 0. Required reading (in this order, before any code)

1. `docs/phase-3-design-record.md` — the spec (extracted from `ROADMAP.md` in the 2026-06-13
   cleanup). The **DECIDED** block (grilling 2026-06-12) and every SCOPE bullet are binding.
2. `CONTEXT.md` → "Language" section — binding domain vocabulary: _Transaction Automation
   Pipeline_, _Blocked Automated Transaction_, _Apply-to-Past_, _Rule Application_, _Rule
   Extension_, _Rule Builder_, _Mandate-Sourced Subscription_, _Fallback Subscription Identity_,
   _Recurring Pattern Suggestion_ (DEFERRED to P5), _Subscription Review_, _Upcoming Subscription
   Payment_.
3. `docs/adr/0013-rules-dsl-json-text-valibot.md` — DSL storage/validation decisions.
4. `docs/adr/0012-merchant-cleaning-and-learned-mapping-precedence.md` — categorization
   precedence: **rules > learned merchantMapping > parser default**.
5. `docs/adr/0014-subscriptions-umn-dedup-lifecycle.md` — UMN dedup, ACTIVE/HIDDEN, 5% matching.
   (Its "open question" on no-UMN fallback identity is RESOLVED by CONTEXT.md _Fallback
   Subscription Identity_: normalized merchant + normalized amount + currency + provider/bank +
   billing cycle when available.)
6. `docs/phase-2-handoff.md` — operational gotchas you WILL hit (worklet ordering, test runner,
   rebuild triggers, pre-screen aggressiveness, run-as DB pulls).
7. Original Kotlin (behavioral spec — port semantics, not code):
   - `/Users/vijayabaskar/work/references/Cashiro/app/src/main/java/com/ritesh/cashiro/domain/model/rule/`
     — `RuleCondition.kt`, `RuleAction.kt`, `TransactionRule.kt`, `RuleApplication.kt` (the 8
     fields × 17 operators × 5 actions enums — port **verbatim** per ADR-0013).
   - `.../presentation/ui/features/settings/rules/` — `RulesViewModel.kt`, `CreateRuleScreen.kt`
     (evaluation + apply-to-past behavior).
   - `.../data/` + `.../domain/` for subscriptions: search `Subscription`, `parseEMandateSubscription`,
     UMN handling in `parser-core/src/main/.../bank/` (e.g. `HDFCBankParser.kt` mandate parsing).
   - Read `src/`, never `bin/` or `build/`.

## 1. Skills & tooling the executing agent must use

| Need                               | Tool/skill                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cashiro/Kotlin source research     | `btca` skill                                                                                              | Searches `/Users/vijayabaskar/work/references`                                                                                                                                                                                                                                                                                                                                        |
| TanStack DB work (new collections) | `bunx @tanstack/intent@latest list` then `load @tanstack/db#db-core/<skill>`                              | MANDATORY per CLAUDE.md before touching collections; source of truth for installed version                                                                                                                                                                                                                                                                                            |
| Dev server / Metro logs            | `orca-cli` skill                                                                                          | Dev terminal handle was `term_f9532500-18f5-4d7d-a0cd-b79edd8fcb6f` (re-discover via `orca terminal list --json`, filter `worktreePath` containing `unmiser`). Logs tee to `/tmp/unmiser-dev.log`. **Never start a second dev server** — tmux session `unmiser` owns it. Restart = send Ctrl-C (`--text "$(printf '\003')"`) then re-send the build command via `orca terminal send`. |
| Device interaction                 | `agent-device` CLI (router skill: run `agent-device help workflow` first; also `help react-native`)       | Device I2223, Android serial `10BE1B0AMP000JZ`, package `com.vijayabaskar56.unmiser`. Loop: `snapshot -i` → `press @eN` / `fill` → re-snapshot. JS-only reload: `agent-device metro reload`.                                                                                                                                                                                          |
| Device DB inspection               | `adb exec-out run-as com.vijayabaskar56.unmiser cat files/SQLite/unmiser.db > /tmp/dev.db` then `sqlite3` | The proof layer for every device verification step                                                                                                                                                                                                                                                                                                                                    |
| Multi-agent build (optional)       | Workflow tool, parallel agents with **disjoint owned-file lists**                                         | This is how Phase 2 was built; single-agent sequential is also fine — follow §3 order                                                                                                                                                                                                                                                                                                 |
| TDD discipline                     | `superpowers:test-driven-development` / `tdd` skill                                                       | The rules interpreter and subscription matching are pure-logic — write tests first                                                                                                                                                                                                                                                                                                    |

**Test runner: `bun run test` (vitest). NEVER `bun test`** — Bun's runner can't dlopen
better-sqlite3 and fails the DB suites spuriously. Gates: `bunx tsc --noEmit`, `bun run test`,
`bun run check` (oxlint + oxfmt). Commits trigger lint-staged automatically.

**Repo hygiene:** do NOT commit `assets/illustractions/*` or `unmiser Wireframes.html` (user's
untracked design files). Store repo (`/Users/vijayabaskar/work/unmiser-extensions`) pushes to
GitHub `main` → jsDelivr serves it live; only push when the registry needs the change.

## 2. Critical invariants (violating these caused real Phase-2 bugs)

1. **Worklet functions are NOT hoisted.** Every `"worklet"`-directive function in
   `lib/parser/engine.ts` must be defined BEFORE any worklet that calls it (closure capture
   happens at definition point). Violation = on-device-only crash (`undefined is not a function`
   / `Property 'X' doesn't exist`), invisible to vitest and tsc. The file carries an in-file
   warning comment; new mandate code MUST slot into the topological order (leaf worklets →
   mid-tier → parse cores).
2. **Engine split:** `prepareManifests` (zod, RN-side, once per run) → `parsePreparedSms*`
   (worklet-safe core, regex-only) → RN-side post-parse (`attachTransactionHash` pattern). Date
   parsing (date-fns) and any non-worklet lib stay RN-side.
3. **Native rebuild triggers:** changes to `packages/react-native-cashrio-sms/src/specs/*` (run
   nitrogen), any `.kt`, or babel config ⇒ full `bunx expo prebuild --clean --platform android &&
bunx expo run:android` via the orca dev terminal (~3 min). JS-only ⇒ `agent-device metro
reload` (~10 s). Phase 3 is JS-only UNLESS `SmsPreScreen.kt` needs a keyword change (see W1).
4. **Singleton resources:** one device, one dev server, one Gradle. All device/build steps are
   serial.
5. **Manifests are owned by the store repo.** Never hand-edit `lib/parser/manifests/*.json`; edit
   in `unmiser-extensions/manifests/`, then `bun run sync:manifests`. Schema changes must update
   BOTH repos (app `lib/parser/manifest-schema.ts` + regenerated `manifest.schema.json` via
   `scripts/generate-manifest-schema.ts`, and the store's vendored `src/` engine + its
   `manifest.schema.json` + `bun run validate` green there).

## 3. Workstreams (dependency order; disjoint file ownership for parallel execution)

### W1 — Engine `mandate` block + `MandateInfo` emit (cross-repo; no dependencies)

**Owned files:** `lib/parser/engine.ts`, `lib/parser/types.ts`, `lib/parser/manifest-schema.ts`,
`lib/parser/manifest.schema.json` (generated), `lib/parser/fixtures.ts` (if fixture schema grows
a mandate expectation), engine tests; store repo: `src/*` (vendored engine sync),
`manifest.schema.json`, `manifests/hdfc-bank.json` (+ any manifest gaining a `mandate` block);
app: `scripts/sync-bundled-manifests.ts` re-run output.

**Spec:**

- Add optional `mandate` block to the manifest zod schema (now implemented in
  `lib/parser/manifest-schema.ts`; `docs/plugin-architecture.md` §3.2 lists the block shape):
  `{ detectKeyword, amount, date, merchant, umn, dateFormat }` (regexes with `(?<value>…)` named
  captures; `umn` optional — some banks have none).
- `parsePreparedSms` ordering (THE trap): **after dispatch, BEFORE the filter**, if
  `manifest.mandate` exists and body contains `detectKeyword` (case-insensitive), run the mandate
  extractors and return a result carrying `mandateRaw` (string fields + the raw matched date
  string). Reason: bundled `excludeKeywords` ("e-mandate!", "will be debited") deliberately
  filter-reject mandate SMS — mandate detection must win first. Keep it worklet-safe (regex
  only); slot helpers into topological order.
- RN-side post-parse (`attachMandateInfo`, sibling of `attachTransactionHash`): parse
  `mandateRaw.date` with `dateFormat` (date-fns) → ISO `nextDeductionDate`; normalize amount
  (strip commas); produce `result.mandate: MandateInfo { amount, nextDeductionDate, merchant,
umn?, currency, pluginId }`. If `detectKeyword` hit but amount or date extraction failed →
  `result.mandateParseFailed = true` with reasons.
- Result-shape suggestion: `confidence` stays as-is; add `mandate?: MandateInfo` and a reason
  `MANDATE_DETECTED` so downstream can branch without a new confidence tier. Don't break existing
  fixtures.
- **Pre-screen/triage passage:** add parity fixtures to `lib/scan/pre-screen-parity.test.ts`
  proving a mandate body passes `shouldCaptureUnrecognizedSms` (TS) — if the heuristic's
  required-keywords list would drop "will be deducted" bodies, extend the TS heuristic AND the
  Kotlin mirror `packages/react-native-cashrio-sms/.../SmsPreScreen.kt` identically (this is the
  one thing that forces a native rebuild — flag it loudly). Also `lib/scan/triage.ts`: a
  mandate-carrying result must return `"persist"`.
- **Fixtures:** add ≥2 mandate fixtures to `hdfc-bank.json` in the STORE repo (source bodies from
  Cashiro's `HDFCBankParserTest.kt` e-mandate cases, anonymized), with expected mandate fields in
  the fixture schema; run store `bun run validate` + app `bun run sync:manifests` + engine tests.

**Acceptance:** engine tests cover detect/extract/fail paths; all existing 18+ fixtures still
pass; store repo validate green; pre-screen parity test includes a mandate body.

### W2 — Rules DSL + interpreter + CRUD + audit (no dependencies)

**Owned files:** `lib/rules/` (new: `types.ts`, `dsl.ts` valibot schemas, `interpreter.ts`,
tests), `db/services/rule-ops.ts` (+test), `db/collections/rules.ts` (new), seed additions for
system templates (`db/services/seed.ts` pattern — follow ADR-0004 static-seed; templates ship
`isActive=false`, `isSystemTemplate=true`).

**Spec:**

- Port Cashiro's `RuleCondition.kt`/`RuleAction.kt` enums **verbatim** (8 `TransactionField`s,
  ~17 `ConditionOperator`s, 5 `ActionType`s: SET/APPEND/PREPEND/CLEAR/BLOCK). valibot schemas
  (valibot is installed; it is the project-standard validator per ADR-0013 — NOT zod here).
  `conditions`/`actions` serialize to JSON strings into the existing `transaction_rules` columns
  (`id` is TEXT caller-supplied — use `crypto.randomUUID()`, polyfilled).
- Interpreter (pure function, no DB): `evaluateRules(rules, txnDraft) → { blocked?: {ruleId,
ruleName}, mutations: FieldChange[], applications: PerRuleChanges[] }`. Conditions: flat list
  with per-condition `logicalOperator` AND/OR (match Cashiro's evaluation exactly — check
  `RulesViewModel.kt`/repository for whether it's left-fold or AND-groups; port that). Actions in
  priority order; later rules may override earlier non-blocking fields; **BLOCK short-circuits**.
  Subcategory SET auto-resolves+sets parent category; category SET incompatible with current
  subcategory clears the subcategory.
- **v1 action-field allowlist** (ROADMAP): categoryId, subcategoryId, merchant name, description,
  recurring flag, billing cycle, optionally account. NEVER: amount, currency, datetime, type,
  hash, provenance, balances. Enforce in the valibot schema, not just UI.
- `ruleApplications` audit: one row per rule that **effectively changed** something
  (before/after per field in `fieldsModified` JSON); no-op match → no row.
- CRUD service + TanStack DB collection (load `@tanstack/intent` skills first; follow
  `db/collections/extensions.ts` queryFn pattern).

**Acceptance:** TDD — interpreter spec'd by tests first; operator matrix covered (at minimum one
test per operator); BLOCK short-circuit, priority override, subcategory→parent, incompatible
clear, audit no-op all tested. Aim ~40+ tests here.

### W3 — Transaction Automation Pipeline integration (depends on W1 + W2)

**Owned files:** `db/services/automation-pipeline.ts` (new), `db/services/sms-processing.ts`,
`db/services/transaction-ops.ts` (touch minimally — wrap, don't rewrite), `db/schema/enums.ts`
(review reasons/statuses), `db/services/apply-to-past.ts` (new, +test).

**Spec:**

- One function every commit path funnels through (CONTEXT _Transaction Automation Pipeline_):
  parser/default category hints → learned merchantMapping (`db/services/merchant-mapping.ts`,
  precedence per ADR-0012) → active rules by priority → save → audit rows → subscription/mandate
  effects (call into W4). Commit paths: manual add/edit, paste-SMS, historical scan, realtime
  listener (all four SMS paths already converge on `processSms` → `addTransaction`; manual path
  is `transaction-ops.addTransaction` callers — wrap at the right chokepoint so it's impossible
  to save without the pipeline).
- **BLOCK:** automated sources → `unrecognized_sms` review row with new reason `BLOCKED_BY_RULE`
  (+ store rule id/name in the existing `parsedFieldsJson`/a new column — prefer JSON to avoid
  migration), status: add `BLOCKED` to `SMS_REVIEW_STATUSES` or reuse `REJECTED` — prefer a new
  status so the review UI can group it. Manual entry → immediate UI feedback (return a typed
  `blocked` outcome; U1 renders it). Blocked = stops save BEFORE subscription matching.
- Add review reasons: `BLOCKED_BY_RULE`, `MANDATE_PARSE_FAILED` (enums are type-level only — no
  SQL migration needed, columns are plain TEXT).
- **Mandate branch in `processSms`:** `result.mandate` → W4 upsert, return new outcome kind
  `{ kind: "mandate", subscriptionId }` — never a transaction. `result.mandateParseFailed` →
  review row `MANDATE_PARSE_FAILED`. Update the scan-summary counters and `lib/scan/triage.ts`
  accordingly (scan counts mandates separately from saved/review).
- **Apply-to-past:** `previewApplyToPast(db, ruleIds) → {count, sample}` then
  `applyToPast(db, ruleIds)` over non-deleted transactions, chunked (500/batch, the
  `pruneReviewRows` pattern), audit rows for effective changes, returns summary. Respects the
  same field allowlist; BLOCK does NOT delete past transactions (blocking is save-time only —
  match Cashiro; verify in RulesViewModel.kt and note the verified behavior in the test).
- Re-check `resolveSmsCategory` interplay: rules apply AFTER the parser-default category hint so
  a rule can override it (precedence test).

**Acceptance:** integration tests over the in-memory harness for all commit paths; a test proving
manual-edit override beats rule action for that one save (ROADMAP: "explicit user edits override
conflicting rule actions for that transaction only").

### W4 — Subscriptions service (depends on W1 types; parallel with W3 otherwise)

**Owned files:** `db/services/subscription-ops.ts` (new, +test), `db/collections/subscriptions.ts`
(new), `lib/subscriptions/` (pure helpers: billing-cycle codec, next-payment prediction,
monthly-equivalent, matching score), migration for transaction→subscription link.

**Spec:**

- **Migration (the one schema change):** `transactions.subscriptionId INTEGER REFERENCES
subscriptions(id) ON DELETE SET NULL` + index. Follow the existing migration pattern
  (`db/use-migrations.ts` + drizzle migrations folder; check how the todos-extension migration
  was added; dev auto-reset handles baseline conflicts on-device).
- `upsertFromMandate(db, mandate: MandateInfo)`: dedup by **UMN** when present (update, never
  duplicate); else **Fallback Subscription Identity** = normalized merchant (lowercase, cleaned)
  - normalized amount (2dp) + currency + provider/bank + billing cycle when available. HIDDEN
    match → reactivate to ACTIVE. Stores `smsBody`? — NO: keep parity with ADR/privacy stance
    (provenance only); `smsBody` column exists but leave null for mandate-sourced (note in test).
- Billing cycle codec: presets (`monthly`, `weekly`, `yearly`, …— port Cashiro's set) + custom
  `custom_COUNT_UNIT_ENDDATE`; helpers `parseBillingCycle`/`formatBillingCycle`/`advanceDate` so
  the raw encoding never leaks past `lib/subscriptions/`.
- Next-payment prediction: mandate `nextDeductionDate` wins; else `lastPaidDate + cycle`; else
  cadence from linked transactions (median gap). Pure, tested with frozen dates (`lib/dates.ts`).
- **Matching:** on every non-blocked SMS/manual save (pipeline step), score ACTIVE subscriptions:
  amount within **5%**, merchant similarity (use the learned-mapping cleaned merchant), provider
  plausibility, date near predicted (±cycle tolerance). Unambiguous single winner → set
  `transactions.subscriptionId`, update `lastPaidDate`, advance `nextPaymentDate`. Ambiguous
  (≥2 candidates) → Subscription Review entry (a query-state, not a new table: "transactions
  matching >1 subscription" or a status field — prefer deriving via query to avoid schema creep).
- Monthly-equivalent normalization helper for sums (`amount × cycles-per-month`).
- Category auto-determination: final matched transaction's category → else merchantMapping →
  else the seeded system "Subscriptions" category (check `seedKey` in `db/services/seed.ts`; add
  one if absent).

**Acceptance:** TDD; UMN dedup + fallback identity + reactivation + 5% boundary (4.9% in, 5.1%
out) + cycle codec round-trip + prediction with frozen dates all covered.

### W5 — Mock UI (depends on W2 + W4 services; mock quality — design comes later)

**Owned files:** `app/(tabs)/_layout.tsx` (add routes), `app/rules/` or `app/(tabs)/rules.tsx` +
`app/rules/create.tsx`, `app/(tabs)/subscriptions.tsx` (or drawer route), components as needed.
Do NOT redesign existing screens; follow the `extensions.tsx` styling idiom (heroui-native +
uniwind classes).

**Spec:**

- **Rules list:** active toggle, priority display (drag is NOT required — up/down buttons fine
  for mock), system-template section (enable/duplicate), audit-log peek per rule (last N
  applications).
- **Rule Builder:** flat condition rows (field/operator/value pickers), action rows (allowlist
  fields only), priority input, active toggle, **preview match count** (calls
  `previewApplyToPast` with the draft rule), save. No nested groups, no raw JSON.
- **Subscriptions screen:** Upcoming (next 30 days, from prediction helper) + full list
  (monthly-equivalent shown), ACTIVE/HIDDEN sections, hide/reactivate actions, hard-delete only
  for manual+unlinked, **Subscription Review section** (ambiguous matches with
  link/dismiss), manual create form (merchant, amount, cycle, next date).
- **Mark-as-recurring:** an action on the transaction detail/long-press → create-or-link
  subscription sheet.
- **BLOCKED_BY_RULE review rendering:** extend the Extensions tab's SMS Review list item to show
  the blocking rule name + an "edit rule" link; manual-save block shows inline feedback in the
  add-transaction sheet.
- Wire TanStack DB live queries (load intent skills); keep lists virtualized if >25 rows
  (LegendList — `@legendapp/list` — per project preference; see `transactions.tsx` pattern).

**Acceptance:** tsc + lint clean; non-UI helpers (e.g. preview count plumbing) unit-tested; every
screen reachable on device.

### W6 — Rule-pack extension type (depends on W2; smallest workstream, can trail)

**Owned files:** `lib/registry/` (accept `type:"rule"` entries), `db/services/extensions.ts`
(install path for rule packs → insert inactive `transaction_rules` rows tagged to the pack),
store repo: rule-pack JSON schema + 1–2 sample packs + catalog generator accepting the new type.

**Spec:** same registry/checksum/version/offline model as parser manifests (`plugins` table,
`type="rule"` — enum value already exists). Install writes **inactive** rule templates; updates
must NOT mutate user-customized/activated rules (match by a stable per-rule id within the pack;
skip rules the user duplicated/edited). Blocking rules from packs require explicit per-rule
enablement (no "enable all" for BLOCK actions). If time-boxed out, ship the app-side install path
against a bundled sample pack and defer store-side catalog support — flag whichever you choose.

## 4. Suggested execution order

```
W1 (engine mandate)  ──┐
W2 (rules DSL)       ──┼──→  W3 (pipeline)  ──→  gates → device verify (§5)
                       └──→  W4 (subscriptions, needs W1's MandateInfo type only)
W5 (UI) after W2+W4 service APIs exist; W6 anytime after W2.
```

If multi-agent: W1/W2 parallel first (disjoint files), then W3/W4 parallel, then W5/W6 parallel.
If single-agent: W1 → W2 → W4 → W3 → W5 → W6 (W3 last of the logic so it integrates real APIs).

## 5. Verification protocol

### 5.1 Gates (after every workstream, and on the combined tree)

```bash
bunx tsc --noEmit        # clean
bun run test             # vitest — ALL green (was 272 at P2 close; expect ~350+ after P3)
bun run check            # oxlint + oxfmt
# store repo, if touched:
cd ../unmiser-extensions && bun run validate
```

### 5.2 Reload/rebuild decision

- JS-only (expected default): `agent-device metro reload`, watch `/tmp/unmiser-dev.log`.
- If `SmsPreScreen.kt` or any nitro spec changed: full rebuild via orca dev terminal —
  Ctrl-C, then `bunx expo prebuild --clean --platform android && bunx expo run:android 2>&1 |
tee /tmp/unmiser-dev.log`; poll the log for `BUILD SUCCESSFUL` / `Logs for your project`.
- If a DB **migration** landed: dev auto-reset may wipe the device DB on baseline conflict —
  EXPECT to re-run the wizard scan to repopulate (or accept the reset; it's a dev device). Verify
  migration applies cleanly in the Metro log (no `useMigrations` errors).

### 5.3 On-device checklist (serial, one by one; pull DB after each step to prove rows)

Device: I2223 (`10BE1B0AMP000JZ`). DB pull:
`adb exec-out run-as com.vijayabaskar56.unmiser cat files/SQLite/unmiser.db > /tmp/dev.db`

1. **Mandate happy path:** paste (Store tab → Add from SMS) an HDFC e-mandate fixture body →
   expect "subscription created/updated" outcome, NOT a transaction.
   `sqlite3: SELECT merchantName, amount, umn, state, nextPaymentDate FROM subscriptions;` —
   row exists; `SELECT COUNT(*) FROM transactions` unchanged.
2. **UMN dedup:** paste the same mandate again → no second row; `updatedAt` advanced.
3. **Mandate parse failure:** paste a mandate body with the date garbled → review item with
   reason `MANDATE_PARSE_FAILED` visible in SMS Review.
4. **Rule applies on save:** create a rule in the Builder (e.g. merchant CONTAINS "swiggy" →
   SET category Food) → paste a Swiggy SMS → transaction saved with that category;
   `SELECT * FROM rule_applications` has one row with before/after JSON.
5. **BLOCK rule:** create a BLOCK rule (merchant CONTAINS "test-block"), paste matching SMS →
   no transaction; review item with `BLOCKED_BY_RULE` + rule name rendered; manual add matching
   the rule shows inline blocked feedback.
6. **Apply-to-past:** Builder preview shows a plausible match count against the ~160 scanned
   transactions; execute; spot-check `rule_applications` rows + a changed transaction.
7. **Matching:** with a subscription whose amount ≈ a recurring merchant in the scan data, paste
   a new SMS for that merchant within 5% → `transactions.subscriptionId` set, `lastPaidDate`
   updated, `nextPaymentDate` advanced.
8. **Subscriptions screen:** upcoming-30-days shows the predicted payment; hide → HIDDEN section;
   paste the mandate again → reactivates to ACTIVE.
9. **Scan regression:** Extensions tab → full historical scan still completes off-thread
   (no `[scan]` fallback WARN in Metro log), summary sane, no review-queue explosion
   (open rows should stay ~low hundreds; mandates from history now appear as subscriptions).
10. **Worklet regression guard:** zero `undefined is not a function` /
    `Property 'X' doesn't exist` in `/tmp/unmiser-dev.log` across all steps.

agent-device quirks (from memory + P2 experience): prefer `press @eN` from a fresh
`snapshot -i`; tab bars sometimes need the ref not the label; `fill` then `keyboard dismiss` can
close sheets — re-open and verify field previews; multiline paste fields retain text even when
the fill reports a diagnostics error (check the preview before retrying).

### 5.4 Exit criteria (Phase 3 done means)

- All §5.3 steps pass with DB-level proof.
- Combined gates green; no regression in the P2 scan flow.
- Rules > merchantMapping > parser-default precedence proven by a test AND a device step (a rule
  overriding a learned mapping).
- ROADMAP Phase 3 marked done with evidence (mirror the P2 status-block style), and
  `docs/phase-3-handoff.md` written (operational knowledge: anything you fought with).

## 6. Close-out

1. Update `ROADMAP.md` §2 table + §4 phase table + Phase 3 header/status block with verification
   evidence (the P2 blocks are the template).
2. Write `docs/phase-3-handoff.md` (pointers + hard-won knowledge, NOT spec duplication).
3. App repo: commit (conventional long-form message like `2c336fc`); do NOT push unless asked.
4. Store repo: if the manifest schema / hdfc mandate fixtures / rule packs changed — commit AND
   push (jsDelivr serves it; the device fetches live), regenerate `index.json` via
   `bun scripts/generate-catalog.ts` before committing.
5. Update CLAUDE.md only if an operational instruction changed (status lives in ROADMAP only).

## 7. Known traps, restated once

- `bun run test`, never `bun test`.
- Worklet topological ordering in `engine.ts` — new mandate helpers go in dependency order.
- Mandate detection BEFORE filter, or `excludeKeywords` eats every mandate SMS.
- Native pre-screen may drop mandate bodies — prove passage with parity fixtures BEFORE device
  testing; a Kotlin change forces the one native rebuild.
- `transactions.id` is INTEGER but `rule_applications.transactionId` is TEXT (ported quirk) —
  stringify when writing audit rows.
- Same-second duplicate balance rows throw on `account_balances (accountId, timestamp)` unique
  index (pre-existing; avoid same-timestamp fixtures in device tests).
- The dev DB may reset on migration baseline conflict — plan the device-verify order so the
  scan-data-dependent steps (4–7) run AFTER repopulating.
- lint-staged runs on commit and may reformat — don't be surprised by amended hunks.
