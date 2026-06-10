import Decimal from "decimal.js";

// HALF_EVEN (banker's rounding) to mirror Java BigDecimal's default for monetary math.
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

export function add(a: string, b: string, _ccy?: string): string {
  return new Decimal(a).plus(b).toString();
}

export function subtract(a: string, b: string, _ccy?: string): string {
  return new Decimal(a).minus(b).toString();
}

export function multiply(a: string, factor: string | number): string {
  // Product is rounded to the canonical 2dp money scale using HALF_EVEN.
  return new Decimal(a).times(factor).toFixed(2, Decimal.ROUND_HALF_EVEN);
}

export function negate(a: string): string {
  return new Decimal(a).negated().toString();
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  return new Decimal(a).comparedTo(b) as -1 | 0 | 1;
}

export function isZero(a: string): boolean {
  return new Decimal(a).isZero();
}

// Canonical 2dp string used as a dedup hash key — always 2dp regardless of currency.
export function normalize2dp(a: string): string {
  return new Decimal(a).toFixed(2, Decimal.ROUND_HALF_EVEN);
}

type Grouping = "western" | "indian";

interface CurrencyDef {
  symbol: string;
  decimals: number;
  grouping: Grouping;
}

// Static, deliberately small config driving display. We do NOT use Intl.NumberFormat
// (Hermes' Intl is unreliable across RN builds) — grouping is done by hand below.
const CURRENCY_CONFIG: Record<string, CurrencyDef> = {
  USD: { symbol: "$", decimals: 2, grouping: "western" },
  INR: { symbol: "₹", decimals: 2, grouping: "indian" },
  NPR: { symbol: "₹", decimals: 2, grouping: "indian" },
  JPY: { symbol: "¥", decimals: 0, grouping: "western" },
  KRW: { symbol: "₩", decimals: 0, grouping: "western" },
  VND: { symbol: "₫", decimals: 0, grouping: "western" },
  BHD: { symbol: "BD", decimals: 3, grouping: "western" },
  KWD: { symbol: "KD", decimals: 3, grouping: "western" },
  OMR: { symbol: "ر.ع.", decimals: 3, grouping: "western" },
};

const DEFAULT_DEF: CurrencyDef = { symbol: "", decimals: 2, grouping: "western" };

// Group the integer part: Western = every 3 digits; Indian = first 3, then 2s (lakh/crore).
function groupInteger(digits: string, grouping: Grouping): string {
  if (grouping === "indian") {
    if (digits.length <= 3) return digits;
    const head = digits.slice(0, digits.length - 3);
    const tail = digits.slice(digits.length - 3);
    const groupedHead = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `${groupedHead},${tail}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function format(amount: string, ccy: string): string {
  const def = CURRENCY_CONFIG[ccy] ?? DEFAULT_DEF;
  const value = new Decimal(amount);
  const isNegative = value.isNegative() && !value.isZero();
  const fixed = value.abs().toFixed(def.decimals, Decimal.ROUND_HALF_EVEN);

  const [intPart, fracPart] = fixed.split(".");
  const groupedInt = groupInteger(intPart, def.grouping);
  const body = fracPart ? `${groupedInt}.${fracPart}` : groupedInt;

  return `${isNegative ? "-" : ""}${def.symbol}${body}`;
}
