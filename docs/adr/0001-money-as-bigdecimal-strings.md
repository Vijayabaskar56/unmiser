---
status: accepted
---

# Money is a bare BigDecimal string plus an explicit currency argument

The Drizzle schema (ported 1:1 from Android Room) stores every monetary field as a `text`
BigDecimal string with `currency` as a separate sibling column. We keep that as the canonical
in-app representation: amounts stay strings and `lib/money.ts` exposes pure functions that take
currency as an explicit argument (`add(a, b, ccy)`, `format(amount, ccy)`, `compare(a, b)`),
with `decimal.js` (HALF_EVEN rounding, to mirror Java `BigDecimal`) as the swappable internal
math engine. We rejected a `Money { amount, currency }` value object (adds pack/unpack ceremony
on every DB read/write and to every prop, to prevent a cross-currency bug that cannot occur until
Phase 6) and `dinero.js` (its integer minor-unit model fights the BigDecimal-string source of
truth — wrong exponent for 0-/3-decimal currencies, and forces reconstructing the exact 2dp
string the dedup hash depends on).

## Consequences

- Currency-safety is by convention, not by type. Nothing stops `add(inrAmount, usdAmount, "INR")`.
  Mitigation: the Phase 6 conversion service becomes the _only_ place two currencies meet, plus a
  dev-mode assertion in the money helpers.
- Because currency is already an explicit argument on every helper, Phase 6 multi-currency adds a
  `convert()` function rather than re-typing `add`/`format`/`compare` — no signature drift.
- The decimal engine is hidden behind the `lib/money.ts` functions, so `decimal.js` vs `big.js`
  stays a one-file swap.
- **Currency display config (extends this ADR):** a static currency-config map (decimals — most=2,
  JPY/KRW/VND=0, BHD/KWD/OMR=3; grouping — Indian lakh/crore for INR/NPR, Western thousands else)
  feeds a small custom `format(amount, ccy)`. We do NOT use `Intl.NumberFormat` — Hermes' Intl is
  unreliable across RN builds and the roadmap requires lakh grouping. (Dedup's `normalizedAmount(2dp)`
  is a hash key and stays at 2dp regardless of currency — see ADR-0010.)
