---
status: accepted
---

# Subscriptions: UMN-deduped, ACTIVE/HIDDEN lifecycle, 5% transaction matching

The parser engine emits `MandateInfo` (amount, nextDeductionDate, merchant, **UMN**) for e-mandate /
UPI-mandate SMS. Subscriptions are created from it:

- **Dedup by UMN** (unique key): re-seeing the same UMN **updates** the existing subscription, never
  creates a duplicate.
- **Lifecycle is ACTIVE / HIDDEN — never hard-delete.** A HIDDEN subscription that sees a fresh
  mandate **reactivates** to ACTIVE.
- **Billing cycles:** standard presets + custom encoded as `custom_COUNT_UNIT_ENDDATE`.
- **Transaction → subscription matching:** a transaction matches a subscription within a **5% amount
  tolerance** (and merchant/cycle plausibility), marking it as that subscription's payment.
- **Monthly-equivalent normalization** lets subscriptions on different cycles be summed/compared.

## Consequences

- UMN is the stable identity for mandate-sourced subscriptions; mandates without a UMN (some banks)
  need a fallback identity (merchant + amount + cycle) — decide when building the mandate pipeline.
- HIDDEN (not delete) preserves history and enables reactivation, mirroring the soft-delete stance
  for transactions (ADR-0008).
