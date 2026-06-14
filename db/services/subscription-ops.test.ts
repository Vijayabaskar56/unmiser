import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { categories, subscriptions, transactions } from "@/db/schema";
import { createTestDb } from "@/db/test-support/harness";
import {
  advanceDate,
  formatBillingCycle,
  parseBillingCycle,
} from "@/lib/subscriptions/billing-cycle";
import {
  amountWithinTolerance,
  monthlyEquivalent,
  predictNextPayment,
} from "@/lib/subscriptions/matching";
import {
  createSubscription,
  deleteSubscription,
  editSubscription,
  matchAndLinkSubscriptionPayment,
  setSubscriptionState,
  syncSubscriptionFromRecurringTransaction,
  upsertFromMandate,
} from "@/db/services/subscription-ops";

const mandate = {
  amount: "1499",
  nextDeductionDate: "2026-07-15",
  merchant: "Netflix",
  umn: "UMN123",
  currency: "INR",
  pluginId: "in.hdfc.bank",
  provider: "HDFC Bank",
};

async function seedCategory(db: ReturnType<typeof createTestDb>["db"]) {
  const [category] = await db
    .insert(categories)
    .values({ name: "Subscription", color: "#111", seedKey: "subscription" })
    .returning();
  return category.id;
}

describe("subscription helpers", () => {
  it("round-trips custom billing cycles and advances dates", () => {
    const cycle = parseBillingCycle("custom_2_week_2026-12-31")!;
    expect(formatBillingCycle(cycle)).toBe("custom_2_week_2026-12-31");
    expect(advanceDate("2026-01-01", cycle)).toBe("2026-01-15");
  });

  it("checks the 5% amount boundary and monthly equivalents", () => {
    expect(amountWithinTolerance("104.90", "100")).toBe(true);
    expect(amountWithinTolerance("105.10", "100")).toBe(false);
    expect(monthlyEquivalent("1200", "yearly")).toBe("100.00");
  });

  it("predicts from mandate, then last paid plus cycle, then median cadence", () => {
    expect(predictNextPayment({ mandateNextDate: "2026-07-15", lastPaidDate: "2026-06-01" })).toBe(
      "2026-07-15",
    );
    expect(predictNextPayment({ lastPaidDate: "2026-06-01", billingCycle: "monthly" })).toBe(
      "2026-07-01",
    );
    expect(
      predictNextPayment({ linkedPaymentDates: ["2026-01-01", "2026-02-01", "2026-03-01"] }),
    ).toBe("2026-03-30");
  });
});

describe("subscription ops", () => {
  it("dedups mandates by UMN and does not store smsBody", async () => {
    const { db, sqlite } = createTestDb();
    await seedCategory(db);
    const first = await upsertFromMandate(db, mandate);
    const second = await upsertFromMandate(db, { ...mandate, amount: "1599" });

    expect(second).toBe(first);
    const rows = await db.select().from(subscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("1599.00");
    expect(rows[0].smsBody).toBeNull();
    sqlite.close();
  });

  it("dedups fallback identity and reactivates hidden subscriptions", async () => {
    const { db, sqlite } = createTestDb();
    await seedCategory(db);
    const first = await upsertFromMandate(db, { ...mandate, umn: undefined });
    await db.update(subscriptions).set({ state: "HIDDEN" }).where(eq(subscriptions.id, first));
    const second = await upsertFromMandate(db, { ...mandate, umn: undefined });

    expect(second).toBe(first);
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, first));
    expect(row.state).toBe("ACTIVE");
    sqlite.close();
  });

  it("links an unambiguous active subscription payment within tolerance", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const subscriptionId = await upsertFromMandate(db, mandate);
    const [transaction] = await db
      .insert(transactions)
      .values({
        amount: "1490",
        merchantName: "Netflix India",
        categoryId,
        transactionType: "EXPENSE",
        dateTime: "2026-07-15T09:00:00Z",
        transactionHash: "sub-payment",
      })
      .returning();

    const result = await matchAndLinkSubscriptionPayment(db, transaction.id);
    expect(result).toEqual({ kind: "linked", subscriptionId });
    const [updatedTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id));
    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));
    expect(updatedTxn.subscriptionId).toBe(subscriptionId);
    expect(updatedSub.lastPaidDate).toBe("2026-07-15");
    expect(updatedSub.nextPaymentDate).toBe("2026-08-15");
    sqlite.close();
  });

  it("creates a subscription from a recurring transaction and links it", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const [transaction] = await db
      .insert(transactions)
      .values({
        amount: "427",
        merchantName: "X Corp",
        categoryId,
        transactionType: "EXPENSE",
        dateTime: "2026-06-07T02:56:38Z",
        transactionHash: "x-corp-recurring",
        isRecurring: true,
        billingCycle: "monthly",
        currency: "INR",
      })
      .returning();

    const result = await syncSubscriptionFromRecurringTransaction(db, transaction.id);
    expect(result.kind).toBe("linked");
    const [subscription] = await db.select().from(subscriptions);
    const [updatedTxn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id));

    expect(subscription.merchantName).toBe("X Corp");
    expect(subscription.amount).toBe("427.00");
    expect(subscription.nextPaymentDate).toBe("2026-07-07");
    expect(subscription.lastPaidDate).toBe("2026-06-07");
    expect(subscription.billingCycle).toBe("monthly");
    expect(updatedTxn.subscriptionId).toBe(subscription.id);
    sqlite.close();
  });

  it("reuses the same subscription for later recurring payments", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const [first] = await db
      .insert(transactions)
      .values({
        amount: "427",
        merchantName: "X Corp",
        categoryId,
        transactionType: "EXPENSE",
        dateTime: "2026-05-07T03:00:59Z",
        transactionHash: "x-corp-may",
        isRecurring: true,
        billingCycle: "monthly",
      })
      .returning();
    const [second] = await db
      .insert(transactions)
      .values({
        amount: "427",
        merchantName: "X Corp Paid Features",
        categoryId,
        transactionType: "EXPENSE",
        dateTime: "2026-06-07T02:56:38Z",
        transactionHash: "x-corp-june",
        isRecurring: true,
        billingCycle: "monthly",
      })
      .returning();

    const firstResult = await syncSubscriptionFromRecurringTransaction(db, first.id);
    const secondResult = await syncSubscriptionFromRecurringTransaction(db, second.id);
    const rows = await db.select().from(subscriptions);
    const [linkedSecond] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, second.id));

    expect(rows).toHaveLength(1);
    expect(secondResult).toEqual(firstResult);
    expect(rows[0].lastPaidDate).toBe("2026-06-07");
    expect(rows[0].nextPaymentDate).toBe("2026-07-07");
    expect(linkedSecond.subscriptionId).toBe(rows[0].id);
    sqlite.close();
  });
});

describe("createSubscription", () => {
  it("inserts an active subscription and returns its id", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createSubscription(db, {
      merchantName: "Spotify",
      amount: "119",
      currency: "INR",
      billingCycle: "monthly",
      nextPaymentDate: "2026-07-01",
    });
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.merchantName).toBe("Spotify");
    expect(row.amount).toBe("119");
    expect(row.state).toBe("ACTIVE");
    expect(row.nextPaymentDate).toBe("2026-07-01");
    sqlite.close();
  });

  it("denormalizes the category name when linked", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const id = await createSubscription(db, {
      merchantName: "Netflix",
      amount: "499",
      categoryId,
    });
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.categoryId).toBe(categoryId);
    expect(row.categoryName).toBe("Subscription");
    sqlite.close();
  });
});

describe("editSubscription", () => {
  it("updates editable fields and refreshes the category snapshot", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const id = await createSubscription(db, { merchantName: "Netflix", amount: "499" });

    await editSubscription(db, id, {
      merchantName: "Netflix Premium",
      amount: "649",
      billingCycle: "yearly",
      categoryId,
    });

    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.merchantName).toBe("Netflix Premium");
    expect(row.amount).toBe("649");
    expect(row.billingCycle).toBe("yearly");
    expect(row.categoryName).toBe("Subscription");
    sqlite.close();
  });

  it("clears the category snapshot when unlinked", async () => {
    const { db, sqlite } = createTestDb();
    const categoryId = await seedCategory(db);
    const id = await createSubscription(db, {
      merchantName: "Netflix",
      amount: "499",
      categoryId,
    });

    await editSubscription(db, id, { categoryId: null });

    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.categoryId).toBeNull();
    expect(row.categoryName).toBeNull();
    sqlite.close();
  });
});

describe("setSubscriptionState", () => {
  it("hides and reactivates a subscription", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createSubscription(db, { merchantName: "Netflix", amount: "499" });

    await setSubscriptionState(db, id, "HIDDEN");
    let [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.state).toBe("HIDDEN");

    await setSubscriptionState(db, id, "ACTIVE");
    [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(row.state).toBe("ACTIVE");
    sqlite.close();
  });
});

describe("deleteSubscription", () => {
  it("removes the row", async () => {
    const { db, sqlite } = createTestDb();
    const id = await createSubscription(db, { merchantName: "Netflix", amount: "499" });
    await deleteSubscription(db, id);
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    expect(rows).toHaveLength(0);
    sqlite.close();
  });
});
