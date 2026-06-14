import { describe, expect, it } from "vitest";

import type { SmsProcessOutcome } from "@/db/services/sms-processing";
import type { ParserResult } from "@/lib/parser/types";

import { smsOutcomeNotification, subscriptionReminderAt } from "@/lib/notifications/dispatch";
import { NOTIFICATION_DEFAULTS, type NotificationPrefs } from "@/lib/notifications/prefs";

function savedOutcome(amount: string, merchant?: string): SmsProcessOutcome {
  const result = {
    confidence: "HIGH",
    reasons: [],
    rawMatches: [],
    fields: {
      amount,
      merchant,
      currency: "INR",
      bankName: "HDFC",
      isFromCard: false,
    },
  } as unknown as ParserResult;
  return { kind: "saved", transactionId: 42, result };
}

const prefs = (overrides: Partial<NotificationPrefs>): NotificationPrefs => ({
  ...NOTIFICATION_DEFAULTS,
  ...overrides,
});

describe("smsOutcomeNotification — saved transaction", () => {
  it("is silent when neither every-transaction nor a qualifying large alert is on", () => {
    const out = smsOutcomeNotification(
      savedOutcome("200"),
      prefs({ everyTransaction: false, largeTransaction: true }),
    );
    expect(out).toBeNull();
  });

  it("notifies for any transaction when every-transaction is on", () => {
    const out = smsOutcomeNotification(
      savedOutcome("200", "Chai"),
      prefs({ everyTransaction: true }),
    );
    expect(out).not.toBeNull();
    expect(out?.title).toBe("₹200.00");
    expect(out?.body).toBe("Chai · HDFC");
    expect(out?.url).toBe("/transaction/42");
  });

  it("flags a large transaction (≥ ₹5,000) when large-transaction is on", () => {
    const out = smsOutcomeNotification(
      savedOutcome("7500", "Flights"),
      prefs({ everyTransaction: false, largeTransaction: true }),
    );
    expect(out?.title).toBe("Large transaction · ₹7,500.00");
  });

  it("does not flag a large transaction when large-transaction is off", () => {
    const out = smsOutcomeNotification(
      savedOutcome("7500"),
      prefs({ everyTransaction: false, largeTransaction: false }),
    );
    expect(out).toBeNull();
  });
});

describe("smsOutcomeNotification — unrecognised SMS", () => {
  const review: SmsProcessOutcome = {
    kind: "review",
    reviewId: 1,
    status: "UNRECOGNIZED",
    result: { confidence: "REJECTED", reasons: [], rawMatches: [] } as unknown as ParserResult,
  };

  it("notifies when unrecognised-SMS is on", () => {
    const out = smsOutcomeNotification(review, prefs({ unrecognisedSms: true }));
    expect(out?.title).toBe("Unrecognised SMS");
    expect(out?.url).toBe("/extensions");
  });

  it("is silent when unrecognised-SMS is off", () => {
    expect(smsOutcomeNotification(review, prefs({ unrecognisedSms: false }))).toBeNull();
  });

  it("ignores non-unrecognised review statuses", () => {
    const rejected = { ...review, status: "REJECTED" } as SmsProcessOutcome;
    expect(smsOutcomeNotification(rejected, prefs({ unrecognisedSms: true }))).toBeNull();
  });
});

describe("subscriptionReminderAt", () => {
  const now = new Date("2026-06-14T12:00:00");

  it("fires 2 days before the due date at 9am local", () => {
    const at = subscriptionReminderAt("2026-06-20", now);
    expect(at?.getFullYear()).toBe(2026);
    expect(at?.getMonth()).toBe(5); // June
    expect(at?.getDate()).toBe(18);
    expect(at?.getHours()).toBe(9);
  });

  it("returns null when the reminder moment is already in the past", () => {
    expect(subscriptionReminderAt("2026-06-15", now)).toBeNull(); // reminder would be 06-13
  });

  it("returns null for a missing/unparseable date", () => {
    expect(subscriptionReminderAt(null, now)).toBeNull();
    expect(subscriptionReminderAt("not-a-date", now)).toBeNull();
  });
});
