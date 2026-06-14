import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import {
  SubscriptionFormSheet,
  type SubscriptionFormMode,
} from "@/components/subscriptions/subscription-form-sheet";
import { AppBar, Badge, Card, SpriteIcon, Text } from "@/components/ui";
import { subscriptionCollection } from "@/db/collections";
import { categoryCollection } from "@/db/collections/finance";
import type { Subscription } from "@/db/schema";
import * as money from "@/lib/money";
import { subscriptionIconId } from "@/lib/subscriptions/icons";
import {
  daysUntil,
  isDueSoon,
  monthlyTotal,
  partitionSubscriptions,
} from "@/lib/subscriptions/overview";

const StyledIonicons = withUniwind(Ionicons);

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [formMode, setFormMode] = useState<SubscriptionFormMode | null>(null);

  const { data: subs, isLoading } = useLiveQuery((q) =>
    q
      .from({ subscription: subscriptionCollection })
      .orderBy(({ subscription }) => subscription.nextPaymentDate, "asc"),
  );
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));

  const refetch = useCallback(() => subscriptionCollection.utils.refetch(), []);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.isIncome),
    [categories],
  );

  const today = new Date();
  const { active, hidden, upcoming } = useMemo(
    () => partitionSubscriptions(subs ?? [], today),
    [subs],
  );
  const total = useMemo(() => monthlyTotal(active), [active]);

  const iconFor = (sub: Subscription) => subscriptionIconId(sub, categoryById);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Subscriptions"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => setFormMode({ type: "new" })}
            accessibilityLabel="New subscription"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* Status row */}
        <View className="flex-row items-center justify-between py-3">
          <Text variant="caption">
            {active.length} ACTIVE · ~{money.formatCompact(total, "INR")}/MO
          </Text>
          {upcoming.length > 0 ? <Badge variant="accent">{upcoming.length} due soon</Badge> : null}
        </View>

        {isLoading ? (
          <Text variant="body">Loading…</Text>
        ) : (
          <View className="gap-5">
            {upcoming.length > 0 ? (
              <SubSection title="Upcoming 30 Days">
                {upcoming.map((sub, i) => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    icon={iconFor(sub)}
                    today={today}
                    first={i === 0}
                    onPress={() => router.push(`/subscription/${sub.id}`)}
                  />
                ))}
              </SubSection>
            ) : null}

            <SubSection title="Active">
              {active.length === 0 ? (
                <Text variant="body" className="px-3.5 py-3.5">
                  No active subscriptions yet.
                </Text>
              ) : (
                active.map((sub, i) => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    icon={iconFor(sub)}
                    today={today}
                    first={i === 0}
                    onPress={() => router.push(`/subscription/${sub.id}`)}
                  />
                ))
              )}
            </SubSection>

            {hidden.length > 0 ? (
              <SubSection title="Hidden">
                {hidden.map((sub, i) => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    icon={iconFor(sub)}
                    today={today}
                    first={i === 0}
                    muted
                    onPress={() => router.push(`/subscription/${sub.id}`)}
                  />
                ))}
              </SubSection>
            ) : null}
          </View>
        )}

        {/* Add CTA */}
        <Pressable
          onPress={() => setFormMode({ type: "new" })}
          className="mt-5 flex-row items-center gap-3 rounded-[3px] border border-dashed border-border p-4 active:opacity-70"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground">
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </View>
          <View className="flex-1">
            <Text variant="heading" className="text-[16px]">
              Add a subscription
            </Text>
            <Text variant="body" className="text-[13px]">
              track a recurring payment manually
            </Text>
          </View>
          <StyledIonicons name="chevron-forward" size={18} className="text-muted" />
        </Pressable>
      </Container>

      <SubscriptionFormSheet
        mode={formMode}
        categories={expenseCategories}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />
    </View>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="heading" className="text-[15px]">
        {title}
      </Text>
      <Card variant="soft" className="gap-0 p-0">
        {children}
      </Card>
    </View>
  );
}

function SubRow({
  sub,
  icon,
  today,
  first,
  muted,
  onPress,
}: {
  sub: Subscription;
  icon: string;
  today: Date;
  first: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  const dueSoon = !muted && isDueSoon(sub.nextPaymentDate, today);
  const subLine = (() => {
    const cycle = sub.billingCycle ?? "monthly";
    if (!sub.nextPaymentDate) return cycle;
    if (dueSoon) {
      const days = daysUntil(sub.nextPaymentDate, today);
      return `${cycle} · ${days === 0 ? "due today" : `due in ${days}d`}`;
    }
    return `${cycle} · ${sub.nextPaymentDate}`;
  })();

  return (
    <Pressable
      onPress={onPress}
      className={muted ? "opacity-60 active:opacity-40" : "active:opacity-70"}
    >
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground">
          <SpriteIcon name={icon} size={20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="heading" numberOfLines={1} className="text-[16px]">
            {sub.merchantName}
          </Text>
          <Text
            variant="body"
            numberOfLines={1}
            className={dueSoon ? "text-[13px] text-accent-foreground" : "text-[13px]"}
          >
            {subLine}
          </Text>
        </View>
        <Text variant="balance" numberOfLines={1} className="text-[17px]">
          {money.format(sub.amount, sub.currency)}
        </Text>
        <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
      </View>
    </Pressable>
  );
}
