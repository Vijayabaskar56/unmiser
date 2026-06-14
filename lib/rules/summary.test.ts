import { describe, expect, it } from "vitest";

import { describeAction, describeCondition } from "@/lib/rules/summary";

describe("describeCondition", () => {
  it("labels merchant/sender/amount conditions like the mockups", () => {
    expect(describeCondition({ field: "MERCHANT", operator: "CONTAINS", value: "swiggy" })).toEqual(
      {
        label: "merchant contains",
        value: "swiggy",
      },
    );
    expect(describeCondition({ field: "SMS_SENDER", operator: "EQUALS", value: "EPFO" })).toEqual({
      label: "sender is",
      value: "EPFO",
    });
    expect(describeCondition({ field: "AMOUNT", operator: "GREATER_THAN", value: "5000" })).toEqual(
      {
        label: "amount >",
        value: "5000",
      },
    );
  });
});

describe("describeAction", () => {
  it("labels category/account/flag actions", () => {
    expect(
      describeAction({ actionType: "SET", field: "CATEGORY", value: "Food & dining" }),
    ).toEqual({ label: "category", value: "Food & dining" });
    expect(
      describeAction({ actionType: "SET", field: "ACCOUNT", value: "provident-fund" }),
    ).toEqual({ label: "account", value: "provident-fund" });
    expect(describeAction({ actionType: "SET", field: "FLAGGED", value: "true" })).toEqual({
      label: "flag",
      value: "review",
    });
  });

  it("handles a BLOCK action", () => {
    expect(describeAction({ actionType: "BLOCK" })).toEqual({ label: "block", value: "" });
  });
});
