import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import Decimal from "decimal.js";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { BudgetFormSheet } from "@/components/budgets/budget-form-sheet";
import { AppBar, Badge, Card, ProgressBar, SpriteIcon, Text } from "@/components/ui";
import {
  budgetCategoryLimitCollection,
  budgetCollection,
  categoryCollection,
  transactionCollection,
} from "@/db/collections";
import { categoryIconId } from "@/lib/categories/icons";
import { buildBudgetProgress, type BudgetProgress } from "@/lib/budgets/progress";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export default function BudgetsScreen() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const { data: budgets } = useLiveQuery((q) => q.from({ budget: budgetCollection }), []);
  const { data: limits } = useLiveQuery(
    (q) => q.from({ limit: budgetCategoryLimitCollection }),
    [],
  );
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }), []);
  const { data: transactions } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  const refetch = useCallback(() => budgetCollection.utils.refetch(), []);
  useFocusEffect(
    useCallback(() => {
      void budgetCollection.utils.refetch();
      void budgetCategoryLimitCollection.utils.refetch();
    }, []),
  );

  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.isIncome),
    [categories],
  );
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const progress = useMemo(
    () =>
      buildBudgetProgress({
        budgets: budgets ?? [],
        limits: limits ?? [],
        categories: categories ?? [],
        transactions: transactions ?? [],
      }),
    [budgets, limits, categories, transactions],
  );

  const plan = useMemo(() => aggregatePlan(progress), [progress]);
  const monthLabel = MONTHS[new Date().getMonth()];

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Budgets"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => setShowForm(true)}
            accessibilityLabel="New budget"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </Pressable>
        }
      />

      <Container className="px-4">
        {/* Plan hero */}
        <Card variant="ink" className="mt-1 gap-3 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text variant="caption" className="tracking-[2px]">
                {monthLabel} PLAN
              </Text>
              <Text variant="balance" className="mt-1 text-[34px]">
                {money.format(plan.limit, "INR")}
              </Text>
              <View className="mt-2 self-start">
                <Badge variant="accent">
                  {plan.percentUsed}% used · {money.formatCompact(plan.spent, "INR")}
                </Badge>
              </View>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-background/40">
              <StyledIonicons name="disc-outline" size={22} className="text-background" />
            </View>
          </View>
        </Card>

        <Text variant="caption" className="mb-2 ml-1 mt-5 tracking-[2px]">
          ENVELOPES
        </Text>

        {progress.length === 0 ? (
          <Card variant="soft" className="items-center gap-2 py-8">
            <Text variant="heading" className="text-[15px]">
              No envelopes yet
            </Text>
            <Text variant="body" className="text-center text-[13px]">
              Create a per-category budget to start pacing your spend.
            </Text>
          </Card>
        ) : (
          <Card variant="soft" className="gap-0 p-0">
            {progress.map((p, i) => {
              const cat = p.limits[0] ? categoryById.get(p.limits[0].categoryId) : undefined;
              const icon = cat ? categoryIconId(cat) : "tag-01";
              return (
                <EnvelopeRow
                  key={p.budget.id}
                  progress={p}
                  icon={icon}
                  first={i === 0}
                  onPress={() => router.push(`/budget/${p.budget.id}` as Href)}
                />
              );
            })}
          </Card>
        )}

        <View className="h-8" />
      </Container>

      <BudgetFormSheet
        isOpen={showForm}
        categories={expenseCategories}
        onClose={() => setShowForm(false)}
        onSaved={() => void refetch()}
      />
    </View>
  );
}

function EnvelopeRow({
  progress,
  icon,
  first,
  onPress,
}: {
  progress: BudgetProgress;
  icon: string;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="gap-2 px-3.5 py-3.5">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full border border-foreground">
            <SpriteIcon name={icon} size={17} />
          </View>
          <Text variant="heading" numberOfLines={1} className="flex-1 text-[16px]">
            {progress.budget.name}
          </Text>
          <Text variant="body" className="text-[13px] text-muted">
            {money.formatCompact(progress.spent, "INR")} /{" "}
            {money.formatCompact(progress.limit, "INR")}
          </Text>
        </View>
        <ProgressBar percent={progress.percentUsed} status={progress.status} />
      </View>
    </Pressable>
  );
}

function aggregatePlan(progress: BudgetProgress[]): {
  limit: string;
  spent: string;
  percentUsed: number;
} {
  const limit = progress.reduce((sum, p) => money.add(sum, p.limit), "0");
  const spent = progress.reduce((sum, p) => money.add(sum, p.spent), "0");
  const percentUsed = money.isZero(limit)
    ? 0
    : Math.round(new Decimal(spent).dividedBy(limit).times(100).toNumber());
  return { limit, spent, percentUsed };
}
