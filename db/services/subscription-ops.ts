import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { categories, subscriptions, transactions } from "@/db/schema";
import { nowIso } from "@/db/utils";
import type { MandateInfo } from "@/lib/parser/types";
import { advanceDate } from "@/lib/subscriptions/billing-cycle";
import {
  amountWithinTolerance,
  fallbackSubscriptionIdentity,
  merchantLooksRelated,
  normalizeAmount,
  normalizeSubscriptionMerchant,
  predictNextPayment,
} from "@/lib/subscriptions/matching";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

async function subscriptionCategoryId(db: Db): Promise<number | null> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.seedKey, "subscription"))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findFallbackMatch(db: Db, mandate: MandateInfo) {
  const rows = await db.select().from(subscriptions);
  const identity = fallbackSubscriptionIdentity({ ...mandate, billingCycle: "monthly" });
  return rows.find((row) => {
    if (row.umn) return false;
    return (
      fallbackSubscriptionIdentity({
        amount: row.amount,
        merchant: row.merchantName,
        nextDeductionDate: row.nextPaymentDate ?? mandate.nextDeductionDate,
        currency: row.currency,
        pluginId: mandate.pluginId,
        provider: row.bankName ?? "",
        billingCycle: row.billingCycle ?? "monthly",
      }) === identity
    );
  });
}

export async function upsertFromMandate(db: Db, mandate: MandateInfo): Promise<number> {
  const amount = normalizeAmount(mandate.amount);
  const timestamp = nowIso();
  const categoryId = await subscriptionCategoryId(db);
  const existing = mandate.umn
    ? (await db.select().from(subscriptions).where(eq(subscriptions.umn, mandate.umn)).limit(1))[0]
    : await findFallbackMatch(db, mandate);

  const values = {
    merchantName: mandate.merchant,
    amount,
    nextPaymentDate: mandate.nextDeductionDate,
    state: "ACTIVE" as const,
    bankName: mandate.provider,
    umn: mandate.umn ?? null,
    categoryId,
    smsBody: null,
    currency: mandate.currency,
    billingCycle: "monthly",
    updatedAt: timestamp,
  };

  if (existing) {
    await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(subscriptions)
    .values({ ...values, createdAt: timestamp })
    .returning();
  return row.id;
}

export type SubscriptionMatchResult =
  | { kind: "none" }
  | { kind: "ambiguous"; subscriptionIds: number[] }
  | { kind: "linked"; subscriptionId: number };

export async function matchAndLinkSubscriptionPayment(
  db: Db,
  transactionId: number,
): Promise<SubscriptionMatchResult> {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  if (!transaction || transaction.isDeleted) return { kind: "none" };

  const candidates = (
    await db.select().from(subscriptions).where(eq(subscriptions.state, "ACTIVE"))
  )
    .filter((subscription) => amountWithinTolerance(transaction.amount, subscription.amount))
    .filter((subscription) =>
      merchantLooksRelated(transaction.merchantName, subscription.merchantName),
    )
    .filter(
      (subscription) =>
        !subscription.bankName ||
        !transaction.bankName ||
        normalizeSubscriptionMerchant(subscription.bankName) ===
          normalizeSubscriptionMerchant(transaction.bankName),
    );

  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) {
    return { kind: "ambiguous", subscriptionIds: candidates.map((candidate) => candidate.id) };
  }

  const subscription = candidates[0];
  const paidDate = transaction.dateTime.slice(0, 10);
  const nextPaymentDate =
    subscription.billingCycle != null
      ? advanceDate(paidDate, { count: 1, unit: "month" })
      : predictNextPayment({
          lastPaidDate: paidDate,
          billingCycle: subscription.billingCycle,
          mandateNextDate: null,
        });

  await db
    .update(transactions)
    .set({ subscriptionId: subscription.id, isRecurring: true })
    .where(eq(transactions.id, transaction.id));
  await db
    .update(subscriptions)
    .set({ lastPaidDate: paidDate, nextPaymentDate, updatedAt: nowIso() })
    .where(eq(subscriptions.id, subscription.id));

  return { kind: "linked", subscriptionId: subscription.id };
}

export async function hideSubscription(db: Db, id: number): Promise<void> {
  await db
    .update(subscriptions)
    .set({ state: "HIDDEN", updatedAt: nowIso() })
    .where(eq(subscriptions.id, id));
}
