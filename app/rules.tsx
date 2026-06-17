import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Badge, BottomBar, Card, Text } from "@/components/ui";
import {
  ruleApplicationCollection,
  smsReviewCollection,
  transactionRuleCollection,
} from "@/db/collections";
import { useAccent } from "@/lib/appearance/use-accent";
import { parseActions, parseConditions } from "@/lib/rules/dsl";
import { describeAction, describeCondition } from "@/lib/rules/summary";

const StyledIonicons = withUniwind(Ionicons);

/** A dark/accent value chip, e.g. the "swiggy" / "food" pills in the mockup. */
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

export default function RulesScreen() {
  const router = useRouter();

  const { data: rules } = useLiveQuery(
    (q) => q.from({ rule: transactionRuleCollection }).orderBy(({ rule }) => rule.priority, "asc"),
    [],
  );
  const { data: applications } = useLiveQuery(
    (q) => q.from({ app: ruleApplicationCollection }),
    [],
  );
  const { data: review } = useLiveQuery((q) => q.from({ r: smsReviewCollection }), []);

  const refetch = useCallback(
    () =>
      Promise.all([
        transactionRuleCollection.utils.refetch(),
        ruleApplicationCollection.utils.refetch(),
        smsReviewCollection.utils.refetch(),
      ]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications ?? []) counts.set(app.ruleId, (counts.get(app.ruleId) ?? 0) + 1);
    return counts;
  }, [applications]);

  const rows = rules ?? [];
  const unrecognisedCount = review?.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Smart Rules"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => router.push("/rule/new")}
            accessibilityLabel="New rule"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* Summary */}
        <Card variant="soft" className="mt-3 flex-row items-center gap-3">
          <View className="flex-1">
            <Text variant="caption">{rows.length} RULES · AUTO-APPLIED</Text>
            <Text variant="body" className="mt-1 text-[15px] text-foreground/80">
              Rules tag and file transactions the moment a matching SMS is parsed.
            </Text>
          </View>
          <StyledIonicons name="git-branch-outline" size={28} className="text-foreground" />
        </Card>

        {/* Unrecognised banner */}
        {unrecognisedCount > 0 ? (
          <Pressable
            onPress={() => router.push("/unrecognised")}
            className="mt-3 flex-row items-center justify-between rounded-[3px] border border-border bg-surface-secondary px-3.5 py-3 active:opacity-70"
          >
            <Text variant="body" className="text-[14px] text-foreground">
              {unrecognisedCount} unrecognised SMS need a sender rule
            </Text>
            <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
          </Pressable>
        ) : null}

        {/* Rules */}
        {rows.length > 0 ? (
          <Card variant="soft" className="mt-3 gap-0 p-0">
            {rows.map((rule, i) => {
              const conditions = parseConditions(rule.conditions);
              const actions = parseActions(rule.actions);
              const cond = conditions[0] ? describeCondition(conditions[0]) : null;
              const act = actions[0] ? describeAction(actions[0]) : null;
              const matched = matchCounts.get(rule.id) ?? 0;
              return (
                <Pressable
                  key={rule.id}
                  onPress={() => router.push(`/rule/${rule.id}`)}
                  className="active:opacity-70"
                >
                  {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
                  <View className="gap-2 px-3.5 py-3.5">
                    {cond ? (
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Badge variant="gray">IF</Badge>
                        <Text className="text-[15px] text-foreground">{cond.label}</Text>
                        <ValueChip>{cond.value}</ValueChip>
                      </View>
                    ) : null}
                    {act ? (
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Badge variant="accent">THEN</Badge>
                        <Text className="text-[15px] text-foreground">{act.label}</Text>
                        <ValueChip accent>{act.value}</ValueChip>
                        <Text variant="body" className="text-[13px]">
                          · {matched} matched
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Text variant="body" className="pt-3">
            No rules yet — create one below.
          </Text>
        )}
      </Container>

      <BottomBar>
        <Pressable
          onPress={() => router.push("/rule/new")}
          className="items-center rounded-[3px] border border-border py-4 active:opacity-70"
        >
          <Text variant="heading" className="text-[16px]">
            New rule
          </Text>
        </Pressable>
      </BottomBar>
    </View>
  );
}
