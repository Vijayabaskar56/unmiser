import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "drizzle-orm";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { subscriptionCollection, transactionCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import { subscriptions, transactions } from "@/db/schema";
import { hideSubscription, upsertFromMandate } from "@/db/services/subscription-ops";
import {
  amountWithinTolerance,
  merchantLooksRelated,
  monthlyEquivalent,
} from "@/lib/subscriptions/matching";

export default function SubscriptionsScreen() {
  const { data } = useLiveQuery((q) =>
    q
      .from({ subscription: subscriptionCollection })
      .orderBy(({ subscription }) => subscription.nextPaymentDate, "asc"),
  );
  const { data: transactionRows } = useLiveQuery((q) =>
    q
      .from({ transaction: transactionCollection })
      .orderBy(({ transaction }) => transaction.dateTime, "desc"),
  );
  const [merchant, setMerchant] = useState("Netflix");
  const [amount, setAmount] = useState("1499");
  const [nextDate, setNextDate] = useState("2026-07-15");
  const [message, setMessage] = useState("");
  const [dismissedReviews, setDismissedReviews] = useState<Set<number>>(() => new Set());

  const rows = data ?? [];
  const upcoming = useMemo(() => {
    const today = new Date();
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
  const reviewItems = useMemo(() => {
    return (transactionRows ?? [])
      .filter(
        (transaction) =>
          !transaction.isDeleted &&
          transaction.subscriptionId == null &&
          !dismissedReviews.has(transaction.id),
      )
      .map((transaction) => {
        const candidates = active.filter(
          (subscription) =>
            amountWithinTolerance(transaction.amount, subscription.amount) &&
            merchantLooksRelated(transaction.merchantName, subscription.merchantName),
        );
        return { transaction, candidates };
      })
      .filter((item) => item.candidates.length > 1)
      .slice(0, 10);
  }, [active, dismissedReviews, transactionRows]);

  const refresh = async () => {
    await Promise.all([
      subscriptionCollection.utils.refetch(),
      transactionCollection.utils.refetch(),
    ]);
  };

  const createManual = async () => {
    const id = await upsertFromMandate(appDb, {
      amount,
      nextDeductionDate: nextDate,
      merchant,
      currency: "INR",
      pluginId: "manual",
      provider: "Manual",
    });
    await refresh();
    setMessage(`Saved subscription ${id}`);
  };

  const reactivate = async (id: number) => {
    await appDb.update(subscriptions).set({ state: "ACTIVE" }).where(eq(subscriptions.id, id));
    await refresh();
  };

  const linkAmbiguous = async (
    transaction: typeof transactions.$inferSelect,
    subscription: typeof subscriptions.$inferSelect,
  ) => {
    const paidDate = transaction.dateTime.slice(0, 10);
    await appDb
      .update(transactions)
      .set({ subscriptionId: subscription.id, isRecurring: true })
      .where(eq(transactions.id, transaction.id));
    await appDb
      .update(subscriptions)
      .set({ lastPaidDate: paidDate })
      .where(eq(subscriptions.id, subscription.id));
    await refresh();
    setMessage(`Linked ${transaction.merchantName} to ${subscription.merchantName}`);
  };

  return (
    <Container>
      <View className="gap-4 p-4">
        <View>
          <Text className="text-foreground text-2xl font-semibold">Subscriptions</Text>
          <Text className="text-muted mt-1">
            Upcoming payments and mandate-sourced subscriptions
          </Text>
        </View>

        <View className="gap-3 rounded-lg border border-border bg-content1 p-3">
          <Text className="text-foreground font-semibold">Manual Create</Text>
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant"
            placeholderTextColor="#888"
          />
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="Amount"
            placeholderTextColor="#888"
          />
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={nextDate}
            onChangeText={setNextDate}
            placeholder="Next date"
            placeholderTextColor="#888"
          />
          <Pressable className="self-start rounded-md bg-primary px-3 py-2" onPress={createManual}>
            <Text className="text-primary-foreground font-semibold">Save</Text>
          </Pressable>
          {message ? <Text className="text-muted">{message}</Text> : null}
        </View>

        <Section title="Upcoming 30 Days" rows={upcoming} onHide={hideSubscriptionAndRefresh} />
        <Section title="Active" rows={active} onHide={hideSubscriptionAndRefresh} />

        <View className="gap-2">
          <Text className="text-foreground text-lg font-semibold">Subscription Review</Text>
          {reviewItems.length === 0 ? (
            <Text className="text-muted">No ambiguous matches.</Text>
          ) : (
            reviewItems.map((item) => (
              <View
                key={item.transaction.id}
                className="rounded-lg border border-border bg-content1 p-3 gap-2"
              >
                <Text className="text-foreground font-semibold">
                  {item.transaction.merchantName} · {item.transaction.amount}{" "}
                  {item.transaction.currency}
                </Text>
                <Text className="text-muted">
                  Matches {item.candidates.map((candidate) => candidate.merchantName).join(", ")}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {item.candidates.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      className="rounded-md border border-border px-3 py-2"
                      onPress={() => linkAmbiguous(item.transaction, candidate)}
                    >
                      <Text className="text-foreground font-semibold">
                        {candidate.merchantName}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    className="rounded-md border border-border px-3 py-2"
                    onPress={() =>
                      setDismissedReviews((prev) => new Set([...prev, item.transaction.id]))
                    }
                  >
                    <Text className="text-foreground font-semibold">Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="text-foreground text-lg font-semibold">Hidden</Text>
          {hidden.length === 0 ? (
            <Text className="text-muted">No hidden subscriptions.</Text>
          ) : null}
          {hidden.map((row) => (
            <View key={row.id} className="rounded-lg border border-border bg-content1 p-3">
              <Text className="text-foreground font-semibold">{row.merchantName}</Text>
              <Text className="text-muted">
                {row.amount} {row.currency} · monthly{" "}
                {monthlyEquivalent(row.amount, row.billingCycle)}
              </Text>
              <Pressable
                className="mt-2 self-start rounded-md border border-border px-3 py-2"
                onPress={() => reactivate(row.id)}
              >
                <Text className="text-foreground font-semibold">Reactivate</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </Container>
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
}: {
  title: string;
  rows: Array<typeof subscriptions.$inferSelect>;
  onHide: (id: number) => void | Promise<void>;
}) {
  return (
    <View className="gap-2">
      <Text className="text-foreground text-lg font-semibold">{title}</Text>
      {rows.length === 0 ? <Text className="text-muted">Nothing here.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} className="rounded-lg border border-border bg-content1 p-3">
          <Text className="text-foreground font-semibold">{row.merchantName}</Text>
          <Text className="text-muted">
            {row.nextPaymentDate ?? "No date"} · {row.amount} {row.currency}
          </Text>
          <Text className="text-muted">
            Monthly equivalent {monthlyEquivalent(row.amount, row.billingCycle)}
          </Text>
          <Pressable
            className="mt-2 self-start rounded-md border border-border px-3 py-2"
            onPress={() => onHide(row.id)}
          >
            <Text className="text-foreground font-semibold">Hide</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
