import type { PaymentMethod } from "@/db/schema/enums";

/**
 * Best-effort derivation of the payment rail ("UPI · NEFT · card") from an SMS
 * body, used to populate `transactions.paymentMethod` at parse time. We keep it
 * here (not in the parser engine) so it is a pure, testable string heuristic the
 * SMS pipeline and any backfill can share.
 *
 * Precedence: an explicit rail keyword in the text wins; otherwise an
 * `isFromCard` parse falls back to CARD; everything else stays null so the UI
 * hides the segment rather than guessing.
 */
export function derivePaymentMethod(
  body: string | null | undefined,
  isFromCard?: boolean,
): PaymentMethod | null {
  const text = (body ?? "").toUpperCase();
  // UPI when the rail is named, or a VPA handle appears — but a VPA has no dotted
  // TLD, so `(?!\.)` after the handle rejects email addresses (e.g. x@gmail.com).
  if (/\bUPI\b|\bVPA\b|@[A-Z0-9_-]{2,}\b(?!\.)/.test(text)) return "UPI";
  if (/\bIMPS\b/.test(text)) return "IMPS";
  if (/\bNEFT\b/.test(text)) return "NEFT";
  if (/\bATM\b|\bCASH WITHDRAWAL\b/.test(text)) return "ATM";
  if (/\bCARD\b|\bPOS\b|\bSWIPE\b/.test(text)) return "CARD";
  if (isFromCard) return "CARD";
  return null;
}

/** Human label for a method chip/segment ("UPI", "NEFT", "Card"). */
export function paymentMethodLabel(method: PaymentMethod | null | undefined): string | null {
  if (!method) return null;
  return method === "CARD" ? "Card" : method;
}
