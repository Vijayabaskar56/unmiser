import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "drizzle-orm";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import {
  AppBar,
  AppSwitch,
  Badge,
  BottomBar,
  Card,
  ConfirmDialog,
  Text,
  TxnRow,
} from "@/components/ui";
import {
  ruleApplicationCollection,
  transactionCollection,
  transactionRuleCollection,
} from "@/db/collections";
import { appDb } from "@/db/app-db";
import { transactionRules } from "@/db/schema";
import { applyToPast } from "@/db/services/apply-to-past";
import { useAccent } from "@/lib/appearance/use-accent";
import { parseActions, parseConditions } from "@/lib/rules/dsl";
import { describeAction, describeCondition } from "@/lib/rules/summary";
import { formatDisplay } from "@/lib/dates";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

function ValueChip({ children, accent }: { children: string; accent?: boolean }) {
  const accentColor = useAccent();
  if (!children) return null;
  return (
    <View
      className={
        accent
          ? "self-start rounded-[3px] border-[1.3px] border-foreground px-2 py-0.5"
          : "self-start rounded-[3px] border-[1.3px] border-foreground bg-foreground px-2 py-0.5"
      }
      style={accent ? { backgroundColor: accentColor } : undefined}
    >
      <Text
        className={
          accent
            ? "text-[13px] font-bold text-accent-foreground"
            : "text-[13px] font-bold text-background"
        }
      >
        {children}
      </Text>
    </View>
  );
}

export default function RuleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: rules } = useLiveQuery((q) => q.from({ rule: transactionRuleCollection }));
  const { data: applications } = useLiveQuery((q) =>
    q.from({ app: ruleApplicationCollection }).orderBy(({ app }) => app.appliedAt, "desc"),
  );
  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }));

  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(
    () =>
      Promise.all([
        transactionRuleCollection.utils.refetch(),
        ruleApplicationCollection.utils.refetch(),
        transactionCollection.utils.refetch(),
      ]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const rule = useMemo(() => (rules ?? []).find((r) => r.id === id), [rules, id]);
  const ruleApps = useMemo(
    () => (applications ?? []).filter((a) => a.ruleId === id),
    [applications, id],
  );
  const txnById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof txns>[number]>();
    for (const t of txns ?? []) m.set(t.id, t);
    return m;
  }, [txns]);

  if (!rule) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Rule" onBack={() => router.back()} />
        <Container className="px-4">
          <Text variant="body">Rule not found.</Text>
        </Container>
      </View>
    );
  }

  const conditions = parseConditions(rule.conditions);
  const actions = parseActions(rule.actions);
  const lastRun = ruleApps[0]?.appliedAt ?? null;

  const toggleActive = async (next: boolean) => {
    await appDb.update(transactionRules).set({ isActive: next }).where(eq(transactionRules.id, id));
    await transactionRuleCollection.utils.refetch();
  };

  const onRunPast = async () => {
    setRunning(true);
    try {
      const result = await applyToPast(appDb, [id]);
      await refetch();
      Alert.alert(
        "Run complete",
        `Updated ${result.updated} transaction${result.updated === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      Alert.alert("Could not run", String(e instanceof Error ? e.message : e));
    } finally {
      setRunning(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await appDb.delete(transactionRules).where(eq(transactionRules.id, id));
      await refetch();
      setConfirmOpen(false);
      router.back();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Rule"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setConfirmOpen(true)}
            accessibilityLabel="Delete rule"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="trash-outline" size={18} className="text-danger" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* IF / THEN */}
        <Card variant="soft" className="mt-3 gap-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-2">
              {conditions.map((c, i) => {
                const d = describeCondition(c);
                return (
                  <View key={i} className="flex-row flex-wrap items-center gap-2">
                    <Badge variant="gray">IF</Badge>
                    <Text className="text-[15px] text-foreground">{d.label}</Text>
                    <ValueChip>{d.value}</ValueChip>
                  </View>
                );
              })}
            </View>
            <AppSwitch value={rule.isActive} onChange={(v) => void toggleActive(v)} />
          </View>
          <View className="h-px bg-separator" />
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge variant="accent">THEN</Badge>
            {actions.map((a, i) => {
              const d = describeAction(a);
              return (
                <View key={i} className="flex-row items-center gap-2">
                  <Text className="text-[15px] text-foreground">{d.label}</Text>
                  <ValueChip accent>{d.value}</ValueChip>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Stats */}
        <View className="flex-row py-5">
          <View className="flex-1">
            <Text variant="display" className="text-[26px]">
              {ruleApps.length}
            </Text>
            <Text variant="caption">Matched</Text>
          </View>
          <View className="mx-3 w-px self-stretch bg-separator" />
          <View className="flex-1">
            <Text variant="display" className="text-[26px]">
              {lastRun ? formatDisplay(lastRun, "d MMM") : "—"}
            </Text>
            <Text variant="caption">Last run</Text>
          </View>
          <View className="mx-3 w-px self-stretch bg-separator" />
          <View className="flex-1">
            <Text variant="display" className="text-[26px]">
              {rule.isActive ? "On" : "Off"}
            </Text>
            <Text variant="caption">Status</Text>
          </View>
        </View>

        {/* Recently matched */}
        <Text variant="caption" className="mb-1">
          Recently matched
        </Text>
        {ruleApps.length === 0 ? (
          <Text variant="body" className="pt-3">
            Nothing matched yet.
          </Text>
        ) : (
          ruleApps.slice(0, 15).map((app) => {
            const txn = txnById.get(Number(app.transactionId));
            if (!txn) return null;
            const isIn = txn.transactionType === "INCOME" || txn.transactionType === "CREDIT";
            return (
              <TxnRow
                key={app.id}
                merchant={txn.merchantName || "—"}
                sub={`${formatDisplay(txn.dateTime, "d MMM")} · auto-tagged`}
                amount={`${isIn ? "+" : "−"}${money.format(txn.amount, txn.currency)}`}
                direction={isIn ? "in" : "out"}
              />
            );
          })
        )}

        {/* Callout */}
        <View className="mt-5 rounded-[3px] bg-surface-secondary p-3.5">
          <Text variant="body" className="text-[13px] text-foreground/80">
            Runs the instant a matching SMS is parsed — fully on-device, even offline.
          </Text>
        </View>
      </Container>

      <BottomBar>
        <Pressable
          onPress={() => void onRunPast()}
          disabled={running}
          className="items-center rounded-[3px] border-[1.5px] border-foreground py-4 active:opacity-70"
        >
          <Text variant="heading" className="text-[16px]">
            {running ? "Running…" : "Run on past"}
          </Text>
        </Pressable>
      </BottomBar>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete rule?"
        description={`“${rule.name}” will be removed.`}
        busy={deleting}
        onConfirm={confirmDelete}
      />
    </View>
  );
}
