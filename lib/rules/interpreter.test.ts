import { describe, expect, it } from "vitest";

import { serializeActions } from "@/lib/rules/dsl";
import { evaluateRules } from "@/lib/rules/interpreter";
import type { RuleDefinition, RuleTransactionDraft } from "@/lib/rules/types";

const txn = (overrides: Partial<RuleTransactionDraft> = {}): RuleTransactionDraft => ({
  amount: "100.00",
  transactionType: "EXPENSE",
  categoryId: 1,
  categoryName: "Miscellaneous",
  subcategoryId: null,
  subcategoryName: null,
  merchantName: "Swiggy Instamart",
  description: "Dinner",
  smsBody: "Rs.100 debited at Swiggy",
  bankName: "HDFC Bank",
  ...overrides,
});

const rule = (overrides: Partial<RuleDefinition>): RuleDefinition => ({
  id: "rule-1",
  name: "Rule",
  priority: 100,
  isActive: true,
  conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "swiggy" }],
  actions: [{ actionType: "SET", field: "NARRATION", value: "food delivery" }],
  ...overrides,
});

describe("evaluateRules", () => {
  it.each([
    ["EQUALS", "Swiggy Instamart", true],
    ["NOT_EQUALS", "Amazon", true],
    ["CONTAINS", "insta", true],
    ["NOT_CONTAINS", "amazon", true],
    ["STARTS_WITH", "swiggy", true],
    ["ENDS_WITH", "mart", true],
    ["IN", "Amazon, Swiggy Instamart", true],
    ["NOT_IN", "Amazon, Netflix", true],
    ["REGEX_MATCHES", "Swiggy\\s+Insta.*", true],
    ["IS_EMPTY", "", false],
    ["IS_NOT_EMPTY", "", true],
  ] as const)("evaluates string operator %s", (operator, value, matches) => {
    const result = evaluateRules(
      [rule({ conditions: [{ field: "MERCHANT", operator, value }] })],
      txn(),
    );
    expect(result.applications.length > 0).toBe(matches);
  });

  it.each([
    ["LESS_THAN", "101", true],
    ["GREATER_THAN", "99", true],
    ["LESS_THAN_OR_EQUAL", "100.00", true],
    ["GREATER_THAN_OR_EQUAL", "100.00", true],
  ] as const)("evaluates numeric operator %s", (operator, value, matches) => {
    const result = evaluateRules(
      [rule({ conditions: [{ field: "AMOUNT", operator, value }] })],
      txn(),
    );
    expect(result.applications.length > 0).toBe(matches);
  });

  it("ANDs conditions like Cashiro even when logicalOperator says OR", () => {
    const result = evaluateRules(
      [
        rule({
          conditions: [
            { field: "MERCHANT", operator: "CONTAINS", value: "swiggy" },
            { field: "BANK_NAME", operator: "CONTAINS", value: "sbi", logicalOperator: "OR" },
          ],
        }),
      ],
      txn(),
    );
    expect(result.applications).toHaveLength(0);
  });

  it("applies lower priority number first and lets later non-blocking rules override", () => {
    const result = evaluateRules(
      [
        rule({
          id: "late",
          name: "Late",
          priority: 20,
          actions: [{ actionType: "SET", field: "NARRATION", value: "late" }],
        }),
        rule({
          id: "early",
          name: "Early",
          priority: 10,
          actions: [{ actionType: "SET", field: "NARRATION", value: "early" }],
        }),
      ],
      txn(),
    );
    expect(result.transaction.description).toBe("late");
    expect(result.applications.map((app) => app.ruleId)).toEqual(["early", "late"]);
  });

  it("BLOCK short-circuits without field mutations", () => {
    const result = evaluateRules(
      [
        rule({ id: "block", name: "Block", priority: 1, actions: [{ actionType: "BLOCK" }] }),
        rule({
          id: "later",
          priority: 2,
          actions: [{ actionType: "SET", field: "NARRATION", value: "later" }],
        }),
      ],
      txn(),
    );
    expect(result.blocked).toEqual({ ruleId: "block", ruleName: "Block" });
    expect(result.applications).toHaveLength(0);
    expect(result.transaction.description).toBe("Dinner");
  });

  it("auto-sets parent category when setting a subcategory", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "SUBCATEGORY", value: "Burgers" }] })],
      txn(),
      {
        categoryById: new Map([[2, { id: 2, name: "Food" }]]),
        subcategoryByName: new Map([["burgers", { id: 7, name: "Burgers", categoryId: 2 }]]),
      },
    );
    expect(result.transaction.subcategoryId).toBe(7);
    expect(result.transaction.categoryId).toBe(2);
    expect(result.mutations.map((m) => m.field)).toContain("SUBCATEGORY");
    expect(result.mutations.map((m) => m.field)).toContain("CATEGORY");
  });

  it("clears incompatible subcategory when setting category", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "CATEGORY", value: "Travel" }] })],
      txn({ categoryId: 2, categoryName: "Food", subcategoryId: 7, subcategoryName: "Burgers" }),
      {
        categoryByName: new Map([["travel", { id: 3, name: "Travel" }]]),
        subcategoryById: new Map([[7, { id: 7, name: "Burgers", categoryId: 2 }]]),
      },
    );
    expect(result.transaction.categoryId).toBe(3);
    expect(result.transaction.subcategoryId).toBeNull();
  });

  it("does not emit audit applications for matching no-op actions", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "NARRATION", value: "Dinner" }] })],
      txn(),
    );
    expect(result.applications).toHaveLength(0);
  });

  it("sets recurring flag and billing cycle through the v1 action allowlist", () => {
    const result = evaluateRules(
      [
        rule({
          actions: [
            { actionType: "SET", field: "RECURRING", value: "true" },
            { actionType: "SET", field: "BILLING_CYCLE", value: "monthly" },
          ],
        }),
      ],
      txn(),
    );

    expect(result.transaction.isRecurring).toBe(true);
    expect(result.transaction.billingCycle).toBe("monthly");
    expect(result.mutations.map((mutation) => mutation.field)).toEqual([
      "RECURRING",
      "BILLING_CYCLE",
    ]);
  });

  it("rejects disallowed action fields in the valibot schema", () => {
    expect(() =>
      serializeActions([{ actionType: "SET", field: "AMOUNT" as never, value: "1" }]),
    ).toThrow();
  });

  it("matches on the SMS_SENDER field", () => {
    const matched = evaluateRules(
      [rule({ conditions: [{ field: "SMS_SENDER", operator: "CONTAINS", value: "EPFO" }] })],
      txn({ smsSender: "AD-EPFO" }),
    );
    const missed = evaluateRules(
      [rule({ conditions: [{ field: "SMS_SENDER", operator: "CONTAINS", value: "EPFO" }] })],
      txn({ smsSender: "VK-HDFCBK" }),
    );
    expect(matched.applications.length).toBe(1);
    expect(missed.applications.length).toBe(0);
  });

  it("SET ACCOUNT resolves the account by name and updates accountId/accountName", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "ACCOUNT", value: "EPF" }] })],
      txn({ accountId: 1, accountName: "Cash" }),
      { accountByName: new Map([["epf", { id: 9, name: "EPF" }]]) },
    );
    expect(result.transaction.accountId).toBe(9);
    expect(result.transaction.accountName).toBe("EPF");
    expect(result.mutations.map((m) => m.field)).toContain("ACCOUNT");
  });

  it("SET ACCOUNT is a no-op when the account name is unknown", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "ACCOUNT", value: "Nope" }] })],
      txn({ accountId: 1, accountName: "Cash" }),
      { accountByName: new Map() },
    );
    expect(result.transaction.accountId).toBe(1);
    expect(result.applications.length).toBe(0);
  });

  it("SET ACCOUNT is a no-op when the transaction already points at that account", () => {
    // The draft carries only accountId (accountName null, as apply-to-past produces
    // for legacy rows). Resolution must compare by id so an identical account does
    // not emit a redundant change.
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "ACCOUNT", value: "EPF" }] })],
      txn({ accountId: 9, accountName: null }),
      { accountByName: new Map([["epf", { id: 9, name: "EPF" }]]) },
    );
    expect(result.applications).toHaveLength(0);
    expect(result.mutations).toHaveLength(0);
  });

  it("SET ACCOUNT is a no-op when the name is ambiguous (shared by two accounts)", () => {
    // buildRuleLookupContext marks a name shared by multiple accounts with an
    // id < 0 sentinel; the interpreter must not guess which account was meant.
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "ACCOUNT", value: "HDFC" }] })],
      txn({ accountId: 1, accountName: "Cash" }),
      { accountByName: new Map([["hdfc", { id: -1, name: "" }]]) },
    );
    expect(result.transaction.accountId).toBe(1);
    expect(result.applications).toHaveLength(0);
  });

  it("SET RECURRING is a no-op when already recurring", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "RECURRING", value: "true" }] })],
      txn({ isRecurring: true }),
    );
    expect(result.applications).toHaveLength(0);
    expect(result.mutations).toHaveLength(0);
  });

  it("SET FLAGGED is a no-op when already flagged", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "FLAGGED", value: "true" }] })],
      txn({ flagged: true }),
    );
    expect(result.applications).toHaveLength(0);
    expect(result.mutations).toHaveLength(0);
  });

  it("SET FLAGGED marks the transaction flagged", () => {
    const result = evaluateRules(
      [rule({ actions: [{ actionType: "SET", field: "FLAGGED", value: "true" }] })],
      txn({ flagged: false }),
    );
    expect(result.transaction.flagged).toBe(true);
    expect(result.mutations.map((m) => m.field)).toContain("FLAGGED");
  });
});
