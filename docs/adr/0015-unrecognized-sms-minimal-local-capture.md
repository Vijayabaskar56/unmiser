---
status: accepted
---

# `unrecognizedSms`: minimal local capture + one-tap manual report, no telemetry

Bank-like SMS that no installed manifest parsed are captured in the existing `unrecognizedSms` table
(sender, body, timestamp), deduped, scoped to bank-like senders (not all SMS). They surface as a
quiet "messages we couldn't read yet" list with a one-tap **Report** that pre-fills a GitHub issue
(sender + body) the user submits manually.

**No registry telemetry, no auto phone-home, no nagging prompt.** Nothing leaves the device unless
the user taps Report.

## Why keep it (vs. dropping it entirely)

Capture is the **detection layer** that makes the manifest-update loop (Pillar 1) actually work, and
it is distinct from the fix-delivery mechanism:

- Without capture, a missed bank SMS is a **silent missed transaction** — balances, budget pacing,
  and cashflow runway go quietly wrong, which directly undermines the behavior-change pillar.
- "Raise an issue" presupposes the user noticed the gap and can produce the SMS content. Capture +
  one-tap report supplies both; otherwise the report loop starves.

Detection (`unrecognizedSms`) and fix-delivery (versioned manifest update) are complementary, not
alternatives.

## Consequences

- Capture is scoped to bank-like senders to avoid hoarding personal messages; tune the sender
  heuristic when building ingestion.
- If a registry/telemetry signal is ever wanted, it must be a separate, explicit opt-in
  (sender-prefix only, never body).
- Re-running the parser over captured rows after a manifest update should retro-create the missed
  transactions (respecting dedup, ADR-0010).
