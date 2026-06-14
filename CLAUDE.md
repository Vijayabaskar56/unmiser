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
  per-bank parsers under `.../bank/`. This is the model for the RN plugin engine
  (`docs/plugin-architecture.md`).
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

## Dev server & device cast

- use /orca-cli to listen for the dev server and interact with it , always start or restart is listen dev server via orca only !!

## RN port current state

`ROADMAP.md` is the single source of truth for phase/feature status (§2 "Where We Are Now" and the
per-phase sections) — check it there rather than duplicating it here. Architecture detail lives in
`docs/` and `docs/adr/`.

<!-- HEROUI-NATIVE-AGENTS-MD-START -->

[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output CLAUDE.md|components/(buttons):{button.mdx,close-button.mdx,link-button.mdx}|components/(collections):{menu.mdx,tag-group.mdx}|components/(controls):{slider.mdx,switch.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-group.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,search-field.mdx,select.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,list-group.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(typography):{text.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,create-heroui-native-app.mdx,rc-1.mdx,rc-2.mdx,rc-3.mdx,rc-4.mdx,v1-0-0.mdx,v1-0-1.mdx,v1-0-2.mdx,v1-0-3.mdx,v1-0-4.mdx}

<!-- HEROUI-NATIVE-AGENTS-MD-END -->
