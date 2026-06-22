import { BottomSheet } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { Field, Segmented, SubmitButton, Text } from "@/components/ui";
import { db } from "@/db/index";
import type { Budget, BudgetCategoryLimit, BudgetPeriod, Category } from "@/db/schema";
import { deleteBudget, saveBudget } from "@/db/services/budget-ops";
import * as money from "@/lib/money";

const PERIODS: BudgetPeriod[] = ["MONTHLY", "WEEKLY", "YEARLY"];
const COLORS = ["#15140f", "#5b8def", "#1f7a3d", "#e0578a", "#d98a2b", "#7c5cbf"];

export interface BudgetFormSheetProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  /** When set, the sheet edits this budget instead of creating a new one. */
  budget?: Budget | null;
  /** The editing budget's category limits (first one prefills the picker). */
  limits?: BudgetCategoryLimit[];
  /** Called after the editing budget is deleted. */
  onDeleted?: () => void;
}

export function BudgetFormSheet({
  isOpen,
  categories,
  onClose,
  onSaved,
  budget,
  limits,
  onDeleted,
}: BudgetFormSheetProps) {
  const editing = budget != null;
  const expenseCategories = useMemo(
    () => categories.filter((category) => !category.isIncome),
    [categories],
  );
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("MONTHLY");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (budget) {
      const editPeriod = (PERIODS as string[]).includes(budget.periodType)
        ? (budget.periodType as BudgetPeriod)
        : "MONTHLY";
      setName(budget.name);
      setAmount(budget.amount);
      setPeriod(editPeriod);
      setCategoryId(limits?.[0]?.categoryId ?? expenseCategories[0]?.id ?? null);
      setColor(budget.color);
      return;
    }
    setName("");
    setAmount("");
    setPeriod("MONTHLY");
    setCategoryId(expenseCategories[0]?.id ?? null);
    setColor(COLORS[0]);
  }, [budget, limits, expenseCategories, isOpen]);

  const onDelete = () => {
    if (!budget) return;
    Alert.alert("Delete budget", `Delete "${budget.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteBudget(db, budget.id);
              onDeleted?.();
              onClose();
            } catch (e) {
              Alert.alert("Could not delete budget", String(e instanceof Error ? e.message : e));
            }
          })();
        },
      },
    ]);
  };

  const selectedCategory = expenseCategories.find((category) => category.id === categoryId);
  const normalizedAmount = normalizeAmount(amount);
  const canSubmit =
    name.trim().length > 0 && !!selectedCategory && normalizedAmount !== null && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !selectedCategory || normalizedAmount === null) return;
    setSubmitting(true);
    try {
      await saveBudget(db, {
        id: budget?.id,
        name,
        amount: normalizedAmount,
        periodType: period,
        color,
        categoryLimits: [
          {
            categoryId: selectedCategory.id,
            categoryName: selectedCategory.name,
            limitAmount: normalizedAmount,
          },
        ],
      });
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save budget", String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <SheetOverlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          snapPoints={["75%"]}
          enableDynamicSizing={false}
        >
          <BottomSheet.Title>{editing ? "Edit budget" : "New budget"}</BottomSheet.Title>
          <View className="gap-4 pt-3">
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Food guardrail"
            />
            <Field
              label="Limit"
              value={amount}
              onChangeText={setAmount}
              placeholder="25000"
              keyboardType="decimal-pad"
            />

            <View>
              <Text variant="caption" className="mb-2">
                Period
              </Text>
              <Segmented
                options={PERIODS}
                value={period}
                onChange={(value) => setPeriod(value as BudgetPeriod)}
              />
            </View>

            <View>
              <Text variant="caption" className="mb-2">
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.map((category) => {
                  const selected = category.id === categoryId;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setCategoryId(category.id)}
                      className={
                        selected
                          ? "rounded-[3px] border-[1.5px] border-foreground bg-foreground px-3 py-2"
                          : "rounded-[3px] border border-border bg-surface px-3 py-2"
                      }
                    >
                      <Text
                        variant="caption"
                        className={selected ? "font-bold text-background" : "text-foreground"}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text variant="caption" className="mb-2">
                Accent
              </Text>
              <View className="flex-row flex-wrap gap-2.5">
                {COLORS.map((candidate) => (
                  <Pressable
                    key={candidate}
                    onPress={() => setColor(candidate)}
                    className="h-8 w-8 rounded-full"
                    style={{
                      backgroundColor: candidate,
                      borderColor: "#15140f",
                      borderWidth: color === candidate ? 2 : 0,
                    }}
                  />
                ))}
              </View>
            </View>

            <Text variant="caption">
              {normalizedAmount
                ? `${money.format(normalizedAmount, "INR")} limit`
                : "Enter a budget limit"}
            </Text>

            <SubmitButton
              label={editing ? "Save changes" : "Create budget"}
              submitting={submitting}
              canSubmit={canSubmit}
              onPress={() => void onSubmit()}
            />

            {editing ? (
              <Pressable onPress={onDelete} className="items-center py-1 active:opacity-60">
                <Text variant="caption" className="text-danger">
                  Delete budget
                </Text>
              </Pressable>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function normalizeAmount(value: string): string | null {
  const stripped = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,2})?$/.test(stripped)) return null;
  if (money.compare(stripped || "0", "0") <= 0) return null;
  return money.normalize2dp(stripped);
}
