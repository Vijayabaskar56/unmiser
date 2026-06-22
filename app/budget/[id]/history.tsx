import { useLiveQuery } from "@tanstack/react-db";
import Decimal from "decimal.js";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";

import { Container } from "@/components/container";
import { HistoryBars } from "@/components/budgets/budget-charts";
import { AppBar, Badge, Card, ProgressBar, Text } from "@/components/ui";
import {
  budgetCategoryLimitCollection,
  budgetCollection,
  transactionCollection,
} from "@/db/collections";
import { monthlyHistory, type HistoryMonth } from "@/lib/budgets/detail";
import * as money from "@/lib/money";

export default function BudgetHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const budgetId = Number(params.id);
  const { width } = useWindowDimensions();

  const { data: budgets } = useLiveQuery((q) => q.from({ budget: budgetCollection }), []);
  const { data: allLimits } = useLiveQuery(
    (q) => q.from({ limit: budgetCategoryLimitCollection }),
    [],
  );
  const { data: transactions } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  const budget = useMemo(() => (budgets ?? []).find((b) => b.id === budgetId), [budgets, budgetId]);
  const limits = useMemo(
    () => (allLimits ?? []).filter((l) => l.budgetId === budgetId),
    [allLimits, budgetId],
  );

  const history = useMemo(() => {
    if (!budget) return [];
    return monthlyHistory({ budget, limits, transactions: transactions ?? [], months: 6 });
  }, [budget, limits, transactions]);

  const monthList = useMemo(() => [...history].reverse(), [history]);
  const avg = useMemo(() => {
    if (history.length === 0) return "0";
    const total = history.reduce((sum, m) => money.add(sum, m.spent), "0");
    return money.normalize2dp(new Decimal(total).dividedBy(history.length).toString());
  }, [history]);
  const overCount = history.filter((m) => m.over).length;
  const limit = limits.reduce((sum, l) => money.add(sum, l.limitAmount || "0"), "0");

  if (!budget) {
    return (
      <View className="flex-1 bg-background">
        <AppBar
          title="Budget history"
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
        title="Budget history"
        sm
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace(`/budget/${budgetId}` as Href)
        }
      />

      <Container className="px-4">
        <Text variant="caption" className="ml-1 tracking-[1px]">
          {budget.name.toUpperCase()} · {money.formatCompact(limit, budget.currency)}/MO
        </Text>

        {/* Average + chart */}
        <Card variant="ink" className="mt-2 gap-3 p-4">
          <View className="flex-row items-start justify-between">
            <View>
              <Text variant="caption" className="tracking-[1px]">
                AVG · LAST {history.length} MONTHS
              </Text>
              <Text variant="balance" className="mt-1 text-[30px]">
                {money.format(avg, budget.currency)}
              </Text>
            </View>
            {overCount > 0 ? <Badge variant="accent">{overCount} over</Badge> : null}
          </View>
          <HistoryBars months={history} width={width - 32 - 28} />
        </Card>

        <Text variant="caption" className="mb-2 ml-1 mt-5 tracking-[2px]">
          MONTH BY MONTH
        </Text>

        <Card variant="soft" className="gap-0 p-0">
          {monthList.map((m, i) => (
            <MonthRow key={m.monthIso} month={m} currency={budget.currency} first={i === 0} />
          ))}
        </Card>

        <View className="h-8" />
      </Container>
    </View>
  );
}

function MonthRow({
  month,
  currency,
  first,
}: {
  month: HistoryMonth;
  currency: string;
  first: boolean;
}) {
  const longLabel = new Date(month.monthIso).toLocaleDateString("en-US", { month: "long" });
  const sub = month.isCurrent
    ? `${month.percent}% · in progress`
    : month.over
      ? `${month.percent}% · over by ${money.formatCompact(
          money.subtract(month.spent, month.limit),
          currency,
        )}`
      : `${month.percent}% · under`;

  return (
    <View>
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <View className="w-[88px]">
          <Text variant="heading" className="text-[16px]">
            {longLabel}
          </Text>
          <Text variant="body" numberOfLines={1} className="text-[11px] text-muted">
            {sub}
          </Text>
        </View>
        <View className="flex-1">
          <ProgressBar
            percent={month.percent}
            status={month.over ? "over" : "calm"}
            highlight={month.isCurrent}
            height={10}
          />
        </View>
        <Text variant="balance" className="text-[15px]">
          {money.formatCompact(month.spent, currency)}
        </Text>
      </View>
    </View>
  );
}
