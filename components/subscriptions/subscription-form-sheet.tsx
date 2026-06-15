import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { Chip, Field, SpriteIcon, SubmitButton, Text } from "@/components/ui";
import type { Category, Subscription } from "@/db/schema";
import { db } from "@/db/index";
import { createSubscription, editSubscription } from "@/db/services/subscription-ops";
import { categoryIconId } from "@/lib/categories/icons";
import * as money from "@/lib/money";
import { BILLING_CYCLE_PRESETS } from "@/lib/subscriptions/billing-cycle";
import { SUBSCRIPTION_FALLBACK_ICON } from "@/lib/subscriptions/icons";

export type SubscriptionFormMode = { type: "new" } | { type: "edit"; subscription: Subscription };

interface Props {
  mode: SubscriptionFormMode | null;
  /** Expense categories offered for linking. */
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit a subscription: merchant, amount, billing cycle, next date, category. */
export function SubscriptionFormSheet({ mode, categories, onClose, onSaved }: Props) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<string | null>("monthly");
  const [nextDate, setNextDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mode) return;
    if (mode.type === "edit") {
      const s = mode.subscription;
      setMerchant(s.merchantName);
      setAmount(s.amount);
      setCycle(s.billingCycle ?? null);
      setNextDate(s.nextPaymentDate ?? "");
      setCategoryId(s.categoryId ?? null);
    } else {
      setMerchant("");
      setAmount("");
      setCycle("monthly");
      setNextDate("");
      setCategoryId(null);
    }
  }, [mode]);

  const selectedIcon = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? categoryIconId(cat) : SUBSCRIPTION_FALLBACK_ICON;
  }, [categories, categoryId]);

  const amountValid = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return false;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
    return money.compare(trimmed, "0") > 0;
  })();

  const canSubmit = merchant.trim().length > 0 && amountValid && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !mode) return;
    setSubmitting(true);
    try {
      const input = {
        merchantName: merchant.trim(),
        amount: money.normalize2dp(amount.trim()),
        billingCycle: cycle,
        nextPaymentDate: nextDate.trim() || null,
        categoryId,
      };
      if (mode.type === "new") {
        await createSubscription(db, input);
      } else {
        await editSubscription(db, mode.subscription.id, input);
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save subscription", String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode?.type === "edit" ? "Edit subscription" : "New subscription";

  return (
    <BottomSheet isOpen={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <BottomSheet.Portal>
        <SheetOverlay />
        <BottomSheet.Content keyboardBehavior="interactive">
          <BottomSheet.Title>{title}</BottomSheet.Title>
          <View className="gap-4 pt-3">
            {/* Icon + merchant */}
            <View className="flex-row items-center gap-3">
              <View className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-foreground">
                <SpriteIcon name={selectedIcon} size={26} />
              </View>
              <View className="flex-1">
                <Field
                  label="Merchant"
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="e.g. Netflix"
                />
              </View>
            </View>

            {/* Amount */}
            <Field
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            {/* Billing cycle */}
            <View>
              <Text variant="caption" className="mb-2">
                Billing cycle
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {BILLING_CYCLE_PRESETS.map((preset) => (
                  <Chip
                    key={preset}
                    variant={cycle === preset ? "on" : "default"}
                    onPress={() => setCycle(preset)}
                  >
                    {preset}
                  </Chip>
                ))}
              </View>
            </View>

            {/* Next payment date */}
            <Field
              label="Next payment (YYYY-MM-DD)"
              value={nextDate}
              onChangeText={setNextDate}
              placeholder="2026-07-01"
              autoCapitalize="none"
            />

            {/* Category */}
            {categories.length > 0 ? (
              <View>
                <Text variant="caption" className="mb-2">
                  Category
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2"
                >
                  <Chip
                    variant={categoryId === null ? "on" : "default"}
                    onPress={() => setCategoryId(null)}
                  >
                    None
                  </Chip>
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      variant={categoryId === c.id ? "on" : "default"}
                      onPress={() => setCategoryId(c.id)}
                    >
                      {c.name}
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <SubmitButton
              label={mode?.type === "edit" ? "Save changes" : "Add subscription"}
              submitting={submitting}
              canSubmit={canSubmit}
              onPress={() => void onSubmit()}
            />
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
