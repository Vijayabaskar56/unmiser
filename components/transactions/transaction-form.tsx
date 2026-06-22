import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Field, SubmitButton, Text } from "@/components/ui";
import { budgetCategoryLimitCollection, budgetCollection } from "@/db/collections";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  subcategoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { budgetImpact } from "@/lib/budgets/pacing";
import { buildBudgetProgress } from "@/lib/budgets/progress";
import { appDb } from "@/db/app-db";
import { db } from "@/db/index";
import { PAYMENT_METHODS, type PaymentMethod } from "@/db/schema/enums";
import { getMainAccountId } from "@/db/services/app-settings";
import { saveTransactionThroughPipeline } from "@/db/services/automation-pipeline";
import { transfer } from "@/db/services/transaction-ops";
import type { TxnType } from "@/lib/balance-service";
import { nowIso } from "@/lib/dates";
import * as money from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-method";

const TXN_TYPES: TxnType[] = ["EXPENSE", "INCOME", "INVESTMENT", "CREDIT", "TRANSFER"];

interface Props {
  /** Called after a successful save so the host screen can dismiss/navigate. */
  onDone?: () => void;
}

/** A single pill in a horizontal picker row (design-system `rounded-[3px]`). */
function PickerChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? "rounded-[3px] border-[1.3px] border-foreground bg-foreground px-3 py-2"
          : "rounded-[3px] border-[1.3px] border-border px-3 py-2"
      }
    >
      <Text className={active ? "text-[12px] text-background" : "text-[12px] text-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}

function PickerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="caption" className="mb-1.5">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
        <View className="flex-row gap-2 px-1">{children}</View>
      </ScrollView>
    </View>
  );
}

/**
 * Create a transaction — the FAB / centre-"+" destination, rendered as a full
 * screen (was a bottom sheet; a screen mounts via the native navigator so the
 * large picker tree no longer blocks an open animation — see
 * `docs/plans` perf note). Writes go through the services layer
 * (`saveTransactionThroughPipeline` runs rules + dedup + the balance cascade, or
 * `transfer()` for the two-leg case), NOT the collection's optimistic path, so
 * balance math stays single-sourced. After a successful save the transactions +
 * account-balances collections are refetched and `onDone` fires.
 */
export function TransactionForm({ onDone }: Props) {
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }), []);
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }), []);
  const { data: subcategories } = useLiveQuery(
    (q) => q.from({ subcategory: subcategoryCollection }),
    [],
  );
  const { data: budgets } = useLiveQuery((q) => q.from({ budget: budgetCollection }), []);
  const { data: budgetLimits } = useLiveQuery(
    (q) => q.from({ limit: budgetCategoryLimitCollection }),
    [],
  );
  const { data: allTransactions } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [type, setType] = useState<TxnType>("EXPENSE");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountList = useMemo(
    () => [...(accounts ?? [])].sort((a, b) => a.bankName.localeCompare(b.bankName)),
    [accounts],
  );
  const categoryList = useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [categories],
  );
  const subcategoryList = useMemo(
    () =>
      categoryId === null
        ? []
        : [...(subcategories ?? [])]
            .filter((s) => s.categoryId === categoryId)
            .sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories, categoryId],
  );

  // Default the account picker to the main account (ADR-0005) once accounts load.
  useEffect(() => {
    if (accountId !== null || accountList.length === 0) return;
    void (async () => {
      const mainId = await getMainAccountId(appDb);
      const exists = mainId !== null && accountList.some((a) => a.id === mainId);
      setAccountId(exists ? mainId : accountList[0].id);
    })();
  }, [accountId, accountList]);

  const selectedAccount = accountList.find((a) => a.id === accountId) ?? null;
  const selectedToAccount = accountList.find((a) => a.id === toAccountId) ?? null;
  const isTransfer = type === "TRANSFER";

  const amountValid = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return false;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
    return money.compare(trimmed, "0") > 0;
  })();

  const transferSameAccount =
    isTransfer &&
    selectedAccount !== null &&
    selectedToAccount !== null &&
    accountId === toAccountId;
  const transferCrossCurrency =
    isTransfer &&
    selectedAccount !== null &&
    selectedToAccount !== null &&
    selectedAccount.currency !== selectedToAccount.currency;
  const transferValid =
    !isTransfer || (selectedToAccount !== null && !transferSameAccount && !transferCrossCurrency);

  const canSubmit =
    amountValid && accountId !== null && categoryId !== null && transferValid && !submitting;

  // Pre-Spend Nudge (choice architecture): if the chosen expense category has a
  // budget, show what this amount would do to it before the user commits.
  const budgetNudge = useMemo(() => {
    if (categoryId === null || !amountValid || type !== "EXPENSE") return null;
    const progresses = buildBudgetProgress({
      budgets: budgets ?? [],
      limits: budgetLimits ?? [],
      categories: categories ?? [],
      transactions: allTransactions ?? [],
    });
    const match = progresses.find((p) => p.limits.some((l) => l.categoryId === categoryId));
    if (!match) return null;
    const impact = budgetImpact({
      currentSpent: match.spent,
      newAmount: money.normalize2dp(amount.trim()),
      limit: match.limit,
    });
    return { name: match.budget.name, currency: match.budget.currency, impact };
  }, [categoryId, amountValid, amount, type, budgets, budgetLimits, categories, allTransactions]);

  const onSelectCategory = (id: number) => {
    setCategoryId((prev) => {
      if (prev !== id) setSubcategoryId(null);
      return id;
    });
  };

  const onSubmit = async () => {
    if (!selectedAccount || categoryId === null || !amountValid) return;
    setSubmitting(true);
    setError(null);
    try {
      if (type === "TRANSFER") {
        if (!selectedToAccount || accountId === toAccountId) return;
        await transfer(db, {
          fromAccount: {
            id: selectedAccount.id,
            currency: selectedAccount.currency,
            isCreditCard: selectedAccount.isCreditCard,
          },
          toAccount: {
            id: selectedToAccount.id,
            currency: selectedToAccount.currency,
            isCreditCard: selectedToAccount.isCreditCard,
          },
          amount: money.normalize2dp(amount.trim()),
          categoryId,
          dateTime: nowIso(),
          merchantName: merchant.trim(),
        });
      } else {
        const outcome = await saveTransactionThroughPipeline(
          db,
          {
            accountId: selectedAccount.id,
            amount: money.normalize2dp(amount.trim()),
            merchantName: merchant.trim(),
            categoryId,
            subcategoryId,
            transactionType: type,
            paymentMethod: method,
            dateTime: nowIso(),
            isCreditCard: selectedAccount.isCreditCard,
            currency: selectedAccount.currency,
          },
          { explicitUserFields: ["merchantName", "categoryId"] },
        );
        if (outcome.kind === "blocked") {
          setError(`Blocked by rule: ${outcome.ruleName}`);
          return;
        }
      }
      await Promise.all([
        transactionCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
      ]);
      // The `add` tab screen stays mounted after navigating away, so clear the
      // entry-specific fields here — otherwise re-opening "+" shows the just-saved
      // values and invites an accidental duplicate (the old sheet reset on close).
      setAmount("");
      setMerchant("");
      setCategoryId(null);
      setSubcategoryId(null);
      setToAccountId(null);
      setType("EXPENSE");
      setMethod(null);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="gap-3 px-5 pt-3">
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <Field
          label="Merchant"
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Optional"
        />

        <PickerRow label="Account">
          {accountList.map((a) => (
            <PickerChip
              key={a.id}
              label={a.bankName}
              active={a.id === accountId}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </PickerRow>

        {isTransfer && (
          <PickerRow label="To account">
            {accountList
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <PickerChip
                  key={a.id}
                  label={a.bankName}
                  active={a.id === toAccountId}
                  onPress={() => {
                    setToAccountId(a.id);
                    setError(null);
                  }}
                />
              ))}
          </PickerRow>
        )}

        {transferCrossCurrency && (
          <Text className="text-[12px] text-danger">
            Cross-currency transfers aren’t supported yet ({selectedAccount?.currency} →{" "}
            {selectedToAccount?.currency}).
          </Text>
        )}

        <PickerRow label="Category">
          {categoryList.map((c) => (
            <PickerChip
              key={c.id}
              label={c.name}
              active={c.id === categoryId}
              onPress={() => onSelectCategory(c.id)}
            />
          ))}
        </PickerRow>

        {categoryId !== null && subcategoryList.length > 0 && (
          <PickerRow label="Subcategory">
            {subcategoryList.map((s) => (
              <PickerChip
                key={s.id}
                label={s.name}
                active={s.id === subcategoryId}
                onPress={() => setSubcategoryId(s.id === subcategoryId ? null : s.id)}
              />
            ))}
          </PickerRow>
        )}

        <PickerRow label="Type">
          {TXN_TYPES.map((t) => (
            <PickerChip
              key={t}
              label={t}
              active={t === type}
              onPress={() => {
                setType(t);
                setError(null);
                if (t !== "TRANSFER") setToAccountId(null);
              }}
            />
          ))}
        </PickerRow>

        {!isTransfer && (
          <PickerRow label="Method (optional)">
            {PAYMENT_METHODS.map((m) => (
              <PickerChip
                key={m}
                label={paymentMethodLabel(m) ?? m}
                active={m === method}
                onPress={() => setMethod(m === method ? null : m)}
              />
            ))}
          </PickerRow>
        )}

        {budgetNudge ? (
          <View
            className={
              budgetNudge.impact.willExceed
                ? "flex-row items-center gap-2 rounded-[3px] border-[1.5px] border-foreground bg-accent px-3 py-2.5"
                : "flex-row items-center gap-2 rounded-[3px] border border-border bg-surface px-3 py-2.5"
            }
          >
            <Text
              className={
                budgetNudge.impact.willExceed
                  ? "flex-1 text-[12px] font-bold text-accent-foreground"
                  : "flex-1 text-[12px] text-foreground"
              }
            >
              {budgetNudge.impact.willExceed
                ? `Puts ${budgetNudge.name} over budget — ${budgetNudge.impact.percentAfter}% of ${money.formatCompact(
                    budgetNudge.impact.spentAfter,
                    budgetNudge.currency,
                  )}`
                : `${budgetNudge.name}: ${budgetNudge.impact.percentAfter}% used after this · ${money.formatCompact(
                    budgetNudge.impact.remainingAfter,
                    budgetNudge.currency,
                  )} left`}
            </Text>
          </View>
        ) : null}

        {error && <Text className="text-[12px] text-danger">{error}</Text>}

        <SubmitButton
          label="Save transaction"
          submitting={submitting}
          canSubmit={canSubmit}
          onPress={() => void onSubmit()}
        />
      </View>
    </ScrollView>
  );
}
