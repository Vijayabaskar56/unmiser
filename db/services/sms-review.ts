import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { unrecognizedSms } from "@/db/schema";
import { nowIso } from "@/db/utils";
import { saveRule } from "@/db/services/rule-ops";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

/**
 * "Not a bank" — drop an unrecognised SMS from the review queue without acting
 * on it. Marking `resolvedAt` removes it from the queue's live query.
 */
export async function dismissUnrecognized(db: Db, id: number): Promise<void> {
  await db.update(unrecognizedSms).set({ resolvedAt: nowIso() }).where(eq(unrecognizedSms.id, id));
}

/**
 * "Add sender" — teach the app that this SMS sender belongs to an account by
 * creating a `sender contains <sender> → set account <name>` rule, then resolve
 * the row. Future SMS from that sender are filed to the account by the engine.
 */
export async function resolveWithSenderRule(
  db: Db,
  opts: { id: number; sender: string; accountName: string },
): Promise<void> {
  await saveRule(db, {
    name: `sender is ${opts.sender}`,
    priority: 100,
    isActive: true,
    conditions: [{ field: "SMS_SENDER", operator: "CONTAINS", value: opts.sender }],
    actions: [{ actionType: "SET", field: "ACCOUNT", value: opts.accountName }],
  });
  await db
    .update(unrecognizedSms)
    .set({ resolvedAt: nowIso() })
    .where(eq(unrecognizedSms.id, opts.id));
}
