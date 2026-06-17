import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import {
  CategoryFormSheet,
  type CategoryFormMode,
} from "@/components/categories/category-form-sheet";
import { Container } from "@/components/container";
import { AppBar, BottomBar, Card, Segmented, SpriteIcon, Text } from "@/components/ui";
import { transactionCollection } from "@/db/collections";
import { categoryCollection } from "@/db/collections/finance";
import { categoryIconId } from "@/lib/categories/icons";
import { aggregateByCategory } from "@/lib/categories/overview";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);
const TABS = ["Expense", "Income"];

export default function CategoriesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState("Expense");
  const [formMode, setFormMode] = useState<CategoryFormMode | null>(null);

  const { data: categories, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ category: categoryCollection })
        .orderBy(({ category }) => category.displayOrder, "asc"),
    [],
  );
  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  const refetch = useCallback(
    () => Promise.all([categoryCollection.utils.refetch(), transactionCollection.utils.refetch()]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const agg = useMemo(() => aggregateByCategory(txns ?? []), [txns]);
  const isIncome = tab === "Income";
  const rows = useMemo(
    () => (categories ?? []).filter((c) => c.isIncome === isIncome),
    [categories, isIncome],
  );

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Categories"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => setFormMode({ type: "new", isIncome })}
            accessibilityLabel="New category"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        <Segmented options={TABS} value={tab} onChange={setTab} className="my-3" />

        {isLoading ? (
          <Text variant="body">Loading…</Text>
        ) : rows.length === 0 ? (
          <Text variant="body" className="pt-2">
            No {tab.toLowerCase()} categories yet.
          </Text>
        ) : (
          <Card variant="soft" className="gap-0 p-0">
            {rows.map((category, i) => {
              const stat = agg.get(category.id);
              const count = stat?.count ?? 0;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => router.push(`/category/${category.id}`)}
                  className="active:opacity-70"
                >
                  {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
                  <View className="flex-row items-center gap-3 px-3.5 py-3.5">
                    <View className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground">
                      <SpriteIcon name={categoryIconId(category)} size={20} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text variant="heading" numberOfLines={1} className="text-[16px]">
                        {category.name}
                      </Text>
                      <Text variant="body" className="text-[13px]">
                        {count} transaction{count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text variant="balance" numberOfLines={1} className="text-[17px]">
                      {money.formatCompact(stat?.total ?? "0", "INR")}
                    </Text>
                    <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}
      </Container>

      <BottomBar>
        <Pressable
          onPress={() => setFormMode({ type: "new", isIncome })}
          className="items-center rounded-[3px] border border-border py-4 active:opacity-70"
        >
          <Text variant="heading" className="text-[16px]">
            New category
          </Text>
        </Pressable>
      </BottomBar>

      <CategoryFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />
    </View>
  );
}
