# Phase-4 UI backlog

Running list of UI gaps/follow-ups found while building the Phase-4 production screens
(profile, accounts, categories, the sprite icon system). True status noted per item.

## 0. Route status audit (2026-06-15)

Verified by reading every file under `app/` (not the stale tree in `route-list.md`, which
predates the native-tabs switch). The Settings hub (`app/(tabs)/settings.tsx`) now links **13**
screens grouped Money · App · Data · About + a profile card — far more than `route-list.md` claims.
Status legend: **DONE** = real screen on the design-system kit · **PARTIAL** = real shell but some
rows/tabs are noop or blocked on a later phase · **STUB** = renders `<ComingSoon>` · **DEV** =
`__DEV__`/hidden utility, not product UI.

### DONE — real, shipped screens

| Route                           | Notes                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `(tabs)/transactions.tsx` (Log) | feed + inline add + search + type chips + bulk delete                                             |
| `(tabs)/settings.tsx` (Hub)     | profile card + Money/App/Data/About sections                                                      |
| `accounts.tsx`                  | list + kind picker + add/edit form sheet · drill-in `account/[id]`                                |
| `account/[id].tsx`              | detail + activity tab + edit/delete/set-main (**Insights tab is a stub**)                         |
| `categories.tsx`                | Expense/Income tabs + form sheet · drill-in `category/[id]`                                       |
| `category/[id].tsx`             | detail + subcategories + recent txns + edit/delete (**Insights tab is a stub**)                   |
| `rules.tsx`                     | list + unrecognised banner + match counts                                                         |
| `rule/new.tsx`                  | builder (field/op/value + category/account/flag actions) + live preview + apply-to-past           |
| `rule/[id].tsx`                 | IF/THEN + matched txns + toggle-active + run-on-past + delete (**no edit — see §4**)              |
| `subscriptions.tsx`             | Upcoming/Active/Hidden + form sheet · drill-in `subscription/[id]`                                |
| `subscription/[id].tsx`         | detail + edit/hide/delete                                                                         |
| `transaction/[id].tsx`          | modal detail + inline edit + soft-delete+undo + mark-recurring                                    |
| `extensions.tsx`                | SMS console: install bundled parsers, link accounts, paste/scan, realtime listener, review        |
| `store.tsx`                     | registry browse + install/update from the 99-extension catalog over jsDelivr + paste-SMS fallback |
| `appearance.tsx`                | theme/accent/text-scale/toggles + preview (follow-ups in §8)                                      |
| `notifications.tsx`             | master switch + money/app toggles + scheduled sync (follow-ups in §5)                             |
| `profile.tsx`                   | banner/archetype picker + name + financial overview + stats                                       |
| `unrecognised.tsx`              | unrecognised-SMS list + dismiss / add-sender-rule (reached from the rules banner)                 |
| `developer.tsx`                 | dev toggles + re-parse/seed/clear-cache + build info (7-tap gate, follow-ups in §6)               |

These supersede the `route-list.md` "ComingSoon stubs" claims for **profile, appearance, accounts,
categories, rules, data-privacy(partial)** — all now built.

### PARTIAL — shell shipped, sub-flows noop or phase-blocked

- **`language.tsx`** — ✅ **i18n runtime DONE (2026-06-15).** Dependency-free engine in `lib/i18n/`
  (`translations.ts` resources, pure `translate()` with dotted-key lookup + `{param}` interpolation +
  `en` fallback, `use-i18n.tsx` `I18nProvider` + `useT()` reading `app.language` reactively). Selection
  persists (`setAppLanguage`) and applies **live** (no reload), like the accent/theme. First translated
  slice: the **Settings hub** + **Language screen** (en/hi/ta real; other locales fall back to en).
  **Follow-ups:** (1) extract the remaining screens' strings into `t()` — the long tail; (2) RTL for
  Urdu (`I18nManager`, needs a reload); (3) optional device-locale default via `expo-localization`.
- **`data-privacy.tsx`** — on-device statement + wipe-all are **real**; **export / import / webhooks /
  app-lock** rows are noop placeholders. Export/import is Phase 8 (Webhooks/Sync/Export); app-lock has
  no phase yet (Cashiro has `AppLockScreen` — currently unscheduled).
- **`about.tsx`** — hero + real version/build; **What's-new / Rate / Share / Licenses / Privacy /
  Terms** rows are noop. Licenses needs its own screen (Cashiro `LicensesScreen`); legal links need URLs.
- **`account/[id].tsx` & `category/[id].tsx` Insights tabs** — placeholder; depend on **Phase 6
  analytics** (per-entity trends/breakdown).

### STUB — `<ComingSoon>`, blocked on a future phase

| Route                               | Blocked on                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `(tabs)/index.tsx` (Home dashboard) | **Phase 5/6** — overview/balances/widgets                                                        |
| `(tabs)/grow.tsx` (Grow)            | **Phase 5/6** — insights / net-worth / budgets surfaces                                          |
| `(tabs)/add.tsx` (centre ＋)        | **Phase 4/5** — manual add; esp. the manual **subscription-create** path Cashiro has and we lack |
| `budgets.tsx`                       | **Phase 5** — whole budgeting pillar (schema + list/detail/wizard)                               |

### DEV / cleanup

- **`design-system.tsx`** — `__DEV__` primitive preview; keep, not product UI.
- **`modal.tsx`** — leftover Expo template demo, never linked → **safe to delete**.
- **`components/ui/tab-bar.tsx`** — superseded by `NativeTabs`; unused → **safe to delete** (also noted in §8).

### Still missing entirely (Cashiro has, we don't) — future phases

- **Analytics** screen (charts/date-range/breakdown) — **Phase 6**.
- **Budgets / BudgetDetail / BudgetHistory** — **Phase 5**.
- **Manual AddTransaction** proper + **Subscription-create-by-hand** — Phase 4/5 (the `add` stub above).
- **Webhooks + WebhookEditor** — **Phase 8**.
- **AppLock** (PIN/biometric gate) — unscheduled.
- **Shared bottom-sheet kit** — cross-cutting refactor; we still use inline chip pickers + form sheets,
  `@gorhom/bottom-sheet` is a dep but unused (see `route-list.md` §"In-screen integration gap").

## 9. Extensions: Store + Extensions unified ✅ DONE (2026-06-15), with follow-ups

- **Done:** `app/store.tsx` and the old dev-console `app/extensions.tsx` are merged into a single
  **`app/extensions.tsx`** with **Installed / Discover** tabs + a per-extension detail screen
  (`app/extension/[id].tsx`, get/installed states). The SMS engine console (permissions, full/resume
  scan, realtime listener, paste-harness, Phase-3 UAT, SMS Review queue) moved behind the developer
  gate at **`app/sms-console.tsx`** (reached from `developer.tsx`). Settings drops the Store row.
  View-model logic is pure + tested in `lib/extensions/catalog.ts` (`parsedCountsByPlugin`,
  `statusBadge`, `formatBytes`, `placeholderMeta`). "What it parses" + "N fixtures pass" run real
  fixtures through the engine (`validateManifestFixtures` / `parseSmsWithManifest`).
- **TODO — registry has no rating / installs / license:** the catalog schema
  (`lib/registry/types.ts` `registryCatalogEntrySchema`) carries only `bytes` (real size). Rating,
  installs, and license are **placeholder UI** from `placeholderMeta()` (deterministic from pluginId).
  Add `rating`/`installs`/`license` to the registry `index.json` schema + the `unmiser-extensions`
  generator, then replace `placeholderMeta` with the real fields.
- **Done — detail share + uninstall:** the detail AppBar has a **Share** action (shares an
  `unmiser://extension/<id>` deep link) and, when installed, a **direct trash icon → Remove
  extension** (`uninstallExtension` drops the plugin + assets; already-created transactions are kept)
  behind a `ConfirmDialog`. No overflow menu — with only Share + Remove, both are header icons. The `+` "Add from SMS" affordance was **removed** from the Extensions header
  (semantic mismatch — it added a transaction, not an extension); the paste fallback still lives in
  the SMS-setup permissions step (`app/(onboarding)/sms-setup/permissions.tsx`).
- **Done — Discover is deep-linkable:** `unmiser://extensions?tab=discover` opens straight to the
  Discover tab (`tab` search param seeds the initial tab).
- **TODO — Discover is a flat name-sorted list** (matches the mock); the old country grouping
  (`groupListingsByCountry`) is dropped. Reintroduce country sections if 99 entries feel unwieldy.
- **TODO — Featured card is static** ("UPI everywhere"). Needs a `featured` flag in the registry.

## 1. UI sprite has no food / pet glyphs

- **Status:** the sprite (`assets/icons/ui-sprite.sprite`, 1,177 Untitled-UI icons) is a UI-icon
  set, not lifestyle — it has no food/drink or pet icons. "Food & Drinks" falls back to
  `face-smile`; `pet-care` → default `tag-01`. Users can repick any of the 1,177 via the picker.
- **Fix (later):** add a small supplementary lifestyle sprite sheet, or curate substitutes for the
  affected seed categories in `lib/categories/icons.ts`.

## 2. Cross-app icon consistency: Ionicons → sprite for semantic icons ✅ DONE (2026-06-14)

- **Done:** account-kind icons (`lib/accounts/kinds.ts` → bank/credit-card-01/coins-01/file-02/
  shield-tick/trend-up-01), profile overview tiles, settings section rows, and the TxnRow
  spend/credit arrows (→ sprite `arrow-up`/`arrow-down`) all render via `<SpriteIcon>` now.
- **Status:** the app mixes Ionicons and the new `<SpriteIcon>`. Chrome/nav glyphs stay on Ionicons
  (universal, and Ionicons has filled/active variants the sprite lacks — e.g. the tab bar). The
  _semantic_ icons should move to the sprite to match the Categories screens.
- **Targets:** `lib/accounts/kinds.ts` (account-kind icons), `app/profile.tsx` (overview tiles),
  `app/(tabs)/settings.tsx` (section rows), `components/ui/txn-row.tsx` (spend/credit arrows).
- **Keep as Ionicons:** AppBar `chevron-back`/`chevron-forward`/`add`/`ellipsis-horizontal`/
  `checkmark`, the edit/delete menu actions, the tab bar, and the theme toggle.

## 3. Dead entity-icon path (ADR-0003) ✅ DONE (2026-06-15)

- **Done:** deleted the unused `<Icon>` cluster — `components/icon.tsx`, `lib/icon-render.tsx`,
  `lib/icon-registry.ts` (+ test), and `lib/icons/{nano-icon,brand-map,category-glyphmap}` — after
  confirming zero product importers (the sprite supersedes them). The live sprite files
  (`lib/icons/sprite.ts`, `sprite-extract.ts`) stay. **ADR-0003** marked `superseded` with a note
  naming the UI sprite as the entity-icon source. (Orphaned brand-WebP/nano-font assets, if any,
  are harmless and can be swept later.)

## 4. Smart Rules: editing + multi-condition ✅ DONE (2026-06-15)

- **Done — edit:** the rule detail (`app/rule/[id].tsx`) now has a **pencil** → `rule/new?edit=<id>`.
  The builder pre-fills conditions + actions from the existing rule (`parseConditions`/`parseActions`)
  and saves through `saveRule` (upsert by id), preserving the rule's name/priority/active state. Title
  - CTA switch to "Edit rule" / "Save changes".
- **Done — multi-condition AND/OR:** `app/rule/new.tsx` builds an array of conditions with **Add
  condition** / **remove**, plus a **Match all / Match any** toggle (shown for 2+ conditions). The
  interpreter now honours the combinator (`ruleMatches`: `.some()` when any condition is tagged
  `logicalOperator: "OR"`, else `.every()`), so OR works end-to-end (covered by
  `lib/rules/interpreter.test.ts`). The detail screen shows the join (`IF` / `AND` / `OR`).
  It's a uniform rule-level mode, not mixed AND/OR precedence (deliberately, to stay unambiguous).
- **Note — lossy edit for non-builder rules.** The builder covers MERCHANT/SMS_SENDER/AMOUNT fields,
  text/amount operators, and SET CATEGORY/ACCOUNT/FLAGGED actions. Editing a rule that uses fields/ops
  outside that set (e.g. system templates' `REGEX_MATCHES` on `SMS_TEXT`) would drop the unsupported
  parts on save — fine for user-built rules, which only use the supported set.

## 5. Notifications: wired, with follow-ups

- **Done (2026-06-14):** on-device local notifications via `expo-notifications`. Prefs persist in
  `app_settings` (keys in `db/schema/app-settings.ts`, service `db/services/notification-settings.ts`,
  pure model `lib/notifications/prefs.ts`) and the screen (`app/notifications.tsx`) reads them
  reactively via `useLiveQuery` over `appSettingsCollection`. Native layer (`lib/notifications/index.ts`):
  master-switch permission prompt, Android channel, quiet-hours suppression, deep-link on tap
  (`app/_layout.tsx`). Wired triggers: every-transaction + large-transaction (≥₹5,000) +
  unrecognised-SMS fire from the live SMS path (`app/extensions.tsx` → `notifyForSmsOutcome`);
  subscription-renewals (2 days before) + weekly-review (Sun 6pm) are scheduled via
  `syncScheduledNotifications` on app start and on every relevant pref change.
- **TODO — Budget warnings (blocked):** the toggle persists but is **inert** — the Budgets feature
  isn't implemented (schema only, `app/budgets.tsx` is a stub). When budgets land, compute spend vs
  limit and fire at 80%/100% (see the absent branch in `lib/notifications/dispatch.ts`).
- **Done (2026-06-15) — quiet hours configurable.** The Notifications row expands to a window editor;
  the window is stored as minute-of-day (`notify.quietStart`/`notify.quietEnd`, `start === end` = off)
  and the suppression in `notifyForSmsOutcome` reads it. The model moved to minutes
  (`lib/notifications/prefs.ts`: `isWithinQuietHours`/`formatTime`/`quietHoursLabel`, all tested). The
  editor (`components/quiet-hours-editor.tsx`) uses the **`@expo/ui` time picker** when its native
  module (`ExpoUI`) is present, else a ±15-min stepper — so it works on the current dev client and
  upgrades after a rebuild.
- **Done — large-transaction threshold configurable.** Stored at `notify.largeThreshold`; an inline
  ₹ input under the toggle persists it; `dispatch.ts` reads `prefs.largeThreshold`. (Still INR-only —
  currency-aware when FX lands.)
- **TODO — Live SMS path is the dev `extensions.tsx` realtime toggle.** When the production
  background/headless SMS receiver is wired, call `notifyForSmsOutcome(appDb, outcome)` from there too.
- **TODO — Weekly review deep-links to `/(tabs)`;** point it at a real weekly-summary screen once one
  exists. `subscription-renewals` rescheduling currently runs on app start / pref change only — if a
  subscription's `nextPaymentDate` changes mid-session, call `syncScheduledNotifications` after that edit.

## 6. Developer options: wired, with follow-ups

- **Done (2026-06-14):** `app/developer.tsx`, reached via 7 taps on the version chip in
  `app/about.tsx`. Confirms use `ConfirmDialog`; results report via toast (`ToastAndroid`, Alert
  fallback). Wired actions:
  - **Send test notification** → `sendTestNotification()` (`lib/notifications`), bypasses pref +
    quiet-hours gates on purpose.
  - **Re-parse all SMS** → `smsScanTask.start({ resume: false })` with live progress in the row +
    cancel-while-running + a completion toast.
  - **Seed demo data** → `seedDemoData()` (`db/services/demo-seed.ts`): 2 demo accounts (marked
    `canonicalBank = "demo-seed"`, idempotent), 6 transactions, 1 subscription due in 2 days.
  - **Clear parse cache** → `clearParseCache()` (`lib/scan`): drops the scan checkpoint + manifest
    cache + engine-mode probe.
  - Build footer shows real runtime values (engine / RN version / platform).
- **TODO — DEBUG toggles are UI-only:** Show parser logs / Inspect manifests / Performance overlay
  hold ephemeral local state and do nothing. Each needs a real feature (a log buffer + overlay, a
  manifest JSON sheet, a perf HUD) before wiring.
- **TODO — Seed demo data has no "remove":** re-running is a safe no-op, but there's no teardown.
  Could add a "Remove demo data" action that deletes rows where `canonicalBank = "demo-seed"` (+ the
  demo subscription/transactions).
- **TODO — version/build are hardcoded** (`1.4.0` / `412`, shared with About) since `app.json` has no
  version field. Source from a single config when one exists.

## 8. Appearance: wired, with follow-ups

- **Done (2026-06-15):** Appearance screen (`app/appearance.tsx`) — Theme (Light/Dark/Auto via
  `Uniwind.setTheme`, auto = "system"; `components/theme-applier.tsx`), live **app-wide accent**, a
  themed **`AppSlider`** for a continuous text scale, the toggles, and a live Preview. Prefs persist
  in `app_settings` (`lib/appearance/prefs.ts` pure model, `db/services/appearance-settings.ts`),
  read reactively via `useLiveQuery`.
- **Accent is applied via a context, not a CSS var.** uniwind can't override a theme variable at
  runtime on native, and a precompiled accent _theme_ is impractical (every theme must redefine
  heroui's entire token set — see the failed `extraThemes` attempt). So accent rides
  `lib/appearance/use-accent.tsx` (`AccentProvider` + `useAccent()`): one live query, consumed by the
  accent-aware components (Badge/Chip/Button accent variants, AppSwitch on-fill, the rules ValueChips,
  and the `NativeTabs` active tab in `app/(tabs)/_layout.tsx`).
- **Done (2026-06-15) — text size is app-wide.** `lib/appearance/use-text-scale.tsx`
  (`TextScaleProvider` + `useTextScale()`, one live query over `appearanceTextStep`) feeds
  `components/ui/text.tsx`, which now applies `fontSize = baseSize × scale` via `style` (base from the
  variant, or an explicit `text-[Npx]` class if present). The Appearance Preview keeps its own
  live-drag `previewScale` (call-site `style` wins over the injected size, so no double-scaling).
  Caveat: only the design-system `Text` scales — raw RN `Text` and fixed `leading-*` line-heights
  don't; revisit if clipping shows at 1.3×.
- **Done (2026-06-15) — compact density.** `lib/appearance/use-density.tsx` (`DensityProvider` +
  `useDensity()`) feeds the design-system `Card`, which tightens padding/gap app-wide when on
  (`p-[14px] gap-2` → `p-[10px] gap-1.5`; call-site `p-0`/`gap-0` overrides still win via
  tailwind-merge). Applied at the `Card` level — rows/containers built from raw Views don't tighten
  yet; extend if needed.
- **Done — background blur.** `lib/appearance/use-background-blur.tsx` (`BackgroundBlurProvider` +
  `useBackgroundBlur()`) + a reusable `components/ui/sheet-overlay.tsx` (`<SheetOverlay />`) layered
  over the default dim, swapped in for `<BottomSheet.Overlay />` across all the bottom sheets. Blur uses
  **expo-blur** (native `ExpoBlurView`), feature-detected — degrades to the flat dim on a dev client
  built before it was added; needs a rebuild to render. Not yet applied to the `PasteSmsSheet` `Modal`
  backdrop (custom, not a BottomSheet).
- **Done (2026-06-15) — accent stragglers.** `about.tsx` (hero dot) and `developer.tsx` (build
  footer) now use `useAccent()`. `modal.tsx` was deleted (see §10), so no static `bg-accent` remains.
- **Done — dead-file cleanup.** `app/modal.tsx` deleted (was an unused Expo demo; also removed its
  `Stack.Screen` registration in `_layout.tsx`). `components/ui/tab-bar.tsx` no longer exists — the
  backlog name was stale; the live component is `components/ui/bottom-bar.tsx`, which IS in use.

## 10. App-lock (PIN + biometric) ✅ DONE (2026-06-15)

- **Done:** matches the App-lock design — full-screen lock overlay (padlock + "unmiser is locked",
  4-dot PIN pad, "Use fingerprint"), reached via Settings → Data & Privacy → **App lock**. Biometric
  is the **primary** factor (auto-prompts on lock, default-on when available); the **4-digit PIN is
  the secondary fallback**. Cold-start always re-locks when enabled; a background-grace timeout
  (`0/1/5/15/30` min, Cashiro's options) governs foreground re-lock within a session.
  - PIN: salted SHA-256 in **expo-secure-store** (never in `app_settings`; ADR-0005) —
    `lib/security/pin.ts`. Config (enabled/biometric/timeout) in `app_settings`
    (`security.*` keys). Pure gate logic + prefs in `lib/security/app-lock.ts` (unit-tested).
  - Biometric via **expo-local-authentication** (`lib/security/biometric.ts`), fail-safe: a runtime
    without the native module degrades to PIN-only instead of crashing.
  - Runtime: `lib/security/use-app-lock.tsx` (`AppLockProvider` + AppState foreground gate) →
    overlay rendered by `AppLockGate` in `app/_layout.tsx`. Settings screen `app/app-lock.tsx`
    (master toggle + inline PIN setup/confirm + change-PIN + biometric toggle + timeout picker).
- **TODO — biometric needs a native rebuild.** `expo-local-authentication` was added after the
  current dev client was built, so fingerprint/face won't work until the dev build is rebuilt; the
  PIN path works today. The config plugin is wired in `app.json` for the next build.
- **TODO — no PIN-attempt lockout/reset.** Wrong PINs just clear and retry (no N-attempt cooldown,
  no forgot-PIN reset beyond disabling App-lock). Cashiro delegated this to the OS; revisit if needed.
