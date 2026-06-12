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
import { matchAndLinkSubscriptionPayment, upsertFromMandate } from "@/db/services/subscription-ops";

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
    ).toBe("2026-03-31");
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
});
