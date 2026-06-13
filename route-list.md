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

**7 bottom-nav tabs.** Add/edit flows are **inline state-toggled forms**; pickers are

**horizontal chip selectors**, not bottom sheets. Only one real modal component exists

(`PasteSmsSheet`, an RN `Modal`); there is **no `@gorhom/bottom-sheet` usage yet**.

```
Root Stack  (app/_layout.tsx — SmsOnboardingGate redirects first-run Android to /sms-setup)
├─ (tabs)  (app/(tabs)/_layout.tsx)
│   ├─ index            → redirects to /transactions (hidden tab)
│   ├─ ★ transactions   (app/(tabs)/transactions.tsx)
│   │   ↳ inline add form (amount, merchant, account/category/subcategory/type chips, transfer target)
│   │   ↳ search · type-filter chips · bulk-select + bulk delete
│   │   ↳ row tap → /transaction/[id] (modal)
│   ├─ ★ accounts       (app/(tabs)/accounts.tsx)
│   │   ↳ inline add/edit form (bank, last4, currency, type, credit limit) · set-main · delete (Alert)
│   ├─ ★ categories     (app/(tabs)/categories.tsx)
│   │   ↳ inline add/edit form (name, 8-color picker, income toggle)
│   │   ↳ accordion subcategories with inline add/edit/delete
│   ├─ ★ extensions     (app/(tabs)/extensions.tsx)
│   │   ↳ SMS permission + full/resume/cancel scan controls + live progress
│   │   ↳ install bundled extensions · per-plugin enable toggle · provider account linker
│   │   ↳ inline paste-SMS section · SMS Review list (newest 25) · dev UAT button
│   ├─ ★ rules          (app/(tabs)/rules.tsx)
│   │   ↳ inline rule builder (merchant-contains, set-category, priority) · save/preview/apply
│   │   ↳ active rules list · system templates list · recent applications
│   ├─ ★ subscriptions  (app/(tabs)/subscriptions.tsx)
│   │   ↳ Upcoming-30-days / Active / Hidden sections · inline hide / reactivate
│   └─ ★ store          (app/(tabs)/store.tsx)
│       ↳ PasteSmsSheet (components/paste-sms-sheet.tsx, RN Modal) ✓
│       ↳ SMS-setup link → /sms-setup · search + check-for-updates · catalog grouped by country
│
├─ transaction/[id]  (app/transaction/[id].tsx, presentation: modal)
│   ↳ view mode · inline edit mode (chip pickers) · delete + undo · mark-as-recurring
├─ modal  (app/modal.tsx, presentation: modal)   — placeholder/template, unused
├─ +not-found
│
└─ (onboarding)  (app/(onboarding)/_layout.tsx) — SMS-setup wizard at /sms-setup
    ├─ index        country select → /sms-setup/providers
    ├─ providers    install providers → /sms-setup/account
    ├─ account      optional account rename → /sms-setup/permissions
    ├─ permissions  grant SMS access (↳ PasteSmsSheet fallback) → /sms-setup/scan
    └─ scan         inbox scan + summary → finish → /(tabs)
```

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

**Settings tree (we have no Settings hub at all):**

- `▸ Settings` hub screen — currently absent; nothing links the config screens.
- `▸ Appearance` (theme/dark-mode), `▸ Profile`, `▸ NotificationSettings`.
- `▸ DataPrivacy` — export / PDF import / duplicate comparison.
- `▸ Webhooks` + `▸ WebhookEditor`.
- `▸ About` / `▸ Licenses` / `▸ DeveloperOptions`.
- `▸ AppLock` — PIN/biometric gate.
- Dedicated `▸ CreateRule` edit screen (vs our inline-only builder).
- `▸ UnrecognizedSms` as its own screen (we surface reviews inline in extensions).

**Likely de-scoped (per product direction — confirm before building):**

- `▸ Chat` (AI assistant) — memory note says **no offline AI**; probably intentionally dropped.

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

