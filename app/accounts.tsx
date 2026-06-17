import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { AccountFormSheet, type FormMode } from "@/components/accounts/account-form-sheet";
import { Container } from "@/components/container";
import { AppBar, Badge, Card, SpriteIcon, Text } from "@/components/ui";
import { accountBalanceCollection, accountCollection } from "@/db/collections/finance";
import { smsReviewCollection } from "@/db/collections";
import type { Account } from "@/db/schema";
import { type AccountKind } from "@/db/services/account-ops";
import { KIND_META, kindMeta, rowToKind } from "@/lib/accounts/kinds";
import { lastParsedAt, relativeTime, reviewStatus } from "@/lib/accounts/overview";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

function latestBalanceByAccount(rows: { accountId: number; balance: string; timestamp: string }[]) {
  const latest = new Map<number, { balance: string; timestamp: string }>();
  for (const row of rows) {
    const prev = latest.get(row.accountId);
    if (!prev || row.timestamp > prev.timestamp) {
      latest.set(row.accountId, { balance: row.balance, timestamp: row.timestamp });
    }
  }
  return latest;
}

/** The secondary "savings ••4410" / "wallet" line for a row. */
function accountSubLabel(account: Account): string {
  const meta = kindMeta(rowToKind(account));
  const word = meta.hasSubtype ? (account.bankSubtype ?? meta.short) : meta.short;
  return meta.hasLast4 && account.accountLast4 ? `${word} ••${account.accountLast4}` : word;
}

export default function AccountsScreen() {
  const router = useRouter();

  const { data: accounts, isLoading } = useLiveQuery(
    (q) => q.from({ account: accountCollection }).orderBy(({ account }) => account.bankName, "asc"),
    [],
  );
  const { data: balances } = useLiveQuery((q) => q.from({ balance: accountBalanceCollection }), []);
  const { data: reviews } = useLiveQuery((q) => q.from({ review: smsReviewCollection }), []);

  const [picking, setPicking] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const refetch = useCallback(
    () =>
      Promise.all([accountCollection.utils.refetch(), accountBalanceCollection.utils.refetch()]),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const latest = useMemo(() => latestBalanceByAccount(balances ?? []), [balances]);
  const rows = accounts ?? [];

  const status = reviewStatus(reviews?.length ?? 0);
  const lastParsed = useMemo(
    () => lastParsedAt((balances ?? []).map((b) => b.timestamp)),
    [balances],
  );

  const onPick = (kind: AccountKind) => {
    setPicking(false);
    setFormMode({ type: "new", kind });
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Accounts"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityLabel="Add a source"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* Status row */}
        <View className="flex-row items-center justify-between py-3">
          <Text variant="caption">
            {rows.length} ACTIVE · LAST PARSED {relativeTime(lastParsed, new Date()).toUpperCase()}
          </Text>
          <Badge
            variant={status.ok ? "default" : "default"}
            className={status.ok ? "border-success" : "border-foreground"}
          >
            {status.label}
          </Badge>
        </View>

        {/* Accounts grouped card */}
        {isLoading ? (
          <Text variant="body">Loading…</Text>
        ) : rows.length > 0 ? (
          <Card variant="soft" className="gap-0 p-0">
            {rows.map((account, i) => {
              const reading = latest.get(account.id);
              const meta = kindMeta(rowToKind(account));
              return (
                <Pressable
                  key={account.id}
                  onPress={() => router.push(`/account/${account.id}`)}
                  className="active:opacity-70"
                >
                  {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
                  <View className="flex-row items-center gap-3 px-3.5 py-3.5">
                    <View className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground">
                      <SpriteIcon name={meta.icon} size={20} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text variant="heading" numberOfLines={1} className="text-[16px]">
                        {account.bankName}
                      </Text>
                      <Text variant="body" numberOfLines={1} className="text-[13px]">
                        {accountSubLabel(account)}
                      </Text>
                    </View>
                    <Text variant="balance" numberOfLines={1} className="text-[19px]">
                      {reading ? money.format(reading.balance, account.currency) : "—"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Text variant="body">No sources yet — add one below.</Text>
        )}

        {/* Add a source */}
        <Pressable
          onPress={() => setPicking(true)}
          className="mt-4 flex-row items-center gap-3 rounded-[3px] border border-dashed border-border p-4 active:opacity-70"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground">
            <StyledIonicons name="add" size={20} className="text-foreground" />
          </View>
          <View className="flex-1">
            <Text variant="heading" className="text-[16px]">
              Add a source
            </Text>
            <Text variant="body" className="text-[13px]">
              bank · PF · insurance · cash
            </Text>
          </View>
          <StyledIonicons name="chevron-forward" size={18} className="text-muted" />
        </Pressable>
      </Container>

      {/* Kind picker */}
      <BottomSheet isOpen={picking} onOpenChange={(o) => !o && setPicking(false)}>
        <BottomSheet.Portal>
          <SheetOverlay />
          <BottomSheet.Content>
            <BottomSheet.Title>Add a source</BottomSheet.Title>
            <View className="gap-2 pt-3">
              {KIND_META.map((meta) => (
                <Pressable
                  key={meta.kind}
                  disabled={!meta.enabled}
                  onPress={() => onPick(meta.kind)}
                  className={
                    meta.enabled
                      ? "flex-row items-center gap-3 rounded-[3px] border border-border p-3 active:opacity-70"
                      : "flex-row items-center gap-3 rounded-[3px] border border-border p-3 opacity-40"
                  }
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full border-[1.3px] border-foreground">
                    <SpriteIcon name={meta.icon} size={18} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text variant="heading" className="text-[15px]">
                      {meta.label}
                    </Text>
                    <Text variant="body" numberOfLines={1} className="text-[12px]">
                      {meta.description}
                    </Text>
                  </View>
                  {meta.enabled ? (
                    <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
                  ) : (
                    <Badge variant="gray">soon</Badge>
                  )}
                </Pressable>
              ))}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Create / edit form */}
      <AccountFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={() => void refetch()}
      />
    </View>
  );
}
