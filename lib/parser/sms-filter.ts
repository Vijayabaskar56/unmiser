// Port of the original Cashiro parser-core SmsFilter.kt plus the worker's
// sender gate (OptimizedSmsReaderWorker.storeUnrecognizedSms). Together they
// implement ADR-0015's "scoped to bank-like senders" capture policy: an SMS
// that fails either check is dropped silently instead of becoming a review row.

/**
 * True when the DLT sender header marks the message transactional (-T) or
 * service (-S). Promotional (-P), government (-G), and unsuffixed senders
 * never carry bank transactions worth reviewing.
 */
export function isBankLikeSender(sender: string): boolean {
  const upper = sender.toUpperCase();
  return upper.endsWith("-T") || upper.endsWith("-S");
}

/**
 * Checks if the message is a transaction message (not OTP, promotional, etc.).
 */
export function isTransactionMessage(message: string): boolean {
  const lower = message.toLowerCase();

  // Skip OTP messages
  if (
    lower.includes("otp") ||
    lower.includes("one time password") ||
    lower.includes("verification code")
  ) {
    return false;
  }

  // Skip promotional messages
  if (
    lower.includes("offer") ||
    lower.includes("discount") ||
    lower.includes("cashback offer") ||
    lower.includes("win ")
  ) {
    return false;
  }

  // Skip payment request messages (common across banks)
  if (
    lower.includes("has requested") ||
    lower.includes("payment request") ||
    lower.includes("collect request") ||
    lower.includes("requesting payment") ||
    lower.includes("requests rs") ||
    lower.includes("ignore if already paid")
  ) {
    return false;
  }

  // Skip merchant payment acknowledgments
  if (lower.includes("have received payment")) {
    return false;
  }

  // Skip payment reminder/due messages
  if (
    lower.includes("is due") ||
    lower.includes("min amount due") ||
    lower.includes("minimum amount due") ||
    lower.includes("in arrears") ||
    lower.includes("is overdue") ||
    lower.includes("ignore if paid") ||
    (lower.includes("pls pay") && lower.includes("min of"))
  ) {
    return false;
  }

  // Skip bank SERVICE NOTICES that are not transactions: declined attempts,
  // fee/limit/feature advisories, KYC / e-mail prompts. These frequently contain
  // "debit card" / a Rs amount, so they would otherwise pass the keyword gate
  // below and flood the review queue. A genuine transaction is fully parsed and
  // never reaches this capture gate, so excluding these markers is safe.
  if (
    lower.includes("txn declined") ||
    lower.includes("transaction declined") ||
    lower.includes("forex markup") ||
    lower.includes("limit modified") ||
    lower.includes("international merchant outlet") ||
    lower.includes("not enabled") ||
    lower.includes("kyc consent") ||
    lower.includes("validating the e-mail")
  ) {
    return false;
  }

  // Must contain transaction keywords
  const transactionKeywords = [
    "debited",
    "credited",
    "withdrawn",
    "withdrawal",
    "withdrawing",
    "deposited",
    "spent",
    "received",
    "transferred",
    "paid",
    "credit",
    "debit",
    "deducted",
    "will be deducted",
    "will be debited",
  ];

  return transactionKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * The capture gate for review rows that are not parsed transactions
 * (UNRECOGNIZED / REJECTED): both the sender and the body must look like a
 * bank transaction, otherwise the SMS is not worth a human's attention.
 */
export function shouldCaptureUnrecognizedSms(sender: string, body: string): boolean {
  return isBankLikeSender(sender) && isTransactionMessage(body);
}
