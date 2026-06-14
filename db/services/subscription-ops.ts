import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { categories, subscriptions, transactions } from "@/db/schema";
import { nowIso } from "@/db/utils";
import type { MandateInfo } from "@/lib/parser/types";
import { advanceDate, parseBillingCycle } from "@/lib/subscriptions/billing-cycle";
import {
  amountWithinTolerance,
  fallbackSubscriptionIdentity,
  merchantLooksRelated,
  normalizeAmount,
  normalizeSubscriptionMerchant,
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

/**
 * Shared candidate selection for linking a transaction to an existing
 * subscription. Both the SMS-mandate match path and the recurring-transaction
 * sync path must use the same filters so they agree on which subscriptions a
 * transaction can attach to (notably: never matching non-ACTIVE rows, so the
 * sync path can't resurrect a HIDDEN subscription).
 */
async function findSubscriptionCandidates(
  db: Db,
  transaction: typeof transactions.$inferSelect,
  opts: { requireActive: boolean },
) {
  const rows = opts.requireActive
    ? await db.select().from(subscriptions).where(eq(subscriptions.state, "ACTIVE"))
    : await db.select().from(subscriptions);

  return rows
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
}

export async function matchAndLinkSubscriptionPayment(
  db: Db,
  transactionId: number,
): Promise<SubscriptionMatchResult> {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  if (!transaction || transaction.isDeleted) return { kind: "none" };

  const candidates = await findSubscriptionCandidates(db, transaction, { requireActive: true });

  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) {
    return { kind: "ambiguous", subscriptionIds: candidates.map((candidate) => candidate.id) };
  }

  const subscription = candidates[0];
  const paidDate = transaction.dateTime.slice(0, 10);
  const nextPaymentDate = advanceDate(
    paidDate,
    parseBillingCycle(subscription.billingCycle) ?? { count: 1, unit: "month" },
  );

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

function paidDateFor(transaction: typeof transactions.$inferSelect): string {
  return transaction.dateTime.slice(0, 10);
}

function nextPaymentAfter(transaction: typeof transactions.$inferSelect): string {
  return advanceDate(
    paidDateFor(transaction),
    parseBillingCycle(transaction.billingCycle) ?? {
      count: 1,
      unit: "month",
    },
  );
}

async function categorySnapshot(db: Db, categoryId: number, subcategoryId?: number | null) {
  const [category] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  return {
    categoryId: category?.id ?? categoryId,
    categoryName: category?.name ?? null,
    subcategoryId: subcategoryId ?? null,
  };
}

/**
 * Cashiro parity: a transaction that rules/manual edits mark recurring should
 * materialize as a subscription row, not only as a recurring transaction flag.
 */
export async function syncSubscriptionFromRecurringTransaction(
  db: Db,
  transactionId: number,
): Promise<SubscriptionMatchResult> {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);
  if (!transaction || transaction.isDeleted || !transaction.isRecurring) return { kind: "none" };
  if (transaction.subscriptionId != null) {
    return { kind: "linked", subscriptionId: transaction.subscriptionId };
  }

  const candidates = await findSubscriptionCandidates(db, transaction, { requireActive: true });
  if (candidates.length > 1) {
    return { kind: "ambiguous", subscriptionIds: candidates.map((candidate) => candidate.id) };
  }

  const timestamp = nowIso();
  const paidDate = paidDateFor(transaction);
  const nextPaymentDate = nextPaymentAfter(transaction);
  const category = await categorySnapshot(db, transaction.categoryId, transaction.subcategoryId);

  if (candidates.length === 1) {
    const existing = candidates[0];
    const latestPaidDate =
      existing.lastPaidDate && existing.lastPaidDate > paidDate ? existing.lastPaidDate : paidDate;
    const latestNextDate =
      existing.lastPaidDate && existing.lastPaidDate > paidDate
        ? (existing.nextPaymentDate ?? nextPaymentDate)
        : nextPaymentDate;

    await db
      .update(subscriptions)
      .set({
        merchantName: transaction.merchantName,
        amount: normalizeAmount(transaction.amount),
        nextPaymentDate: latestNextDate,
        state: "ACTIVE",
        bankName: transaction.bankName,
        categoryId: category.categoryId,
        subcategoryId: category.subcategoryId,
        categoryName: category.categoryName,
        currency: transaction.currency,
        billingCycle: transaction.billingCycle ?? existing.billingCycle ?? "monthly",
        lastPaidDate: latestPaidDate,
        updatedAt: timestamp,
      })
      .where(eq(subscriptions.id, existing.id));
    await db
      .update(transactions)
      .set({ subscriptionId: existing.id, isRecurring: true })
      .where(eq(transactions.id, transaction.id));
    return { kind: "linked", subscriptionId: existing.id };
  }

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      merchantName: transaction.merchantName,
      amount: normalizeAmount(transaction.amount),
      nextPaymentDate,
      state: "ACTIVE",
      bankName: transaction.bankName,
      umn: null,
      categoryId: category.categoryId,
      subcategoryId: category.subcategoryId,
      categoryName: category.categoryName,
      subcategoryName: transaction.subcategoryName,
      smsBody: null,
      currency: transaction.currency,
      billingCycle: transaction.billingCycle ?? "monthly",
      lastPaidDate: paidDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  await db
    .update(transactions)
    .set({ subscriptionId: subscription.id, isRecurring: true })
    .where(eq(transactions.id, transaction.id));
  return { kind: "linked", subscriptionId: subscription.id };
}

export async function setSubscriptionState(
  db: Db,
  id: number,
  state: "ACTIVE" | "HIDDEN",
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ state, updatedAt: nowIso() })
    .where(eq(subscriptions.id, id));
}

export async function hideSubscription(db: Db, id: number): Promise<void> {
  await setSubscriptionState(db, id, "HIDDEN");
}

export interface SubscriptionInput {
  merchantName: string;
  amount: string;
  currency?: string;
  billingCycle?: string | null;
  nextPaymentDate?: string | null;
  bankName?: string | null;
  categoryId?: number | null;
}

/** Manually create a subscription (active), denormalizing the category name. */
export async function createSubscription(db: Db, input: SubscriptionInput): Promise<number> {
  const snapshot =
    input.categoryId != null
      ? await categorySnapshot(db, input.categoryId)
      : { categoryId: null, categoryName: null };
  const [row] = await db
    .insert(subscriptions)
    .values({
      merchantName: input.merchantName,
      amount: input.amount,
      currency: input.currency ?? "INR",
      billingCycle: input.billingCycle ?? null,
      nextPaymentDate: input.nextPaymentDate ?? null,
      bankName: input.bankName ?? null,
      categoryId: snapshot.categoryId,
      categoryName: snapshot.categoryName,
      state: "ACTIVE",
    })
    .returning({ id: subscriptions.id });
  return row.id;
}

/** Update editable fields; re-snapshots the category name when categoryId changes. */
export async function editSubscription(
  db: Db,
  id: number,
  patch: Partial<SubscriptionInput>,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.merchantName !== undefined) set.merchantName = patch.merchantName;
  if (patch.amount !== undefined) set.amount = patch.amount;
  if (patch.currency !== undefined) set.currency = patch.currency;
  if (patch.billingCycle !== undefined) set.billingCycle = patch.billingCycle;
  if (patch.nextPaymentDate !== undefined) set.nextPaymentDate = patch.nextPaymentDate;
  if (patch.bankName !== undefined) set.bankName = patch.bankName;
  if (patch.categoryId !== undefined) {
    if (patch.categoryId === null) {
      set.categoryId = null;
      set.categoryName = null;
    } else {
      const snapshot = await categorySnapshot(db, patch.categoryId);
      set.categoryId = snapshot.categoryId;
      set.categoryName = snapshot.categoryName;
    }
  }
  await db.update(subscriptions).set(set).where(eq(subscriptions.id, id));
}

export async function deleteSubscription(db: Db, id: number): Promise<void> {
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}
