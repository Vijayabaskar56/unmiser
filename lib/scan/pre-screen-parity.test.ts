import { describe, expect, it } from "vitest";

import {
  isBankLikeSender,
  isTransactionMessage,
  shouldCaptureUnrecognizedSms,
} from "@/lib/parser/sms-filter";

// Fixture-parity suite for the NATIVE coarse pre-screen.
//
// The Kotlin mirror lives in
// packages/react-native-cashrio-sms/android/src/main/java/com/margelo/nitro/
// cashriosms/SmsPreScreen.kt (isBankLikeSender / isTransactionMessage /
// shouldCapture). Kotlin has no JS test runner here, so parity is asserted by
// running the SAME cases through the TS source of truth; every case below is
// a Kotlin parity case — if SmsPreScreen.kt diverges on any of them, the
// native pre-screen would drop (or pass) records the TS gate would not.

const CAPTURE_CASES: Array<{ name: string; sender: string; body: string; expected: boolean }> = [
  // [K1] transactional DLT sender + debit keyword → capture
  {
    name: "bank debit from -S sender",
    sender: "VM-HDFCBK-S",
    body: "Rs.100.00 debited from A/c XX1234 at AMAZON",
    expected: true,
  },
  // [K2] -T suffix also counts as bank-like
  {
    name: "bank credit from -T sender",
    sender: "AD-SBIINB-T",
    body: "Rs.5,000 credited to A/c XX9876",
    expected: true,
  },
  // [K3] unsuffixed sender → never captured even with txn keywords
  {
    name: "txn body but unsuffixed sender",
    sender: "HDFCBK",
    body: "Rs.100.00 debited from A/c XX1234",
    expected: false,
  },
  // [K4] promotional (-P) sender → not bank-like
  {
    name: "promo DLT suffix",
    sender: "VM-HDFCBK-P",
    body: "Rs.100.00 debited from A/c XX1234",
    expected: false,
  },
  // [K5] OTP message from bank sender → dropped
  {
    name: "OTP from bank sender",
    sender: "VM-HDFCBK-S",
    body: "123456 is your OTP for txn of Rs.500",
    expected: false,
  },
  // [K6] promo keyword ("offer") → dropped
  {
    name: "offer promo from bank sender",
    sender: "VM-HDFCBK-S",
    body: "Special offer: get a pre-approved loan, amount credited instantly",
    expected: false,
  },
  // [K7] collect/payment request → dropped
  {
    name: "UPI collect request",
    sender: "VM-HDFCBK-S",
    body: "John has requested Rs.250 from you. Approve to pay. Ignore if already paid",
    expected: false,
  },
  // [K8] dues reminder → dropped
  {
    name: "card minimum due reminder",
    sender: "VM-HDFCBK-S",
    body: "Your card payment min amount due is Rs.1,000 by 15/06",
    expected: false,
  },
  // [K9] merchant acknowledgment → dropped
  {
    name: "merchant received-payment ack",
    sender: "JD-PAYTMB-S",
    body: "You have received payment of Rs.90 from customer",
    expected: false,
  },
  // [K10] bank-like sender but no transaction keyword → dropped
  {
    name: "informational SMS without txn keywords",
    sender: "VM-HDFCBK-S",
    body: "Your branch will be closed on Sunday",
    expected: false,
  },
  // [K11] lower-case suffix still matches (uppercase comparison)
  {
    name: "lower-case dlt suffix",
    sender: "vm-hdfcbk-s",
    body: "Rs.100 withdrawn from A/c XX1234 at ATM",
    expected: true,
  },
  // [K12] "pls pay" alone is NOT a reminder (needs "min of" too)
  {
    name: "pls pay without min of",
    sender: "VM-HDFCBK-S",
    body: "Pls pay attention: Rs.100 debited from A/c XX1234",
    expected: true,
  },
  // [K13] "pls pay" + "min of" IS a reminder → dropped
  {
    name: "pls pay with min of",
    sender: "VM-HDFCBK-S",
    body: "Pls pay a min of Rs.500 towards your card",
    expected: false,
  },
  // [K14] "win " promo keyword (trailing space) → dropped
  {
    name: "win promo",
    sender: "VM-HDFCBK-S",
    body: "Spend Rs.500 and win exciting prizes, amount debited weekly",
    expected: false,
  },
];

describe("native pre-screen TS mirror (Kotlin parity: SmsPreScreen.kt)", () => {
  for (const testCase of CAPTURE_CASES) {
    it(`${testCase.name} -> ${testCase.expected ? "capture" : "drop"}`, () => {
      expect(shouldCaptureUnrecognizedSms(testCase.sender, testCase.body)).toBe(testCase.expected);
    });
  }

  it("isBankLikeSender mirrors the Kotlin suffix check exactly", () => {
    expect(isBankLikeSender("VM-HDFCBK-S")).toBe(true);
    expect(isBankLikeSender("VM-HDFCBK-T")).toBe(true);
    expect(isBankLikeSender("vm-hdfcbk-t")).toBe(true);
    expect(isBankLikeSender("VM-HDFCBK-G")).toBe(false);
    expect(isBankLikeSender("+919876543210")).toBe(false);
    expect(isBankLikeSender("")).toBe(false);
  });

  it("isTransactionMessage requires a transaction keyword", () => {
    expect(isTransactionMessage("Rs.10 transferred to friend")).toBe(true);
    expect(isTransactionMessage("Rs.10 deposited in your account")).toBe(true);
    expect(isTransactionMessage("Hello from your bank")).toBe(false);
  });
});
