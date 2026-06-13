# Phase 2 Handoff

Status as of 2026-06-12: **Phase 2 complete and device-verified.** `docs/phase-2-design-record.md`
holds the full decided design (registry, wizard, bundled allowlist, scan hardening) and the
verification evidence (extracted from `ROADMAP.md` in the 2026-06-13 cleanup); this doc keeps only
the operational knowledge a future session needs.

## What shipped (pointers, not duplication)

- **Registry:** `lib/registry/` (catalog fetch via jsDelivr, SHA-256-verified install,
  trust-by-install-source, throttled update check, reprocess-review-queue-on-update). Catalog CI
  lives in `unmiser-extensions` (`scripts/generate-catalog.ts` + `.github/workflows/catalog.yml`
  → `index.json`, 99 entries). Store tab: `app/(tabs)/store.tsx`.
- **Wizard:** `app/(onboarding)/sms-setup/` + first-run gate in `app/_layout.tsx`
  (`smsSetupCompletedAt` KV pref). Re-entry from the Store tab.
- **Scan:** `lib/scan/` — singleton task store, worklet executor on a dedicated
  `createWorkletRuntime`, chunked RN-thread fallback, KV checkpoint/resume, native coarse
  pre-screen in the Nitro module (`SmsPreScreen.kt`, mirrors `lib/parser/sms-filter.ts`).
- **Engine split:** `prepareManifests` (zod, RN-side, once per run) →
  `parsePreparedSms*` (worklet-safe core) → `attachTransactionHash` (js-md5/decimal, RN-side).
- **Auto-create:** `processSms` auto-creates accounts on HIGH-confidence parses (ADR-0006);
  only ambiguous multi-suffix matches go to `ACCOUNT_RESOLUTION_REQUIRED`.
- **Bundled manifests:** `bun run sync:manifests` copies the 12-bank allowlist byte-identical
  from `../unmiser-extensions/manifests/`. Never hand-edit `lib/parser/manifests/*.json` — fix
  in the store repo and re-sync.

## Device verification evidence (I2223, real ~5.3k inbox, 2026-06-12)

- Wizard gate → country/providers from the **live** jsDelivr catalog → `in.boi.bank` installed
  with `trust=registry`, stored checksum byte-identical to the catalog `sha256`.
- Worklet scan ran **without** the chunked fallback (no `[scan]` WARN), UI responsive throughout;
  checkpoint resume from 3,250/5,345 worked after an interrupted run.
- Outcome: **161 SMS transactions saved**, 4 accounts auto-created (HDFC ····7672, IOB ····1999,
  HDFC ····7087 **as credit card**, SBI ····7672), **92 open review rows** (53 acct-resolution,
  13 low-confidence, 10 rejected, 16 unrecognized) — exit criterion "low hundreds, not
  thousands" met (previously 4k+).
- Update check against live catalog: "Everything is up to date". Paste sheet: HDFC SMS saved
  against the auto-created ····7672 account.

## Hard-won operational knowledge (do not lose)

1. **Worklet functions are NOT hoisted.** The worklets babel plugin rewrites every
   `"worklet"`-directive function into a non-hoisted binding whose closure is captured at the
   DEFINITION point. A worklet calling a helper defined later in the file captures `undefined`
   and crashes on-device with `undefined is not a function` / `Property 'X' doesn't exist` —
   **invisible to vitest** (untransformed) and to tsc. `lib/parser/engine.ts` is therefore in
   strict topological order (leaf worklets → mid-tier → parse cores); see the in-file comment.
   Any new worklet code must follow definition-before-use ordering.
2. **Test runner:** `bun run test` (vitest). Bun's own `bun test` cannot dlopen better-sqlite3
   and fails the DB suites spuriously.
3. **Native rebuild triggers:** any change to `packages/react-native-cashrio-sms/src/specs/*`
   (run nitrogen first), `SmsPreScreen.kt`/`CashrioSms.kt`, or babel config ⇒ full
   `prebuild --clean` + `run:android` cycle. JS-only changes: `agent-device metro reload`.
4. **Pre-screen aggressiveness watch-item:** `preScreen=true` drops messages natively before
   manifest dispatch. If a real bank's sender has no DLT-style shape, its SMS dies pre-bridge
   even though the manifest would match. Symptom: missing transactions with clean logs. Fix is
   one line in `lib/scan/index.ts` (pass `false`). Realtime listener currently runs
   `preScreen=false`.
5. **Known pre-existing edge:** two same-account SMS with identical `receivedAt` + stated
   balances collide on the `account_balances (accountId, timestamp)` unique index inside
   `addTransaction`'s cascade (surfaced in A4 tests; real inboxes have distinct timestamps).
   Fix would live in balance-persistence/transaction-ops.

## Deferred (intentionally, see ROADMAP "Not built")

- Realtime `RECEIVE_SMS` end-to-end device test (wiring verified; needs a real incoming SMS).
- On-device update-apply with a real manifest version bump (e2e unit-tested in
  `lib/registry/updates.test.ts`; needs a v2 manifest in the store to exercise live).
- Manifest signing (catalog `signature: null` reserved; checksum-only in v1).
- Processed-records persistence split: scan triage parses off-thread, then `processSms`
  re-parses the small persisted fraction RN-side. Optimization: split `processSms` into
  parse + `processParsedSms` so worklet results persist directly.
- Store-repo branch protection: the catalog CI commit-back uses the default `GITHUB_TOKEN`;
  needs a PAT/exemption if branch protection is ever enabled.
- Wizard country names: `lib/onboarding-state.ts` has a small hardcoded map; unknown catalog
  countries render as raw ISO codes.
