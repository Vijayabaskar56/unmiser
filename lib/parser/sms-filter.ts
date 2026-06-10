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
