---
status: accepted
---

# Merchant name: declarative cleaning in the engine; learned mappings with a fixed categorization precedence

Two layers turn a raw SMS into a categorized transaction's merchant:

1. **Cleaning** stays declarative in the parser engine (manifest `cleaning` block: `stripPatterns`,
   `commonWords`, `minMerchantLength`, `isValidMerchantName`). It produces the display merchant name
   from the raw SMS body.
2. **Learned mapping**: on user (re)categorization, upsert `merchantMappings[cleanedMerchant] = categoryId`
   (keyed on the case-normalized cleaned name). During ingestion, after cleaning, look it up and
   auto-assign the category (Cashiro: `merchantMappingRepository.getCategoryForMerchant`).

**Categorization precedence (highest wins):**
`rules engine (Phase 3)` > `learned merchantMapping` > `parser's guessed category`.

## Consequences

- `merchantMappings.merchantName` is the cleaned, case-normalized key — cleaning must be deterministic
  so the same merchant always maps to the same row.
- The precedence chain is the contract for both real-time ingestion and batch apply-to-past; the
  rules engine (Phase 3) can override a learned mapping, and a learned mapping overrides the parser.
