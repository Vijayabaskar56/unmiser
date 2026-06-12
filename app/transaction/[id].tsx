import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "drizzle-orm";
import { router, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
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

const TXN_TYPES: TxnType[] = ["EXPENSE", "INCOME", "INVESTMENT", "CREDIT", "TRANSFER"];

/**
 * Transaction detail + inline edit/delete (modal route).
 *
 * Reads the row from the live transactions collection (filtered to non-deleted),
 * snapshotting it into local state on first load so the screen keeps rendering
 * after a soft-delete removes it from the collection — that snapshot powers the
 * Undo affordance.
 *
 * WRITES go through the services layer (editTransaction / softDeleteTransaction /
 * undoDelete), never the collection's optimistic path, so the balance cascade
 * stays single-sourced. accountId is read off the transaction row (ADR-0006);
 * isCreditCard is looked up from the owning account. After every write we refetch
 * the transactions AND account-balances collections so the list + Accounts screen
 * reflect the change.
 *
 * DEVICE-GATED QA (cannot run under vitest):
 *  - Open a row -> all fields shown; Edit toggles inline fields; Save persists and
 *    the list row updates (amount/merchant/category/type/date).
 *  - Delete removes the row from the list and shows an Undo banner; Undo restores
 *    it and its balance delta.
 *  - dateTime is edited as a raw ISO string ("yyyy-MM-ddTHH:mm:ss"); a proper
 *    date picker is a later presentation change.
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

  // Snapshot the row so the screen survives the soft-delete (which drops it from
  // the live collection) and can still offer Undo.
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

  // Edit-form state, seeded from the row when entering edit mode.
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
      <Container className="px-4 pt-6 pb-4">
        <Text className="text-muted text-sm">Transaction not found.</Text>
      </Container>
    );
  }

  const account = txn.accountId !== null ? (accountById.get(txn.accountId) ?? null) : null;
  const isCredit = txn.transactionType === "INCOME";

  if (deleted) {
    return (
      <Container className="px-4 pt-6 pb-4">
        <Text className="text-3xl font-semibold text-foreground tracking-tight mb-2">Deleted</Text>
        <Text className="text-muted text-sm mb-6">This transaction was deleted.</Text>
        <Pressable
          onPress={() => void onUndo()}
          disabled={busy}
          className="rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70 mb-3"
        >
          <Text className="text-background font-medium">{busy ? "…" : "Undo delete"}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="rounded-xl border border-border px-4 py-3 items-center active:opacity-70"
        >
          <Text className="text-foreground font-medium">Close</Text>
        </Pressable>
      </Container>
    );
  }

  return (
    <Container className="px-4 pt-6 pb-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text
          className={
            isCredit
              ? "text-success text-3xl font-semibold tracking-tight"
              : "text-foreground text-3xl font-semibold tracking-tight"
          }
        >
          {isCredit ? "+" : "-"}
          {money.format(txn.amount, txn.currency)}
        </Text>
        {!editing && (
          <Pressable
            onPress={beginEdit}
            className="rounded-xl border border-border px-4 py-2 active:opacity-70"
          >
            <Text className="text-foreground font-medium">Edit</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View className="gap-4">
          <View>
            <Text className="text-muted text-xs mb-1">Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={mutedColor}
              keyboardType="decimal-pad"
              className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="text-muted text-xs mb-1">Merchant</Text>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Optional"
              placeholderTextColor={mutedColor}
              className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <View>
            <Text className="text-muted text-xs mb-2">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              <View className="flex-row gap-2 px-1">
                {categoryList.map((c) => {
                  const active = c.id === categoryId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => onSelectCategory(c.id)}
                      className={
                        active
                          ? "rounded-full bg-foreground px-3 py-2"
                          : "rounded-full border border-border px-3 py-2"
                      }
                    >
                      <Text
                        className={active ? "text-background text-xs" : "text-foreground text-xs"}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {categoryId !== null && subcategoryList.length > 0 && (
            <View>
              <Text className="text-muted text-xs mb-2">Subcategory</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                <View className="flex-row gap-2 px-1">
                  {subcategoryList.map((s) => {
                    const active = s.id === subcategoryId;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setSubcategoryId(active ? null : s.id)}
                        className={
                          active
                            ? "rounded-full bg-foreground px-3 py-2"
                            : "rounded-full border border-border px-3 py-2"
                        }
                      >
                        <Text
                          className={active ? "text-background text-xs" : "text-foreground text-xs"}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          <View>
            <Text className="text-muted text-xs mb-2">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {TXN_TYPES.map((t) => {
                const active = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    className={
                      active
                        ? "rounded-full bg-foreground px-3 py-2"
                        : "rounded-full border border-border px-3 py-2"
                    }
                  >
                    <Text
                      className={active ? "text-background text-xs" : "text-foreground text-xs"}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-muted text-xs mb-1">Date/time (ISO)</Text>
            <TextInput
              value={dateTime}
              onChangeText={setDateTime}
              placeholder={nowIso()}
              placeholderTextColor={mutedColor}
              autoCapitalize="none"
              className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <Pressable
            onPress={() => void onSave()}
            disabled={!canSave}
            className={
              canSave
                ? "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
                : "rounded-xl bg-secondary px-4 py-3 items-center"
            }
          >
            <Text className={canSave ? "text-background font-medium" : "text-muted font-medium"}>
              {busy ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setEditing(false)}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-foreground font-medium">Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-3">
          <DetailRow label="Merchant" value={txn.merchantName || "—"} />
          <DetailRow label="Category" value={categoryById.get(txn.categoryId) ?? "—"} />
          <DetailRow
            label="Subcategory"
            value={
              txn.subcategoryId !== null ? (subcategoryById.get(txn.subcategoryId) ?? "—") : "—"
            }
          />
          <DetailRow label="Account" value={account ? account.bankName : "—"} />
          <DetailRow label="Type" value={txn.transactionType} />
          <DetailRow label="Date" value={formatDisplay(txn.dateTime, "MMM d, yyyy · HH:mm")} />
          <DetailRow label="Currency" value={txn.currency} />
          {txn.description ? <DetailRow label="Note" value={txn.description} /> : null}
          {txn.subscriptionId ? (
            <DetailRow label="Subscription" value={`#${txn.subscriptionId}`} />
          ) : null}
          {message ? <Text className="text-muted text-sm">{message}</Text> : null}

          <Pressable
            onPress={() => void onMarkRecurring()}
            disabled={busy}
            className="mt-2 rounded-xl border border-border px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-foreground font-medium">
              {txn.subscriptionId ? "Update recurring link" : "Mark as recurring"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void onDelete()}
            disabled={busy}
            className="mt-4 rounded-xl border border-danger px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-danger font-medium">{busy ? "…" : "Delete transaction"}</Text>
          </Pressable>
        </View>
      )}
    </Container>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-border p-3">
      <Text className="text-muted text-sm">{label}</Text>
      <Text className="text-foreground font-medium flex-1 text-right ml-3" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
