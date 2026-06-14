import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "heroui-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, AppSwitch, Badge, BottomBar, Card, SpriteIcon, Text } from "@/components/ui";
import { transactionRuleCollection } from "@/db/collections";
import { categoryCollection, accountCollection } from "@/db/collections/finance";
import { appDb } from "@/db/app-db";
import { applyToPast, previewRuleMatches } from "@/db/services/apply-to-past";
import { saveRule } from "@/db/services/rule-ops";
import type {
  ConditionOperator,
  RuleAction,
  RuleCondition,
  TransactionField,
} from "@/lib/rules/types";

const StyledIonicons = withUniwind(Ionicons);

const FIELDS: { field: TransactionField; label: string }[] = [
  { field: "MERCHANT", label: "merchant" },
  { field: "SMS_SENDER", label: "sender" },
  { field: "AMOUNT", label: "amount" },
];
const TEXT_OPS: { op: ConditionOperator; label: string }[] = [
  { op: "CONTAINS", label: "contains" },
  { op: "EQUALS", label: "is exactly" },
  { op: "STARTS_WITH", label: "starts with" },
];
const AMOUNT_OPS: { op: ConditionOperator; label: string }[] = [
  { op: "GREATER_THAN", label: ">" },
  { op: "LESS_THAN", label: "<" },
  { op: "EQUALS", label: "is" },
];

/** Pill toggle used for field/operator selection. */
function Pill({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={
        on
          ? "rounded-[3px] border-[1.3px] border-foreground bg-foreground px-3 py-2"
          : "rounded-[3px] border-[1.3px] border-border px-3 py-2"
      }
    >
      <Text
        className={on ? "text-[13px] font-semibold text-background" : "text-[13px] text-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function NewRuleScreen() {
  const router = useRouter();
  const { data: categories } = useLiveQuery((q) => q.from({ c: categoryCollection }));
  const { data: accounts } = useLiveQuery((q) => q.from({ a: accountCollection }));

  const [field, setField] = useState<TransactionField>("MERCHANT");
  const [operator, setOperator] = useState<ConditionOperator>("CONTAINS");
  const [value, setValue] = useState("");
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [flag, setFlag] = useState(false);
  const [applyPast, setApplyPast] = useState(true);
  const [picker, setPicker] = useState<null | "category" | "account">(null);
  const [pastCount, setPastCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const isAmount = field === "AMOUNT";
  const ops = isAmount ? AMOUNT_OPS : TEXT_OPS;

  const onField = (f: TransactionField) => {
    setField(f);
    setOperator((f === "AMOUNT" ? AMOUNT_OPS : TEXT_OPS)[0].op);
  };

  const definition = useMemo(() => {
    const conditions: RuleCondition[] = [{ field, operator, value: value.trim() }];
    const actions: RuleAction[] = [];
    if (categoryName) actions.push({ actionType: "SET", field: "CATEGORY", value: categoryName });
    if (accountName) actions.push({ actionType: "SET", field: "ACCOUNT", value: accountName });
    if (flag) actions.push({ actionType: "SET", field: "FLAGGED", value: "true" });
    return { conditions, actions };
  }, [field, operator, value, categoryName, accountName, flag]);

  const valid = value.trim().length > 0 && definition.actions.length > 0;

  // Debounced live preview of how many past transactions would match.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!valid) {
      setPastCount(null);
      return;
    }
    debounce.current = setTimeout(() => {
      void previewRuleMatches(appDb, {
        id: "preview",
        name: "preview",
        priority: 100,
        isActive: true,
        ...definition,
      }).then(setPastCount);
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [valid, definition]);

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const name = `${FIELDS.find((f) => f.field === field)?.label} ${operator.toLowerCase()} ${value.trim()}`;
      const id = await saveRule(appDb, { name, priority: 100, isActive: true, ...definition });
      await transactionRuleCollection.utils.refetch();
      if (applyPast) await applyToPast(appDb, [id]);
      router.back();
    } catch (e) {
      Alert.alert("Could not save rule", String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  const pickerItems = picker === "category" ? (categories ?? []) : (accounts ?? []);
  const pickerLabel = (item: { name?: string; bankName?: string }) =>
    item.name ?? item.bankName ?? "";

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="New rule"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => void onSave()}
            disabled={!valid || saving}
            accessibilityLabel="Save rule"
            className={
              valid && !saving
                ? "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
                : "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-border opacity-40"
            }
          >
            <StyledIonicons name="checkmark" size={20} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* WHEN */}
        <Card variant="soft" className="mt-3 gap-3">
          <View className="flex-row items-center gap-2">
            <Badge variant="default">WHEN</Badge>
            <Text variant="caption">A SMS IS PARSED</Text>
          </View>
          <Text variant="body" className="text-[15px] text-foreground">
            match where
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {FIELDS.map((f) => (
              <Pill
                key={f.field}
                on={field === f.field}
                label={f.label}
                onPress={() => onField(f.field)}
              />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {ops.map((o) => (
              <Pill
                key={o.op}
                on={operator === o.op}
                label={o.label}
                onPress={() => setOperator(o.op)}
              />
            ))}
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="value"
            placeholderTextColor="#9a988c"
            keyboardType={isAmount ? "decimal-pad" : "default"}
            autoCapitalize="none"
            className="rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[16px] font-semibold text-foreground"
          />
        </Card>

        {/* THEN */}
        <Card variant="soft" className="mt-3 gap-0 p-0">
          <View className="flex-row items-center gap-2 px-3.5 pb-1 pt-3">
            <Badge variant="accent">THEN</Badge>
            <Text variant="caption">APPLY THESE</Text>
          </View>
          <ActionRow
            icon="grid-01"
            label="Category"
            value={categoryName}
            onPress={() => setPicker("category")}
            onClear={() => setCategoryName(null)}
          />
          <View className="mx-3.5 h-px bg-separator" />
          <ActionRow
            icon="bank"
            label="Account"
            value={accountName}
            onPress={() => setPicker("account")}
            onClear={() => setAccountName(null)}
          />
          <View className="mx-3.5 h-px bg-separator" />
          <View className="flex-row items-center gap-3 px-3.5 py-3.5">
            <View className="h-9 w-9 items-center justify-center rounded-full border-[1.3px] border-foreground">
              <SpriteIcon name="flag-01" size={16} />
            </View>
            <Text variant="heading" className="flex-1 text-[15px]">
              Flag for review
            </Text>
            <AppSwitch value={flag} onChange={setFlag} />
          </View>
        </Card>

        {/* Apply to past — a checkmark card, tap to toggle inclusion. */}
        {valid && pastCount !== null && pastCount > 0 ? (
          <Pressable
            onPress={() => setApplyPast((v) => !v)}
            className="mt-3 flex-row items-center gap-3 rounded-[3px] bg-surface-secondary px-3.5 py-3.5 active:opacity-70"
          >
            <View
              className={
                applyPast
                  ? "h-6 w-6 items-center justify-center rounded-full bg-foreground"
                  : "h-6 w-6 items-center justify-center rounded-full border-[1.3px] border-border"
              }
            >
              {applyPast ? (
                <StyledIonicons name="checkmark" size={15} className="text-background" />
              ) : null}
            </View>
            <Text variant="body" className="flex-1 text-[14px] text-foreground">
              <Text className="font-bold text-foreground">{pastCount} past transactions</Text> match
              — apply to them too?
            </Text>
          </Pressable>
        ) : null}
      </Container>

      <BottomBar>
        <Pressable
          onPress={() => void onSave()}
          disabled={!valid || saving}
          className={
            valid && !saving
              ? "items-center rounded-[3px] bg-foreground py-4 active:opacity-70"
              : "items-center rounded-[3px] bg-foreground py-4 opacity-40"
          }
        >
          <Text className="font-bold text-background">{saving ? "Saving…" : "Save rule"}</Text>
        </Pressable>
      </BottomBar>

      {/* Category / account picker */}
      <BottomSheet isOpen={picker !== null} onOpenChange={(o) => !o && setPicker(null)}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <BottomSheet.Title>
              {picker === "category" ? "Choose category" : "Choose account"}
            </BottomSheet.Title>
            <View className="gap-1 pt-2">
              {pickerItems.map((item) => {
                const name = pickerLabel(item);
                return (
                  <Pressable
                    key={(item as { id: number }).id}
                    onPress={() => {
                      if (picker === "category") setCategoryName(name);
                      else setAccountName(name);
                      setPicker(null);
                    }}
                    className="rounded-[3px] px-2 py-3 active:opacity-70"
                  >
                    <Text className="text-[15px] text-foreground">{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  value,
  onPress,
  onClear,
}: {
  icon: string;
  label: string;
  value: string | null;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-3.5 py-3.5 active:opacity-70"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full border-[1.3px] border-foreground">
        <SpriteIcon name={icon} size={16} />
      </View>
      <Text variant="heading" className="flex-1 text-[15px]">
        {label}
      </Text>
      {value ? (
        <Pressable
          onPress={onClear}
          className="rounded-[3px] border-[1.3px] border-foreground bg-foreground px-2.5 py-1"
        >
          <Text className="text-[13px] font-bold text-background">{value} ✕</Text>
        </Pressable>
      ) : (
        <Text variant="body" className="text-[14px] text-muted">
          + set
        </Text>
      )}
    </Pressable>
  );
}
