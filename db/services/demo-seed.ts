import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { accounts, categories } from "@/db/schema";
import { createAccount } from "@/db/services/account-ops";
import { createSubscription } from "@/db/services/subscription-ops";
import { addTransaction } from "@/db/services/transaction-ops";

type Db = BaseSQLiteDatabase<"sync" | "async", any, any>;

// Seeded accounts carry this marker in `canonicalBank` so the seed is
// idempotent (re-running is a no-op) and could later be selectively removed.
const DEMO_MARKER = "demo-seed";

export interface DemoSeedResult {
  /** false when demo data already existed (no-op) or prerequisites were missing. */
  seeded: boolean;
  reason?: string;
  accounts: number;
  transactions: number;
}

/**
 * Insert a small set of sample accounts, transactions and a subscription for
 * manual QA (Developer options → Seed demo data). Idempotent: bails if a prior
 * demo seed is present. Requires the default categories (seeded on first launch)
 * since transactions need a category.
 */
export async function seedDemoData(db: Db): Promise<DemoSeedResult> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.canonicalBank, DEMO_MARKER));
  if (existing.length > 0) {
    return { seeded: false, reason: "Demo data already present.", accounts: 0, transactions: 0 };
  }

  const expenseCat = (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isIncome, false))
      .limit(1)
  )[0];
  const incomeCat = (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isIncome, true))
      .limit(1)
  )[0];
  if (!expenseCat || !incomeCat) {
    return { seeded: false, reason: "No categories to attach to.", accounts: 0, transactions: 0 };
  }

  const checkingId = await createAccount(db, {
    bankName: "Demo Bank",
    accountLast4: "4242",
    currency: "INR",
    kind: "bank",
    bankSubtype: "savings",
    canonicalBank: DEMO_MARKER,
    iconName: "bank",
  });
  const cardId = await createAccount(db, {
    bankName: "Demo Card",
    accountLast4: "7777",
    currency: "INR",
    kind: "credit",
    creditLimit: "100000",
    canonicalBank: DEMO_MARKER,
    iconName: "credit-card-01",
  });

  // Spread across the last few days; ISO datetimes.
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  const txns = [
    {
      accountId: checkingId,
      amount: "85000",
      merchantName: "Acme Payroll",
      categoryId: incomeCat.id,
      transactionType: "INCOME" as const,
      dateTime: daysAgo(3),
      isCreditCard: false,
    },
    {
      accountId: checkingId,
      amount: "1299",
      merchantName: "Swiggy",
      categoryId: expenseCat.id,
      transactionType: "EXPENSE" as const,
      dateTime: daysAgo(2),
      isCreditCard: false,
    },
    {
      accountId: cardId,
      amount: "7499",
      merchantName: "Amazon",
      categoryId: expenseCat.id,
      transactionType: "EXPENSE" as const,
      dateTime: daysAgo(2),
      isCreditCard: true,
    },
    {
      accountId: checkingId,
      amount: "350",
      merchantName: "Uber",
      categoryId: expenseCat.id,
      transactionType: "EXPENSE" as const,
      dateTime: daysAgo(1),
      isCreditCard: false,
    },
    {
      accountId: cardId,
      amount: "599",
      merchantName: "Netflix",
      categoryId: expenseCat.id,
      transactionType: "EXPENSE" as const,
      dateTime: daysAgo(1),
      isCreditCard: true,
    },
    {
      accountId: checkingId,
      amount: "12000",
      merchantName: "Rent",
      categoryId: expenseCat.id,
      transactionType: "EXPENSE" as const,
      dateTime: daysAgo(0),
      isCreditCard: false,
    },
  ];
  for (const t of txns) {
    await addTransaction(db, { ...t, currency: "INR" });
  }

  // A subscription due in 2 days, so the renewal reminder has something to fire.
  const due = new Date();
  due.setDate(due.getDate() + 2);
  await createSubscription(db, {
    merchantName: "Netflix",
    amount: "599",
    currency: "INR",
    billingCycle: "MONTHLY",
    nextPaymentDate: due.toISOString().slice(0, 10),
    categoryId: expenseCat.id,
  });

  return { seeded: true, accounts: 2, transactions: txns.length };
}
