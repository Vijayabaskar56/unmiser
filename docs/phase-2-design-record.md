# Phase 2 Design Record — The `sms-parser` Plugin Engine (USP)

> Extracted verbatim from `ROADMAP.md` (2026-06-13 cleanup). This is the full Phase 2 spec,
> decided design (grilling 2026-06-11), and completion status. Code comments referencing
> "ROADMAP Phase 2, workstream A/B/C/D" resolve here. Operational handoff knowledge lives in
> `docs/phase-2-handoff.md`.

## Status (device-verified 2026-06-12)

All three milestones complete. Real-inbox verification on I2223 (~5.3k messages): wizard first-run gate → live-catalog country/provider selection → registry install with checksum verify (`in.boi.bank`, trust=registry, sha256 matches catalog) → permission flow → off-thread worklet scan (no JS-thread fallback; UI responsive throughout) with checkpoint **resume** mid-inbox → **161 SMS transactions auto-saved**, 4 accounts auto-created per ADR-0006 (incl. credit-card detection), **92 open review rows (exit criterion "low hundreds" ✅)** → update check against live catalog → production paste sheet saves against the auto-created account. One on-device bug found+fixed during verification: worklet-marked functions are NOT hoisted (closure capture at definition point), so `lib/parser/engine.ts` is now in strict topological order — see the in-file warning comment.

Per-deliverable:

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

## Decided design (grilling 2026-06-11; all shipped as decided)

Four workstreams; kept as the design record. Exit criterion at the end — met on device 2026-06-12.

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

## Original spec

- **GOAL:** Ship one interpreter engine + installable parser extensions; users install only the banks/providers they need.
- **SCOPE:**
  - Pure interpreter engine (ROADMAP §3.3): dispatch, filter, extraction (named captures), classification hints, cleaning, card-vs-account, dedup hash, confidence/reasons, mandate emit.
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
