import { describe, expect, it } from "vitest";

import { accounts } from "@/db/schema";
import { createTestDb } from "@/db/test-support/harness";

import {
  clearMainAccountIfDeleted,
  getBaseCurrency,
  getMainAccountId,
  getSetting,
  setMainAccount,
  setSetting,
} from "@/db/services/app-settings";

describe("app-settings service", () => {
  it("round-trips a setting via set/get", async () => {
    const { db, sqlite } = createTestDb();

    expect(await getSetting(db, "streak_state")).toBeNull();

    await setSetting(db, "streak_state", "5");
    expect(await getSetting(db, "streak_state")).toBe("5");

    // re-setting the same key overwrites (upsert, not duplicate-insert)
    await setSetting(db, "streak_state", "6");
    expect(await getSetting(db, "streak_state")).toBe("6");

    sqlite.close();
  });

  it("setMainAccount stores accounts.id, readable via getMainAccountId", async () => {
    const { db, sqlite } = createTestDb();

    expect(await getMainAccountId(db)).toBeNull();

    const [acct] = await db
      .insert(accounts)
      .values({ bankName: "HDFC", accountLast4: "1234", currency: "INR" })
      .returning();

    await setMainAccount(db, acct.id);

    expect(await getMainAccountId(db)).toBe(acct.id);
    // stored as text under the canonical key
    expect(await getSetting(db, "mainAccountId")).toBe(String(acct.id));

    sqlite.close();
  });

  it("getBaseCurrency resolves currencyOf(mainAccountId)", async () => {
    const { db, sqlite } = createTestDb();

    const [acct] = await db
      .insert(accounts)
      .values({ bankName: "Chase", accountLast4: "0001", currency: "USD" })
      .returning();

    await setMainAccount(db, acct.id);

    expect(await getBaseCurrency(db)).toBe("USD");

    sqlite.close();
  });

  it("getBaseCurrency is null when no main account is set", async () => {
    const { db, sqlite } = createTestDb();

    expect(await getBaseCurrency(db)).toBeNull();

    sqlite.close();
  });

  it("getBaseCurrency is null when the main account id points at no account", async () => {
    const { db, sqlite } = createTestDb();

    // Stale/dangling pointer (e.g. the account was deleted). ADR-0005 notes a
    // reset step should repoint mainAccountId; until then, base currency falls
    // back to null rather than throwing.
    await setMainAccount(db, 9999);

    expect(await getMainAccountId(db)).toBe(9999);
    expect(await getBaseCurrency(db)).toBeNull();

    sqlite.close();
  });

  it("clearMainAccountIfDeleted clears the pref when the deleted account was the main account", async () => {
    const { db, sqlite } = createTestDb();

    const [acct] = await db
      .insert(accounts)
      .values({ bankName: "HDFC", accountLast4: "1234", currency: "INR" })
      .returning();

    await setMainAccount(db, acct.id);
    expect(await getMainAccountId(db)).toBe(acct.id);

    await clearMainAccountIfDeleted(db, acct.id);

    // pref is cleared/repointed to null
    expect(await getMainAccountId(db)).toBeNull();

    sqlite.close();
  });

  it("clearMainAccountIfDeleted leaves the pref when a non-main account is deleted", async () => {
    const { db, sqlite } = createTestDb();

    const [main] = await db
      .insert(accounts)
      .values({ bankName: "HDFC", accountLast4: "1111", currency: "INR" })
      .returning();
    const [other] = await db
      .insert(accounts)
      .values({ bankName: "Chase", accountLast4: "2222", currency: "USD" })
      .returning();

    await setMainAccount(db, main.id);

    await clearMainAccountIfDeleted(db, other.id);

    // main account pref is untouched
    expect(await getMainAccountId(db)).toBe(main.id);

    sqlite.close();
  });

  it("getBaseCurrency tolerates the cleared pref after main-account deletion", async () => {
    const { db, sqlite } = createTestDb();

    const [acct] = await db
      .insert(accounts)
      .values({ bankName: "HDFC", accountLast4: "1234", currency: "INR" })
      .returning();

    await setMainAccount(db, acct.id);
    expect(await getBaseCurrency(db)).toBe("INR");

    await clearMainAccountIfDeleted(db, acct.id);

    // cleared pref => base currency falls back to null rather than throwing
    expect(await getBaseCurrency(db)).toBeNull();

    sqlite.close();
  });

  it("clearMainAccountIfDeleted is a no-op when no main account is set", async () => {
    const { db, sqlite } = createTestDb();

    await clearMainAccountIfDeleted(db, 9999);

    expect(await getMainAccountId(db)).toBeNull();

    sqlite.close();
  });
});
