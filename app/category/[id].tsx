import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import {
  CategoryFormSheet,
  type CategoryFormMode,
} from "@/components/categories/category-form-sheet";
import { Container } from "@/components/container";
import { AppBar, ConfirmDialog, SpriteIcon, Text, TxnRow } from "@/components/ui";
import { transactionCollection } from "@/db/collections";
import { categoryCollection, subcategoryCollection } from "@/db/collections/finance";
import { db } from "@/db/index";
import { deleteCategory } from "@/db/services/category-ops";
import { categoryIconId } from "@/lib/categories/icons";
import { aggregateByCategory } from "@/lib/categories/overview";
import { formatDisplay } from "@/lib/dates";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);

  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));
  const { data: subcategories } = useLiveQuery((q) => q.from({ sub: subcategoryCollection }));
  const { data: txns } = useLiveQuery((q) =>
    q.from({ txn: transactionCollection }).orderBy(({ txn }) => txn.dateTime, "desc"),
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [formMode, setFormMode] = useState<CategoryFormMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(
    () => Promise.all([categoryCollection.utils.refetch(), transactionCollection.utils.refetch()]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const category = useMemo(
    () => (categories ?? []).find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const subs = useMemo(
    () => (subcategories ?? []).filter((s) => s.categoryId === categoryId),
    [subcategories, categoryId],
  );
  const categoryTxns = useMemo(
    () => (txns ?? []).filter((t) => t.categoryId === categoryId && !t.isDeleted).slice(0, 25),
    [txns, categoryId],
  );
  const stat = useMemo(() => aggregateByCategory(txns ?? []).get(categoryId), [txns, categoryId]);

  if (!category) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Category" onBack={() => router.back()} />
        <Container className="px-4">
          <Text variant="body">Category not found.</Text>
        </Container>
      </View>
    );
  }

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteCategory(db, categoryId);
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
        title={category.name}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Category menu"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="ellipsis-horizontal" size={18} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* Summary */}
        <View className="flex-row items-center gap-3 pt-3">
          <View className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-foreground">
            <SpriteIcon name={categoryIconId(category)} size={26} />
          </View>
          <View className="flex-1">
            <Text variant="caption">{category.isIncome ? "INCOME" : "EXPENSE"}</Text>
            <Text variant="title" className="text-[26px]">
              {money.format(stat?.total ?? "0", "INR")}
            </Text>
          </View>
        </View>
        <Text variant="body" className="pt-1">
          {stat?.count ?? 0} transaction{(stat?.count ?? 0) === 1 ? "" : "s"}
        </Text>

        {/* Subcategories */}
        {subs.length > 0 ? (
          <View className="pt-5">
            <Text variant="caption" className="mb-2">
              Subcategories
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {subs.map((s) => (
                <View key={s.id} className="rounded-[3px] border border-border px-3 py-1.5">
                  <Text className="text-[13px] text-foreground">{s.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Recent transactions */}
        <View className="pt-6">
          <Text variant="caption" className="mb-1">
            Recent
          </Text>
          {categoryTxns.length === 0 ? (
            <Text variant="body" className="pt-3">
              No transactions in this category yet.
            </Text>
          ) : (
            categoryTxns.map((txn) => {
              const isIn = txn.transactionType === "INCOME" || txn.transactionType === "CREDIT";
              return (
                <TxnRow
                  key={txn.id}
                  merchant={txn.merchantName || "—"}
                  sub={`${formatDisplay(txn.dateTime, "d MMM")} · ${txn.transactionType.toLowerCase()}`}
                  amount={`${isIn ? "+" : "−"}${money.format(txn.amount, txn.currency)}`}
                  direction={isIn ? "in" : "out"}
                />
              );
            })
          )}
        </View>
      </Container>

      {/* … menu */}
      <BottomSheet isOpen={menuOpen} onOpenChange={(o) => !o && setMenuOpen(false)}>
        <BottomSheet.Portal>
          <SheetOverlay />
          <BottomSheet.Content>
            <BottomSheet.Title>{category.name}</BottomSheet.Title>
            <View className="gap-1 pt-2">
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  setFormMode({ type: "edit", category });
                }}
                className="flex-row items-center gap-3 rounded-[3px] px-2 py-3 active:opacity-70"
              >
                <StyledIonicons name="create-outline" size={20} className="text-foreground" />
                <Text className="text-[15px] text-foreground">Edit</Text>
              </Pressable>
              {!category.isSystem ? (
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="flex-row items-center gap-3 rounded-[3px] px-2 py-3 active:opacity-70"
                >
                  <StyledIonicons name="trash-outline" size={20} className="text-danger" />
                  <Text className="text-[15px] text-danger">Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <CategoryFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete category?"
        description={`“${category.name}” will be removed.`}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}
