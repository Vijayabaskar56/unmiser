# Route List &amp; Gap Analysis

Maps every screen and its in-screen integrations (bottom sheets, dialogs, pickers,

sub-flows) for **(1)** the original Cashiro Android app — the behavioral spec — and

**(2)** our Unmiser Expo Router port, then lists the **gaps**: what exists in ours,

and what routes are still needed.

- Original (source of truth): `/Users/vijayabaskar/work/references/Cashiro`
- Ours: `/Users/vijayabaskar/work/unmiser/app` (Expo Router, file-based)

Legend: `▸` screen/route · `↳` in-screen sheet/dialog/picker/sub-flow · `★` bottom-nav tab

---

## 1. Cashiro (original Android app)

Navigation: Jetpack Compose `NavHost` with `@Serializable` destinations

(`presentation/navigation/CashiroDestinations.kt`, `CashiroNavHost.kt`).

**Only 2 bottom-nav tabs** (Home, Analytics); everything else is a pushed route.

Add/edit flows are dedicated screens; pickers are **bottom sheets**, not inline.

```
Root
├─ ★ Home  (features/home/HomeScreen.kt)
│   ↳ More-options sheet · Edit-widgets sheet · Currency-selection sheet
│   ↳ Breakdown dialog · Full-resync confirm dialog · SMS-parsing-progress dialog
├─ ★ Analytics  (features/analytics/AnalyticsScreen.kt)
│   ↳ Date-range-picker dialog · Chart-type selector · Currency filter
│
│
├─ Transactions  (features/transactions/TransactionsScreen.kt)
│   ↳ Filter sheet (→ number-pad sheets for min/max) · Currency sheet
│   ↳ Date-range dialog · Delete-multiple dialog · Export dialog · Sort menu
├─ TransactionDetail  (.../TransactionDetailScreen.kt)
│   ↳ Category sheet · Account sheet · Target-account sheet (transfers)
│   ↳ Number-pad sheet · Match-preview sheet (rule suggestions)
│   ↳ Date picker · Time picker · Delete dialog · Type/billing-cycle dropdowns
├─ AddTransaction  (features/add/AddScreen.kt)  — FAB overlay, two tabs
│   ↳ Transaction tab: category/account/target-account/number-pad sheets, date & time pickers
│   ↳ Subscription tab: + billing-cycle menu, custom unit/count/end-date pickers
│
├─ Subscriptions  (features/subscriptions/SubscriptionsScreen.kt)
│   ↳ Delete-subscription dialog · expandable SMS-body view
│
├─ Budgets  (features/budgets/BudgetsScreen.kt)
│   ↳ Edit-budget sheet (number-pad, category, account, dates, color)
│   ↳ Budget-type wizard · Budget-track-type wizard
├─ BudgetDetail  (.../BudgetDetailScreen.kt)    ↳ Edit-budget sheet · pie chart
├─ BudgetHistory (.../BudgetHistoryScreen.kt)
│
├─ Categories  (features/categories/CategoriesScreen.kt)
│   ↳ Edit-category sheet (icon selector, color picker) · Edit-subcategory sheet
│   ↳ Category-migration sheet (delete-with-txns) · Delete dialog · Filter menu
│
├─ ManageAccounts  (features/accounts/ManageAccountsScreen.kt)
│   ↳ Add-account sheet · Edit-account sheet (number-pad, icon, currency)
│   ↳ Balance-update sheet · Balance-history sheet
│   ↳ Merge flow (selection → balance-option → manual-input → confirm) · Delete dialog
├─ AddAccount   (features/accounts/AddAccountScreen.kt)
├─ AccountDetail (features/accounts/AccountDetailScreen.kt)  — account txn history
│
├─ Settings  (features/settings/SettingsScreen.kt)   — hub linking the below
│   ↳ Language sheet · Delete-AI-model dialog
│   ├─ Appearance        (.../appearance/AppearanceScreen.kt)   theme, blur, nav style
│   ├─ Profile           (features/profile/ProfileScreen.kt)    ↳ Edit-profile sheet (image/color/banner)
│   ├─ SmsSettings       (.../settings/sms/SMSScreen.kt)        ↳ Scan-period dialog
│   │   └─ UnrecognizedSms (.../unrecognized/...)               ↳ Delete dialog · SMS-body view
│   ├─ Rules             (.../settings/rules/RulesScreen.kt)
│   │   │  ↳ Batch-apply dialog · Delete dialog · Reset dialog · per-rule menu
│   │   └─ CreateRule    (.../rules/CreateRuleScreen.kt)        ↳ Category sheet · Account sheet
│   ├─ NotificationSettings (.../notifications/...)
│   ├─ Webhooks          (.../webhooks/WebhooksScreen.kt)       ↳ Delete dialog
│   │   └─ WebhookEditor (.../webhooks/WebhookEditorScreen.kt)
│   ├─ DataPrivacy       (.../dataprivacy/DataPrivacyScreen.kt)
│   │   ↳ PDF-import sheet (→ duplicate-comparison sheet) · Export-options dialog · PDF-processing dialog
│   ├─ Budgets (link, see above)
│   └─ About             (.../about/AboutScreen.kt)
│       ├─ Licenses      (.../about/LicensesScreen.kt)
│       └─ DeveloperOptions (.../developer/DeveloperScreen.kt)
│
├─ OnBoarding  (features/onboarding/OnBoardingScreen.kt)  — single first-run screen
└─ AppLock     (.../applock/AppLockScreen.kt)             — PIN/biometric gate
```

Reusable sheets/dialogs (`presentation/ui/components/`): category, account, currency,

language pickers; date / date-range / time pickers; color picker; number pad;

SMS-parsing-progress; generic delete dialogs.

---

## 2. Unmiser (our Expo Router port)

Navigation: file-based under `app/`. `(tabs)` and `(onboarding)` are layout groups.

**Current IA (verified 2026-06-15):** the bar is now **`NativeTabs`** (`app/(tabs)/_layout.tsx`) —
the custom `components/ui/tab-bar.tsx` is **dead/unused** (safe to delete). Four tabs around a centre
**＋** action: **Home · Log · ＋ · Grow · Hub**. Everything else is a **root-stack route pushed from
the Hub** (no `href:null` tabs anymore). Most add/edit flows use **inline form sheets + chip
selectors** (no `@gorhom/bottom-sheet` yet); the design-system primitive kit (`components/ui/`) backs
all real screens.

Legend additions: `●` = real, shipped screen · `◐` = real shell, some rows/tabs noop or phase-blocked ·
`▱` = `ComingSoon` stub · `▸DEV` = `__DEV__`/hidden utility (not product UI).

```
Root Stack  (app/_layout.tsx — fonts/splash; SmsOnboardingGate redirects first-run → /sms-setup)
├─ (tabs)  (app/(tabs)/_layout.tsx — NativeTabs)
│   ├─ ★ index          Home   ▱ (app/(tabs)/index.tsx)          dashboard stub → Phase 5/6
│   ├─ ★ transactions   Log    ● (app/(tabs)/transactions.tsx)   transaction feed
│   │   ↳ inline add form · search · type-filter chips · bulk delete · row → /transaction/[id]
│   ├─ ＋  (centre action) → /add  (not a tab; manual capture)
│   ├─ ★ grow            Grow   ▱ (app/(tabs)/grow.tsx)           insights/net-worth/budgets stub → P5/6
│   └─ ★ settings        Hub    ● (app/(tabs)/settings.tsx)       Settings hub (links 13 screens)
│       ↳ profile card (live txn count) → /profile ●
│       ↳ Money:  /accounts ● · /budgets ▱ · /categories ● · /rules ● · /subscriptions ●
│       ↳ App:    /appearance ● · /language ◐ · /notifications ● · /extensions ● · /store ●
│       ↳ Data:   /data-privacy ◐
│       ↳ About:  /about ◐
│
│   Pushed from Hub / list screens (root-stack routes):
├─ accounts        ● — list + kind picker + add/edit sheet · set-main/delete
│   └─ account/[id]      ● — detail + activity tab + edit/delete/set-main  (Insights tab ▱ → P6)
├─ categories      ● — Expense/Income tabs + form sheet
│   └─ category/[id]     ● — detail + subcategories + recent txns + edit/delete  (Insights tab ▱ → P6)
├─ rules           ● — list + unrecognised banner + match counts
│   ├─ rule/new          ● — builder (field/op/value + cat/acct/flag actions) + live preview + apply-to-past
│   ├─ rule/[id]         ● — IF/THEN + matched txns + toggle/run-on-past/delete  (no edit — backlog §4)
│   └─ unrecognised      ● — unrecognised-SMS list + dismiss / add-sender-rule (reached from rules banner)
├─ subscriptions   ● — Upcoming/Active/Hidden + form sheet
│   └─ subscription/[id] ● — detail + edit/hide/delete
├─ extensions      ● — SMS console: install bundled parsers, link accounts, paste/scan, realtime, review
├─ store           ● — registry browse + install/update (99-extension catalog via jsDelivr) + PasteSmsSheet
├─ profile         ● — banner/archetype picker + name + financial overview + stats
├─ appearance      ● — theme/accent/text-scale/toggles + preview      (backlog §8 follow-ups)
├─ notifications   ● — master switch + money/app toggles + scheduled sync  (backlog §5 follow-ups)
├─ language        ◐ — 14-language catalog renders, but NOT persisted, no i18n runtime
├─ data-privacy    ◐ — on-device statement + wipe-all real; export/import/webhooks/app-lock rows noop
├─ about           ◐ — hero + real version/build; What's-new/Rate/Share/Licenses/legal rows noop
│   └─ developer        ● — dev toggles + re-parse/seed/clear-cache + build info (7-tap gate on version)
├─ budgets         ▱ (app/budgets.tsx)  — whole budgeting pillar → Phase 5
├─ add             ▱ (app/add.tsx)      — ＋ destination; manual add (+ manual subscription-create) → P4/5
│
├─ transaction/[id]  ● (modal) — view / inline edit / delete+undo / mark-recurring
├─ design-system     ▸DEV (app/design-system.tsx) — primitive preview (/design-system)
├─ modal ▸DEV (leftover template demo, never linked — safe to delete) · +not-found
│
└─ (onboarding)  (app/(onboarding)/_layout.tsx) — SMS-setup wizard at /sms-setup
    ├─ index → providers → account → permissions (↳ PasteSmsSheet) → scan → finish → /(tabs)
```

**Reality vs. the old tree:** the Settings hub now links **13** screens (Money · App · Data · About +
a profile card), and the previously-"ComingSoon" sub-screens — **profile, appearance, accounts,
categories, rules, subscriptions, notifications** — are all **built**. Detail drill-ins
(`account/[id]`, `category/[id]`, `subscription/[id]`, `rule/[id]`, `rule/new`, `unrecognised`) exist.
Remaining stubs are **Home, Grow, add, budgets**; `language`/`data-privacy`/`about` are partial.
Per-screen status detail lives in `docs/phase-4-ui-backlog.md` §0.

---

## 3. Gap analysis

### Routes we already have (parity or new)  — verified 2026-06-15

| Area                     | Cashiro                          | Unmiser                          | Notes                                                 |
| ------------------------ | -------------------------------- | -------------------------------- | ----------------------------------------------------- |
| Transactions list        | ✅                               | ✅                               | ours inline-add vs their FAB/AddScreen                |
| Transaction detail       | ✅                               | ✅ `/transaction/[id]`           | ours inline-edit; missing their sheets                |
| Subscriptions            | ✅                               | ✅ list **+ detail/edit**        | `subscription/[id]` (edit/hide/delete) now built      |
| Categories               | ✅                               | ✅ list **+ detail**             | `category/[id]`; still no icon-picker / migration sheet |
| Accounts (manage)        | ✅                               | ✅ list **+ detail**             | `account/[id]` drill-in; no merge / balance-history   |
| Rules                    | ✅ Settings›Rules + CreateRule   | ✅ list + `rule/new` + `rule/[id]` | dedicated builder + detail; no **edit** yet (backlog §4) |
| SMS settings / review    | ✅ SmsSettings + UnrecognizedSms | ✅ extensions + `/unrecognised`  | review folded into extensions; `/unrecognised` is its own screen |
| Profile                  | ✅ (sheet)                       | ✅ `/profile`                    | banner/archetype/name/overview/stats                  |
| Appearance               | ✅                               | ✅ `/appearance`                 | theme/accent/text-scale/toggles (follow-ups backlog §8) |
| Notifications            | ✅ NotificationSettings          | ✅ `/notifications`              | toggles + scheduled sync (follow-ups backlog §5)      |
| DeveloperOptions         | ✅                               | ✅ `/developer`                  | 7-tap gate on About version                           |
| Onboarding               | ✅ single screen                 | ✅ 5-step SMS wizard             | ours is richer                                        |
| **Extensions (plugins)** | ✗                                | ✅ **new**                       | our USP — plugin layer                                |
| **Store (marketplace)**  | ✗                                | ✅ **new**                       | our USP — 99-extension store                          |

### Partial — shell built, sub-flows noop or phase-blocked

- `◐ Language` — catalog renders but selection **not persisted**, no i18n runtime.
- `◐ DataPrivacy` — wipe-all real; **export/import** (→ Phase 8) + **webhooks** (→ P8) + **app-lock**
  (unscheduled) rows are noop.
- `◐ About` — version real; What's-new / Rate / Share / **Licenses** / legal links noop.
- `◐ Account/Category detail "Insights" tab` — placeholder; depends on **Phase 6 analytics**.

### Routes still needed (present in Cashiro, missing in ours)

**High value (core tracker parity):**

- `▸ Home / Dashboard` — ▱ stub today; overview/balances/widgets → **Phase 5/6**.
- `▸ Grow / Analytics` — ▱ stub today; charts/date-range/breakdown → **Phase 6**.
- `▸ Budgets` + `▸ BudgetDetail` + `▸ BudgetHistory` — ▱ stub; whole pillar (no schema) → **Phase 5**.
- `▸ AddTransaction` proper (esp. the **Subscription tab** to create a subscription by hand) — ▱ `add`
  stub; ours has no manual subscription-create path → **Phase 4/5**.

**Settings tree (hub ✅; most sub-screens now built):**

- `▸ Settings` hub — ✅ **done**, links 13 screens (Money · App · Data · About + profile card).
- `▸ Appearance`, `▸ Profile`, `▸ Notifications`, `▸ DeveloperOptions` — ✅ **built**.
- `▸ Language`, `▸ DataPrivacy`, `▸ About` — ◐ **partial** (see above).
- `▸ Budgets` — ▱ stub (Phase 5).
- `▸ Webhooks` + `▸ WebhookEditor` — still missing → **Phase 8**.
- `▸ Licenses` — still missing (own screen; `about` row is noop).
- `▸ AppLock` — still missing (unscheduled).
- Rule **edit** (reopen `rule/new` pre-filled) — missing (backlog §4); detail/create already built.

**Out of scope (resolved):**

- `▸ Chat` / on-device AI — **OUT.** The user confirmed: no on-device / offline AI. Ignore the
  on-device-AI bits in the `design/` hi-fi (Settings "Data & Privacy → on-device AI", the hidden
  "AI Chat Assistant · Qwen 2.5") — those are stale. Data & Privacy is export / import / backup only.

### In-screen integration gap (cross-cutting)

Cashiro is **bottom-sheet driven**: category/account/currency pickers, number pad,

color/icon pickers, date &amp; time pickers are all `ModalBottomSheet`s, reused across

screens. Unmiser currently uses **inline chip pickers + state-toggled forms** and ships

**zero bottom sheets** (only `PasteSmsSheet`, an RN `Modal`). `@gorhom/bottom-sheet` is a

dependency but unused. Reaching UX parity implies building a shared sheet kit:

- Category-selection sheet, Account-selection sheet, Currency sheet
- Number-pad sheet, Date picker, Time picker
- Color picker, Icon picker
- Confirm/delete dialog primitive (we use `Alert.alert` ad hoc today)

### Suggested priority order  (updated 2026-06-15 — ✅ = now done)

1. **Dashboard/Home** + **Grow/Analytics** (the stub tabs — biggest visible gap) → P5/6.
2. **Budgets** pillar (new schema + 3 screens) → P5.
3. **Manual AddTransaction / Subscription-create** (the `add` stub). ✅ **AccountDetail drill-in done.**
4. ✅ **Settings hub + Appearance/Profile/Notifications/Developer done.** Remaining: DataPrivacy export
   /import + **Webhooks** + **Licenses** + **AppLock** (→ P8 / unscheduled); finish Language i18n.
5. **Shared bottom-sheet kit** to replace inline pickers (refactor, improves all of the above).
6. ✅ **Chat — resolved OUT of scope** (no on-device AI).
7. **Cleanup:** delete dead `components/ui/tab-bar.tsx` and `app/modal.tsx`.
