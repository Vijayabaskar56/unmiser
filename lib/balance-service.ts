import Decimal from "decimal.js";

// Money is always carried at 2-decimal scale with banker's rounding (HALF_EVEN),
// matching the BigDecimal money domain of the original Cashiro app.
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

const MONEY_SCALE = 2;

function money(value: Decimal): string {
  return value.toFixed(MONEY_SCALE);
}

export type TxnType = "INCOME" | "EXPENSE" | "INVESTMENT" | "CREDIT" | "TRANSFER";

export interface Reading {
  id: number;
  balance: string;
  timestamp: string;
  sourceType: SourceType | null;
  transactionId?: number | null;
  transactionAmount?: string | null;
  transactionType?: TxnType | null;
  // The linked transaction's SMS-stated post-transaction balance (transactions.balance_after),
  // joined onto the reading. When present it is ground truth and anchors this row even if the
  // row's sourceType is TRANSACTION_CALCULATED (mirrors the Kotlin `transactionBalanceAfter` guard).
  transactionBalanceAfter?: string | null;
  isCreditCard: boolean;
}

export type SourceType =
  | "TRANSACTION_CALCULATED"
  | "TRANSACTION_SMS_BALANCE"
  | "SMS_BALANCE"
  | "MANUAL"
  | "MANUAL_EDIT"
  | "CARD_LINK"
  | "MAIN_ACCOUNT_SYNC";

export function calculateBalance(
  currentBalance: string,
  amount: string,
  type: TxnType,
  isCreditCard: boolean,
): string {
  const current = new Decimal(currentBalance);
  const amt = new Decimal(amount);

  // Ported verbatim from AccountBalanceRepository.calculateBalance (Kotlin).
  if (isCreditCard && type === "INCOME") {
    // A payment toward a credit card reduces the amount owed, floored at zero.
    return money(Decimal.max(current.minus(amt), 0));
  }
  if (isCreditCard) {
    // Any other credit-card activity (spend) increases the amount owed.
    return money(current.plus(amt));
  }
  if (type === "INCOME") {
    return money(current.plus(amt));
  }
  if (type === "EXPENSE" || type === "INVESTMENT") {
    // Spending cannot drive a normal account negative.
    return money(Decimal.max(current.minus(amt), 0));
  }
  // CREDIT / TRANSFER on a normal account leave the balance unchanged here.
  return money(current);
}

// Source types whose balance is *stated* (ground truth) rather than derived.
const ANCHOR_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>([
  "TRANSACTION_SMS_BALANCE",
  "SMS_BALANCE",
  "MANUAL",
  "MANUAL_EDIT",
]);

function isAnchor(row: Reading): boolean {
  return (
    // A stated post-transaction balance is ground truth (Kotlin's first disjunct).
    row.transactionBalanceAfter != null ||
    (row.sourceType != null && ANCHOR_SOURCE_TYPES.has(row.sourceType)) ||
    row.transactionId == null
  );
}

/**
 * Anchor-segmented running fold over a time-ordered series of balance readings.
 *
 * Walks the readings in order carrying a running balance seeded by
 * `startingBalance`. An anchor row (a stated balance: MANUAL / MANUAL_EDIT /
 * SMS_BALANCE / TRANSACTION_SMS_BALANCE, or any row with no transaction) is
 * ground truth: its balance is carried forward unchanged and resets the running
 * balance. Every other (calculated) row re-applies its transaction delta via
 * `calculateBalance`. Pure: inputs are never mutated; new objects are returned.
 */
export function recalculateBalancesAfter(
  readingsAfterT: Reading[],
  startingBalance: string,
): Reading[] {
  let running = startingBalance;

  return readingsAfterT.map((row) => {
    if (isAnchor(row)) {
      running = row.balance;
      return { ...row };
    }

    // A calculated row missing the data needed to recompute is treated as an
    // anchor too — carry its stored balance forward (mirrors the Kotlin guard).
    if (row.transactionAmount == null || row.transactionType == null) {
      running = row.balance;
      return { ...row };
    }

    const recomputed = calculateBalance(
      running,
      row.transactionAmount,
      row.transactionType,
      row.isCreditCard,
    );
    running = recomputed;
    return { ...row, balance: recomputed };
  });
}
