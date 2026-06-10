import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accountBalances, accounts, cards, categories, transactions } from "@/db/schema";
import { getMainAccountId, setMainAccount } from "@/db/services/app-settings";
import { createTestDb } from "@/db/test-support/harness";

import { createAccount, deleteAccount, editAccount } from "@/db/services/account-ops";

describe("account-ops service", () => {
  it("createAccount('bank') stores a non-wallet, non-credit account", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(row.bankName).toBe("HDFC");
    expect(row.accountLast4).toBe("1234");
    expect(row.currency).toBe("INR");
    expect(row.isWallet).toBe(false);
    expect(row.isCreditCard).toBe(false);
    expect(row.creditLimit).toBeNull();

    sqlite.close();
  });

  it("createAccount('credit') sets isCreditCard and stores creditLimit", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "Amex",
      accountLast4: "9999",
      currency: "USD",
      kind: "credit",
      creditLimit: "50000.00",
    });

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(row.isCreditCard).toBe(true);
    expect(row.isWallet).toBe(false);
    expect(row.creditLimit).toBe("50000.00");

    sqlite.close();
  });

  it("createAccount('wallet') sets isWallet and persists optional presentation fields", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "Paytm",
      accountLast4: "0000",
      currency: "INR",
      kind: "wallet",
      color: "#FF0000",
      iconName: "wallet",
      canonicalBank: "in.paytm.wallet",
    });

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(row.isWallet).toBe(true);
    expect(row.isCreditCard).toBe(false);
    expect(row.color).toBe("#FF0000");
    expect(row.iconName).toBe("wallet");
    expect(row.canonicalBank).toBe("in.paytm.wallet");

    sqlite.close();
  });

  it("createAccount rejects a duplicate (bankName, accountLast4)", async () => {
    const { db, sqlite } = createTestDb();

    await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    await expect(
      createAccount(db, {
        bankName: "HDFC",
        accountLast4: "1234",
        currency: "INR",
        kind: "bank",
      }),
    ).rejects.toThrow();

    sqlite.close();
  });

  it("editAccount applies changes", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    await editAccount(db, id, { bankName: "HDFC Renamed", color: "#00FF00" });

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(row.bankName).toBe("HDFC Renamed");
    expect(row.color).toBe("#00FF00");

    sqlite.close();
  });

  it("deleteAccount removes the account and cascade-deletes its balances", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    await db.insert(accountBalances).values({
      accountId: id,
      balance: "100.00",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    await deleteAccount(db, id);

    const accts = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(accts).toHaveLength(0);

    const bals = await db.select().from(accountBalances).where(eq(accountBalances.accountId, id));
    expect(bals).toHaveLength(0);

    sqlite.close();
  });

  it("deleteAccount nulls cards.accountId (set-null FK)", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    const [card] = await db
      .insert(cards)
      .values({
        cardLast4: "5678",
        cardType: "DEBIT",
        bankName: "HDFC",
        accountId: id,
      })
      .returning();

    await deleteAccount(db, id);

    const [cardAfter] = await db.select().from(cards).where(eq(cards.id, card.id));
    expect(cardAfter.accountId).toBeNull();

    sqlite.close();
  });

  // transactions.accountId is declared `onDelete: "set null"`, but its migration
  // added the column via `ALTER TABLE ADD COLUMN`, which in SQLite cannot attach
  // an ON DELETE action (the live FK is NO ACTION). deleteAccount compensates by
  // explicitly nulling transactions.accountId before deleting, so the delete
  // succeeds and the transaction row survives detached (ADR-0006).
  it("deleteAccount nulls transactions.accountId and leaves the transaction row intact", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });

    const [cat] = await db
      .insert(categories)
      .values({ name: "Food", color: "#000000" })
      .returning();

    await db.insert(transactions).values({
      accountId: id,
      merchantName: "Coffee",
      categoryId: cat.id,
      amount: "5.00",
      transactionType: "EXPENSE",
      dateTime: "2026-01-01T10:00:00.000Z",
      currency: "INR",
      transactionHash: "hash-1",
    });

    await deleteAccount(db, id);

    const remaining = await db.select().from(transactions);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].accountId).toBeNull();
    const accountsLeft = await db.select().from(accounts);
    expect(accountsLeft).toHaveLength(0);

    sqlite.close();
  });

  it("deleteAccount clears the main-account pref when it referenced the deleted account", async () => {
    const { db, sqlite } = createTestDb();

    const id = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1234",
      currency: "INR",
      kind: "bank",
    });
    await setMainAccount(db, id);
    expect(await getMainAccountId(db)).toBe(id);

    await deleteAccount(db, id);

    expect(await getMainAccountId(db)).toBeNull();

    sqlite.close();
  });

  it("deleteAccount leaves the main-account pref when a different account is deleted", async () => {
    const { db, sqlite } = createTestDb();

    const mainId = await createAccount(db, {
      bankName: "HDFC",
      accountLast4: "1111",
      currency: "INR",
      kind: "bank",
    });
    const otherId = await createAccount(db, {
      bankName: "Chase",
      accountLast4: "2222",
      currency: "USD",
      kind: "bank",
    });
    await setMainAccount(db, mainId);

    await deleteAccount(db, otherId);

    expect(await getMainAccountId(db)).toBe(mainId);

    sqlite.close();
  });
});
