import { and, eq, inArray, isNull } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import {
  accounts,
  categories,
  type SmsReviewReason,
  type SmsReviewStatus,
  unrecognizedSms,
} from "@/db/schema";
import { createAccount } from "@/db/services/account-ops";
import { saveTransactionThroughPipeline } from "@/db/services/automation-pipeline";
import { upsertFromMandate } from "@/db/services/subscription-ops";
import { resolveAccount } from "@/lib/account-resolver";
import { nowIso, parseIso, toIso } from "@/lib/dates";
import { parseSmsWithManifests } from "@/lib/parser";
import { shouldCaptureUnrecognizedSms } from "@/lib/parser/sms-filter";
import type { ParserResult, SmsInput, SmsParserManifest } from "@/lib/parser/types";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

export type SmsProcessOutcome =
  | { kind: "saved"; transactionId: number; result: ParserResult }
  | { kind: "mandate"; subscriptionId: number; result: ParserResult }
  | { kind: "review"; reviewId: number; result: ParserResult; status: SmsReviewStatus }
  | { kind: "duplicate"; transactionId: number; result: ParserResult }
  | { kind: "rejected"; result: ParserResult };

export async function processSms(
  db: Db,
  manifests: SmsParserManifest[],
  input: SmsInput,
): Promise<SmsProcessOutcome> {
  const result = parseSmsWithManifests(manifests, input);

  if (result.mandate) {
    const subscriptionId = await upsertFromMandate(db, result.mandate);
    await resolveReviewRow(db, input);
    return { kind: "mandate", subscriptionId, result };
  }

  if (result.mandateParseFailed) {
    const reviewId = await captureSmsReview(db, input, result, "REJECTED", "MANDATE_PARSE_FAILED");
    return { kind: "review", reviewId, result, status: "REJECTED" };
  }

  if (!result.matchedManifest) {
    // ADR-0015: capture is scoped to bank-like senders with transaction-looking
    // bodies. Everything else (OTPs, promos, telecom) is dropped silently —
    // mirroring the original app's storeUnrecognizedSms gate.
    if (!shouldCaptureUnrecognizedSms(input.sender, input.body)) {
      return { kind: "rejected", result };
    }
    const reviewId = await captureSmsReview(db, input, result, "UNRECOGNIZED", "NO_PARSER");
    return { kind: "review", reviewId, result, status: "UNRECOGNIZED" };
  }

  // Filter-rejected results carry a matchedManifest but no fields, so this
  // branch must run before any field access. The same capture gate applies:
  // a promo from a bank sender is noise, not review work.
  if (result.confidence === "REJECTED" || !result.fields) {
    if (!shouldCaptureUnrecognizedSms(input.sender, input.body)) {
      return { kind: "rejected", result };
    }
    const reviewId = await captureSmsReview(db, input, result, "REJECTED", mapReviewReason(result));
    return { kind: "review", reviewId, result, status: "REJECTED" };
  }

  const accountLast4 = result.fields.accountLast4;
  if (!accountLast4) {
    const reviewId = await captureSmsReview(
      db,
      input,
      result,
      "ACCOUNT_RESOLUTION_REQUIRED",
      "UNKNOWN_ACCOUNT_LAST4",
    );
    return { kind: "review", reviewId, result, status: "ACCOUNT_RESOLUTION_REQUIRED" };
  }

  const existingAccounts = await db
    .select({
      id: accounts.id,
      canonicalBank: accounts.canonicalBank,
      accountLast4: accounts.accountLast4,
      isCreditCard: accounts.isCreditCard,
      currency: accounts.currency,
    })
    .from(accounts);
  const resolved = resolveAccount(
    { canonicalBank: result.matchedManifest.pluginId, accountLast4 },
    existingAccounts.map((account) => ({
      id: account.id,
      canonicalBank: account.canonicalBank ?? "",
      accountLast4: account.accountLast4,
    })),
  );

  // ADR-0006: only a genuinely ambiguous partial suffix (several same-bank
  // accounts end with the fragment) still needs a human. "No match" auto-creates
  // below instead of hoarding ACCOUNT_RESOLUTION_REQUIRED rows.
  if (resolved.kind === "many") {
    const reviewId = await captureSmsReview(
      db,
      input,
      result,
      "ACCOUNT_RESOLUTION_REQUIRED",
      "UNKNOWN_ACCOUNT_LAST4",
    );
    return { kind: "review", reviewId, result, status: "ACCOUNT_RESOLUTION_REQUIRED" };
  }

  if (result.confidence !== "HIGH") {
    const reviewId = await captureSmsReview(
      db,
      input,
      result,
      "LOW_CONFIDENCE",
      mapReviewReason(result),
    );
    return { kind: "review", reviewId, result, status: "LOW_CONFIDENCE" };
  }

  let accountId: number;
  let isCreditCard: boolean;
  if (resolved.kind === "matched") {
    const account = existingAccounts.find((row) => row.id === resolved.accountId)!;
    accountId = account.id;
    isCreditCard = account.isCreditCard;
  } else {
    // ADR-0006 auto-create: a confident parse with no matching account upserts
    // one keyed on the canonical bank (manifest pluginId) + last4. The unique
    // (bankName, accountLast4) index guarantees one row per bank+last4.
    isCreditCard = result.fields.isFromCard === true;
    accountId = await autoCreateSmsAccount(db, {
      pluginId: result.matchedManifest.pluginId,
      bankName: result.matchedManifest.name,
      accountLast4,
      currency: result.fields.currency,
      isCreditCard,
    });
  }

  const categoryId = await resolveSmsCategory(db, result.fields.transactionType);
  const dateTime = normalizeReceivedAt(input.receivedAt);
  const pipelineOutcome = await saveTransactionThroughPipeline(db, {
    accountId,
    amount: result.fields.amount!,
    merchantName: result.fields.merchant ?? "Transfer",
    categoryId,
    transactionType: result.fields.transactionType!,
    dateTime,
    isCreditCard,
    smsSender: input.sender,
    smsBody: null,
    balanceAfter: result.fields.balance ?? null,
    transactionHash: result.fields.transactionHash,
    sourceType: "SMS",
    sourcePluginId: result.matchedManifest.pluginId,
    sourcePluginVersion: result.matchedManifest.version,
    sourceReceivedAt: input.receivedAt,
    currency: result.fields.currency,
  });

  if (pipelineOutcome.kind === "blocked") {
    const reviewId = await captureSmsReview(
      db,
      input,
      {
        ...result,
        fields: {
          ...result.fields!,
          blockedRuleId: pipelineOutcome.ruleId,
          blockedRuleName: pipelineOutcome.ruleName,
        } as ParserResult["fields"],
      },
      "BLOCKED",
      "BLOCKED_BY_RULE",
    );
    return { kind: "review", reviewId, result, status: "BLOCKED" };
  }

  // A message that is now a saved transaction (fresh insert or hash-dedup on a
  // rescan) no longer needs review; resolve any earlier review row for it.
  await resolveReviewRow(db, input);

  return { kind: "saved", transactionId: pipelineOutcome.transactionId, result };
}

/**
 * Auto-create the ADR-0006 account for a confident SMS parse. The unique
 * (bankName, accountLast4) index is the dedup authority: if a concurrent insert
 * (e.g. two messages for the same new account inside one scan batch) loses the
 * race, the violation is caught and the surviving row's id is returned instead.
 */
async function autoCreateSmsAccount(
  db: Db,
  input: {
    pluginId: string;
    bankName: string;
    accountLast4: string;
    currency: string;
    isCreditCard: boolean;
  },
): Promise<number> {
  try {
    return await createAccount(db, {
      bankName: input.bankName,
      accountLast4: input.accountLast4,
      currency: input.currency,
      kind: input.isCreditCard ? "credit" : "bank",
      canonicalBank: input.pluginId,
      iconName: "type_finance_bank",
    });
  } catch (error) {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.bankName, input.bankName), eq(accounts.accountLast4, input.accountLast4)),
      )
      .limit(1);
    if (existing.length > 0) return existing[0].id;
    throw error;
  }
}

/**
 * Hygiene pass over the open review queue (the original app's
 * cleanupOldEntries() analog): soft-deletes UNRECOGNIZED/REJECTED rows that no
 * longer pass the capture gate — rows hoarded before the gate existed, or after
 * a gate tightening. Parsed-but-unresolved rows (ACCOUNT_RESOLUTION_REQUIRED,
 * LOW_CONFIDENCE) are real work and are never pruned. Returns the pruned count.
 */
export async function pruneReviewRows(db: Db): Promise<number> {
  const rows = await db
    .select({
      id: unrecognizedSms.id,
      sender: unrecognizedSms.sender,
      smsBody: unrecognizedSms.smsBody,
      status: unrecognizedSms.status,
    })
    .from(unrecognizedSms)
    .where(and(eq(unrecognizedSms.isDeleted, false), isNull(unrecognizedSms.resolvedAt)));

  const staleIds = rows
    .filter(
      (row) =>
        (row.status === "UNRECOGNIZED" || row.status === "REJECTED") &&
        !shouldCaptureUnrecognizedSms(row.sender, row.smsBody),
    )
    .map((row) => row.id);

  // Chunked to stay under SQLite's bound-parameter limit.
  for (let i = 0; i < staleIds.length; i += 500) {
    await db
      .update(unrecognizedSms)
      .set({ isDeleted: true })
      .where(inArray(unrecognizedSms.id, staleIds.slice(i, i + 500)));
  }
  return staleIds.length;
}

async function resolveReviewRow(db: Db, input: SmsInput): Promise<void> {
  await db
    .update(unrecognizedSms)
    .set({ resolvedAt: nowIso() })
    .where(
      and(
        eq(unrecognizedSms.sender, input.sender),
        eq(unrecognizedSms.smsBody, input.body),
        isNull(unrecognizedSms.resolvedAt),
      ),
    );
}

function normalizeReceivedAt(receivedAt: string): string {
  const parsed = parseIso(receivedAt);
  if (Number.isNaN(parsed.getTime())) return nowIso();
  return toIso(parsed);
}

export async function captureSmsReview(
  db: Db,
  input: SmsInput,
  result: ParserResult,
  status: SmsReviewStatus,
  reviewReason: SmsReviewReason,
): Promise<number> {
  const values = {
    sender: input.sender,
    smsBody: input.body,
    receivedAt: input.receivedAt,
    status,
    reviewReason,
    pluginId: result.matchedManifest?.pluginId ?? null,
    pluginVersion: result.matchedManifest?.version ?? null,
    parserConfidence: result.confidence,
    parsedFieldsJson: result.fields ? JSON.stringify(result.fields) : null,
    rawMatchesJson: JSON.stringify(result.rawMatches),
  };

  await db
    .insert(unrecognizedSms)
    .values(values)
    .onConflictDoUpdate({
      target: [unrecognizedSms.sender, unrecognizedSms.smsBody],
      set: values,
    });

  const rows = await db
    .select({ id: unrecognizedSms.id })
    .from(unrecognizedSms)
    .where(and(eq(unrecognizedSms.sender, input.sender), eq(unrecognizedSms.smsBody, input.body)))
    .limit(1);
  return rows[0].id;
}

async function resolveSmsCategory(
  db: Db,
  type: NonNullable<ParserResult["fields"]>["transactionType"],
): Promise<number> {
  const seedKey =
    type === "INCOME" ? "income" : type === "INVESTMENT" ? "investment" : "miscellaneous";
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.seedKey, seedKey))
    .limit(1);
  if (rows.length > 0) return rows[0].id;

  const fallback = await db.select({ id: categories.id }).from(categories).limit(1);
  if (fallback.length === 0) {
    throw new Error("Cannot save SMS transaction without at least one category");
  }
  return fallback[0].id;
}

function mapReviewReason(result: ParserResult): SmsReviewReason {
  if (result.reasons.includes("FILTER_REJECTED")) return "FILTER_REJECTED";
  if (result.reasons.includes("MISSING_AMOUNT")) return "MISSING_AMOUNT";
  if (result.reasons.includes("MISSING_TYPE")) return "MISSING_TYPE";
  if (result.reasons.includes("MISSING_MERCHANT")) return "MISSING_MERCHANT";
  if (result.reasons.includes("PIPELINE_REJECTED")) return "PIPELINE_REJECTED";
  if (result.reasons.includes("NO_MATCHING_MANIFEST")) return "NO_PARSER";
  return "AMBIGUOUS_MERCHANT";
}
