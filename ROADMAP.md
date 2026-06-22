# Unmiser — Product Roadmap

> Status 2026-06-22. Cashiro (Android/Kotlin) audit → sequenced RN-port plan. Two non-negotiable pillars + owner's fixed decisions.
>
> **v1 = Android only. iOS deferred.** Engine is platform-agnostic (`(sender, body)` from any source) → iOS later = ingestion adapter only.
>
> Plugin-system architecture: `docs/plugin-architecture.md` (formerly §3 here).

---

## 1. Vision & Product Pillars

**Pillar 1 — Extension/Plugin Layer (USP).** Cashiro: 98 hand-written Kotlin bank parsers shipped in-app → doesn't scale, every bank fix = store release. Unmiser: one interpreter engine + downloadable declarative manifests (regex + field maps). Users install only their banks (2-bank user → 2 plugins, not 98). Fixes ship as manifest updates — no store review, offline after download. First priority after foundations.

**Pillar 2 — Behavior Change.** Audit: Cashiro = great visualization, near-zero intervention (only `recommendedDailySpending`). Unmiser: interrupt harmful patterns before/during spend (pre-spend nudges, pacing alerts, runway, anomalies) + reinforce good habits (weekly ritual, gain framing, report card). Principles: loss aversion, choice architecture, salience, commitment, gain framing.

---

## 2. Where We Are Now

Stack: Expo SDK 56, Drizzle ORM 1.0-rc, TanStack DB 0.6.5, React 19, RN 0.85.3, TS 6, Bun. **Phases 0–3 done; Phases 4 (production UI), 5 (budgets) and 8 (export/scheduler) are in progress; 6/7/9 pending.** 477 tests passing.

| Phase                               | State   | One-liner                                                                                                                 | Detail                                                     |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Phase 0 — Foundations**           | ✅ Done | 1:1 Drizzle port of Room v51, migrations, TanStack DB collection factory, balance cascade, money/date helpers.            | §3 Phase 0                                                 |
| **Phase 1 — Manual tracker**        | ✅ Done | Categories/accounts/cards/transactions CRUD, transfers, soft-delete+undo, balance time-series, drawer+tabs UI. 152 tests. | §3 Phase 1                                                 |
| **Phase 2 — SMS-parser USP**        | ✅ Done | Engine, manifests, registry, wizard, off-thread scan. Device-verified 2026-06-12 (~5.3k inbox → 161 saved, 92 review).    | `docs/phase-2-design-record.md`, `docs/phase-2-handoff.md` |
| **Phase 3 — Rules + subscriptions** | ✅ Done | Rules DSL + automation pipeline, mandates → subscriptions, matching. Device-verified 2026-06-12. 316 tests.               | `docs/phase-3-design-record.md`, `docs/phase-3-handoff.md` |
| **Phase 4 — Production UI**         | 🟨 In progress | Most wireframe screens shipped: 5-step onboarding, nav shell + tabs, app-lock, SMS console, extension store/detail, settings (quiet hours, privacy/terms), calendar date scrubber, transaction form screen. Home dashboard + final polish pass remain. | §3 Phase 4 |
| **Phase 5 — Budgets**               | 🟨 In progress | Budget data/service + progress/pacing/detail math, list/detail/history UI + charts, and the Pre-Spend Nudge in the Add form are built; Budget Pacing Alert surfacing + wizard polish remain. | §3 Phase 5 |
| **Phase 8 — Export + scheduler**    | 🟨 In progress | Export/restore service + file picker/share flow and Android Nitro scheduler bridge are built; webhook profiles/delivery + native-trigger drain still pending. | §3 Phase 8 |

**Not built:** Phase 6 analytics/full behavior-change, Phase 7 exchange rates, webhook profiles/delivery, and Phase 9 `api-source`. **In progress but incomplete:** Phase 4 home dashboard + polish, Phase 5 pacing-alert surfacing. **Deferred from P2:** realtime `RECEIVE_SMS` e2e device test (wiring verified), on-device update-apply with real version bump (unit-tested e2e), manifest signing (checksum-only v1; catalog `signature` reserved). **Deferred from P3:** recurring-pattern mining → P6.

---

## 3. Phased Roadmap

| Phase | Goal                                                    | Status         |
| ----- | ------------------------------------------------------- | -------------- |
| **0** | Foundations & data primitives                           | ✅ Done        |
| **1** | Categories (+seed), accounts/cards, manual transactions | ✅ Done        |
| **2** | **`sms-parser` plugin engine + ingestion (USP)**        | ✅ Done        |
| **3** | Rules engine + subscriptions/mandates                   | ✅ Done        |
| **4** | Production UI from wireframes                           | 🟨 In progress |
| **5** | Budgets + first behavior-change nudges                  | 🟨 In progress |
| **6** | Analytics/reports + full behavior-change pillar         | ⬜ Not started |
| **7** | Multi-currency exchange rates                           | ⬜ Not started |
| **8** | Webhooks / sync / export                                | 🟨 In progress |
| **9** | `api-source` plugins (vetted)                           | ⬜ Not started |

Order: foundations → USP early → UI → core features → behavior change → rates + sync → api-source. Two behavior features pulled into P5 so pillar 2 never fully defers.

### Phase 0 — Foundations & Data Primitives ✅ Done

Money helpers (`lib/money.ts`, lakh grouping), dates (`lib/dates.ts`), icon mapping, TanStack DB collection factory, `isSample`. Detail: `docs/prd/phase-0-1-foundations-and-manual-tracker.md`.

### Phase 1 — Categories, Accounts & Manual Transactions ✅ Done

Manual tracker: categories/subcategories CRUD + 33/200+ seed, merchant mappings, accounts/cards (last4 linking, Cash wallet, main-account), balance time-series + recalc cascade, transactions (CRUD/transfer/soft-delete+undo/per-txn currency/search/filter/bulk). Detail: `docs/prd/phase-0-1-foundations-and-manual-tracker.md`, `docs/phase-1-ui-backlog.md`.

### Phase 2 — `sms-parser` Plugin Engine (USP) ✅ Done

One engine + installable extensions. Shipped: worklet-safe engine (`lib/parser/`), manifest schema/validation + fixtures, extension storage, Nitro SMS module + native pre-screen, jsDelivr registry (checksum install, pull updates), onboarding wizard, off-thread scan w/ checkpoint/resume, ADR-0006 auto-create, paste fallback, 12 bundled manifests (99 in store). Device-verified 2026-06-12: ~5.3k inbox → 161 auto-saved, 92 review (exit criterion ✅), no JS-thread fallback.

Spec + decided design (workstreams A–D) + evidence: **`docs/phase-2-design-record.md`**. Handoff: `docs/phase-2-handoff.md`.

### Phase 3 — Rules Engine + Subscriptions/Mandates ✅ Done

Shipped: rules DSL/interpreter (valibot, ADR-0013) + `ruleApplications` audit, system templates + rule-pack install, automation pipeline (merchant mapping → rules → save → audit → subscription matching) on every commit path, `BLOCKED_BY_RULE`/`MANDATE_PARSE_FAILED` review paths, engine `mandate` block + HDFC e-mandate, UMN/fallback dedup (ADR-0014), txn→subscription matching + manual recurring link, Rules + Subscriptions tabs. Device-verified 2026-06-12; 316 tests.

Spec + evidence: **`docs/phase-3-design-record.md`**. Plan: `docs/phase-3-plan.md`. Handoff: `docs/phase-3-handoff.md`.

### Phase 4 — Production UI from Wireframes

- **STATUS:** In progress. Shipped: 5-step onboarding (Welcome→Archetype→Country→SMS→Done), navigation shell + tabs, app-lock, SMS console, extension store/detail, settings surfaces (quiet hours, privacy/terms), transactions calendar date scrubber, transaction form as a full screen. Remaining: home dashboard, net-worth/account surfaces, and the final polish pass; dev harness stays `__DEV__`-gated.
- **GOAL:** Replace the dev/utility screens with the real product UI per **`unmiser Wireframes.html`** (repo root — the design source of truth: screen areas + per-screen explorations).
- **SCOPE:** Implement the wireframes' app structure and screens over the existing data/services layer (Phases 0–3 logic unchanged): navigation shell, onboarding/SMS-permission flow polish, home dashboard, SMS auto-log + transaction review, extension store, account/net-worth surfaces, settings. Theme via existing heroui-native + uniwind system; lists via `@legendapp/list`.
- **DELIVERABLES:** Wireframe-faithful screens replacing the current tab stubs/dev harnesses (dev harness stays `__DEV__`-gated), updated navigation, UI polish pass on existing flows.
- **DEPS:** P0–3 (all data + automation already built; this phase is presentation).
- **WHY NOW:** Engine + automation proven on device; current UI is dev-grade. Real UI needed before budgets/behavior features land on user-facing surfaces.

### Phase 5 — Budgets + First Behavior-Change Nudges

- **STATUS:** In progress. Shipped: budget collection + `budget-ops`, progress/pacing/detail math (`lib/budgets/`), budgets list + detail + history screens with charts, budget form sheet, and the **Pre-Spend Nudge** in the Add form (budget impact before save). Remaining: surfacing **Budget Pacing Alerts** on user-facing screens, account scoping, and wizard polish.
- **GOAL:** Per-category budgets + earliest proactive signals.
- **SCOPE:** Budgets — periods (DAILY/WEEKLY/MONTHLY/YEARLY/CUSTOM), expense vs savings, track modes (ALL vs ADDED_ONLY), per-category limits, account scoping, real-time progress + `recommendedDailySpending`, history/trends. Behavior (pillar 2, early): **Budget Pacing Alerts** (loss aversion; `daysRemaining`/`percentUsed`), **Pre-Spend Nudge** (budget impact in Add sheet pre-save).
- **DELIVERABLES:** Budgets list/detail/wizard, limit tracking, pacing + pre-spend integrations.
- **DEPS:** P1, P3, P4 (txns, categories, subscriptions for ADDED_ONLY; UI shell).
- **WHY NOW:** Budget math = cheapest high-impact nudges; proves pillar 2 mid-roadmap.

### Phase 6 — Analytics/Reports + Full Behavior-Change Pillar

- **GOAL:** Insight visualizations + complete intervention set.
- **SCOPE:** Analytics — trends (line/bar/heatmap), category breakdown, top merchants, summary card, period/custom range, type filter, balance trend. Behavior (§4 full list): Category Creep, Cashflow Runway, Smart Home Warnings, Weekly Ritual, Savings gain framing, Anomaly Detection, Subscription Pause, Recurring Audit, Monthly Report Card (+streaks, auto-adjust, impulse timer). Plus P3-deferred recurring-pattern mining.
- **DELIVERABLES:** Analytics screen, home widgets, scheduled-insight jobs, new tables (weekly_goals, monthly_report, streak_state).
- **DEPS:** P1–5. **WHY NOW:** behavior features need accumulated trends/budgets.

### Phase 7 — Multi-Currency Exchange Rates

- **SCOPE:** fawazahmed0 currency-api (jsdelivr + cloudflare fallback), 3-tier cache (memory → `exchangeRates` table → API) w/ expiry, USD-intermediate cross-rates, base currency from main account, refresh centralized in one manager.
- **DELIVERABLES:** Provider + conversion service, currency picker, central refresh.
- **DEPS:** P1, 5, 6. **WHY NOW:** cross-cutting, not blocking single-currency users; centralize after consumers exist.

### Phase 8 — Webhooks / Sync / Export

- **STATUS:** In progress. Export/restore and the Android scheduler bridge are built; webhook profile storage, delivery service, logs, and UI remain.
- **SHIPPED SO FAR:** Export/restore service with FULL/MASKED/ANONYMOUS modes, document picker/share integration, and tests. Android Nitro scheduler package (`react-native-unmiser-scheduler`) with WorkManager interval/manual triggers, AlarmManager scheduled triggers, boot re-apply, and JS wrapper. The native scheduler records pending webhook triggers for JS to drain; it does not yet perform closed-app HTTP delivery.
- **REMAINING SCOPE:** Webhook profiles + data-type selection, cursor/incremental sync (successAt == rangeEnd invariant), 250/batch, retry + redirect handling, delivery logging, scheduled settings UI, and draining pending native triggers into the JS sync manager.
- **DELIVERABLES:** Sync manager + webhook profile UI, pending-trigger drain, delivery logs, scheduler wiring, export/backup/import.
- **DEPS:** P1–6. **WHY NOW:** power-user/portability layer; lower priority than pillars.

### Phase 9 — `api-source` Plugins (Vetted)

- **SCOPE:** `api-source` interpreter (`docs/plugin-architecture.md` §3.4), OAuth/creds in Keychain, allowlist/vetting registry, mapping into txn pipeline; 1–2 reference integrations (broker official API, PF via AA).
- **DEPS:** P2 (plugin model), P7 (multi-currency). **WHY LAST:** highest trust/security surface, most external deps.

---

## 4. Behavior-Change Features (Pillar 2 Detail)

Priority: **Core** = P5–6; **Important** = P6; **Nice-to-have** = P6+.

| Feature                            | Principle                  | Data / logic                                                                            | Priority       |
| ---------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- | -------------- |
| **Budget Pacing Alerts**           | Loss aversion              | `BudgetWithSpending` burn-rate projection at 50/75/90/100%; alert if projected > amount | Core (P5)      |
| **Pre-Spend Nudge**                | Choice architecture        | `(currentSpending + newAmount)/amount` in Add sheet                                     | Core (P5)      |
| **Category Creep Detection**       | Awareness vs autopilot     | Month vs trailing-3-mo category avg; alert if dev > 30% AND abs diff > threshold        | Core (P6)      |
| **Cashflow Runway**                | Scarcity framing           | Liquid balances / (last-30d expenses / 30); warn < 30 days                              | Core (P6)      |
| **Smart Spend Warnings (Home)**    | Salience at check-in       | Count budgets projected-over w/ daysRemaining > 5                                       | Core (P6)      |
| **Weekly Spending Ritual**         | Commitment device          | Last-7d by category; top cats, biggest expense; `weekly_goals` table                    | Core (P6)      |
| **Savings Goal Framing**           | Gain framing               | `budgetType = SAVINGS` → "saved X of Y"; milestones 25/50/75%                           | Important (P6) |
| **Merchant Spending Context**      | Anchoring at entry         | `MerchantData` avg/min/max/last visit in add/detail                                     | Important (P6) |
| **Anomaly Detection**              | Salience on outliers       | Amount > 2× merchant avg / > 3× category weekly avg; `is_anomaly` flag                  | Important (P6) |
| **Subscription Pause Suggestions** | Inertia override           | Category unused 2+ billing cycles → flag + annual waste                                 | Important (P6) |
| **Recurring Transaction Audit**    | Quarterly forcing function | Recurring txns/subs by merchant; monthly-equivalent total                               | Important (P6) |
| **Monthly Report Card**            | Accountability             | Month-end budgets graded A–F vs last month; 2 action items; `monthly_report`            | Important (P6) |
| **Streak Tracking**                | Gamification               | Consecutive zero-discretionary days; `streak_state` prefs                               | Nice-to-have   |
| **Budget Auto-Adjust Suggestions** | Realistic goals            | 3-mo utilization; suggest reallocation if <70% vs >110%                                 | Nice-to-have   |
| **Impulse Delay Timer**            | Cooling-off                | Discretionary + > ₹1000 → 60s timer + alternative framing                               | Nice-to-have   |

---

## 5. Explicitly Out of Scope

- **Offline/on-device AI (Cashiro chat).** No AI: `chat` package, MediaPipe/Qwen, model downloads, `AiContextRepository`, `chatMessages` UI all excluded (table stays unused; droppable later).
- **iOS — entire platform out of v1.** No build, no ingestion, no cross-platform SMS abstraction. Engine stays source-agnostic for later.
- **Android mechanisms deferred:** Quick Settings tiles, boot-receiver semantics, RCS/MMS. (`RECEIVE_SMS` + `READ_SMS` ARE in scope — P2.)
- **PDF statement import** (GPay/PhonePe via PDFBox) — separate from parser USP.
- **Sample-data as shipped feature** — `isSample` = dev/seed only.

---

## 6. Risks & Open Questions

| Risk / question                    | Why                                                                                  | Mitigation / open                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Android SMS native module**      | Restricted permission; Play needs declared core use case + review.                   | Module behind engine boundary; prep Play declaration early; paste fallback if denied/rejected.                               |
| **iOS (deferred)**                 | Post-v1.                                                                             | Engine source-agnostic → additive adapter. **Open:** which iOS ingestion (paste/Share Sheet/forwarding) has lowest friction. |
| **Declarative expressiveness**     | ~18% of banks (HDFC waterfall, SBI/AMEX post-processing) don't reduce to regex+maps. | Hybrid: `fallbackToBuiltin` hook. **Open:** how rich can manifest conditionals get before a built-in is cheaper?             |
| **`api-source` trust**             | Outbound calls + user creds = exfiltration risk.                                     | Vetted/allowlisted only; secrets in Keychain. **Open:** who vets, what's the bar?                                            |
| **Banks changing SMS formats**     | Silent format change breaks a parser.                                                | Versioned manifests, no-store-review fixes. **Open:** drift detection via `unrecognizedSms` telemetry / parse confidence?    |
| **Registry & distribution**        | Community plugins need hosting/discovery/trust signals.                              | Catalog + integrity (checksum now). **Open:** signing, community-submission flow, `community` vs `vetted` surfacing.         |
| **Decimal precision**              | TEXT BigDecimal amounts; JS floats lossy.                                            | decimal.js since P0; never raw `number` for money.                                                                           |
| **TanStack DB ↔ Drizzle at scale** | Financial collections add cascades (transfer dual-balance, recalc-after-edit).       | Collection factory generalized P0; test rollback + cascade edges (`recalculateBalancesAfter` flagged complex).               |
