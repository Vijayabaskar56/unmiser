import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import {
  SubscriptionFormSheet,
  type SubscriptionFormMode,
} from "@/components/subscriptions/subscription-form-sheet";
import { AppBar, Badge, Card, ConfirmDialog, SpriteIcon, Text } from "@/components/ui";
import { subscriptionCollection } from "@/db/collections";
import { categoryCollection } from "@/db/collections/finance";
import { db } from "@/db/index";
import { deleteSubscription, setSubscriptionState } from "@/db/services/subscription-ops";
import * as money from "@/lib/money";
import { monthlyEquivalent } from "@/lib/subscriptions/matching";
import { daysUntil } from "@/lib/subscriptions/overview";
import { subscriptionIconId } from "@/lib/subscriptions/icons";

const StyledIonicons = withUniwind(Ionicons);

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscriptionId = Number(id);

  const { data: subs } = useLiveQuery((q) => q.from({ subscription: subscriptionCollection }));
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));

  const [menuOpen, setMenuOpen] = useState(false);
  const [formMode, setFormMode] = useState<SubscriptionFormMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(() => subscriptionCollection.utils.refetch(), []);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const sub = useMemo(
    () => (subs ?? []).find((s) => s.id === subscriptionId),
    [subs, subscriptionId],
  );
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.isIncome),
    [categories],
  );

  if (!sub) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Subscription" onBack={() => router.back()} />
        <Container className="px-4">
          <Text variant="body">Subscription not found.</Text>
        </Container>
      </View>
    );
  }

  const isHidden = sub.state === "HIDDEN";
  const cycle = sub.billingCycle ?? "monthly";

  const nextLabel = (() => {
    if (!sub.nextPaymentDate) return "no date";
    const days = daysUntil(sub.nextPaymentDate, new Date());
    if (days < 0) return `overdue ${-days}d`;
    if (days === 0) return "due today";
    return `in ${days}d`;
  })();

  const toggleState = async () => {
    await setSubscriptionState(db, subscriptionId, isHidden ? "ACTIVE" : "HIDDEN");
    await refetch();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteSubscription(db, subscriptionId);
      await refetch();
      setConfirmOpen(false);
      router.back();
    } catch (e) {
      setConfirmOpen(false);
      Alert.alert("Could not delete", String(e instanceof Error ? e.message : e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title={sub.merchantName}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Subscription menu"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="ellipsis-horizontal" size={18} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        <View className="flex-row items-center gap-3 pt-3">
          <View className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-foreground">
            <SpriteIcon name={subscriptionIconId(sub, categoryById)} size={26} />
          </View>
          <View className="flex-1">
            <Text variant="caption">{cycle.toUpperCase()}</Text>
            <Text variant="display" className="pt-0.5">
              {money.format(sub.amount, sub.currency)}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-2 pt-3">
          <Badge variant={isHidden ? "gray" : "accent"}>{isHidden ? "hidden" : "active"}</Badge>
          <Badge variant="gray">next {nextLabel}</Badge>
          <Badge variant="gray">
            ~{money.format(monthlyEquivalent(sub.amount, sub.billingCycle), sub.currency)}/mo
          </Badge>
        </View>

        <Card variant="soft" className="mt-5 gap-0 p-0">
          <DetailRow label="Next payment" value={sub.nextPaymentDate ?? "—"} first />
          <DetailRow label="Last paid" value={sub.lastPaidDate ?? "—"} />
          <DetailRow label="Category" value={sub.categoryName ?? "Uncategorized"} />
          <DetailRow label="Bank" value={sub.bankName ?? "—"} />
          {sub.umn ? <DetailRow label="Mandate (UMN)" value={sub.umn} /> : null}
        </Card>
      </Container>

      <BottomSheet isOpen={menuOpen} onOpenChange={(o) => !o && setMenuOpen(false)}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <BottomSheet.Title>{sub.merchantName}</BottomSheet.Title>
            <View className="gap-1 pt-2">
              <MenuRow
                icon="create-outline"
                label="Edit"
                onPress={() => {
                  setMenuOpen(false);
                  setFormMode({ type: "edit", subscription: sub });
                }}
              />
              <MenuRow
                icon={isHidden ? "eye-outline" : "eye-off-outline"}
                label={isHidden ? "Reactivate" : "Hide"}
                onPress={() => {
                  setMenuOpen(false);
                  void toggleState();
                }}
              />
              <MenuRow
                icon="trash-outline"
                label="Delete"
                destructive
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmOpen(true);
                }}
              />
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <SubscriptionFormSheet
        mode={formMode}
        categories={expenseCategories}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete subscription?"
        description={`“${sub.merchantName}” will be removed.`}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

function DetailRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View>
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center justify-between px-3.5 py-3.5">
        <Text variant="body" className="text-[14px]">
          {label}
        </Text>
        <Text variant="heading" numberOfLines={1} className="max-w-[60%] text-[14px]">
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[3px] px-2 py-3 active:opacity-70"
    >
      <StyledIonicons
        name={icon}
        size={20}
        className={destructive ? "text-danger" : "text-foreground"}
      />
      <Text className={destructive ? "text-[15px] text-danger" : "text-[15px] text-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}
