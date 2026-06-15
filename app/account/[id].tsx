import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { AccountFormSheet, type FormMode } from "@/components/accounts/account-form-sheet";
import { Container } from "@/components/container";
import { AppBar, Badge, ConfirmDialog, Segmented, Text, TxnRow } from "@/components/ui";
import { db } from "@/db/index";
import { appDb } from "@/db/app-db";
import {
  accountBalanceCollection,
  accountCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { deleteAccount } from "@/db/services/account-ops";
import { getMainAccountId, setMainAccount } from "@/db/services/app-settings";
import { kindMeta, rowToKind } from "@/lib/accounts/kinds";
import { relativeTime } from "@/lib/accounts/overview";
import { formatDisplay } from "@/lib/dates";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

const TABS = ["Activity", "Insights"];

export default function AccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: balances } = useLiveQuery((q) => q.from({ balance: accountBalanceCollection }));
  const { data: txns } = useLiveQuery((q) =>
    q.from({ txn: transactionCollection }).orderBy(({ txn }) => txn.dateTime, "desc"),
  );

  const [tab, setTab] = useState("Activity");
  const [menuOpen, setMenuOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [isMain, setIsMain] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(
    () =>
      Promise.all([accountCollection.utils.refetch(), accountBalanceCollection.utils.refetch()]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void getMainAccountId(appDb).then((mid) => setIsMain(mid === accountId));
    }, [refetch, accountId]),
  );

  const account = useMemo(
    () => (accounts ?? []).find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const latestReading = useMemo(() => {
    let latest: { balance: string; timestamp: string } | null = null;
    for (const b of balances ?? []) {
      if (b.accountId !== accountId) continue;
      if (!latest || b.timestamp > latest.timestamp) latest = b;
    }
    return latest;
  }, [balances, accountId]);

  const accountTxns = useMemo(
    () => (txns ?? []).filter((t) => t.accountId === accountId && !t.isDeleted),
    [txns, accountId],
  );

  if (!account) {
    return (
      <View className="flex-1 bg-background">
        <AppBar title="Account" onBack={() => router.back()} />
        <Container className="px-4">
          <Text variant="body">Account not found.</Text>
        </Container>
      </View>
    );
  }

  const kind = rowToKind(account);
  const meta = kindMeta(kind);
  const smsTracked = kind === "bank" || kind === "credit";
  const subWord = meta.hasSubtype ? (account.bankSubtype ?? meta.short) : meta.short;
  const caption =
    meta.hasLast4 && account.accountLast4 ? `${subWord} ••${account.accountLast4}` : subWord;

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(db, accountId);
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

  const onSetMain = () => {
    setMenuOpen(false);
    void (async () => {
      await setMainAccount(appDb, accountId);
      setIsMain(true);
    })();
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title={account.bankName}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Account menu"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="ellipsis-horizontal" size={18} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        <Text variant="caption" className="pt-2">
          {caption.toUpperCase()}
        </Text>
        <Text variant="display" className="pt-1">
          {latestReading ? money.format(latestReading.balance, account.currency) : "—"}
        </Text>

        <View className="flex-row items-center gap-2 pt-3">
          <Badge variant={smsTracked ? "accent" : "gray"}>
            {smsTracked ? "auto from SMS" : "manual"}
          </Badge>
          <Badge variant="gray">
            updated {relativeTime(latestReading?.timestamp ?? null, new Date())}
          </Badge>
          {isMain ? <Badge variant="default">★ main</Badge> : null}
        </View>

        <Segmented options={TABS} value={tab} onChange={setTab} className="mt-5" />

        {tab === "Activity" ? (
          <View className="pt-3">
            {accountTxns.length === 0 ? (
              <Text variant="body" className="pt-4">
                No transactions for this account yet.
              </Text>
            ) : (
              accountTxns.map((txn) => {
                const isIn = txn.transactionType === "INCOME" || txn.transactionType === "CREDIT";
                const formatted = money.format(txn.amount, txn.currency);
                return (
                  <TxnRow
                    key={txn.id}
                    merchant={txn.merchantName || "—"}
                    sub={`${formatDisplay(txn.dateTime, "d MMM")} · ${txn.categoryName ?? txn.transactionType.toLowerCase()}`}
                    amount={`${isIn ? "+" : "−"}${formatted}`}
                    direction={isIn ? "in" : "out"}
                  />
                );
              })
            )}
          </View>
        ) : (
          <View className="items-center pt-10">
            <Text variant="body">Insights are coming soon.</Text>
          </View>
        )}
      </Container>

      {/* … menu */}
      <BottomSheet isOpen={menuOpen} onOpenChange={(o) => !o && setMenuOpen(false)}>
        <BottomSheet.Portal>
          <SheetOverlay />
          <BottomSheet.Content>
            <BottomSheet.Title>{account.bankName}</BottomSheet.Title>
            <View className="gap-1 pt-2">
              <MenuRow
                icon="create-outline"
                label="Edit"
                onPress={() => {
                  setMenuOpen(false);
                  setFormMode({ type: "edit", account });
                }}
              />
              {!isMain ? (
                <MenuRow icon="star-outline" label="Set as main account" onPress={onSetMain} />
              ) : null}
              <MenuRow
                icon="trash-outline"
                label="Delete"
                destructive
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmOpen(true);
                }}
              />
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <AccountFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete account?"
        description={`“${account.bankName}” will be removed. Transactions are kept.`}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

function MenuRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[3px] px-2 py-3 active:opacity-70"
    >
      <StyledIonicons
        name={icon}
        size={20}
        className={destructive ? "text-danger" : "text-foreground"}
      />
      <Text className={destructive ? "text-[15px] text-danger" : "text-[15px] text-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}
