import { LegendList } from "@legendapp/list/react-native";
import { useLiveQuery } from "@tanstack/react-db";
import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  subcategoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { appDb } from "@/db/app-db";
import { db } from "@/db/index";
import { getMainAccountId } from "@/db/services/app-settings";
import { addTransaction, softDeleteTransaction, transfer } from "@/db/services/transaction-ops";
import type { Transaction } from "@/db/schema";
import type { TxnType } from "@/lib/balance-service";
import { formatDisplay, nowIso } from "@/lib/dates";
import * as money from "@/lib/money";

const TXN_TYPES: TxnType[] = ["EXPENSE", "INCOME", "INVESTMENT", "CREDIT", "TRANSFER"];

// Memoized so LegendList only re-renders rows whose props actually changed
// (selection toggles, name-map updates) instead of every visible row per render.
const TransactionRow = memo(function TransactionRow({
  txn,
  categoryName,
  accountName,
  selected,
  selectMode,
  onPress,
  onLongPress,
}: {
  txn: Transaction;
  categoryName: string;
  accountName: string;
  selected: boolean;
  selectMode: boolean;
  onPress: (txn: Transaction) => void;
  onLongPress: (txn: Transaction) => void;
}) {
  const isCredit = txn.transactionType === "INCOME";
  return (
    <Pressable
      onPress={() => onPress(txn)}
      onLongPress={() => onLongPress(txn)}
      className={
        selected
          ? "mb-2 flex-row items-center justify-between rounded-xl border border-foreground bg-secondary p-3 active:opacity-70"
          : "mb-2 flex-row items-center justify-between rounded-xl border border-border p-3 active:opacity-70"
      }
    >
      {selectMode && (
        <View
          className={
            selected
              ? "mr-3 h-5 w-5 rounded-full bg-foreground items-center justify-center"
              : "mr-3 h-5 w-5 rounded-full border border-border"
          }
        >
          {selected && <Text className="text-background text-xs">✓</Text>}
        </View>
      )}
      <View className="flex-1 pr-3">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {txn.merchantName || "—"}
        </Text>
        <Text className="text-muted text-xs" numberOfLines={1}>
          {categoryName} · {accountName}
        </Text>
        <Text className="text-muted text-xs">
          {txn.transactionType} · {formatDisplay(txn.dateTime)}
        </Text>
      </View>
      <Text className={isCredit ? "text-success font-semibold" : "text-foreground font-semibold"}>
        {isCredit ? "+" : "-"}
        {money.format(txn.amount, txn.currency)}
      </Text>
    </Pressable>
  );
});

/**
 * Transactions list + an inline Add-Transaction sheet.
 *
 * The list is a live query over the (non-deleted) transactions collection,
 * rendered with money.format and a friendly date. Adding goes through the
 * services layer — addTransaction(db, ...) runs dedup + the balance cascade —
 * NOT the collection's optimistic path, so balance math stays single-sourced.
 * After a successful add we refetch the transactions AND account-balances
 * collections so both the list here and the Accounts screen reflect the write.
 *
 * The add form is rendered inline (toggled by state) rather than a native
 * bottom-sheet to stay dependency-light and tsc-verifiable; swapping it for
 * heroui-native BottomSheet is a pure presentation change later.
 *
 * DEVICE-GATED QA (cannot run under vitest / no visual check here):
 *  - Picker chips: account defaults to the main account; verify selection + the
 *    keyboard-driven amount entry on a device.
 *  - Submit with empty/invalid amount or no category is blocked (button disabled).
 *  - After submit the new row appears and the form resets/closes.
 */
export default function TransactionsScreen() {
  // Newest-first ordering lives in the live query so it is maintained
  // incrementally (d2ts) instead of re-sorting the full array per render.
  const { data: txns, isLoading } = useLiveQuery((q) =>
    q.from({ txn: transactionCollection }).orderBy(({ txn }) => txn.dateTime, "desc"),
  );
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));
  const { data: subcategories } = useLiveQuery((q) =>
    q.from({ subcategory: subcategoryCollection }),
  );

  const mutedColor = useThemeColor("muted");

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [type, setType] = useState<TxnType>("EXPENSE");
  const [submitting, setSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // List search + type-filter (combined, client-side over the live query).
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<TxnType | "ALL">("ALL");

  // Bulk-selection mode (ADR-0008 soft-delete). When active, row taps toggle a
  // selection checkmark instead of navigating to the detail screen.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Name-lookup maps for enriching list rows (category + account names).
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  );
  const accountById = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a.bankName])),
    [accounts],
  );
  // Full-account lookup so bulk-delete can derive isCreditCard from the owning
  // account (softDeleteTransaction needs accountId + isCreditCard to re-cascade).
  const accountRowById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  // Subcategories for the currently-selected category (picker only shows after a
  // category is chosen). Filtered client-side off the live subcategories query.
  const subcategoryList = useMemo(
    () =>
      categoryId === null
        ? []
        : [...(subcategories ?? [])]
            .filter((s) => s.categoryId === categoryId)
            .sort((a, b) => a.name.localeCompare(b.name)),
    [subcategories, categoryId],
  );

  const accountList = useMemo(
    () => [...(accounts ?? [])].sort((a, b) => a.bankName.localeCompare(b.bankName)),
    [accounts],
  );
  const categoryList = useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [categories],
  );

  // Default the account picker to the main account (ADR-0005) once accounts load.
  useEffect(() => {
    if (accountId !== null || accountList.length === 0) return;
    void (async () => {
      const mainId = await getMainAccountId(appDb);
      const exists = mainId !== null && accountList.some((a) => a.id === mainId);
      setAccountId(exists ? mainId : accountList[0].id);
    })();
  }, [accountId, accountList]);

  const selectedAccount = accountList.find((a) => a.id === accountId) ?? null;
  const selectedToAccount = accountList.find((a) => a.id === toAccountId) ?? null;
  const isTransfer = type === "TRANSFER";

  const amountValid = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return false;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
    return money.compare(trimmed, "0") > 0;
  })();

  // For TRANSFER the destination must be a distinct account; the transfer()
  // service rejects cross-currency, so we also gate on matching currencies here
  // (Save disabled) and surface the thrown message inline on a failed attempt.
  const transferSameAccount =
    isTransfer &&
    selectedAccount !== null &&
    selectedToAccount !== null &&
    accountId === toAccountId;
  const transferCrossCurrency =
    isTransfer &&
    selectedAccount !== null &&
    selectedToAccount !== null &&
    selectedAccount.currency !== selectedToAccount.currency;
  const transferValid =
    !isTransfer || (selectedToAccount !== null && !transferSameAccount && !transferCrossCurrency);

  const canSubmit =
    amountValid && accountId !== null && categoryId !== null && transferValid && !submitting;

  const resetForm = useCallback(() => {
    setAmount("");
    setMerchant("");
    setCategoryId(null);
    setSubcategoryId(null);
    setType("EXPENSE");
    setToAccountId(null);
    setTransferError(null);
  }, []);

  // Picking a (different) category clears any subcategory selection so we never
  // submit a subcategory that belongs to another category.
  const onSelectCategory = useCallback((id: number) => {
    setCategoryId((prev) => {
      if (prev !== id) setSubcategoryId(null);
      return id;
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!selectedAccount || categoryId === null || !amountValid) return;
    setSubmitting(true);
    setTransferError(null);
    try {
      // Called directly on the expo db (not wrapped in db.transaction): the
      // expo-sqlite drizzle driver is typed sync and rejects async transaction
      // callbacks. Both services are await-style and driver-agnostic; they
      // synthesize the dedup hash and run the balance cascade internally.
      if (type === "TRANSFER") {
        if (!selectedToAccount || accountId === toAccountId) return;
        // transfer() throws on cross-currency — surface inline, leave form open.
        await transfer(db, {
          fromAccount: {
            id: selectedAccount.id,
            currency: selectedAccount.currency,
            isCreditCard: selectedAccount.isCreditCard,
          },
          toAccount: {
            id: selectedToAccount.id,
            currency: selectedToAccount.currency,
            isCreditCard: selectedToAccount.isCreditCard,
          },
          amount: money.normalize2dp(amount.trim()),
          categoryId,
          dateTime: nowIso(),
          merchantName: merchant.trim(),
        });
      } else {
        await addTransaction(db, {
          accountId: selectedAccount.id,
          amount: money.normalize2dp(amount.trim()),
          merchantName: merchant.trim(),
          categoryId,
          subcategoryId,
          transactionType: type,
          dateTime: nowIso(),
          isCreditCard: selectedAccount.isCreditCard,
          currency: selectedAccount.currency,
        });
      }
      await Promise.all([
        transactionCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
      ]);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedAccount,
    selectedToAccount,
    accountId,
    toAccountId,
    categoryId,
    subcategoryId,
    amountValid,
    amount,
    merchant,
    type,
    resetForm,
  ]);

  // Search (merchant + category name, case-insensitive substring) combined with
  // the type filter. Order is preserved from the query's dateTime desc.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (txns ?? []).filter((t) => {
      if (filterType !== "ALL" && t.transactionType !== filterType) return false;
      if (!needle) return true;
      const merchantName = (t.merchantName ?? "").toLowerCase();
      const categoryName = (categoryById.get(t.categoryId) ?? "").toLowerCase();
      return merchantName.includes(needle) || categoryName.includes(needle);
    });
  }, [txns, search, filterType, categoryById]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  }, []);

  const toggleRow = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onRowPress = useCallback(
    (txn: Transaction) => {
      if (selectMode) toggleRow(txn.id);
      else router.push({ pathname: "/transaction/[id]", params: { id: txn.id } });
    },
    [selectMode, toggleRow],
  );

  const onRowLongPress = useCallback(
    (txn: Transaction) => {
      if (!selectMode) setSelectMode(true);
      toggleRow(txn.id);
    },
    [selectMode, toggleRow],
  );

  const keyExtractor = useCallback((item: Transaction) => String(item.id), []);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow
        txn={item}
        categoryName={categoryById.get(item.categoryId) ?? "—"}
        accountName={item.accountId !== null ? (accountById.get(item.accountId) ?? "—") : "—"}
        selected={selectedIds.has(item.id)}
        selectMode={selectMode}
        onPress={onRowPress}
        onLongPress={onRowLongPress}
      />
    ),
    [categoryById, accountById, selectedIds, selectMode, onRowPress, onRowLongPress],
  );

  // LegendList re-renders visible rows when extraData changes identity; memoized
  // so unrelated state (form fields, search text) doesn't churn the rows.
  const extraData = useMemo(
    () => [selectedIds, selectMode, categoryById, accountById],
    [selectedIds, selectMode, categoryById, accountById],
  );

  const onBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const rows = (txns ?? []).filter((t) => selectedIds.has(t.id));
      for (const t of rows) {
        if (t.accountId === null) continue; // no owning account to re-cascade
        const owner = accountRowById.get(t.accountId);
        await softDeleteTransaction(db, t.id, t.accountId, owner?.isCreditCard ?? false);
      }
      await Promise.all([
        transactionCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
      ]);
      setSelectedIds(new Set());
      setSelectMode(false);
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, txns, accountRowById]);

  return (
    <Container isScrollable={false} className="pt-6">
      <LegendList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={extraData}
        recycleItems
        estimatedItemSize={88}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListEmptyComponent={
          isLoading ? (
            <Text className="text-muted text-sm">Loading…</Text>
          ) : (
            <Text className="text-muted text-sm">
              {search.trim() || filterType !== "ALL"
                ? "No transactions match your filters."
                : "No transactions yet — add one above."}
            </Text>
          )
        }
        ListHeaderComponent={
          <View>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-3xl font-semibold text-foreground tracking-tight">
                Transactions
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={toggleSelectMode}
                  className={
                    selectMode
                      ? "rounded-xl border border-border px-3 py-2 active:opacity-70"
                      : "rounded-xl border border-border px-3 py-2 active:opacity-70"
                  }
                >
                  <Text className="text-foreground font-medium">
                    {selectMode ? "Done" : "Select"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowForm((s) => !s)}
                  className="rounded-xl bg-foreground px-4 py-2 active:opacity-70"
                >
                  <Text className="text-background font-medium">{showForm ? "Cancel" : "Add"}</Text>
                </Pressable>
              </View>
            </View>
            <Text className="text-muted text-sm mb-5">{filtered.length} transactions</Text>

            {showForm && (
              <View className="mb-6 rounded-xl border border-border p-4 gap-4">
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
                  <Text className="text-muted text-xs mb-2">Account</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                    <View className="flex-row gap-2 px-1">
                      {accountList.map((a) => {
                        const active = a.id === accountId;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => setAccountId(a.id)}
                            className={
                              active
                                ? "rounded-full bg-foreground px-3 py-2"
                                : "rounded-full border border-border px-3 py-2"
                            }
                          >
                            <Text
                              className={
                                active ? "text-background text-xs" : "text-foreground text-xs"
                              }
                            >
                              {a.bankName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {isTransfer && (
                  <View>
                    <Text className="text-muted text-xs mb-2">To account</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                      <View className="flex-row gap-2 px-1">
                        {accountList
                          .filter((a) => a.id !== accountId)
                          .map((a) => {
                            const active = a.id === toAccountId;
                            return (
                              <Pressable
                                key={a.id}
                                onPress={() => {
                                  setToAccountId(a.id);
                                  setTransferError(null);
                                }}
                                className={
                                  active
                                    ? "rounded-full bg-foreground px-3 py-2"
                                    : "rounded-full border border-border px-3 py-2"
                                }
                              >
                                <Text
                                  className={
                                    active ? "text-background text-xs" : "text-foreground text-xs"
                                  }
                                >
                                  {a.bankName}
                                </Text>
                              </Pressable>
                            );
                          })}
                      </View>
                    </ScrollView>
                    {transferCrossCurrency && (
                      <Text className="text-danger text-xs mt-2">
                        Cross-currency transfers aren’t supported yet ({selectedAccount?.currency} →{" "}
                        {selectedToAccount?.currency}).
                      </Text>
                    )}
                    {transferError && (
                      <Text className="text-danger text-xs mt-2">{transferError}</Text>
                    )}
                  </View>
                )}

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
                              className={
                                active ? "text-background text-xs" : "text-foreground text-xs"
                              }
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
                                className={
                                  active ? "text-background text-xs" : "text-foreground text-xs"
                                }
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
                          onPress={() => {
                            setType(t);
                            setTransferError(null);
                            if (t !== "TRANSFER") setToAccountId(null);
                          }}
                          className={
                            active
                              ? "rounded-full bg-foreground px-3 py-2"
                              : "rounded-full border border-border px-3 py-2"
                          }
                        >
                          <Text
                            className={
                              active ? "text-background text-xs" : "text-foreground text-xs"
                            }
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={!canSubmit}
                  className={
                    canSubmit
                      ? "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
                      : "rounded-xl bg-secondary px-4 py-3 items-center"
                  }
                >
                  <Text
                    className={canSubmit ? "text-background font-medium" : "text-muted font-medium"}
                  >
                    {submitting ? "Saving…" : "Save transaction"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View className="mb-3">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search merchant or category"
                placeholderTextColor={mutedColor}
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {(["ALL", ...TXN_TYPES] as const).map((t) => {
                const active = t === filterType;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setFilterType(t)}
                    className={
                      active
                        ? "rounded-full bg-foreground px-3 py-2"
                        : "rounded-full border border-border px-3 py-2"
                    }
                  >
                    <Text
                      className={active ? "text-background text-xs" : "text-foreground text-xs"}
                    >
                      {t === "ALL" ? "All" : t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectMode && (
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-muted text-sm">{selectedIds.size} selected</Text>
                <Pressable
                  onPress={() => void onBulkDelete()}
                  disabled={selectedIds.size === 0 || deleting}
                  className={
                    selectedIds.size === 0 || deleting
                      ? "rounded-xl bg-secondary px-4 py-2"
                      : "rounded-xl bg-danger px-4 py-2 active:opacity-70"
                  }
                >
                  <Text
                    className={
                      selectedIds.size === 0 || deleting
                        ? "text-muted font-medium"
                        : "text-danger-foreground font-medium"
                    }
                  >
                    {deleting ? "Deleting…" : `Delete (${selectedIds.size})`}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        }
      />
    </Container>
  );
}
