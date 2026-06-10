# Unmiser

React Native (Expo) port of the **Cashiro** Android/Kotlin expense tracker. See `ROADMAP.md`
for the sequenced plan and product pillars. Architecture decisions live in `docs/adr/`.

## Reference: the original Android app (source of truth for behavior)

The original Kotlin app is cloned at:

```
/Users/vijayabaskar/work/references/Cashiro
```

When porting a feature, **read the original Kotlin first** — it is the behavioral spec. High-value
paths:

- `parser-core/src/main/.../com/ritesh/parser/core/` — the already-extracted SMS parser engine
  (`ParsedTransaction`, `MandateInfo`, `SmsFilter`, `CompiledPatterns`, `TransactionType`) and
  per-bank parsers under `.../bank/`. This is the model for the RN plugin engine (ROADMAP §3).
  (Note: `parser-core/bin/` is compiled output — read `src/`, not `bin/`.)
- `app/src/main/java/com/ritesh/cashiro/` — the app: `data/`, `domain/model/`, `presentation/`
  (accounts, transactions, budgets, subscriptions, rules, settings/sms, settings/rules).
- `docs/` — `architecture.md`, `BANK_SUPPORT.md`, `CONTRIBUTING_BANK_PARSERS.md`,
  `database-migrations.md`, `design.md`, `parser-test-standards.md`, `state-management.md`.

Other reference repos (TanStack, super-app-showcase, Kvaesitso, etc.) live alongside it under
`/Users/vijayabaskar/work/references/`. The `btca` skill searches that directory.

## Agent skills (TanStack DB)

`@tanstack/db` and `@tanstack/react-db` ship versioned Agent Skills in `node_modules` via
`@tanstack/intent`. Before doing TanStack DB work, run `bunx @tanstack/intent@latest list` and
`load <package>#<skill>` (e.g. `@tanstack/db#db-core/live-queries`,
`@tanstack/db#db-core/mutations-optimistic`). Skill-loading guidance also lives in `AGENTS.md`.
These skills are the **source of truth for the installed version** — prefer them over training
knowledge. (Note: this is `@tanstack/intent` "skill" — agent dev-time knowledge — NOT a runtime
bank-parser "plugin"; see `CONTEXT.md` flagged ambiguities.)

## Dev server & device cast (cmux Dock + tmux)

The Android dev server and scrcpy device cast run via cmux Dock controls (`.cmux/dock.json`),
each wrapped in a persistent tmux session by `.cmux/dock-session.sh` so they survive cmux
workspace switches (the Dock panel only detaches the tmux client; the process keeps running).

- tmux session: named after the git root folder — currently `cashrio-rn` (the project was
  rebranded to Unmiser but the directory hasn't been renamed). One window per process:
  - window `dev` — `bunx expo prebuild --clean --platform android && bunx expo run:android`,
    logs tee'd to `/tmp/unmiser-dev.log`
  - window `scrcpy` — device cast to the test phone, logs tee'd to `/tmp/unmiser-scrcpy.log`
- **Check dev/Metro logs**: `tail -f /tmp/unmiser-dev.log` (or
  `tmux capture-pane -p -t cashrio-rn:dev` for the live pane).
- **Don't start a second dev server** — if `tmux has-session -t cashrio-rn` succeeds, the dev
  server is already running there. To restart it, kill the window's process inside tmux
  (e.g. `tmux send-keys -t cashrio-rn:dev C-c` then re-run), not a fresh terminal.
- **Known dev-log noise**: on every dev-client launch Metro logs one ERROR —
  "Can't perform a React state update on a component that hasn't mounted yet" from
  `expo-router/build/fork/useLinking.native.js` (`onUnhandledLinking` setState on the unhandled
  `unmiser://expo-development-client/?url=...` launch URL before the navigator mounts).
  Upstream expo-router bug (see expo/expo#35224), dev-only, harmless — do not chase it, and do
  NOT LogBox-ignore that message (it would mask real premature-setState bugs in app code).

## RN port current state

Phase 0 + Phase 1 built: full Drizzle schema (`db/schema/*`, 1:1 with Android Room v51), relations,
migrations, the TanStack DB collection factory + per-table collections, the balance-cascade service,
and the manual-tracker UI — categories/subcategories CRUD, accounts CRUD, and transactions
(add/edit/transfer/soft-delete, search/filter/bulk). 152 tests. The starter todos demo has been
removed. SMS/parser engine (Phase 2) and beyond not yet built. See `ROADMAP.md` and `docs/`.
