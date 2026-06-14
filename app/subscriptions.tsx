import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { AppBar } from "@/components/ui";
import { subscriptionCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import { subscriptions } from "@/db/schema";
import { hideSubscription } from "@/db/services/subscription-ops";
import { monthlyEquivalent } from "@/lib/subscriptions/matching";

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { data } = useLiveQuery((q) =>
    q
      .from({ subscription: subscriptionCollection })
      .orderBy(({ subscription }) => subscription.nextPaymentDate, "asc"),
  );

  const rows = data ?? [];
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);
    return rows.filter((row) => {
      if (row.state !== "ACTIVE" || !row.nextPaymentDate) return false;
      const date = new Date(`${row.nextPaymentDate}T00:00:00`);
      return date >= today && date <= limit;
    });
  }, [rows]);
  const active = rows.filter((row) => row.state === "ACTIVE");
  const hidden = rows.filter((row) => row.state === "HIDDEN");

  const refresh = async () => {
    await subscriptionCollection.utils.refetch();
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, []),
  );

  const reactivate = async (id: number) => {
    await appDb.update(subscriptions).set({ state: "ACTIVE" }).where(eq(subscriptions.id, id));
    await refresh();
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Subscriptions"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container>
        <View className="gap-4 p-4">
          <Text className="text-muted">{active.length} active</Text>

          <Section title="Upcoming 30 Days" rows={upcoming} onHide={hideSubscriptionAndRefresh} />
          <Section title="Active" rows={active} onHide={hideSubscriptionAndRefresh} />
          <Section title="Hidden" rows={hidden} actionLabel="Reactivate" onHide={reactivate} />
        </View>
      </Container>
    </View>
  );

  async function hideSubscriptionAndRefresh(id: number) {
    await hideSubscription(appDb, id);
    await refresh();
  }
}

function Section({
  title,
  rows,
  onHide,
  actionLabel = "Hide",
}: {
  title: string;
  rows: Array<typeof subscriptions.$inferSelect>;
  onHide: (id: number) => void | Promise<void>;
  actionLabel?: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-foreground text-lg font-semibold">{title}</Text>
      {rows.length === 0 ? <Text className="text-muted">Nothing here.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} className="rounded-lg border border-border bg-content1 p-3 gap-2">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-foreground font-semibold">{row.merchantName}</Text>
              <Text className="text-muted text-sm">{row.nextPaymentDate ?? "No date"}</Text>
            </View>
            <Text className="text-foreground font-semibold">
              {row.currency} {row.amount}
            </Text>
          </View>
          <Text className="text-muted text-sm">
            {row.billingCycle ?? "monthly"} · {monthlyEquivalent(row.amount, row.billingCycle)}
            /mo
          </Text>
          <Pressable
            className="mt-2 self-start rounded-md border border-border px-3 py-2"
            onPress={() => onHide(row.id)}
          >
            <Text className="text-foreground font-semibold">{actionLabel}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
