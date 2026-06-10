import { describe, expect, it } from "vitest";
import { resolveAccount, type ExistingAccount } from "@/lib/account-resolver";

describe("resolveAccount", () => {
  it("matches an existing account by exact canonicalBank + accountLast4", () => {
    const existing: ExistingAccount[] = [{ id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" }];

    expect(resolveAccount({ canonicalBank: "hdfc-in", accountLast4: "1234" }, existing)).toEqual({
      kind: "matched",
      accountId: 7,
    });
  });

  it("needs-create when a full (>=4 char) last4 has no exact match", () => {
    const existing: ExistingAccount[] = [{ id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" }];

    expect(resolveAccount({ canonicalBank: "hdfc-in", accountLast4: "9999" }, existing)).toEqual({
      kind: "needs-create",
      canonicalBank: "hdfc-in",
      accountLast4: "9999",
    });
  });

  it("matches a partial (<4 char) fragment to the unique account ending with it", () => {
    const existing: ExistingAccount[] = [
      { id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" },
      { id: 8, canonicalBank: "hdfc-in", accountLast4: "5678" },
    ];

    expect(resolveAccount({ canonicalBank: "hdfc-in", accountLast4: "34" }, existing)).toEqual({
      kind: "matched",
      accountId: 7,
    });
  });

  it("needs-create (keeping the fragment) when a partial fragment matches many accounts", () => {
    const existing: ExistingAccount[] = [
      { id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" },
      { id: 8, canonicalBank: "hdfc-in", accountLast4: "9234" },
    ];

    expect(resolveAccount({ canonicalBank: "hdfc-in", accountLast4: "34" }, existing)).toEqual({
      kind: "needs-create",
      canonicalBank: "hdfc-in",
      accountLast4: "34",
    });
  });

  it("needs-create (keeping the fragment) when a partial fragment matches zero accounts", () => {
    const existing: ExistingAccount[] = [{ id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" }];

    expect(resolveAccount({ canonicalBank: "hdfc-in", accountLast4: "99" }, existing)).toEqual({
      kind: "needs-create",
      canonicalBank: "hdfc-in",
      accountLast4: "99",
    });
  });

  it("scopes matching to the canonical bank (same last4, different bank does not match)", () => {
    const existing: ExistingAccount[] = [{ id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" }];

    expect(resolveAccount({ canonicalBank: "icici-in", accountLast4: "1234" }, existing)).toEqual({
      kind: "needs-create",
      canonicalBank: "icici-in",
      accountLast4: "1234",
    });
  });

  it("scopes partial-fragment matching to the canonical bank", () => {
    const existing: ExistingAccount[] = [{ id: 7, canonicalBank: "hdfc-in", accountLast4: "1234" }];

    // "34" is a unique suffix under hdfc-in, but the query is for icici-in.
    expect(resolveAccount({ canonicalBank: "icici-in", accountLast4: "34" }, existing)).toEqual({
      kind: "needs-create",
      canonicalBank: "icici-in",
      accountLast4: "34",
    });
  });
});
