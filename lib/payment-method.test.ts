import { describe, expect, it } from "vitest";

import { derivePaymentMethod, paymentMethodLabel } from "./payment-method";

describe("derivePaymentMethod", () => {
  it("detects UPI from the rail keyword or a VPA handle", () => {
    expect(derivePaymentMethod("Rs 612 paid via UPI to Zepto")).toBe("UPI");
    expect(derivePaymentMethod("sent to zepto@okhdfcbank")).toBe("UPI");
  });

  it("detects NEFT and IMPS", () => {
    expect(derivePaymentMethod("NEFT credit of Rs 62000 from ACME")).toBe("NEFT");
    expect(derivePaymentMethod("IMPS transfer Rs 500")).toBe("IMPS");
  });

  it("detects ATM and card transactions", () => {
    expect(derivePaymentMethod("ATM cash withdrawal Rs 2000")).toBe("ATM");
    expect(derivePaymentMethod("Rs 480 spent on Card XX4410 at SWIGGY")).toBe("CARD");
  });

  it("falls back to CARD when the parse flags a card but the text is silent", () => {
    expect(derivePaymentMethod("Rs 480 spent at SWIGGY", true)).toBe("CARD");
  });

  it("returns null when nothing matches and it is not a card", () => {
    expect(derivePaymentMethod("Rs 480 spent at SWIGGY")).toBeNull();
    expect(derivePaymentMethod(null)).toBeNull();
  });

  it("does not mistake an email address for a UPI handle", () => {
    expect(derivePaymentMethod("statement sent to you@gmail.com")).toBeNull();
  });
});

describe("paymentMethodLabel", () => {
  it("titlecases CARD and passes rails through", () => {
    expect(paymentMethodLabel("CARD")).toBe("Card");
    expect(paymentMethodLabel("UPI")).toBe("UPI");
    expect(paymentMethodLabel(null)).toBeNull();
  });
});
