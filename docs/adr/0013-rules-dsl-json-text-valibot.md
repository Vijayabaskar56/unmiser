---
status: accepted
---

# Rules DSL: JSON-in-text columns, validated with valibot, ported enums verbatim

`transactionRules.conditions` and `.actions` stay **JSON strings** in `text` columns (as the ported
schema types them). The DSL is defined as a **valibot** schema in TS (chosen over zod for its
smaller, tree-shakeable footprint on React Native), validated on write and parsed on read:

- `Condition { field: TransactionField, operator: ConditionOperator, value, logicalOperator: AND|OR }`
- `Action { type: ActionType, field?, value? }`

Cashiro's enums are ported **verbatim** for behavioral parity (8 transaction fields × ~17 operators —
`EQUALS/NOT_EQUALS/CONTAINS/NOT_CONTAINS/STARTS_WITH/…/GREATER_THAN/…` — × 5 actions
`SET/APPEND/PREPEND/CLEAR/BLOCK`).

Evaluation is an interpreter: match a transaction's conditions, then apply actions in `priority`
order. **`BLOCK` short-circuits and prevents the save.** When an action sets a subcategory, its
parent category is auto-resolved and set. Every application is logged to `ruleApplications`
(audit). Rules run both real-time in the ingestion pipeline and as a batch apply-to-past. System
templates seed with `isActive = false` (opt-in) via the static-seed pattern (ADR-0004).

Categorization precedence (ADR-0012): rules > learned merchantMapping > parser default.

## Consequences

- valibot is the project's standard schema validator (revisit if another need forces zod).
- The JSON blobs are opaque to SQL queries; rule matching happens in app code over parsed objects,
  not via SQL on the columns.
