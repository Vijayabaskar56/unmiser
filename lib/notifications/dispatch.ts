import type { SmsProcessOutcome } from "@/db/services/sms-processing";
import * as money from "@/lib/money";

import { LARGE_TRANSACTION_THRESHOLD, type NotificationPrefs } from "./prefs";

/** A ready-to-present local notification (content only — no trigger/timing). */
export interface NotificationContent {
  title: string;
  body: string;
  /** Optional in-app route, delivered via `data.url` and handled in _layout. */
  url?: string;
}

/**
 * Decide whether an SMS-processing outcome should surface a notification, and
 * with what content. Pure — takes the user's prefs and the outcome, returns
 * content or null. The native layer wraps this with the master-switch and
 * quiet-hours gates; this function only encodes the per-category rules:
 *
 * - saved transaction → notify if `everyTransaction`, OR if it clears the
 *   "large" threshold and `largeTransaction` is on.
 * - unrecognised SMS  → notify if `unrecognisedSms`.
 *
 * (Budget warnings are intentionally absent — the Budgets feature isn't built
 * yet, so there's nothing to evaluate; the toggle persists but stays inert.)
 */
export function smsOutcomeNotification(
  outcome: SmsProcessOutcome,
  prefs: NotificationPrefs,
): NotificationContent | null {
  if (outcome.kind === "saved") {
    const fields = outcome.result.fields;
    const amount = fields?.amount;
    const isLarge = amount != null && Number(amount) >= LARGE_TRANSACTION_THRESHOLD;

    const wantEvery = prefs.everyTransaction;
    const wantLarge = isLarge && prefs.largeTransaction;
    if (!wantEvery && !wantLarge) return null;

    const currency = fields?.currency ?? "INR";
    const amountText = amount != null ? money.format(amount, currency) : "Transaction";
    const merchant = fields?.merchant?.trim();
    const bank = fields?.bankName?.trim();

    return {
      title: isLarge ? `Large transaction · ${amountText}` : amountText,
      body: merchant ? (bank ? `${merchant} · ${bank}` : merchant) : (bank ?? "Logged"),
      url: `/transaction/${outcome.transactionId}`,
    };
  }

  if (outcome.kind === "review" && outcome.status === "UNRECOGNIZED") {
    if (!prefs.unrecognisedSms) return null;
    return {
      title: "Unrecognised SMS",
      body: "A bank message needs a rule before it can be tracked.",
      url: "/extensions",
    };
  }

  return null;
}

/**
 * The local fire-time for a subscription-renewal reminder: `daysBefore` days
 * before the next payment date, at `hour` local time. Returns null when the
 * resulting moment is already in the past (so we never schedule a no-op) or when
 * the date is unparseable. Pure — used by the scheduler to build DATE triggers.
 */
export function subscriptionReminderAt(
  nextPaymentDateIso: string | null,
  now: Date,
  daysBefore = 2,
  hour = 9,
): Date | null {
  if (!nextPaymentDateIso) return null;
  // nextPaymentDate is a LocalDate ("YYYY-MM-DD"); anchor at local midnight.
  const due = new Date(`${nextPaymentDateIso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;

  const fireAt = new Date(due);
  fireAt.setDate(fireAt.getDate() - daysBefore);
  fireAt.setHours(hour, 0, 0, 0);

  return fireAt.getTime() > now.getTime() ? fireAt : null;
}
