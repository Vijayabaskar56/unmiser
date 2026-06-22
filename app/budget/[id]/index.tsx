import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Container } from "@/components/container";
import { BudgetFormSheet } from "@/components/budgets/budget-form-sheet";
import { SpendPie } from "@/components/budgets/budget-charts";
import { AppBar, Badge, Card, SpriteIcon, Text } from "@/components/ui";
import {
  budgetCategoryLimitCollection,
  budgetCollection,
  categoryCollection,
  transactionCollection,
} from "@/db/collections";
import type { Transaction } from "@/db/schema";
import { spendComposition } from "@/lib/budgets/detail";
import { pacingProjection } from "@/lib/budgets/pacing";
import { buildBudgetProgress, currentBudgetWindow } from "@/lib/budgets/progress";
import { categoryIconId } from "@/lib/categories/icons";
import { formatDisplay, isWithin } from "@/lib/dates";
import * as money from "@/lib/money";

export default function BudgetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const budgetId = Number(params.id);
  const [showEdit, setShowEdit] = useState(false);

  const { data: budgets } = useLiveQuery((q) => q.from({ budget: budgetCollection }), []);
  const { data: allLimits } = useLiveQuery(
    (q) => q.from({ limit: budgetCategoryLimitCollection }),
    [],
  );
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }), []);
  const { data: transactions } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  useFocusEffect(
    useCallback(() => {
      void budgetCollection.utils.refetch();
      void budgetCategoryLimitCollection.utils.refetch();
    }, []),
  );

  const budget = useMemo(() => (budgets ?? []).find((b) => b.id === budgetId), [budgets, budgetId]);
  const limits = useMemo(
    () => (allLimits ?? []).filter((l) => l.budgetId === budgetId),
    [allLimits, budgetId],
  );
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const progress = useMemo(() => {
    if (!budget) return null;
    return (
      buildBudgetProgress({
        budgets: [budget],
        limits,
        categories: categories ?? [],
        transactions: transactions ?? [],
      })[0] ?? null
    );
  }, [budget, limits, categories, transactions]);

  const slices = useMemo(
    () => (budget ? spendComposition({ budget, limits, transactions: transactions ?? [] }) : []),
    [budget, limits, transactions],
  );

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.isIncome),
    [categories],
  );

  // Pillar-2 Budget Pacing Alert: extrapolate the current burn rate to period end.
  const pacing = useMemo(() => {
    if (!budget || !progress) return null;
    const window = currentBudgetWindow(budget);
    return pacingProjection({
      spent: progress.spent,
      limit: progress.limit,
      windowStart: window.start,
      windowEnd: window.end,
    });
  }, [budget, progress]);

  const windowTxns = useMemo(() => {
    if (!budget) return [];
    const window = currentBudgetWindow(budget);
    const categoryIds = new Set(limits.map((l) => l.categoryId));
    return (transactions ?? [])
      .filter((txn) => {
        if (txn.isDeleted || txn.transactionType !== "EXPENSE") return false;
        if (txn.currency !== budget.currency) return false;
        if (!isWithin(txn.dateTime, window.start, window.end)) return false;
        return categoryIds.size === 0 || categoryIds.has(txn.categoryId);
      })
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }, [budget, limits, transactions]);

  if (!budget || !progress) {
    return (
      <View className="flex-1 bg-background">
        <AppBar
          title="Budget"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/budgets"))}
        />
        <Container className="px-4">
          <Text variant="body" className="mt-6">
            Budget not found.
          </Text>
        </Container>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title={budget.name}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/budgets"))}
        right={
          <>
            <Pressable
              onPress={() => setShowEdit(true)}
              accessibilityLabel="Edit budget"
              className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
            >
              <SpriteIcon name="edit-02" size={18} />
            </Pressable>
            <Pressable
              onPress={() => router.push(`/budget/${budget.id}/history` as Href)}
              accessibilityLabel="Budget history"
              className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
            >
              <SpriteIcon name="calendar-date" size={18} />
            </Pressable>
          </>
        }
      />

      <Container className="px-4">
        {/* Hero: pie + numbers */}
        <Card variant="ink" className="mt-1 flex-row items-center gap-3 p-4">
          <SpendPie slices={slices} currency={budget.currency} size={124} />
          <View className="flex-1 items-end gap-1">
            <Text variant="caption" className="tracking-[1px]">
              SPENT OF {money.format(progress.limit, budget.currency)}
            </Text>
            <Text variant="balance" className="text-[30px]">
              {money.format(progress.spent, budget.currency)}
            </Text>
            <Text variant="body" className="text-[13px] text-muted">
              {money.formatCompact(progress.remaining, budget.currency)} left ·{" "}
              {progress.daysRemaining} days
            </Text>
            <View className="mt-1">
              <Badge variant={progress.status === "over" ? "default" : "accent"}>
                {progress.percentUsed}% used
              </Badge>
            </View>
          </View>
        </Card>

        {/* Pillar-2 pacing alert (loss aversion): under now, but on pace to overspend. */}
        {pacing?.projectedOver ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-[3px] border-[1.5px] border-foreground bg-accent px-3 py-2.5">
            <SpriteIcon name="alert-triangle" size={16} />
            <Text className="flex-1 text-[12px] font-bold text-accent-foreground">
              On pace to overspend by {money.formatCompact(pacing.projectedOverBy, budget.currency)}{" "}
              · {progress.daysRemaining} days left
            </Text>
          </View>
        ) : null}

        {/* Transactions */}
        <View className="mb-2 mt-5 flex-row items-center justify-between">
          <Text variant="heading" className="text-[16px]">
            In this budget
          </Text>
          <Text variant="caption">{windowTxns.length} txns</Text>
        </View>

        {windowTxns.length === 0 ? (
          <Card variant="soft" className="items-center py-8">
            <Text variant="body" className="text-[13px]">
              No spend in this period yet.
            </Text>
          </Card>
        ) : (
          <Card variant="soft" className="gap-0 p-0">
            {windowTxns.map((txn, i) => {
              const cat = categoryById.get(txn.categoryId);
              return (
                <TxnLine
                  key={txn.id}
                  txn={txn}
                  icon={cat ? categoryIconId(cat) : "tag-01"}
                  categoryName={cat?.name ?? txn.categoryName ?? ""}
                  first={i === 0}
                  onPress={() => router.push(`/transaction/${txn.id}`)}
                />
              );
            })}
          </Card>
        )}

        <View className="h-8" />
      </Container>

      <BudgetFormSheet
        isOpen={showEdit}
        budget={budget}
        limits={limits}
        categories={expenseCategories}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          void budgetCollection.utils.refetch();
          void budgetCategoryLimitCollection.utils.refetch();
        }}
        onDeleted={() => (router.canGoBack() ? router.back() : router.replace("/budgets"))}
      />
    </View>
  );
}

function TxnLine({
  txn,
  icon,
  categoryName,
  first,
  onPress,
}: {
  txn: Transaction;
  icon: string;
  categoryName: string;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-full border border-foreground">
          <SpriteIcon name={icon} size={18} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="heading" numberOfLines={1} className="text-[16px]">
            {txn.merchantName}
          </Text>
          <Text variant="body" numberOfLines={1} className="text-[12px] text-muted">
            {formatDisplay(txn.dateTime, "dd MMM")}
            {categoryName ? ` · ${categoryName}` : ""}
          </Text>
        </View>
        <Text variant="balance" className="text-[16px]">
          −{money.format(txn.amount, txn.currency)}
        </Text>
      </View>
    </Pressable>
  );
}
