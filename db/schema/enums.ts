// String enums, mirroring the Kotlin enums stored as TEXT (value === enum name)
// by Room's TypeConverters.

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "CREDIT", "TRANSFER", "INVESTMENT"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_SOURCES = ["MANUAL", "SMS", "IMPORT", "API_SOURCE"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

// Payment rail surfaced on the transaction row/detail ("UPI · NEFT · card").
// Nullable on the row: derived from the SMS at parse time, or optionally chosen
// when adding manually. Existing/manual rows without it simply hide the segment.
export const PAYMENT_METHODS = ["UPI", "NEFT", "IMPS", "CARD", "CASH", "ATM", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Parser confidence shown as the detail-card badge ("HIGH"). Set HIGH on a
// successful SMS parse, left null for manual entries (badge hidden when null).
export const PARSE_CONFIDENCE = ["HIGH", "MEDIUM", "LOW"] as const;
export type ParseConfidence = (typeof PARSE_CONFIDENCE)[number];

export const EXTENSION_TYPES = ["sms-parser", "rule"] as const;
export type ExtensionType = (typeof EXTENSION_TYPES)[number];

// Trust is set by INSTALL SOURCE (bundled = compiled-in, registry = fetched
// from the store), not by the manifest's own trust field. "community" and
// "vetted" are reserved for future third-party submissions / api-source.
export const EXTENSION_TRUST_TIERS = [
  "bundled",
  "registry",
  "owner",
  "community",
  "vetted",
] as const;
export type ExtensionTrustTier = (typeof EXTENSION_TRUST_TIERS)[number];

export const SMS_REVIEW_STATUSES = [
  "UNRECOGNIZED",
  "ACCOUNT_RESOLUTION_REQUIRED",
  "LOW_CONFIDENCE",
  "DUPLICATE_SKIPPED",
  "REJECTED",
  "BLOCKED",
] as const;
export type SmsReviewStatus = (typeof SMS_REVIEW_STATUSES)[number];

export const SMS_REVIEW_REASONS = [
  "NO_PARSER",
  "FILTER_REJECTED",
  "UNKNOWN_ACCOUNT_LAST4",
  "AMBIGUOUS_MERCHANT",
  "MISSING_AMOUNT",
  "MISSING_TYPE",
  "MISSING_MERCHANT",
  "PIPELINE_REJECTED",
  "BLOCKED_BY_RULE",
  "MANDATE_PARSE_FAILED",
] as const;
export type SmsReviewReason = (typeof SMS_REVIEW_REASONS)[number];

export const SUBSCRIPTION_STATES = ["ACTIVE", "HIDDEN"] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export const CARD_TYPES = ["DEBIT", "CREDIT"] as const;
export type CardType = (typeof CARD_TYPES)[number];

// Account "source" kinds (Unmiser net-worth model). BANK/CREDIT/CASH are wired
// this phase; PF/INSURANCE/INVESTMENT are reserved — the Add-a-source UI shows
// them disabled until their feature phase. The canonical kind lives in
// accounts.sourceKind; the legacy isWallet/isCreditCard booleans are derived
// from it (CREDIT→isCreditCard, CASH→isWallet) so the balance cascade and seed
// keep working unchanged.
export const SOURCE_KINDS = ["BANK", "CREDIT", "CASH", "PF", "INSURANCE", "INVESTMENT"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

// Subtype shown for BANK sources only (the secondary "savings ••4410" line).
export const BANK_SUBTYPES = ["savings", "salary", "current"] as const;
export type BankSubtype = (typeof BANK_SUBTYPES)[number];

export const BUDGET_PERIODS = ["CUSTOM", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const BUDGET_TRACK_TYPES = ["ADDED_ONLY", "ALL_TRANSACTIONS"] as const;
export type BudgetTrackType = (typeof BUDGET_TRACK_TYPES)[number];

export const BUDGET_TYPES = ["EXPENSE", "SAVINGS"] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export const WEBHOOK_DATA_TYPES = [
  "SUMMARY",
  "TRANSACTIONS",
  "BUDGETS",
  "ACCOUNTS",
  "SUBSCRIPTIONS",
] as const;
export type WebhookDataType = (typeof WEBHOOK_DATA_TYPES)[number];

export const WEBHOOK_LOG_STATUSES = ["SUCCESS", "FAILURE"] as const;
export type WebhookLogStatus = (typeof WEBHOOK_LOG_STATUSES)[number];

export const WEBHOOK_RANGE_PRESETS = [
  "SINCE_LAST_SUCCESS",
  "TODAY",
  "CURRENT_WEEK",
  "CURRENT_MONTH",
  "PREVIOUS_MONTH",
  "LAST_30_DAYS",
  "CUSTOM",
] as const;
export type WebhookRangePreset = (typeof WEBHOOK_RANGE_PRESETS)[number];

export const WEBHOOK_SYNC_REASONS = ["MANUAL", "INTERVAL", "SCHEDULED", "TEST"] as const;
export type WebhookSyncReason = (typeof WEBHOOK_SYNC_REASONS)[number];
