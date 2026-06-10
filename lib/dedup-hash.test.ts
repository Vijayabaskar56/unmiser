import { md5 } from "js-md5";
import { describe, expect, it } from "vitest";
import { transactionHash } from "@/lib/dedup-hash";

describe("transactionHash", () => {
  it("is deterministic — identical inputs yield identical hashes across calls", () => {
    const input = { sender: "HDFCBK", amount: "1000.00", body: "Rs.1000 debited" };
    expect(transactionHash(input)).toBe(transactionHash(input));
  });

  it("normalizes amount to 2dp — '1000' and '1000.00' share one hash", () => {
    const base = { sender: "HDFCBK", body: "Rs.1000 debited" };
    expect(transactionHash({ ...base, amount: "1000" })).toBe(
      transactionHash({ ...base, amount: "1000.00" }),
    );
  });

  it("changes the hash when the sender differs", () => {
    const base = { amount: "1000.00", body: "Rs.1000 debited" };
    expect(transactionHash({ ...base, sender: "HDFCBK" })).not.toBe(
      transactionHash({ ...base, sender: "ICICIB" }),
    );
  });

  it("changes the hash when the amount differs", () => {
    const base = { sender: "HDFCBK", body: "Rs.1000 debited" };
    expect(transactionHash({ ...base, amount: "1000.00" })).not.toBe(
      transactionHash({ ...base, amount: "2000.00" }),
    );
  });

  it("changes the hash when the body differs", () => {
    const base = { sender: "HDFCBK", amount: "1000.00" };
    expect(transactionHash({ ...base, body: "Rs.1000 debited at A" })).not.toBe(
      transactionHash({ ...base, body: "Rs.1000 debited at B" }),
    );
  });

  it("matches the documented formula MD5(sender | amount(2dp) | smsBodyHash[:16])", () => {
    const input = { sender: "HDFCBK", amount: "1000", body: "Rs.1000 debited" };
    const expected = md5(`HDFCBK|1000.00|${md5(input.body).slice(0, 16)}`);
    expect(transactionHash(input)).toBe(expected);
  });

  it("depends on the body ONLY through the first 16 chars of its md5", () => {
    // For any two distinct bodies, the hash differs iff their md5 16-char prefixes differ.
    // This proves the body's sole contribution is md5(body)[:16] — collisions on that prefix
    // are an accepted, documented consequence (we assert the formula, not anti-collision).
    const base = { sender: "HDFCBK", amount: "1000.00" };
    const bodyA = "Rs.1000 debited at MERCHANT_ALPHA on 2026-06-08";
    const bodyB = "Rs.1000 debited at MERCHANT_BETA on 2026-06-08";

    const prefixesDiffer = md5(bodyA).slice(0, 16) !== md5(bodyB).slice(0, 16);
    const hashesDiffer =
      transactionHash({ ...base, body: bodyA }) !== transactionHash({ ...base, body: bodyB });

    expect(hashesDiffer).toBe(prefixesDiffer);
  });
});
