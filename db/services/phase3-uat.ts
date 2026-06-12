import { and, count, desc, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  categories,
  ruleApplications,
  subscriptions,
  transactions,
  unrecognizedSms,
} from "@/db/schema";
import { applyToPast, previewApplyToPast } from "@/db/services/apply-to-past";
import { loadEnabledParserManifests } from "@/db/services/extensions";
import { saveRule } from "@/db/services/rule-ops";
import { processSms } from "@/db/services/sms-processing";
import { hideSubscription, matchAndLinkSubscriptionPayment } from "@/db/services/subscription-ops";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

const SENDER = "VM-HDFCBK-S";
const MANDATE_BODY =
  "E-Mandate! Rs.1,499 will be deducted on 15/07/26, 09:00:00 For NETFLIX mandate UMN HDFCUMN12345";
const BAD_MANDATE_BODY =
  "E-Mandate! Rs.1,499 will be deducted soon For NETFLIX mandate UMN HDFCUMN12345";

function stamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(8, 14);
}

async function categoryName(db: Db, seedKey: string): Promise<string> {
  const [category] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.seedKey, seedKey))
    .limit(1);
  if (!category) throw new Error(`Missing seeded category: ${seedKey}`);
  return category.name;
}

async function transactionById(db: Db, id: number) {
  const [row] = await db
    .select({
      id: transactions.id,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      subscriptionId: transactions.subscriptionId,
      isRecurring: transactions.isRecurring,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  return row ?? null;
}

async function latestReview(db: Db, reason: typeof unrecognizedSms.$inferSelect.reviewReason) {
  const [row] = await db
    .select({
      id: unrecognizedSms.id,
      status: unrecognizedSms.status,
      reviewReason: unrecognizedSms.reviewReason,
      parsedFieldsJson: unrecognizedSms.parsedFieldsJson,
    })
    .from(unrecognizedSms)
    .where(eq(unrecognizedSms.reviewReason, reason))
    .orderBy(desc(unrecognizedSms.id))
    .limit(1);
  return row ?? null;
}

export interface Phase3UatResult {
  mandateSubscriptionId: number;
  mandateDedupCount: number;
  mandateParseFailureReviewId: number;
  swiggyTransactionId: number;
  swiggyRuleAuditCount: number;
  blockedReviewId: number;
  applyToPastPreviewCount: number;
  applyToPastUpdated: number;
  matchedTransactionId: number;
  matchedSubscriptionId: number;
  hiddenState: string;
  reactivatedState: string;
}

export async function runPhase3Uat(db: Db): Promise<Phase3UatResult> {
  const manifests = await loadEnabledParserManifests(db);
  const subscriptionCategory = await categoryName(db, "subscription");
  const unique = stamp();
  const baseTime = new Date();
  let sequence = 0;
  const sms = (body: string) => {
    const receivedAt = new Date(baseTime.getTime() + sequence * 1000).toISOString();
    sequence += 1;
    return { sender: SENDER, body, receivedAt };
  };

  const mandate = await processSms(db, manifests, sms(MANDATE_BODY));
  if (mandate.kind !== "mandate") throw new Error(`Mandate failed: ${mandate.kind}`);

  const mandateAgain = await processSms(db, manifests, sms(MANDATE_BODY));
  if (mandateAgain.kind !== "mandate")
    throw new Error(`Mandate dedup failed: ${mandateAgain.kind}`);

  const [{ count: mandateDedupCount }] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(eq(subscriptions.umn, "HDFCUMN12345"));

  const badMandate = await processSms(db, manifests, sms(BAD_MANDATE_BODY));
  if (badMandate.kind !== "review") throw new Error(`Bad mandate failed: ${badMandate.kind}`);
  const badReview = await latestReview(db, "MANDATE_PARSE_FAILED");
  if (!badReview) throw new Error("Missing MANDATE_PARSE_FAILED review row");

  const swiggyRuleId = "uat-swiggy-subscription";
  await saveRule(db, {
    id: swiggyRuleId,
    name: "UAT Swiggy to Subscription",
    priority: 10,
    isActive: true,
    conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "SWIGGY" }],
    actions: [{ actionType: "SET", field: "CATEGORY", value: subscriptionCategory }],
  });

  const swiggyBody = `Rs.333.${unique.slice(-2)} debited from HDFC Bank A/c XX1234 at SWIGGY-UAT-${unique} on 13/06/26. Avl bal:INR 87,900.00`;
  const swiggy = await processSms(db, manifests, sms(swiggyBody));
  if (swiggy.kind !== "saved") throw new Error(`Swiggy save failed: ${swiggy.kind}`);
  const [swiggyAudits] = await db
    .select({ count: count() })
    .from(ruleApplications)
    .where(
      and(
        eq(ruleApplications.ruleId, swiggyRuleId),
        eq(ruleApplications.transactionId, String(swiggy.transactionId)),
      ),
    );

  const blockRuleId = "uat-block-test-block";
  await saveRule(db, {
    id: blockRuleId,
    name: "UAT Block Test Block",
    priority: 1,
    isActive: true,
    conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "TEST-BLOCK" }],
    actions: [{ actionType: "BLOCK" }],
  });
  const blocked = await processSms(
    db,
    manifests,
    sms(
      `Rs.654.${unique.slice(-2)} debited from HDFC Bank A/c XX1234 at TEST-BLOCK-${unique} on 13/06/26. Avl bal:INR 87,000.00`,
    ),
  );
  if (blocked.kind !== "review") throw new Error(`Block did not review: ${blocked.kind}`);
  const blockReview = await latestReview(db, "BLOCKED_BY_RULE");
  if (!blockReview) throw new Error("Missing BLOCKED_BY_RULE review row");

  const applyRuleId = "uat-apply-past-swiggy";
  await saveRule(db, {
    id: applyRuleId,
    name: "UAT Apply Past Swiggy",
    priority: 20,
    isActive: true,
    conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: "SWIGGY INSTAMART" }],
    actions: [{ actionType: "SET", field: "CATEGORY", value: subscriptionCategory }],
  });
  const preview = await previewApplyToPast(db, [applyRuleId]);
  const applied = await applyToPast(db, [applyRuleId]);

  const mandateMatchBody = `E-Mandate! Rs.700 will be deducted on 20/07/26, 09:00:00 For MATCHMEUAT-${unique} mandate UMN UATMATCH${unique}`;
  const matchMandate = await processSms(db, manifests, sms(mandateMatchBody));
  if (matchMandate.kind !== "mandate")
    throw new Error(`Match mandate failed: ${matchMandate.kind}`);
  const paymentBody = `Rs.700.00 debited from HDFC Bank A/c XX1234 at MATCHMEUAT-${unique} on 20/06/26. Avl bal:INR 86,000.00`;
  const payment = await processSms(db, manifests, sms(paymentBody));
  if (payment.kind !== "saved") throw new Error(`Subscription payment failed: ${payment.kind}`);
  let paymentRow = await transactionById(db, payment.transactionId);
  if (!paymentRow?.subscriptionId) {
    await matchAndLinkSubscriptionPayment(db, payment.transactionId);
    paymentRow = await transactionById(db, payment.transactionId);
  }
  if (!paymentRow?.subscriptionId) throw new Error("Payment was not linked to a subscription");

  await hideSubscription(db, matchMandate.subscriptionId);
  const [hidden] = await db
    .select({ state: subscriptions.state })
    .from(subscriptions)
    .where(eq(subscriptions.id, matchMandate.subscriptionId));
  await processSms(db, manifests, sms(mandateMatchBody));
  const [reactivated] = await db
    .select({ state: subscriptions.state })
    .from(subscriptions)
    .where(eq(subscriptions.id, matchMandate.subscriptionId));

  return {
    mandateSubscriptionId: mandate.subscriptionId,
    mandateDedupCount,
    mandateParseFailureReviewId: badReview.id,
    swiggyTransactionId: swiggy.transactionId,
    swiggyRuleAuditCount: swiggyAudits.count,
    blockedReviewId: blockReview.id,
    applyToPastPreviewCount: preview.count,
    applyToPastUpdated: applied.updated,
    matchedTransactionId: payment.transactionId,
    matchedSubscriptionId: paymentRow.subscriptionId,
    hiddenState: hidden?.state ?? "",
    reactivatedState: reactivated?.state ?? "",
  };
}
