# Architecture: The Plugin System

> Moved from `ROADMAP.md` §3 (2026-06-13 cleanup) — legacy citations "ROADMAP §3.x" resolve to the
> matching subsection here. Built in Phases 2–3 (`docs/phase-2-design-record.md`,
> `docs/phase-3-design-record.md`); `api-source` ships in the final phase. Implementation source of
> truth: `lib/parser/`, `lib/registry/`, `db/schema/sms.ts`.

### 3.1 The typed-plugin model

Plugin = typed declarative capability, user-installed. Two types, two trust tiers:

| Type         | Does                                               | Data flow                                   | Trust                                        | Status                 |
| ------------ | -------------------------------------------------- | ------------------------------------------- | -------------------------------------------- | ---------------------- |
| `sms-parser` | Bank SMS → `ParsedTransaction`                     | Pure fn over local string; no network/creds | Safe-by-construction → open install          | **BUILT (P2)**         |
| `api-source` | Pulls txns from external APIs (brokers, PF via AA) | Outbound calls w/ user credentials          | Vetted/allowlisted only; secrets in Keychain | Design now, build last |

Engine-first, extension-driven: app ships generic interpreter; bank behavior lives in manifests. Gnarly banks (HDFC merchant waterfalls, SBI post-parse overrides) → richer manifest DSL primitives, NOT app-bundled bank code. Scraping-style sources may stay built-in.

### 3.2 `sms-parser` manifest schema

Downloaded into local DB, interpreted offline. Blocks: identity (`pluginId`/`name`/`country`/`currency`/`version`), `dispatch` (senders + DLT patterns), `filter` (exclude/requireAny keywords), `extract` (ordered named-capture regex lists: amount/merchant/balance/reference/accountLast4), `typeRules` (investment/expense/income/CC keywords), `cleaning` (strip patterns, min length, common words), `mandate` (optional: detectKeyword + amount/date/merchant/UMN extractors + dateFormat), `pipeline` (declarative conditionals: `rejectWhen`, `extractFieldWhen`, `setFieldWhen`, `fallbackField`, `confidenceWhen`).

**Source of truth (implemented):** `lib/parser/manifest-schema.ts` (zod) + generated `manifest.schema.json`. Examples: `lib/parser/manifests/*.json`, store repo `unmiser-extensions/manifests/`. Version bump = fix shipped without store review.

### 3.3 The interpreter engine — responsibilities

One engine runs every manifest. Owns:

- **Dispatch**: sender vs installed manifests, first match wins (mirrors `BankParserFactory`).
- **Filter**: exclude/requireAny waterfall (`isTransactionMessage`).
- **Extraction**: ordered named-capture regexes + `takeLast4` + merchant validation (len ≥ 2, has letters, not VPA, not all digits).
- **Classification**: investment-first, then expense/income/credit.
- **Cleaning**: stripPatterns/commonWords.
- **Card-vs-account**: exclusion list → inclusion list, declarative.
- **Dedup**: `MD5(sender | normalizedAmount(2dp) | smsBodyHash[:16])`; skip existing `transactionHash`.
- **Mandate**: `mandate` block → emit `MandateInfo` for subscription pipeline.
- **Conditional pipeline**: declarative branches/overrides/fallbacks for gnarly formats — no bank-specific app code.

Simple banks = basic regex maps; gnarly banks = pipeline primitives. No compiled-parser monolith.

### 3.4 `api-source` manifest (future, sketch)

`{ type: "api-source", trust: "vetted", auth: { method, secretsKeys }, endpoints, mapping (JSONPath) }`. Secrets in expo-secure-store/Keychain — never DB/manifest. Vetted/allowlisted only (outbound calls + creds = exfiltration risk).

### 3.5 Installed plugins in DB / TanStack DB

- `plugins` table (manifest JSON, type, version, trust, enabled, installedAt) + `plugin_assets` (manifest body). TanStack DB optimistic layer over drizzle/expo-sqlite.
- Offline after download; version bump re-syncs one bank, no store release.
- `unrecognizedSms` captures unhandled messages → "install the parser you need" loop + telemetry.

### 3.6 SMS ingestion — Android v1 (iOS deferred)

Android allows `READ_SMS`/`RECEIVE_SMS` → direct read. Native module feeds engine `(sender, body)`:

| Source         | Path                                                  | Notes                                           |
| -------------- | ----------------------------------------------------- | ----------------------------------------------- |
| **Real-time**  | `RECEIVE_SMS` broadcast → engine on arrival           | Mirrors `SmsBroadcastReceiver`; needs dev build |
| **Historical** | One-time `READ_SMS` scan (first run / opt-in re-scan) | Mirrors `SmsReaderWorker`                       |

Engine is source-agnostic → iOS later (paste/Share Sheet/forwarding) = additive adapter, same manifests. Paste-SMS fallback ships on Android too (permission-denied users).
