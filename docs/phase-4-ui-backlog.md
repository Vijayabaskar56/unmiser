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

| Route | Notes |
| --- | --- |
| `(tabs)/transactions.tsx` (Log) | feed + inline add + search + type chips + bulk delete |
| `(tabs)/settings.tsx` (Hub) | profile card + Money/App/Data/About sections |
| `accounts.tsx` | list + kind picker + add/edit form sheet · drill-in `account/[id]` |
| `account/[id].tsx` | detail + activity tab + edit/delete/set-main (**Insights tab is a stub**) |
| `categories.tsx` | Expense/Income tabs + form sheet · drill-in `category/[id]` |
| `category/[id].tsx` | detail + subcategories + recent txns + edit/delete (**Insights tab is a stub**) |
| `rules.tsx` | list + unrecognised banner + match counts |
| `rule/new.tsx` | builder (field/op/value + category/account/flag actions) + live preview + apply-to-past |
| `rule/[id].tsx` | IF/THEN + matched txns + toggle-active + run-on-past + delete (**no edit — see §4**) |
| `subscriptions.tsx` | Upcoming/Active/Hidden + form sheet · drill-in `subscription/[id]` |
| `subscription/[id].tsx` | detail + edit/hide/delete |
| `transaction/[id].tsx` | modal detail + inline edit + soft-delete+undo + mark-recurring |
| `extensions.tsx` | SMS console: install bundled parsers, link accounts, paste/scan, realtime listener, review |
| `store.tsx` | registry browse + install/update from the 99-extension catalog over jsDelivr + paste-SMS fallback |
| `appearance.tsx` | theme/accent/text-scale/toggles + preview (follow-ups in §8) |
| `notifications.tsx` | master switch + money/app toggles + scheduled sync (follow-ups in §5) |
| `profile.tsx` | banner/archetype picker + name + financial overview + stats |
| `unrecognised.tsx` | unrecognised-SMS list + dismiss / add-sender-rule (reached from the rules banner) |
| `developer.tsx` | dev toggles + re-parse/seed/clear-cache + build info (7-tap gate, follow-ups in §6) |

These supersede the `route-list.md` "ComingSoon stubs" claims for **profile, appearance, accounts,
categories, rules, data-privacy(partial)** — all now built.

### PARTIAL — shell shipped, sub-flows noop or phase-blocked

- **`language.tsx`** — 14-language catalog renders, but selection is **not persisted** and there is
  **no i18n runtime**. Needs a locale store + a translation layer (own follow-up; not a Phase-4 dep).
- **`data-privacy.tsx`** — on-device statement + wipe-all are **real**; **export / import / webhooks /
  app-lock** rows are noop placeholders. Export/import is Phase 8 (Webhooks/Sync/Export); app-lock has
  no phase yet (Cashiro has `AppLockScreen` — currently unscheduled).
- **`about.tsx`** — hero + real version/build; **What's-new / Rate / Share / Licenses / Privacy /
  Terms** rows are noop. Licenses needs its own screen (Cashiro `LicensesScreen`); legal links need URLs.
- **`account/[id].tsx` & `category/[id].tsx` Insights tabs** — placeholder; depend on **Phase 6
  analytics** (per-entity trends/breakdown).

### STUB — `<ComingSoon>`, blocked on a future phase

| Route | Blocked on |
| --- | --- |
| `(tabs)/index.tsx` (Home dashboard) | **Phase 5/6** — overview/balances/widgets |
| `(tabs)/grow.tsx` (Grow) | **Phase 5/6** — insights / net-worth / budgets surfaces |
| `(tabs)/add.tsx` (centre ＋) | **Phase 4/5** — manual add; esp. the manual **subscription-create** path Cashiro has and we lack |
| `budgets.tsx` | **Phase 5** — whole budgeting pillar (schema + list/detail/wizard) |

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

## 3. Dead entity-icon path (ADR-0003)

- **Status:** the `<Icon>` component (`components/icon.tsx`) + nano-icons font + brand-WebP
  resolution are no longer used by any screen — the sprite supersedes them.
- **Fix:** retire `components/icon.tsx` / `lib/icon-registry` / `lib/icons/{nano-icon,brand-map,
category-glyphmap}` once nothing imports them, and update ADR-0003 to name the sprite as the
  entity-icon source.

## 4. Smart Rules: editing an existing rule's conditions/actions

- **Status:** the rule detail screen (`app/rule/[id].tsx`) supports toggle-active, run-on-past, and
  delete, but not editing the IF/THEN of an existing rule (the mockup's pencil). Create-rule
  (`app/rule/new.tsx`) is create-only.
- **Fix:** let the pencil open the rule builder pre-filled (e.g. `rule/new?edit=<id>` loading the
  rule), reusing `saveRule` (which already upserts by id). Multi-condition rules (AND/OR) are also
  not yet buildable in the UI — the engine supports multiple conditions but `new.tsx` builds one.
- **Engine note:** the interpreter's `ruleMatches` uses `.every()` (AND); `logicalOperator: "OR"`
  on conditions is stored but not honoured. Wire OR if the builder ever exposes it.

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
- **TODO — Quiet hours are fixed (10pm–8am):** the row is display-only (no `onPress`). Constant lives
  in `lib/notifications/prefs.ts` (`QUIET_HOURS`). Add a time-range picker + persist start/end keys.
- **TODO — Large-transaction threshold is a constant** (`LARGE_TRANSACTION_THRESHOLD = 5000`, INR,
  no FX). Make it user-configurable and currency-aware when FX lands.
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
  runtime on native, and a precompiled accent *theme* is impractical (every theme must redefine
  heroui's entire token set — see the failed `extraThemes` attempt). So accent rides
  `lib/appearance/use-accent.tsx` (`AccentProvider` + `useAccent()`): one live query, consumed by the
  accent-aware components (Badge/Chip/Button accent variants, AppSwitch on-fill, the rules ValueChips,
  and the `NativeTabs` active tab in `app/(tabs)/_layout.tsx`).
- **TODO — text size is Preview-only.** The slider persists `textScale` and scales the Preview, but
  it is NOT applied app-wide. Wire it by having `components/ui/text.tsx` multiply its resolved size by
  a reactive scale (a `useTextScale()` context like `useAccent`), since sizes are class-based today.
- **TODO — Background blur / Compact density are inert.** They persist + drive the Preview only.
  Blur → gate the bottom-sheet/overlay blur; density → a compact spacing scale consumed by
  cards/rows. Both need a real mechanism.
- **TODO — accent stragglers.** A few low-traffic spots still use the static `bg-accent` class
  (`app/modal.tsx`, `app/about.tsx`, `app/developer.tsx`) — convert to `useAccent()` for full
  coverage.
- **Cleanup — dead `components/ui/tab-bar.tsx`.** The custom tab bar was replaced by `NativeTabs`
  (`app/(tabs)/_layout.tsx`); the file (and its dot/label wiring) is unused and safe to delete.
