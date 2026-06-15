import { useLiveQuery } from "@tanstack/react-db";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
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
import { parseActions, parseConditions } from "@/lib/rules/dsl";
import type {
  ConditionOperator,
  LogicalOperator,
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

function opsFor(field: TransactionField) {
  return field === "AMOUNT" ? AMOUNT_OPS : TEXT_OPS;
}
function fieldLabel(field: TransactionField): string {
  return FIELDS.find((f) => f.field === field)?.label ?? field.toLowerCase();
}

interface CondDraft {
  field: TransactionField;
  operator: ConditionOperator;
  value: string;
}
const EMPTY_COND: CondDraft = { field: "MERCHANT", operator: "CONTAINS", value: "" };

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
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editId = typeof edit === "string" && edit.length > 0 ? edit : undefined;

  const { data: categories } = useLiveQuery((q) => q.from({ c: categoryCollection }));
  const { data: accounts } = useLiveQuery((q) => q.from({ a: accountCollection }));
  const { data: rules } = useLiveQuery((q) => q.from({ rule: transactionRuleCollection }));

  const [conditions, setConditions] = useState<CondDraft[]>([{ ...EMPTY_COND }]);
  const [matchMode, setMatchMode] = useState<LogicalOperator>("AND");
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [flag, setFlag] = useState(false);
  const [applyPast, setApplyPast] = useState(true);
  const [picker, setPicker] = useState<null | "category" | "account">(null);
  const [pastCount, setPastCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const editRule = useMemo(
    () => (editId ? (rules ?? []).find((r) => r.id === editId) : undefined),
    [editId, rules],
  );

  // Pre-fill the builder once when editing an existing rule.
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    // Track the loaded id (not a boolean) so switching to a different edit target re-prefills.
    if (!editId || loadedRef.current === editId || !editRule) return;
    loadedRef.current = editId;
    const conds = parseConditions(editRule.conditions).map((c) => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
    }));
    setConditions(conds.length > 0 ? conds : [{ ...EMPTY_COND }]);
    setMatchMode(
      parseConditions(editRule.conditions).some((c) => c.logicalOperator === "OR") ? "OR" : "AND",
    );
    for (const a of parseActions(editRule.actions)) {
      if (a.actionType !== "SET") continue;
      if (a.field === "CATEGORY") setCategoryName(a.value ?? null);
      else if (a.field === "ACCOUNT") setAccountName(a.value ?? null);
      else if (a.field === "FLAGGED") setFlag(a.value === "true");
    }
  }, [editId, editRule]);

  const setCondField = (i: number, field: TransactionField) =>
    setConditions((cs) =>
      cs.map((c, idx) => (idx === i ? { ...c, field, operator: opsFor(field)[0].op } : c)),
    );
  const setCondOp = (i: number, operator: ConditionOperator) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, operator } : c)));
  const setCondValue = (i: number, value: string) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, value } : c)));
  const addCond = () => setConditions((cs) => [...cs, { ...EMPTY_COND }]);
  const removeCond = (i: number) =>
    setConditions((cs) => (cs.length > 1 ? cs.filter((_, idx) => idx !== i) : cs));

  const definition = useMemo(() => {
    const conds: RuleCondition[] = conditions
      .map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value.trim(),
        ...(matchMode === "OR" ? { logicalOperator: "OR" as const } : {}),
      }))
      .filter((c) => c.value.length > 0);
    const actions: RuleAction[] = [];
    if (categoryName) actions.push({ actionType: "SET", field: "CATEGORY", value: categoryName });
    if (accountName) actions.push({ actionType: "SET", field: "ACCOUNT", value: accountName });
    if (flag) actions.push({ actionType: "SET", field: "FLAGGED", value: "true" });
    return { conditions: conds, actions };
  }, [conditions, matchMode, categoryName, accountName, flag]);

  const valid = conditions.every((c) => c.value.trim().length > 0) && definition.actions.length > 0;

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
        id: editId ?? "preview",
        name: "preview",
        priority: 100,
        isActive: true,
        ...definition,
      }).then(setPastCount);
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [valid, definition, editId]);

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const first = conditions[0];
      const base = `${fieldLabel(first.field)} ${first.operator.toLowerCase()} ${first.value.trim()}`;
      const name =
        editRule?.name ?? (conditions.length > 1 ? `${base} +${conditions.length - 1}` : base);
      const id = await saveRule(appDb, {
        id: editId,
        name,
        priority: editRule?.priority ?? 100,
        isActive: editRule?.isActive ?? true,
        ...definition,
      });
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
        title={editId ? "Edit rule" : "New rule"}
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
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Badge variant="default">WHEN</Badge>
              <Text variant="caption">A SMS IS PARSED</Text>
            </View>
            {conditions.length > 1 ? (
              <View className="flex-row items-center gap-1.5">
                <Text variant="caption">MATCH</Text>
                <Pill on={matchMode === "AND"} label="all" onPress={() => setMatchMode("AND")} />
                <Pill on={matchMode === "OR"} label="any" onPress={() => setMatchMode("OR")} />
              </View>
            ) : null}
          </View>

          {conditions.map((c, i) => {
            const isAmount = c.field === "AMOUNT";
            return (
              <View key={i} className="gap-2">
                {i > 0 ? (
                  <View className="flex-row items-center justify-between">
                    <Badge variant="gray">{matchMode}</Badge>
                    <Pressable
                      onPress={() => removeCond(i)}
                      accessibilityLabel={`Remove condition ${i + 1}`}
                      className="active:opacity-70"
                    >
                      <Text className="text-[13px] font-semibold text-muted">remove ✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text variant="body" className="text-[15px] text-foreground">
                    match where
                  </Text>
                )}
                <View className="flex-row flex-wrap gap-2">
                  {FIELDS.map((f) => (
                    <Pill
                      key={f.field}
                      on={c.field === f.field}
                      label={f.label}
                      onPress={() => setCondField(i, f.field)}
                    />
                  ))}
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {opsFor(c.field).map((o) => (
                    <Pill
                      key={o.op}
                      on={c.operator === o.op}
                      label={o.label}
                      onPress={() => setCondOp(i, o.op)}
                    />
                  ))}
                </View>
                <TextInput
                  value={c.value}
                  onChangeText={(t) => setCondValue(i, t)}
                  placeholder="value"
                  placeholderTextColor="#9a988c"
                  keyboardType={isAmount ? "decimal-pad" : "default"}
                  autoCapitalize="none"
                  className="rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[16px] font-semibold text-foreground"
                />
              </View>
            );
          })}

          <Pressable
            onPress={addCond}
            className="flex-row items-center gap-1.5 self-start active:opacity-70"
            accessibilityLabel="Add condition"
          >
            <SpriteIcon name="plus" size={15} />
            <Text variant="heading" className="text-[14px]">
              Add condition
            </Text>
          </Pressable>
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
          <Text className="font-bold text-background">
            {saving ? "Saving…" : editId ? "Save changes" : "Save rule"}
          </Text>
        </Pressable>
      </BottomBar>

      {/* Category / account picker */}
      <BottomSheet isOpen={picker !== null} onOpenChange={(o) => !o && setPicker(null)}>
        <BottomSheet.Portal>
          <SheetOverlay />
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
