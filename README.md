# Unmiser

**Change your relationship with money.**

A miser fears money. An unmiser understands it. Unmiser is a local-first expense
tracker for Android that reads your bank SMS **on-device** — nothing ever leaves
your phone — and turns the noise of transaction messages into a clear picture of
where your money goes, so you can change the habits behind it.

Unmiser is a React Native (Expo) port of the Cashiro Android app, rebuilt
around two pillars:

1. **A plugin-based SMS parser.** Every bank parser is a plain JSON manifest
   bundled with the SMS fixtures that prove it. A small default set ships in
   `lib/parser/manifests/`; the full community store (99+ banks) lives in the
   separate [unmiser-extensions](https://github.com/Vijayabaskar56/unmiser-extensions)
   repo — anyone can author a bank without writing code.
2. **Behavior change, not just tracking.** Budgets, review queues, and spending
   insight are framed around changing your money habits.

## Privacy

SMS parsing happens entirely on-device. There is no telemetry, no phone-home,
no account. Unrecognized messages are kept locally so _you_ can choose to
report them (one tap pre-fills a GitHub issue you submit yourself). See
`docs/adr/0015-unrecognized-sms-minimal-local-capture.md`.

## Stack

- **Expo / React Native** (New Architecture), expo-router, Reanimated, uniwind
- **expo-sqlite + Drizzle ORM** — schema 1:1 with the original Android Room DB
- **TanStack DB** — reactive collections + incremental live queries
- **Nitro Modules** — the native SMS adapter (`packages/react-native-cashrio-sms`)
- **Vitest, oxlint/oxfmt, Husky**

## Getting started

```bash
bun install
bun android        # expo run:android (dev client, physical device/emulator)
```

## Tests & checks

```bash
bun run test       # vitest — includes fixture validation for the bundled parser plugins
bun run check      # oxlint + oxfmt
bunx tsc --noEmit
```

## Authoring a bank parser plugin

Contribute banks to the
[unmiser-extensions](https://github.com/Vijayabaskar56/unmiser-extensions)
store — a plugin is one JSON file (manifest + fixtures) validated against the
same engine this app runs. The engine source of truth is `lib/parser/` here;
`bun scripts/generate-manifest-schema.ts` regenerates the authoring JSON
Schema, and `bun scripts/validate-manifest.ts <file>` validates a single
bundle locally.

## Project docs

- `ROADMAP.md` — sequenced plan and product pillars
- `docs/adr/` — architecture decision records
- `CLAUDE.md` / `AGENTS.md` — agent and contributor working notes
