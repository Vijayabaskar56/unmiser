---
status: accepted
---

# Category/subcategory seed + reset: a static seed module keyed by `seedKey`, not Android's `default_*` columns

Cashiro's `CategoryEntity` carries five nullable reset columns (`default_name`, `default_color`,
`default_icon_res_id`, `default_icon_name`, `default_description` — `CategoryEntity.kt:43-56`) so a
user can edit a **system category** and later reset it to the shipped original. The RN port dropped
all five (the ported `categories`/`subcategories` tables have only `isSystem`). We resolve the
resulting roadmap/schema contradiction by **not restoring `default_*`** and instead:

- A **static seed module** (`lib/seed/categories.ts`) is the single source of truth: it defines the
  ~33 categories + 200+ subcategories with `seedKey`, default `name`, `color`, `iconName`
  (per ADR-0003), `isIncome`, `displayOrder`, and nested subcategories. It is the authoring source
  for both the seed and the icon mapping.
- A **Drizzle migration generated from that module** inserts the rows (`isSystem = true`), reusing
  the already-wired `useMigrations` pipeline. Idempotent, versioned.
- A new nullable **`seedKey`** column on `categories` and `subcategories`: a stable identity
  (e.g. `"food"`) for system rows, `NULL` for user-created rows.
- **Edit:** users may edit system categories (name/color/icon); the row changes, `seedKey` does not.
- **Add:** users may create their own categories/subcategories (`isSystem = false`, `seedKey = NULL`).
- **Reset:** a runtime function restores a system row from the seed module matched by `seedKey` —
  works even after a rename, because the match is on `seedKey`, not the user-editable `name`.

## Why `seedKey` over `default_*`

`seedKey` is reset-capable with **one** stable-identity column instead of **five** denormalized
default columns, and keeps the canonical defaults in code (DRY) rather than copied onto every row.
It is a cleaner design than the Android original. Restoring `default_*` was rejected: the port has
already deliberately diverged from strict 1:1 (it normalized `accountBalances`, dropped these), so
fidelity is not the goal here.

## Consequences

- `categories.name` has a unique index. Reset restoring a default `name` can collide if the user
  meanwhile created another category with that name — reset must handle the collision (fail softly
  or suffix). Flagged for the Phase-1 reset implementation.
- Hard-deleting a system (or any) category is constrained by `transactions.categoryId` (NOT NULL FK).
  System categories likely need a hide/disable affordance rather than delete — but no `isHidden`
  column exists yet. Out of scope for this ADR; decide when building the Categories screen.
- The seed module is also the natural home for the seed-time `merchantMappings` (learned
  merchant → category) if any ship by default.
