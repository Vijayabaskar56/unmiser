import { describe, expect, it } from "vitest";

import { accounts, categories, transactions, unrecognizedSms } from "@/db/schema";
import { createAccount } from "@/db/services/account-ops";
import { processSms, pruneReviewRows } from "@/db/services/sms-processing";
import { createTestDb, type TestDb } from "@/db/test-support/harness";
import { bundledParserManifests } from "@/lib/parser/manifests";

const RECEIVED_AT = "2026-06-10T10:00:00";
const TXN_BODY = "Rs.500.00 debited from A/c XX1234. Avl Bal Rs.4500.00 Ref:REF001";

// Real bundled-manifest fixtures that parse HIGH (see lib/parser/manifests).
// IOB ledger lines carry a full 4-digit last4; the "a/c no. XXXXX42" narrative
// carries a 2-digit partial fragment; Slice is a card (isFromCard) provider.
const IOB_CREDIT_2345 = {
  sender: "BV-IOBCHN-S",
  body: "Rs.10000.00 Credited to SB-xxx2345 AcBal:79503.33 CLRBal: 79547.15 [UPI/615356 ] TOWNBRANCH-CITY on 02-06-2026 10:31:44.IOB.",
  receivedAt: RECEIVED_AT,
};
const IOB_DEBIT_2345 = {
  sender: "VA-IOBCHN-S",
  body: "Rs.20.64 Debited to SB-xxx2345 AcBal:65162.78 CLRBal: 65206.60 [CHRGS- SMS ] BRANCH ONE on 23-05-2026 08:00:39.IOB.",
  // Distinct timestamp: both messages state a balance, and account_balances has
  // a unique (accountId, timestamp) index.
  receivedAt: "2026-06-10T11:00:00",
};
const IOB_PARTIAL_42 = {
  sender: "VM-IOBCHN-S",
  body: "Your a/c XXXXX42 debited for payee HOTEL SARAVANA for Rs. 150.00 on 2026-03-25, ref 645069093618.If not you, report to your bank immediately-IOB.",
  receivedAt: RECEIVED_AT,
};
const SLICE_CARD_1234 = {
  sender: "JD-SLICE-S",
  body: "Rs.450.00 spent on your Slice card XX1234 at SWIGGY on 09/06/26.",
  receivedAt: RECEIVED_AT,
};

async function seedCategories(db: TestDb): Promise<void> {
  await db.insert(categories).values([
    { name: "Income", color: "#3DDC97", seedKey: "income", isIncome: true },
    { name: "Miscellaneous", color: "#757575", seedKey: "miscellaneous" },
  ]);
}

// No manifests installed: every message takes the NO_PARSER path, which is
// where the ADR-0015 capture gate (bank-like sender + transaction-looking
// body) decides between a review row and a silent drop.
describe("processSms capture gate", () => {
  it("captures unmatched SMS from bank-like senders with transactional bodies", async () => {
    const { db } = createTestDb();
    const outcome = await processSms(db, [], {
      sender: "VM-IOBCHN-S",
      body: TXN_BODY,
      receivedAt: RECEIVED_AT,
    });

    expect(outcome.kind).toBe("review");
    const rows = await db.select().from(unrecognizedSms);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("UNRECOGNIZED");
  });

  it("silently drops promotional senders even with transactional-looking bodies", async () => {
    const { db } = createTestDb();
    const outcome = await processSms(db, [], {
      sender: "VM-HDFCBN-P",
      body: TXN_BODY,
      receivedAt: RECEIVED_AT,
    });

    expect(outcome.kind).toBe("rejected");
    expect(await db.select().from(unrecognizedSms)).toHaveLength(0);
  });

  it("silently drops non-transactional bodies from bank-like senders", async () => {
    const { db } = createTestDb();
    const outcome = await processSms(db, [], {
      sender: "AD-HDFCBK-S",
      body: "Special offer: Open your account and win up to Rs. 1000.",
      receivedAt: RECEIVED_AT,
    });

    expect(outcome.kind).toBe("rejected");
    expect(await db.select().from(unrecognizedSms)).toHaveLength(0);
  });

  it("silently drops unsuffixed senders (telecom, person-to-person)", async () => {
    const { db } = createTestDb();
    const outcome = await processSms(db, [], {
      sender: "JT-JioPay",
      body: "Recharge of Rs.239 received for your Jio number.",
      receivedAt: RECEIVED_AT,
    });

    expect(outcome.kind).toBe("rejected");
    expect(await db.select().from(unrecognizedSms)).toHaveLength(0);
  });
});

// ADR-0006 auto-create: a HIGH-confidence parse whose accountLast4 matches no
// existing account creates the account itself instead of parking the message in
// ACCOUNT_RESOLUTION_REQUIRED (the drift that hoarded 910 stale rows).
describe("processSms account auto-create (ADR-0006)", () => {
  it("auto-creates a canonical-bank account on a confident parse and saves the transaction", async () => {
    const { db } = createTestDb();
    await seedCategories(db);

    const outcome = await processSms(db, bundledParserManifests, IOB_CREDIT_2345);

    expect(outcome.kind).toBe("saved");
    const accountRows = await db.select().from(accounts);
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]).toMatchObject({
      bankName: "Indian Overseas Bank",
      canonicalBank: "in.iob.bank",
      accountLast4: "2345",
      currency: "INR",
      isCreditCard: false,
      isWallet: false,
      iconName: "type_finance_bank",
    });

    const txnRows = await db.select().from(transactions);
    expect(txnRows).toHaveLength(1);
    expect(txnRows[0].accountId).toBe(accountRows[0].id);
  });

  it("reuses the auto-created account for a second SMS with the same last4 (no duplicates)", async () => {
    const { db } = createTestDb();
    await seedCategories(db);

    const first = await processSms(db, bundledParserManifests, IOB_CREDIT_2345);
    const second = await processSms(db, bundledParserManifests, IOB_DEBIT_2345);

    expect(first.kind).toBe("saved");
    expect(second.kind).toBe("saved");
    const accountRows = await db.select().from(accounts);
    expect(accountRows).toHaveLength(1);
    const txnRows = await db.select().from(transactions);
    expect(txnRows).toHaveLength(2);
    expect(txnRows.every((row) => row.accountId === accountRows[0].id)).toBe(true);
  });

  it("auto-creates a credit account when the parse carries the card signal", async () => {
    const { db } = createTestDb();
    await seedCategories(db);

    const outcome = await processSms(db, bundledParserManifests, SLICE_CARD_1234);

    expect(outcome.kind).toBe("saved");
    const accountRows = await db.select().from(accounts);
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]).toMatchObject({
      bankName: "Slice",
      canonicalBank: "in.slice",
      accountLast4: "1234",
      isCreditCard: true,
    });
  });

  it("resolves a partial last4 fragment to the unique existing same-bank account", async () => {
    const { db } = createTestDb();
    await seedCategories(db);
    const accountId = await createAccount(db, {
      bankName: "Indian Overseas Bank",
      accountLast4: "8842",
      canonicalBank: "in.iob.bank",
      currency: "INR",
      kind: "bank",
    });

    const outcome = await processSms(db, bundledParserManifests, IOB_PARTIAL_42);

    expect(outcome.kind).toBe("saved");
    expect(await db.select().from(accounts)).toHaveLength(1);
    const txnRows = await db.select().from(transactions);
    expect(txnRows).toHaveLength(1);
    expect(txnRows[0].accountId).toBe(accountId);
  });

  it("still routes an ambiguous partial fragment (many same-bank matches) to review", async () => {
    const { db } = createTestDb();
    await seedCategories(db);
    await createAccount(db, {
      bankName: "Indian Overseas Bank",
      accountLast4: "8842",
      canonicalBank: "in.iob.bank",
      currency: "INR",
      kind: "bank",
    });
    await createAccount(db, {
      bankName: "Indian Overseas Bank",
      accountLast4: "9942",
      canonicalBank: "in.iob.bank",
      currency: "INR",
      kind: "bank",
    });

    const outcome = await processSms(db, bundledParserManifests, IOB_PARTIAL_42);

    expect(outcome.kind).toBe("review");
    if (outcome.kind === "review") {
      expect(outcome.status).toBe("ACCOUNT_RESOLUTION_REQUIRED");
    }
    // No third account was invented and nothing was saved.
    expect(await db.select().from(accounts)).toHaveLength(2);
    expect(await db.select().from(transactions)).toHaveLength(0);
    const reviewRows = await db.select().from(unrecognizedSms);
    expect(reviewRows).toHaveLength(1);
    expect(reviewRows[0].status).toBe("ACCOUNT_RESOLUTION_REQUIRED");
  });

  it("resolves a prior review row when a rescan of the same message now saves", async () => {
    const { db } = createTestDb();
    await seedCategories(db);
    // A stale row from before the auto-create flip (same sender+body).
    await db.insert(unrecognizedSms).values({
      sender: IOB_CREDIT_2345.sender,
      smsBody: IOB_CREDIT_2345.body,
      receivedAt: RECEIVED_AT,
      createdAt: RECEIVED_AT,
      status: "ACCOUNT_RESOLUTION_REQUIRED",
      reviewReason: "UNKNOWN_ACCOUNT_LAST4",
    });

    const outcome = await processSms(db, bundledParserManifests, IOB_CREDIT_2345);

    expect(outcome.kind).toBe("saved");
    const reviewRows = await db.select().from(unrecognizedSms);
    expect(reviewRows).toHaveLength(1);
    expect(reviewRows[0].resolvedAt).not.toBeNull();

    // A second rescan dedups on the transaction hash and keeps everything stable.
    const rescan = await processSms(db, bundledParserManifests, IOB_CREDIT_2345);
    expect(rescan.kind).toBe("saved");
    expect(await db.select().from(transactions)).toHaveLength(1);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });
});

describe("pruneReviewRows", () => {
  it("soft-deletes gate-failing UNRECOGNIZED/REJECTED rows, keeps parsed and passing rows", async () => {
    const { db } = createTestDb();
    await db.insert(unrecognizedSms).values([
      // Fails the gate (promo sender) — pruned.
      {
        sender: "VM-HDFCBN-P",
        smsBody: "Last chance! Personal loan offer for you.",
        receivedAt: RECEIVED_AT,
        createdAt: RECEIVED_AT,
        status: "UNRECOGNIZED",
        reviewReason: "NO_PARSER",
      },
      // Fails the gate (promo body from matched sender) — pruned.
      {
        sender: "AD-HDFCBK-S",
        smsBody: "Earn cashback offer on every UPI transaction.",
        receivedAt: RECEIVED_AT,
        createdAt: RECEIVED_AT,
        status: "REJECTED",
        reviewReason: "FILTER_REJECTED",
      },
      // Passes the gate — kept.
      {
        sender: "VM-IOBCHN-S",
        smsBody: TXN_BODY,
        receivedAt: RECEIVED_AT,
        createdAt: RECEIVED_AT,
        status: "UNRECOGNIZED",
        reviewReason: "NO_PARSER",
      },
      // Parsed-but-unresolved is real work — never pruned, even from a
      // sender that fails the gate today.
      {
        sender: "VM-HDFCBK",
        smsBody: TXN_BODY,
        receivedAt: RECEIVED_AT,
        createdAt: RECEIVED_AT,
        status: "ACCOUNT_RESOLUTION_REQUIRED",
        reviewReason: "UNKNOWN_ACCOUNT_LAST4",
      },
    ]);

    const pruned = await pruneReviewRows(db);

    expect(pruned).toBe(2);
    const remaining = await db.select().from(unrecognizedSms);
    const open = remaining.filter((row) => !row.isDeleted);
    expect(open.map((row) => row.sender).sort()).toEqual(["VM-HDFCBK", "VM-IOBCHN-S"]);
    // Pruned rows are soft-deleted, not destroyed (provenance kept).
    expect(remaining).toHaveLength(4);
  });

  it("is a no-op on an already-clean queue", async () => {
    const { db } = createTestDb();
    expect(await pruneReviewRows(db)).toBe(0);
  });
});
