import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { transactionRules, unrecognizedSms } from "@/db/schema";
import { dismissUnrecognized, resolveWithSenderRule } from "@/db/services/sms-review";
import { listActiveRules } from "@/db/services/rule-ops";
import { createTestDb } from "@/db/test-support/harness";

async function seedUnrecognized(db: ReturnType<typeof createTestDb>["db"]): Promise<number> {
  const [row] = await db
    .insert(unrecognizedSms)
    .values({ sender: "AD-EPFO", smsBody: "EPF credited", receivedAt: "2026-06-11T00:00:00" })
    .returning();
  return row.id;
}

describe("sms-review service", () => {
  it("dismissUnrecognized resolves the row (leaves the review queue)", async () => {
    const { db, sqlite } = createTestDb();
    const id = await seedUnrecognized(db);

    await dismissUnrecognized(db, id);

    const [row] = await db.select().from(unrecognizedSms).where(eq(unrecognizedSms.id, id));
    expect(row.resolvedAt).not.toBeNull();
    sqlite.close();
  });

  it("resolveWithSenderRule creates a sender→account rule and resolves the row", async () => {
    const { db, sqlite } = createTestDb();
    const id = await seedUnrecognized(db);

    await resolveWithSenderRule(db, { id, sender: "AD-EPFO", accountName: "EPF" });

    const rules = await listActiveRules(db);
    expect(rules).toHaveLength(1);
    expect(rules[0].conditions[0]).toMatchObject({ field: "SMS_SENDER", value: "AD-EPFO" });
    expect(rules[0].actions[0]).toMatchObject({ field: "ACCOUNT", value: "EPF" });

    const [row] = await db.select().from(unrecognizedSms).where(eq(unrecognizedSms.id, id));
    expect(row.resolvedAt).not.toBeNull();

    // sanity: the rule actually persisted
    const stored = await db.select().from(transactionRules);
    expect(stored).toHaveLength(1);
    sqlite.close();
  });
});
