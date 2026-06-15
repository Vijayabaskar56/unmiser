import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "drizzle-orm";
import { router, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import {
  AppBar,
  Badge,
  BottomBar,
  Button,
  Card,
  ConfirmDialog,
  SpriteIcon,
  Tag,
  Text,
} from "@/components/ui";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  subcategoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { subscriptionCollection } from "@/db/collections";
import { db } from "@/db/index";
import { transactions } from "@/db/schema";
import { upsertFromMandate } from "@/db/services/subscription-ops";
import {
  editTransaction,
  softDeleteTransaction,
  undoDelete,
  type EditTransactionChanges,
} from "@/db/services/transaction-ops";
import type { Transaction } from "@/db/schema";
import type { TxnType } from "@/lib/balance-service";
import { formatDisplay, nowIso } from "@/lib/dates";
import * as money from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-method";

const StyledIonicons = withUniwind(Ionicons);

const TXN_TYPES: TxnType[] = ["EXPENSE", "INCOME", "INVESTMENT", "CREDIT", "TRANSFER"];

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: "Spend",
  INCOME: "Income",
  INVESTMENT: "Invest",
  CREDIT: "Credit",
  TRANSFER: "Transfer",
};

/**
 * Transaction detail (redesign) — an ink hero card (source label + confidence
 * badge, big amount, merchant, account/category/date/type rows), a RAW SMS card,
 * and a pinned bottom bar (Split — deferred/disabled — + Edit/Save).
 *
 * WRITES go through the services layer (editTransaction / softDeleteTransaction /
 * undoDelete), never the collection's optimistic path, so the balance cascade
 * stays single-sourced. The row is snapshotted on first load so the screen
 * survives a soft-delete (which drops it from the live collection) and can offer
 * Undo. After every write the transactions + account-balances + subscriptions
 * collections are refetched.
 */
export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const txnId = Number(params.id);

  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }));
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));
  const { data: subcategories } = useLiveQuery((q) =>
    q.from({ subcategory: subcategoryCollection }),
  );

  const mutedColor = useThemeColor("muted");
  const foreground = useThemeColor("foreground");

  const [snapshot, setSnapshot] = useState<Transaction | null>(null);
  const live = useMemo(() => (txns ?? []).find((t) => t.id === txnId) ?? null, [txns, txnId]);
  useEffect(() => {
    if (live) setSnapshot(live);
  }, [live]);
  const txn = live ?? snapshot;

  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Edit-form state, seeded when entering edit mode.
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [type, setType] = useState<TxnType>("EXPENSE");
  const [dateTime, setDateTime] = useState("");

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  );
  const subcategoryById = useMemo(
    () => new Map((subcategories ?? []).map((s) => [s.id, s.name])),
    [subcategories],
  );
  const accountById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  const categoryList = useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [categories],
  );
  const subcategoryList = useMemo(
    () =>
      categoryId === null
        ? []
        : [...(subcategories ?? [])]
            .filter((s) => s.categoryId === categoryId)
            .sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories, categoryId],
  );

  const beginEdit = useCallback(() => {
    if (!txn) return;
    setAmount(txn.amount);
    setMerchant(txn.merchantName);
    setCategoryId(txn.categoryId);
    setSubcategoryId(txn.subcategoryId ?? null);
    setType(txn.transactionType as TxnType);
    setDateTime(txn.dateTime);
    setEditing(true);
  }, [txn]);

  const onSelectCategory = useCallback((id: number) => {
    setCategoryId((prev) => {
      if (prev !== id) setSubcategoryId(null);
      return id;
    });
  }, []);

  const amountValid = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return false;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
    return money.compare(trimmed, "0") > 0;
  })();
  const canSave = !!txn && amountValid && categoryId !== null && !busy;

  const refetch = useCallback(
    () =>
      Promise.all([
        transactionCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
        subscriptionCollection.utils.refetch(),
      ]),
    [],
  );

  const onSave = useCallback(async () => {
    if (!txn || txn.accountId === null || categoryId === null || !amountValid) return;
    const account = accountById.get(txn.accountId);
    if (!account) return;
    setBusy(true);
    try {
      const changes: EditTransactionChanges = {
        amount: money.normalize2dp(amount.trim()),
        merchantName: merchant.trim(),
        categoryId,
        subcategoryId,
        transactionType: type,
        dateTime,
      };
      await editTransaction(db, txn.id, txn.accountId, account.isCreditCard, changes);
      await refetch();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [
    txn,
    accountById,
    categoryId,
    amountValid,
    amount,
    merchant,
    subcategoryId,
    type,
    dateTime,
    refetch,
  ]);

  const onDelete = useCallback(async () => {
    if (!txn || txn.accountId === null) return;
    const account = accountById.get(txn.accountId);
    if (!account) return;
    setBusy(true);
    try {
      await softDeleteTransaction(db, txn.id, txn.accountId, account.isCreditCard);
      await refetch();
      setConfirmOpen(false);
      setDeleted(true);
    } finally {
      setBusy(false);
    }
  }, [txn, accountById, refetch]);

  const onUndo = useCallback(async () => {
    if (!txn || txn.accountId === null) return;
    const account = accountById.get(txn.accountId);
    if (!account) return;
    setBusy(true);
    try {
      await undoDelete(db, txn.id, txn.accountId, account.isCreditCard);
      await refetch();
      setDeleted(false);
    } finally {
      setBusy(false);
    }
  }, [txn, accountById, refetch]);

  const onMarkRecurring = useCallback(async () => {
    if (!txn) return;
    setBusy(true);
    try {
      const subscriptionId = await upsertFromMandate(db, {
        amount: txn.amount,
        nextDeductionDate: txn.dateTime.slice(0, 10),
        merchant: txn.merchantName,
        currency: txn.currency,
        pluginId: "manual",
        provider: txn.bankName ?? "Manual",
      });
      await db
        .update(transactions)
        .set({ subscriptionId, isRecurring: true })
        .where(eq(transactions.id, txn.id));
      await refetch();
      setMessage(`Linked to subscription #${subscriptionId}`);
    } finally {
      setBusy(false);
    }
  }, [txn, refetch]);

  if (!txn) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Transaction" sm onBack={() => router.back()} />
        <Container className="px-5 pt-4">
          <Text className="text-[13px] text-muted">Transaction not found.</Text>
        </Container>
      </View>
    );
  }

  const account = txn.accountId !== null ? (accountById.get(txn.accountId) ?? null) : null;
  const isIn = txn.transactionType === "INCOME";
  const methodLabel = paymentMethodLabel(txn.paymentMethod);

  const deleteDescription = `${txn.merchantName || "—"} · ${isIn ? "+" : "−"}${money.format(
    txn.amount,
    txn.currency,
  )} · ${formatDisplay(txn.dateTime, "d MMM")}. It stays out of your totals — you can re-import it from SMS later.`;

  if (deleted) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Transaction" sm onBack={() => router.back()} />
        <Container className="px-5 pt-6">
          <Text className="mb-2 text-[28px] font-extrabold tracking-tight text-foreground">
            Deleted
          </Text>
          <Text className="mb-6 text-[13px] text-muted">This transaction was deleted.</Text>
          <Button onPress={() => void onUndo()} disabled={busy} className="mb-3">
            {busy ? "…" : "Undo delete"}
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            Close
          </Button>
        </Container>
      </View>
    );
  }

  // Source caps label: "PARSED · HDFC MANIFEST" / "MANUAL".
  const sourceLabel = [
    txn.sourceType === "SMS" ? "PARSED" : "MANUAL",
    txn.bankName ? `· ${txn.bankName.toUpperCase()}${txn.sourcePluginId ? " MANIFEST" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Transaction"
        sm
        onBack={() => router.back()}
        right={
          <>
            <Pressable
              onPress={editing ? () => setEditing(false) : beginEdit}
              accessibilityLabel={editing ? "Stop editing" : "Edit"}
              className={
                editing
                  ? "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground bg-foreground active:opacity-70"
                  : "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
              }
            >
              <StyledIonicons
                name="create-outline"
                size={18}
                className={editing ? "text-background" : "text-foreground"}
              />
            </Pressable>
            <Pressable
              onPress={() => setConfirmOpen(true)}
              accessibilityLabel="Delete"
              className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
            >
              <StyledIonicons name="trash-outline" size={18} className="text-foreground" />
            </Pressable>
          </>
        }
      />

      <Container isScrollable={false} className="px-5">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Hero card */}
          <Card variant="ink" className="mt-2 p-4">
            <View className="flex-row items-center gap-2.5">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full border-[1.3px] ${isIn ? "border-foreground" : "border-border"}`}
              >
                <SpriteIcon
                  name={isIn ? "arrow-down" : "arrow-up"}
                  size={17}
                  color={isIn ? foreground : mutedColor}
                />
              </View>
              <Text
                numberOfLines={1}
                className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-muted"
              >
                {sourceLabel}
              </Text>
              {txn.parseConfidence ? (
                <Badge variant={txn.parseConfidence === "HIGH" ? "accent" : "gray"}>
                  {txn.parseConfidence}
                </Badge>
              ) : null}
            </View>

            <Text
              className={`mt-3 text-[34px] font-extrabold tracking-tight ${isIn ? "text-success" : "text-foreground"}`}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {isIn ? "+" : "−"}
              {money.format(txn.amount, txn.currency)}
            </Text>

            {editing ? (
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Merchant"
                placeholderTextColor={mutedColor}
                className="mt-1 rounded-[3px] border border-border bg-surface px-3 py-2 text-[18px] font-bold text-foreground"
              />
            ) : (
              <Text className="mt-1 text-[19px] font-bold text-foreground">
                {txn.merchantName || "—"}
              </Text>
            )}

            <View className="my-3.5 h-px bg-separator" />

            {/* Read-only rows */}
            <DetailRow
              label="Account"
              value={account ? `${account.bankName} ··${account.accountLast4}` : "—"}
            />

            <View className="flex-row items-center justify-between py-2">
              <Text className="text-[14px] text-muted">Category</Text>
              <View className="flex-row items-center gap-1.5">
                <Tag variant="on">{categoryById.get(txn.categoryId) ?? "—"}</Tag>
                {txn.subcategoryId !== null && subcategoryById.get(txn.subcategoryId) ? (
                  <Tag>{subcategoryById.get(txn.subcategoryId)!}</Tag>
                ) : null}
              </View>
            </View>

            <DetailRow
              label="Date · time"
              value={`${formatDisplay(txn.dateTime, "d MMM")} · ${formatDisplay(txn.dateTime, "HH:mm")}`}
            />
            <DetailRow
              label="Type"
              value={`${TYPE_LABEL[txn.transactionType] ?? txn.transactionType}${methodLabel ? ` · ${methodLabel}` : ""}`}
            />
          </Card>

          {/* Edit pickers (category / subcategory / type) */}
          {editing && (
            <View className="mt-4 gap-4">
              <View>
                <Text variant="caption" className="mb-1">
                  Amount
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  className="rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[15px] text-foreground"
                />
              </View>

              <PickerRow label="Category">
                {categoryList.map((c) => (
                  <PickerChip
                    key={c.id}
                    label={c.name}
                    active={c.id === categoryId}
                    onPress={() => onSelectCategory(c.id)}
                  />
                ))}
              </PickerRow>

              {categoryId !== null && subcategoryList.length > 0 && (
                <PickerRow label="Subcategory">
                  {subcategoryList.map((s) => (
                    <PickerChip
                      key={s.id}
                      label={s.name}
                      active={s.id === subcategoryId}
                      onPress={() => setSubcategoryId(s.id === subcategoryId ? null : s.id)}
                    />
                  ))}
                </PickerRow>
              )}

              <PickerRow label="Type">
                {TXN_TYPES.map((t) => (
                  <PickerChip key={t} label={t} active={t === type} onPress={() => setType(t)} />
                ))}
              </PickerRow>

              <View>
                <Text variant="caption" className="mb-1">
                  Date/time (ISO)
                </Text>
                <TextInput
                  value={dateTime}
                  onChangeText={setDateTime}
                  autoCapitalize="none"
                  placeholder={nowIso()}
                  placeholderTextColor={mutedColor}
                  className="rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[15px] text-foreground"
                />
              </View>
            </View>
          )}

          {/* RAW SMS */}
          {!editing && txn.smsBody ? (
            <Card variant="soft" className="mt-3.5">
              <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
                Raw SMS
              </Text>
              <Text className="font-mono text-[12px] leading-5 text-foreground/80">
                {txn.smsBody}
              </Text>
            </Card>
          ) : null}

          {/* Recurring + status */}
          {!editing && (
            <Pressable
              onPress={() => void onMarkRecurring()}
              disabled={busy}
              className="mt-3.5 items-center rounded-[3px] border border-border px-4 py-3 active:opacity-70"
            >
              <Text className="font-semibold text-foreground">
                {txn.subscriptionId ? "Update recurring link" : "Mark as recurring"}
              </Text>
            </Pressable>
          )}
          {message ? <Text className="mt-2 text-[13px] text-muted">{message}</Text> : null}
        </ScrollView>
      </Container>

      {/* Pinned bottom bar — Split (deferred) + Edit/Save */}
      <BottomBar className="flex-row gap-3">
        {editing ? (
          <>
            <Button variant="outline" className="flex-1" onPress={() => setEditing(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!canSave} onPress={() => void onSave()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="flex-1" disabled>
              Split
            </Button>
            <Button className="flex-1" onPress={beginEdit}>
              Edit
            </Button>
          </>
        )}
      </BottomBar>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this transaction?"
        description={deleteDescription}
        busy={busy}
        onConfirm={() => void onDelete()}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-[14px] text-muted">{label}</Text>
      <Text
        className="ml-3 flex-1 text-right text-[14px] font-bold text-foreground"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function PickerChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? "rounded-[3px] border-[1.3px] border-foreground bg-foreground px-3 py-2"
          : "rounded-[3px] border-[1.3px] border-border px-3 py-2"
      }
    >
      <Text className={active ? "text-[12px] text-background" : "text-[12px] text-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}

function PickerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="caption" className="mb-1.5">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
        <View className="flex-row gap-2 px-1">{children}</View>
      </ScrollView>
    </View>
  );
}
