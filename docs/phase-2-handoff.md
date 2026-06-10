# Phase 2 Handoff

Status as of 2026-06-09 (post Nitro-migration QA session):

- Parser engine, manifest schema, bundled parser fixtures, and SMS-processing service are in place.
- Android SMS ingestion now goes through a **Nitro module** (`packages/react-native-cashrio-sms`,
  hybrid object `CashrioSms`): permissions, paged historical reads, notifications, and a
  callback-based realtime listener (`startSmsListener`/`stopSmsListener` backed by a dynamically
  registered `SMS_RECEIVED` BroadcastReceiver). The old `NativeModules`/`NativeEventEmitter` bridge
  is gone; `lib/android-sms-adapter.ts` is the only JS boundary.
- Extensions UI exists for install/enable, account linking, paste parsing, historical scan,
  realtime listening, and SMS review.

Fixed in this session (each was breaking Phase 2 on device):

1. **Extensions screen freeze/crash** — the SMS Review list rendered all rows unvirtualized inside
   a ScrollView; after a real scan stored 5k+ review rows, mounting the screen pegged the JS thread
   (heap 30→158MB, eventual Fabric SIGSEGV in `MountingCoordinator::pullTransaction`). Now capped
   via `REVIEW_RENDER_LIMIT` (25) with a "showing latest N" header.
2. **Nitro hybrid object never registered** — `nitro.json` had an empty `autolinking {}` block, so
   `createHybridObject("CashrioSms")` threw and the adapter reported unavailable. Autolinking entry
   added, nitrogen re-run.
3. **SMS permissions missing from the APK** — no manifest declared `READ_SMS`/`RECEIVE_SMS`/
   `POST_NOTIFICATIONS`, so requests were auto-denied. Now declared in the library manifest.
4. **Realtime listening was dead code** — no BroadcastReceiver existed and the JS emitter pointed
   at a removed module. Implemented natively in the Nitro module (see above).
5. **HDFC manifest gaps vs the original `HDFCBankParser.kt`** — added `HDFCB` sender + DLT
   patterns, lowercase `A/C x1234` / `HDFC Bank XX1234` / `BLOCK DC` account patterns,
   `To <payee> On <date>` (incl. VPA) / `Info:` / salary merchant patterns, more balance/reference
   patterns, and the original's exclusion filters (future debits, e-mandate, promos, requests).
   Real-device fixtures added (157 tests pass).
6. **Filter-rejected SMS were mislabeled** — `processSms` routed them to `UNRECOGNIZED/NO_PARSER`
   because the rejected branch was unreachable (`fields` is unset on filter rejection). Now stored
   as `REJECTED/FILTER_REJECTED`.
7. **Stale review rows** — review items whose SMS later saved as a transaction stayed in the queue
   forever (910 of 912 ACCOUNT_RESOLUTION rows were stale after linking the real account).
   `processSms` now stamps `resolvedAt` on the matching review row whenever an SMS saves (fresh or
   hash-dedup on rescan), and `smsReviewCollection` filters resolved rows out.

Verified on device (iQOO I2223, real inbox):

- Adapter reports available; permission request shows the system dialog and resolves granted.
- Historical full scan over ~5.3k messages saves transactions automatically once a provider
  account is linked (HDFC ····7672): hundreds of SMS-sourced transactions written to `transactions`
  with dedup on rescan (review items deduped via the `(sender, smsBody)` unique index).
- Tab navigation and the Extensions screen are stable with thousands of review rows in the DB.

Known gaps / follow-ups:

- `loadEnabledParserManifests` and `enabledPluginAssetCollection` join `plugin_assets` on
  `pluginId` only — a future manifest **version bump** would load both versions. Join on
  `(pluginId, version)` against the plugin row before shipping reversible updates.
- Realtime path needs a real incoming SMS to fully verify end-to-end (receiver + callback wiring
  is in place; notification hook returns false until POST_NOTIFICATIONS is granted on Android 13+).
- The scan summary counts review-status REJECTED outcomes in the "review" bucket; consider a
  separate rejected counter in the UI.
- Pre-existing lint failures (unused imports) in `db/services/balance-persistence.test.ts` and
  `db/test-support/harness.smoke.test.ts` make `bun run check` fail.
- The bundled HDFC/SBI/Slice manifests still review-queue every non-financial SMS from unmatched
  senders (4k+ UNRECOGNIZED rows on a real inbox) — consider dropping or aging these out.
