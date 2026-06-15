import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list/react-native";
import { useLiveQuery } from "@tanstack/react-db";
import { format } from "date-fns";
import { router } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { TransactionFormSheet } from "@/components/transactions/transaction-form-sheet";
import {
  AppBar,
  CalendarScrubber,
  Card,
  Chip,
  ConfirmDialog,
  Field,
  IconButton,
  Tag,
  Text,
  TxnRow,
} from "@/components/ui";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { db } from "@/db/index";
import { softDeleteTransaction } from "@/db/services/transaction-ops";
import type { Transaction } from "@/db/schema";
import { useAccent } from "@/lib/appearance/use-accent";
import { formatDisplay, nowIso, parseIso, startOfPeriod, toIso } from "@/lib/dates";
import * as money from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-method";

const StyledIonicons = withUniwind(Ionicons);

// Semantic filter (mock model): All / Spends / Income, plus dynamic category
// "#hashtags". A category filter is keyed `cat:<id>`.
type FilterKey = "ALL" | "SPENDS" | "INCOME" | `cat:${number}`;
const SPEND_TYPES = new Set(["EXPENSE", "INVESTMENT"]);

// A flattened list item: a date-section header (string) or a transaction row.
type ListItem = string | Transaction;

// The black SPENT/RECEIVED summary bar (Card variant="inverted").
const SummaryBar = memo(function SummaryBar({
  monthLabel,
  spent,
  received,
}: {
  monthLabel: string;
  spent: string;
  received: string;
}) {
  // accent-foreground is ink (meant to sit ON the accent fill); on this black
  // card the received total must be the accent hue itself, applied at runtime.
  const accent = useAccent();
  return (
    <Card variant="inverted" className="mb-4 flex-row items-start justify-between px-4 py-3.5">
      <View>
        <Text className="text-[10px] font-bold uppercase tracking-[2px] text-muted">
          Spent · {monthLabel}
        </Text>
        <Text
          className="mt-1 text-[26px] font-extrabold text-background"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {spent}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-[10px] font-bold uppercase tracking-[2px] text-muted">Received</Text>
        <Text
          className="mt-1 text-[20px] font-extrabold"
          style={{ fontVariant: ["tabular-nums"], color: accent }}
        >
          +{received}
        </Text>
      </View>
    </Card>
  );
});

// Memoized so LegendList only re-renders rows whose props actually changed.
const Row = memo(function Row({
  txn,
  categoryName,
  selected,
  selectMode,
  onPress,
  onLongPress,
}: {
  txn: Transaction;
  categoryName: string;
  selected: boolean;
  selectMode: boolean;
  onPress: (txn: Transaction) => void;
  onLongPress: (txn: Transaction) => void;
}) {
  const isIn = txn.transactionType === "INCOME";
  const methodLabel = paymentMethodLabel(txn.paymentMethod);
  const sub = `${formatDisplay(txn.dateTime, "HH:mm")}${methodLabel ? ` · ${methodLabel}` : ""} · ${categoryName}`;
  const amount = `${isIn ? "+" : "−"}${money.format(txn.amount, txn.currency)}`;

  return (
    <Pressable
      onPress={() => onPress(txn)}
      onLongPress={() => onLongPress(txn)}
      className={selected ? "bg-surface-secondary" : undefined}
    >
      <TxnRow
        merchant={txn.merchantName || "—"}
        sub={sub}
        amount={amount}
        direction={isIn ? "in" : "out"}
        badge={
          selectMode ? (
            <View
              className={
                selected
                  ? "h-5 w-5 items-center justify-center rounded-full bg-foreground"
                  : "h-5 w-5 rounded-full border border-border"
              }
            >
              {selected && <Text className="text-[11px] text-background">✓</Text>}
            </View>
          ) : undefined
        }
      />
    </Pressable>
  );
});

/** Date-section header: "TODAY · 12 JUN" / "YESTERDAY · 11 JUN" / "SAT · 8 JUN". */
function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-[1.5px] text-muted">
      {label}
    </Text>
  );
}

function dayLabel(iso: string, todayKey: string, yesterdayKey: string): string {
  const key = iso.slice(0, 10);
  const date = formatDisplay(iso, "d MMM").toUpperCase();
  if (key === todayKey) return `TODAY · ${date}`;
  if (key === yesterdayKey) return `YESTERDAY · ${date}`;
  return formatDisplay(iso, "EEE · d MMM").toUpperCase();
}

/**
 * Transactions list (redesign) — AppBar + black month-summary bar, semantic +
 * #hashtag filter chips, date-grouped TxnRows, a floating + FAB that opens the
 * TransactionFormSheet, and an empty state. Bulk soft-delete (ADR-0008) is kept
 * behind long-press → select mode. The list is a live query (newest-first,
 * maintained incrementally by d2ts); grouping/filtering is client-side.
 */
export default function TransactionsScreen() {
  const { data: txns, isLoading } = useLiveQuery((q) =>
    q.from({ txn: transactionCollection }).orderBy(({ txn }) => txn.dateTime, "desc"),
  );
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: categories } = useLiveQuery((q) => q.from({ category: categoryCollection }));

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  // The day the calendar scrubber has selected; the list filters to it. Defaults
  // to today (parsed off the frozen wall-clock now, like the rest of the screen).
  const [selectedDay, setSelectedDay] = useState<Date>(() => parseIso(nowIso()));

  // Bulk-selection (ADR-0008 soft-delete).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  );
  const accountRowById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  // Current-month window for the #hashtag ranking (the chips stay month-scoped so
  // they remain useful even on a sparse day). Recomputed each render (not memoized
  // on mount) so it rolls over across a month boundary; thisMonth's memo keys on
  // the cheap string value, so an unchanged month still skips the filter.
  const monthStart = startOfPeriod(nowIso(), "MONTHLY");
  const thisMonth = useMemo(
    () => (txns ?? []).filter((t) => t.dateTime >= monthStart),
    [txns, monthStart],
  );

  // The selected day drives the list + summary. activeDays marks which days have
  // any transaction so the scrubber can dot them.
  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const activeDays = useMemo(
    () => new Set((txns ?? []).map((t) => t.dateTime.slice(0, 10))),
    [txns],
  );
  const dayTxns = useMemo(
    () => (txns ?? []).filter((t) => t.dateTime.slice(0, 10) === selectedKey),
    [txns, selectedKey],
  );

  const { spent, received } = useMemo(() => {
    let s = "0";
    let r = "0";
    for (const t of dayTxns) {
      if (t.transactionType === "INCOME") r = money.add(r, t.amount);
      else if (SPEND_TYPES.has(t.transactionType)) s = money.add(s, t.amount);
    }
    return { spent: money.format(s, "INR"), received: money.format(r, "INR") };
  }, [dayTxns]);

  const dayLabelText = format(selectedDay, "d MMM").toUpperCase();

  // Select a day, recording the direction so the list can slide in accordingly.
  const navDir = useRef(0);
  const handleSelect = useCallback((d: Date) => {
    setSelectedDay((prev) => {
      navDir.current = d >= prev ? 1 : -1;
      return d;
    });
  }, []);

  // Top categories this month → #hashtag chips (by row count, max 3). Skip any
  // whose name collides with a semantic chip (e.g. a category literally named
  // "Income") so the row never shows "Income" twice.
  const topCategories = useMemo(() => {
    const reserved = new Set(["all", "spends", "income"]);
    const counts = new Map<number, number>();
    for (const t of thisMonth) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, name: categoryById.get(id) ?? "—" }))
      .filter((c) => !reserved.has(c.name.trim().toLowerCase()))
      .slice(0, 3);
  }, [thisMonth, categoryById]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (txns ?? []).filter((t) => {
      if (t.dateTime.slice(0, 10) !== selectedKey) return false;
      if (filter === "SPENDS" && !SPEND_TYPES.has(t.transactionType)) return false;
      if (filter === "INCOME" && t.transactionType !== "INCOME") return false;
      if (filter.startsWith("cat:") && t.categoryId !== Number(filter.slice(4))) return false;
      if (!needle) return true;
      const merchantName = (t.merchantName ?? "").toLowerCase();
      const categoryName = (categoryById.get(t.categoryId) ?? "").toLowerCase();
      return merchantName.includes(needle) || categoryName.includes(needle);
    });
  }, [txns, search, filter, categoryById, selectedKey]);

  // Flatten filtered rows into [header, ...rows, header, ...rows] preserving the
  // query's dateTime-desc order, so LegendList keeps virtualizing.
  const items = useMemo<ListItem[]>(() => {
    const now = nowIso();
    const todayKey = now.slice(0, 10);
    const y = parseIso(now);
    y.setDate(y.getDate() - 1);
    const yesterdayKey = toIso(y).slice(0, 10);

    const out: ListItem[] = [];
    let lastKey = "";
    for (const t of filtered) {
      const key = t.dateTime.slice(0, 10);
      if (key !== lastKey) {
        out.push(dayLabel(t.dateTime, todayKey, yesterdayKey));
        lastKey = key;
      }
      out.push(t);
    }
    return out;
  }, [filtered]);

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

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const keyExtractor = useCallback(
    (item: ListItem) => (typeof item === "string" ? `h:${item}` : `t:${item.id}`),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (typeof item === "string") return <SectionHeader label={item} />;
      return (
        <Row
          txn={item}
          categoryName={categoryById.get(item.categoryId) ?? "—"}
          selected={selectedIds.has(item.id)}
          selectMode={selectMode}
          onPress={onRowPress}
          onLongPress={onRowLongPress}
        />
      );
    },
    [categoryById, selectedIds, selectMode, onRowPress, onRowLongPress],
  );

  const extraData = useMemo(
    () => [selectedIds, selectMode, categoryById],
    [selectedIds, selectMode, categoryById],
  );

  const onBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const rows = (txns ?? []).filter((t) => selectedIds.has(t.id));
      for (const t of rows) {
        if (t.accountId === null) continue;
        const owner = accountRowById.get(t.accountId);
        await softDeleteTransaction(db, t.id, t.accountId, owner?.isCreditCard ?? false);
      }
      await Promise.all([
        transactionCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
      ]);
      exitSelect();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, txns, accountRowById, exitSelect]);

  const filtersActive = filter !== "ALL" || search.trim().length > 0;

  const header = (
    <View>
      <Text className="mb-4 text-[13px] text-muted">
        {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
      </Text>

      <SummaryBar monthLabel={dayLabelText} spent={spent} received={received} />

      {searchOpen && (
        <View className="mb-3">
          <Field
            label=""
            value={search}
            onChangeText={setSearch}
            placeholder="Search merchant or category"
            autoFocus
          />
        </View>
      )}

      <View className="mb-1 flex-row flex-wrap gap-2">
        <Chip variant={filter === "ALL" ? "on" : "default"} onPress={() => setFilter("ALL")}>
          All
        </Chip>
        <Chip variant={filter === "SPENDS" ? "on" : "default"} onPress={() => setFilter("SPENDS")}>
          Spends
        </Chip>
        <Chip variant={filter === "INCOME" ? "on" : "default"} onPress={() => setFilter("INCOME")}>
          Income
        </Chip>
        {topCategories.map((c) => {
          const key: FilterKey = `cat:${c.id}`;
          return (
            <Pressable key={c.id} onPress={() => setFilter(filter === key ? "ALL" : key)}>
              <Tag variant={filter === key ? "on" : "default"}>{c.name}</Tag>
            </Pressable>
          );
        })}
      </View>

      {selectMode && (
        <View className="mb-2 mt-3 flex-row items-center justify-between">
          <Text className="text-[13px] text-muted">{selectedIds.size} selected</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setConfirmOpen(true)}
              disabled={selectedIds.size === 0 || deleting}
              className={
                selectedIds.size === 0 || deleting
                  ? "rounded-[3px] bg-surface-secondary px-3 py-1.5"
                  : "rounded-[3px] bg-danger px-3 py-1.5 active:opacity-70"
              }
            >
              <Text
                className={
                  selectedIds.size === 0 || deleting
                    ? "text-[13px] font-semibold text-muted"
                    : "text-[13px] font-semibold text-danger-foreground"
                }
              >
                {deleting ? "Deleting…" : `Delete (${selectedIds.size})`}
              </Text>
            </Pressable>
            <Pressable
              onPress={exitSelect}
              className="rounded-[3px] border border-border px-3 py-1.5"
            >
              <Text className="text-[13px] font-semibold text-foreground">Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const empty = isLoading ? (
    <Text className="text-[13px] text-muted">Loading…</Text>
  ) : filtersActive ? (
    <Text className="text-[13px] text-muted">No transactions match your filters.</Text>
  ) : activeDays.size === 0 ? (
    <EmptyState onAddManually={() => setFormOpen(true)} />
  ) : (
    <Text className="text-[13px] text-muted">
      Nothing on {format(selectedDay, "EEE, d MMM")}. Pick another day above.
    </Text>
  );

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Transactions"
        right={
          <>
            <IconButton
              name="search"
              label="Search"
              active={searchOpen}
              onPress={() => {
                setSearchOpen((o) => !o);
                if (searchOpen) setSearch("");
              }}
            />
            <IconButton
              name="funnel-outline"
              label="Filter"
              active={filter !== "ALL"}
              onPress={() => setFilter("ALL")}
            />
          </>
        }
      />

      {/* The calendar wraps the list so the month grid expands over it. Summary +
          filters stay fixed and reflect the selected day. */}
      <CalendarScrubber selected={selectedDay} onSelect={handleSelect} activeDays={activeDays}>
        <View className="px-5 pt-3">{header}</View>
        {/* The rows slide in (direction follows the day change) on every selection. */}
        <Animated.View
          key={selectedKey}
          entering={(navDir.current >= 0 ? SlideInRight : SlideInLeft).duration(200)}
          className="flex-1"
        >
          <LegendList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            extraData={extraData}
            recycleItems
            estimatedItemSize={64}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
            ListEmptyComponent={empty}
          />
        </Animated.View>
      </CalendarScrubber>

      {/* Floating + FAB → add-transaction sheet */}
      <Pressable
        onPress={() => setFormOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-foreground active:opacity-80"
        style={{ elevation: 4 }}
      >
        <StyledIonicons name="add" size={28} className="text-background" />
      </Pressable>

      <TransactionFormSheet isOpen={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selectedIds.size} transaction${selectedIds.size === 1 ? "" : "s"}?`}
        description="They stay out of your totals — you can re-import from SMS later."
        confirmLabel={`Delete (${selectedIds.size})`}
        busy={deleting}
        onConfirm={() => void onBulkDelete()}
      />
    </View>
  );
}

/** Empty state (mock): hatched illustration placeholder + two CTAs. */
function EmptyState({ onAddManually }: { onAddManually: () => void }) {
  return (
    <View className="pt-2">
      <Card variant="soft" className="items-center gap-3 py-8">
        <View className="h-16 w-24 items-center justify-center rounded-[3px] border border-border bg-surface-secondary">
          <StyledIonicons name="wallet-outline" size={28} className="text-muted" />
        </View>
        <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-muted">
          Illustration
        </Text>
      </Card>

      <Text className="mt-6 text-center text-[22px] font-extrabold tracking-tight text-foreground">
        Nothing logged yet
      </Text>
      <Text className="mt-1.5 text-center text-[13px] leading-5 text-muted">
        Connect a bank and unmiser will fill this in from your SMS — or add one by hand.
      </Text>

      <Pressable
        onPress={() => router.push("/accounts")}
        className="mt-6 items-center rounded-[3px] bg-foreground px-4 py-3.5 active:opacity-80"
      >
        <Text className="font-semibold text-background">Connect a bank</Text>
      </Pressable>
      <Pressable
        onPress={onAddManually}
        className="mt-2.5 items-center rounded-[3px] border-[1.5px] border-foreground px-4 py-3.5 active:opacity-70"
      >
        <Text className="font-semibold text-foreground">Add manually</Text>
      </Pressable>
    </View>
  );
}
