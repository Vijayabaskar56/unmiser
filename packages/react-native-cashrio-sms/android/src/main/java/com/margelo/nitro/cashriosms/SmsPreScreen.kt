package com.margelo.nitro.cashriosms

/**
 * Manifest-INDEPENDENT coarse pre-screen, the exact Kotlin mirror of
 * lib/parser/sms-filter.ts (ADR-0015 capture gate): a bank-like DLT sender
 * shape plus a transaction-looking body. Applied natively (behind the
 * `preScreen` flag) so the obvious 80-90% noise never crosses the bridge.
 *
 * IMPORTANT: this must NEVER evaluate manifest dispatch/filter regexes —
 * manifest semantics are the TS engine's sole authority (no Kotlin fork).
 * Any keyword change here MUST be mirrored in lib/parser/sms-filter.ts and
 * covered by the parity cases in lib/scan/pre-screen-parity.test.ts.
 */
object SmsPreScreen {
  /** Mirror of isBankLikeSender: DLT transactional (-T) or service (-S) suffix. */
  fun isBankLikeSender(sender: String): Boolean {
    val upper = sender.uppercase()
    return upper.endsWith("-T") || upper.endsWith("-S")
  }

  /** Mirror of isTransactionMessage: not OTP/promo/request/reminder, has txn keywords. */
  fun isTransactionMessage(message: String): Boolean {
    val lower = message.lowercase()

    // Skip OTP messages
    if (
      lower.contains("otp") ||
      lower.contains("one time password") ||
      lower.contains("verification code")
    ) {
      return false
    }

    // Skip promotional messages
    if (
      lower.contains("offer") ||
      lower.contains("discount") ||
      lower.contains("cashback offer") ||
      lower.contains("win ")
    ) {
      return false
    }

    // Skip payment request messages (common across banks)
    if (
      lower.contains("has requested") ||
      lower.contains("payment request") ||
      lower.contains("collect request") ||
      lower.contains("requesting payment") ||
      lower.contains("requests rs") ||
      lower.contains("ignore if already paid")
    ) {
      return false
    }

    // Skip merchant payment acknowledgments
    if (lower.contains("have received payment")) {
      return false
    }

    // Skip payment reminder/due messages
    if (
      lower.contains("is due") ||
      lower.contains("min amount due") ||
      lower.contains("minimum amount due") ||
      lower.contains("in arrears") ||
      lower.contains("is overdue") ||
      lower.contains("ignore if paid") ||
      (lower.contains("pls pay") && lower.contains("min of"))
    ) {
      return false
    }

    // Skip bank SERVICE NOTICES that are not transactions: declined attempts,
    // fee/limit/feature advisories, KYC / e-mail prompts. These frequently
    // contain "debit card" / a Rs amount, so they would otherwise pass the
    // keyword gate below and flood the review queue. A genuine transaction is
    // fully parsed and never reaches this capture gate, so this is safe.
    if (
      lower.contains("txn declined") ||
      lower.contains("transaction declined") ||
      lower.contains("forex markup") ||
      lower.contains("limit modified") ||
      lower.contains("international merchant outlet") ||
      lower.contains("not enabled") ||
      lower.contains("kyc consent") ||
      lower.contains("validating the e-mail")
    ) {
      return false
    }

    // Must contain transaction keywords
    val transactionKeywords = listOf(
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
    )

    return transactionKeywords.any { lower.contains(it) }
  }

  /** Mirror of shouldCaptureUnrecognizedSms: both checks must pass. */
  fun shouldCapture(sender: String, body: String): Boolean =
    isBankLikeSender(sender) && isTransactionMessage(body)
}
