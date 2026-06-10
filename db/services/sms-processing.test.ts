import { describe, expect, it } from "vitest";

import { unrecognizedSms } from "@/db/schema";
import { processSms, pruneReviewRows } from "@/db/services/sms-processing";
import { createTestDb } from "@/db/test-support/harness";

const RECEIVED_AT = "2026-06-10T10:00:00";
const TXN_BODY = "Rs.500.00 debited from A/c XX1234. Avl Bal Rs.4500.00 Ref:REF001";

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
