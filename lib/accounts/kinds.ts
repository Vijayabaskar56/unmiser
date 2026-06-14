import type { AccountKind } from "@/db/services/account-ops";

/**
 * Per-kind UI metadata for the Add-a-source picker, the create/edit form, and
 * the list/detail labels. Single source of truth so "which kinds are wired this
 * phase" and "which fields a kind shows" live in one place.
 *
 * `enabled: false` kinds (PF / insurance / investment) render in the picker but
 * disabled — the schema + model already carry them; the feature lands later.
 *
 * `icon` is a UI-sprite id (rendered with <SpriteIcon>), kept as a plain string
 * so this module stays RN-free and unit-testable.
 */
export interface KindMeta {
  kind: AccountKind;
  /** Picker title, e.g. "Bank account". */
  label: string;
  /** Secondary-line word when there's no subtype, e.g. "wallet". */
  short: string;
  icon: string;
  description: string;
  /** Wired this phase. */
  enabled: boolean;
  /** Asks for the last-4 digits (BANK/CREDIT). */
  hasLast4: boolean;
  /** BANK-only savings/salary/current subtype. */
  hasSubtype: boolean;
  /** CREDIT-only credit limit. */
  hasCreditLimit: boolean;
  /** Balance is entered by hand (no SMS feed). */
  manualBalance: boolean;
}

export const KIND_META: readonly KindMeta[] = [
  {
    kind: "bank",
    label: "Bank account",
    short: "bank",
    icon: "bank",
    description: "savings, salary or current — auto-tracked from SMS",
    enabled: true,
    hasLast4: true,
    hasSubtype: true,
    hasCreditLimit: false,
    manualBalance: false,
  },
  {
    kind: "credit",
    label: "Credit card",
    short: "credit",
    icon: "credit-card-01",
    description: "auto-tracked from SMS, with a limit",
    enabled: true,
    hasLast4: true,
    hasSubtype: false,
    hasCreditLimit: true,
    manualBalance: false,
  },
  {
    kind: "cash",
    label: "Cash",
    short: "wallet",
    icon: "coins-01",
    description: "a wallet balance you keep up to date",
    enabled: true,
    hasLast4: false,
    hasSubtype: false,
    hasCreditLimit: false,
    manualBalance: true,
  },
  {
    kind: "pf",
    label: "Provident fund",
    short: "provident fund",
    icon: "file-02",
    description: "EPF / PPF balance",
    enabled: false,
    hasLast4: false,
    hasSubtype: false,
    hasCreditLimit: false,
    manualBalance: true,
  },
  {
    kind: "insurance",
    label: "Insurance",
    short: "insurance",
    icon: "shield-tick",
    description: "policy value",
    enabled: false,
    hasLast4: false,
    hasSubtype: false,
    hasCreditLimit: false,
    manualBalance: true,
  },
  {
    kind: "investment",
    label: "Investment",
    short: "investment",
    icon: "trend-up-01",
    description: "stocks, mutual funds & more",
    enabled: false,
    hasLast4: false,
    hasSubtype: false,
    hasCreditLimit: false,
    manualBalance: true,
  },
] as const;

const BY_KIND: Record<string, KindMeta> = Object.fromEntries(KIND_META.map((m) => [m.kind, m]));

export function kindMeta(kind: AccountKind): KindMeta {
  return BY_KIND[kind] ?? KIND_META[0];
}

/** Map a stored row's flags/sourceKind back to the UI `AccountKind`. */
export function rowToKind(row: {
  sourceKind?: string | null;
  isCreditCard?: boolean;
  isWallet?: boolean;
}): AccountKind {
  switch (row.sourceKind) {
    case "CREDIT":
      return "credit";
    case "CASH":
      return "cash";
    case "PF":
      return "pf";
    case "INSURANCE":
      return "insurance";
    case "INVESTMENT":
      return "investment";
    case "BANK":
      return "bank";
    default:
      // Pre-migration fallback from the legacy flags.
      return row.isCreditCard ? "credit" : row.isWallet ? "cash" : "bank";
  }
}
