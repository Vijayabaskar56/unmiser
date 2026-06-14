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

**Phase 4 IA (wireframe):** a custom design-system `TabBar` (`components/ui/tab-bar.tsx`,
passed to expo-router `Tabs` via the `tabBar` prop) — a **flush dark/inverted bar, icon-only,
with a yellow active-dot**. Four real tabs around a centre **＋** action: **Home · Log · ＋ ·
Grow · Hub**. `backBehavior="history"` so hardware-back returns to the previous screen. Most
add/edit flows are still **inline forms + chip selectors** (no `@gorhom/bottom-sheet` yet); the
design-system primitive kit (`components/ui/`) + the Settings hub are the first Phase-4 UI.

Legend additions: `●` = real screen on the design-system kit · `▱` = `ComingSoon` stub ·
`(href:null)` = in the tab navigator but **not** in the bar (reached by pushing from the Hub).

```
Root Stack  (app/_layout.tsx — fonts/splash; SmsOnboardingGate redirects first-run → /sms-setup)
├─ (tabs)  (app/(tabs)/_layout.tsx — custom TabBar)
│   ├─ ★ index          Home   ▱ (app/(tabs)/index.tsx)          → dashboard (Phase 5)
│   ├─ ★ transactions   Log    ● (app/(tabs)/transactions.tsx)   transaction feed
│   │   ↳ inline add form · search · type-filter chips · bulk delete · row → /transaction/[id]
│   ├─ ＋  (centre action) → /add  (not a tab; manual capture)
│   ├─ ★ grow            Grow   ▱ (app/(tabs)/grow.tsx)           → insights/net-worth/subs (P5/6)
│   ├─ ★ settings        Hub    ● (app/(tabs)/settings.tsx)       Settings hub
│   │   ↳ ink profile card (live txn count) → /profile ▱
│   │   ↳ ListGroup rows → /appearance ▱ · /language ▱ · /accounts ● · /budgets ▱ ·
│   │     /categories ● · /rules ● · /data-privacy ▱
│   │
│   ├─ accounts (href:null)      ● — add/edit/set-main/delete · reached from Hub
│   ├─ categories (href:null)    ● — inline add/edit + subcategory accordion · from Hub
│   ├─ rules (href:null)         ● — inline rule builder + templates + applications · from Hub
│   ├─ extensions (href:null)    ● — SMS scan/permission/install/review  ⚠ ORPHANED (no entry yet)
│   ├─ store (href:null)         ● — extension marketplace + PasteSmsSheet ⚠ ORPHANED (no entry yet)
│   └─ subscriptions (href:null) ● — Upcoming/Active/Hidden                ⚠ ORPHANED (no entry yet)
│
├─ add            ▱ (app/add.tsx)            — ＋ destination; manual add (Phase 4/5)
├─ profile        ▱ (app/profile.tsx)        ┐
├─ appearance     ▱ (app/appearance.tsx)     │ Settings sub-screens — designs in design/,
├─ language       ▱ (app/language.tsx)       │ ComingSoon stubs for now (pushed over tabs,
├─ budgets        ▱ (app/budgets.tsx)        │ AppBar with back)
├─ data-privacy   ▱ (app/data-privacy.tsx)   ┘
│
├─ transaction/[id]  ● (modal) — view / inline edit / delete+undo / mark-recurring
├─ design-system     ● (app/design-system.tsx) — __DEV__ primitive preview (/design-system)
├─ modal · +not-found
│
└─ (onboarding)  (app/(onboarding)/_layout.tsx) — SMS-setup wizard at /sms-setup
    ├─ index → providers → account → permissions (↳ PasteSmsSheet) → scan → finish → /(tabs)
```

**Wired up:** the previously-orphaned **Subscriptions** (Money section), **Extensions** and
**Store** (App section) are now reached from the **Settings hub**, grouped into Money · App · Data
sections. (Note: the tree above predates the native-tabs switch — those screens are now root stack
routes pushed from Settings, not `href:null` tabs; the bar itself is now `NativeTabs`.)

---

## 3. Gap analysis

### Routes we already have (parity or new)


| Area                     | Cashiro                         | Unmiser                      | Notes                                         |
| ------------------------ | ------------------------------- | ---------------------------- | --------------------------------------------- |
| Transactions list        | ✅                               | ✅                            | ours inline-add vs their FAB/AddScreen        |
| Transaction detail       | ✅                               | ✅ `/transaction/[id]`        | ours inline-edit; missing their sheets        |
| Subscriptions            | ✅                               | ✅                            | ours list-only; no detail/edit                |
| Categories               | ✅                               | ✅                            | ours inline; no icon picker / migration sheet |
| Accounts (manage)        | ✅                               | ✅ accounts tab               | ours inline; no merge / balance-history       |
| Rules                    | ✅ Settings›Rules + CreateRule   | ✅ rules tab                  | ours inline builder, no dedicated edit screen |
| SMS settings / review    | ✅ SmsSettings + UnrecognizedSms | ✅ folded into extensions tab |                                               |
| Onboarding               | ✅ single screen                 | ✅ 5-step SMS wizard          | ours is richer                                |
| **Extensions (plugins)** | ✗                               | ✅ **new**                    | our USP — plugin layer                        |
| **Store (marketplace)**  | ✗                               | ✅ **new**                    | our USP — 99-extension store                  |


### Routes still needed (present in Cashiro, missing in ours)

**High value (core tracker parity):**

- `▸ Home / Dashboard` — overview, balances, widgets, currency switcher. We have **no home**; index just redirects to transactions.
- `▸ Analytics` — charts, date-range, spend breakdown. **Entirely missing.**
- `▸ Budgets` + `▸ BudgetDetail` + `▸ BudgetHistory` — the whole budgeting pillar. **Missing** (no schema, no routes).
- `▸ AccountDetail` — per-account transaction history. We have an accounts list but no drill-in.
- `▸ AddTransaction` proper (esp. the **Subscription tab** for creating a subscription by hand) — ours has no manual subscription-create path at all.

**Settings tree (hub ✅ built as the Hub tab; sub-screens are stubs):**

- `▸ Settings` hub — ✅ **done** (`app/(tabs)/settings.tsx`, the Hub tab), links the config screens.
- `▸ Appearance`, `▸ Profile`, `▸ Language`, `▸ Budgets`, `▸ DataPrivacy` — ▱ **`ComingSoon` stubs**
  wired from the hub; designs exist in `design/` (Appearance, Profile, Data & Privacy ready to build).
- `▸ NotificationSettings`, `▸ Webhooks` + `▸ WebhookEditor`, `▸ About` / `▸ Licenses` /
  `▸ DeveloperOptions`, `▸ AppLock` — still missing (not in the current hub design).
- Dedicated `▸ CreateRule` edit screen (vs our inline-only builder).
- `▸ UnrecognizedSms` as its own screen (we surface reviews inline in extensions).

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

### Suggested priority order

1. **Dashboard/Home** + **Analytics** (the two original tabs — biggest visible gap).
2. **Budgets** pillar (new schema + 3 screens).
3. **Manual AddTransaction / Subscription create** + **AccountDetail** drill-in.
4. **Settings hub** and its sub-screens (Appearance, DataPrivacy/export, Webhooks, About, AppLock).
5. **Shared bottom-sheet kit** to replace inline pickers (refactor, improves all of the above).
6. Confirm whether **Chat** is in or out of scope.

