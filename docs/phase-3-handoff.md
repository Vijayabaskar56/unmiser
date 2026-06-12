# Phase 3 Handoff — Rules Engine + Subscriptions/Mandates

Completed and device-verified on 2026-06-12.

## What Shipped

- HDFC manifest `mandate` block support, including RN-side date normalization and `MandateInfo`.
- Mandate outcomes in SMS processing:
  - valid mandate → subscription upsert, no transaction
  - malformed mandate → SMS Review `MANDATE_PARSE_FAILED`
- Rules engine:
  - JSON DSL validated with valibot
  - condition/action interpreter
  - priority order and BLOCK short-circuiting
  - audited effective changes in `rule_applications`
  - inactive system templates
- Transaction automation pipeline:
  - parser/default category → merchant mapping → active rules → save → rule audit → subscription matching
  - manual save uses explicit-field overrides so user-entered merchant/category wins for that save
  - automated BLOCK creates SMS Review `BLOCKED_BY_RULE`
- Apply-to-past preview/apply over non-deleted transactions.
- Subscriptions:
  - `transactions.subscriptionId` migration and index
  - UMN dedup and fallback identity for mandates without UMN
  - ACTIVE/HIDDEN lifecycle with new mandate reactivation
  - 5% payment matching and direct transaction link
  - billing-cycle helpers and monthly equivalent
- Mock UI:
  - Rules tab
  - Subscriptions tab with upcoming/active/hidden/review sections
  - transaction detail "Mark as recurring"
  - Extensions SMS Review rendering for blocked rules
- Rule-pack install path in `db/services/extensions.ts`; installed rule packs write inactive templates.

## Verification

App repo:

```bash
bunx tsc --noEmit
bun run test
bun run check
```

Latest green run: 33 test files, 316 tests.

Store repo:

```bash
cd ../unmiser-extensions
bun run validate
```

Latest green run: `OK: 99 bundles, 668 fixtures, 0 failures`.

Device: I2223, Android package `com.vijayabaskar56.unmiser`.

Useful DB pull:

```bash
adb exec-out run-as com.vijayabaskar56.unmiser cat files/SQLite/unmiser.db > /tmp/dev.db
```

Final device evidence:

- Mandate create/dedup/failure:
  - `HDFCUMN12345` exists once in `subscriptions`
  - malformed mandate row exists with `reviewReason='MANDATE_PARSE_FAILED'`
- Rules:
  - `uat-swiggy-subscription` created audit rows for Swiggy SMS saves
  - `uat-block-test-block` created SMS Review `BLOCKED_BY_RULE`
- Apply-to-past:
  - `uat-apply-past-swiggy` created a `rule_applications` row for the existing Swiggy Instamart transaction
- Matching:
  - latest UAT payment `MATCHMEUAT-175011` has `subscriptionId=4` and `isRecurring=1`
  - matching subscription was hidden and reactivated by mandate; final state `ACTIVE`
- Scan regression:
  - full scan started from Extensions and settled back to `Full scan`
  - final DB counts: `transactions=166`, `subscriptions=4`, open SMS Review rows `96`
- Worklet/log guard:
  - no matches in `/tmp/unmiser-dev.log` for `undefined is not a function`
  - no matches for `Property ... doesn't exist`
  - no `[scan]` fallback warning
  - no migration error

## Operational Notes

- Use `bun run test`, not `bun test`; Bun's runner still cannot load `better-sqlite3`.
- `SmsPreScreen.kt` changed for mandate phrases, so a native rebuild was required and completed.
- The Extensions dev harness includes `__DEV__`-only Phase 3 UAT controls. They call the same service paths as production SMS processing and exist only because Android accessibility automation exposed nested multiline/Pressable nodes without usable bounds.
- Device validation found and fixed two real bugs:
  - rule category actions used to record an audit change even when the category name did not resolve to a category id
  - synthetic SMS UAT messages initially reused the same timestamp and hit the `account_balances(accountId,timestamp)` unique index
- The seeded top-level food category is named `Food & Drinks`, not `Food`. System templates and the Rules tab default should use the seeded name.
- Saved SMS transactions intentionally do not persist `smsBody`; tests that need to inspect a transaction after SMS processing should use the returned transaction id.
- Subscription matching is covered by `db/services/sms-processing.test.ts` with a mandate → later payment integration test.

## Store Repo

The store repo `/Users/vijayabaskar/work/unmiser-extensions` was updated for the mandate schema, vendored parser code, `date-fns`, and the HDFC mandate fixtures. Regenerate the catalog with:

```bash
bun scripts/generate-catalog.ts
```

`bun run validate` must stay green before pushing because the app consumes this repo via jsDelivr.

W6 shipped the app-side rule-pack install path and tests. Store-side sample rule packs and catalog entries are deferred under the Phase 3 plan fallback.
