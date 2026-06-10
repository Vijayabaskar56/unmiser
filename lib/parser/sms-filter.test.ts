import { describe, expect, it } from "vitest";

import {
  isBankLikeSender,
  isTransactionMessage,
  shouldCaptureUnrecognizedSms,
} from "@/lib/parser/sms-filter";

// Cases ported from the original Cashiro parser-core TestSmsFilter.kt so the
// RN gate stays behavior-identical to the Kotlin SmsFilter.
describe("isTransactionMessage", () => {
  it("filters out OTPs", () => {
    const otpMessages = [
      "<#> 557026 is the One Time Password (OTP) for Phone Verification on NoBroker - World's largest brokerage free platform. A7jPtLVJWz3",
      "Your OTP for ICICI Bank is 1234. Do not share it with anyone.",
      "Verification code: 987654. Valid for 10 mins.",
      "Use 123456 as your one time password for Amazon Pay.",
    ];
    for (const msg of otpMessages) {
      expect(isTransactionMessage(msg), `should filter out OTP: ${msg}`).toBe(false);
    }
  });

  it("filters out promotional messages", () => {
    const promoMessages = [
      "Get up to 50% discount on your next ride. Use code GO50.",
      "Special offer: Open your account and win up to Rs. 1000.",
      "Earn cashback offer on every UPI transaction.",
    ];
    for (const msg of promoMessages) {
      expect(isTransactionMessage(msg), `should filter out promo: ${msg}`).toBe(false);
    }
  });

  it("filters out payment requests", () => {
    const requestMessages = [
      "SENDER NAME has requested Rs. 500 from you. Ignore if already paid.",
      "Payment request for Rs. 1200 is pending. Pay now to avoid late fee.",
      "Collect request of Rs.100 from VPA name@upi",
    ];
    for (const msg of requestMessages) {
      expect(isTransactionMessage(msg), `should filter out request: ${msg}`).toBe(false);
    }
  });

  it("filters out payment reminders and dues", () => {
    const reminders = [
      "Your credit card payment of Rs.5000 is due on 15-06-2026.",
      "Min amount due Rs.450 on your card. Ignore if paid.",
      "Your loan EMI is overdue. Pay immediately to avoid charges.",
    ];
    for (const msg of reminders) {
      expect(isTransactionMessage(msg), `should filter out reminder: ${msg}`).toBe(false);
    }
  });

  it("accepts real transactions", () => {
    const transactions = [
      "Rs.500.00 debited from A/c XX1234. Avl Bal Rs.4500.00 Ref:REF001",
      "Rs.1000.00 credited to A/c XX1234 from SENDER NAME. Ref:TXN123",
      "You have spent Rs.250 at AMAZON via your Credit Card.",
      "ATM withdrawal of Rs.2000 successful for A/c XX5566.",
    ];
    for (const msg of transactions) {
      expect(isTransactionMessage(msg), `should accept transaction: ${msg}`).toBe(true);
    }
  });
});

describe("isBankLikeSender", () => {
  it("accepts DLT transactional (-T) and service (-S) senders, any case", () => {
    expect(isBankLikeSender("VM-HDFCBK-S")).toBe(true);
    expect(isBankLikeSender("AD-SBIINB-T")).toBe(true);
    expect(isBankLikeSender("vm-hdfcbk-s")).toBe(true);
  });

  it("rejects promotional, government, and unsuffixed senders", () => {
    expect(isBankLikeSender("VM-HDFCBN-P")).toBe(false);
    expect(isBankLikeSender("AX-NHAIGOV-G")).toBe(false);
    expect(isBankLikeSender("JT-JioPay")).toBe(false);
    expect(isBankLikeSender("VK-IOBCHN")).toBe(false);
    expect(isBankLikeSender("+919812345678")).toBe(false);
  });
});

describe("shouldCaptureUnrecognizedSms", () => {
  it("captures only bank-like senders with transaction-looking bodies", () => {
    const txnBody = "Rs.500.00 debited from A/c XX1234. Avl Bal Rs.4500.00";
    expect(shouldCaptureUnrecognizedSms("VM-IOBCHN-S", txnBody)).toBe(true);
    // Promo sender, transactional-looking body: still dropped.
    expect(shouldCaptureUnrecognizedSms("VM-HDFCBN-P", txnBody)).toBe(false);
    // Bank-like sender, promo body: dropped.
    expect(shouldCaptureUnrecognizedSms("AD-HDFCBK-S", "Special offer: win up to Rs. 1000.")).toBe(
      false,
    );
  });
});
