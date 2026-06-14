import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { Icon } from "@/components/icon";
import { AppBar } from "@/components/ui";
import { appDb } from "@/db/app-db";
import { db } from "@/db/index";
import { accountBalanceCollection, accountCollection } from "@/db/collections/finance";
import {
  type AccountKind,
  createAccount,
  deleteAccount,
  editAccount,
} from "@/db/services/account-ops";
import { getMainAccountId, setMainAccount } from "@/db/services/app-settings";
import * as money from "@/lib/money";

const KINDS: AccountKind[] = ["bank", "credit", "wallet"];

/**
 * Accounts list with inline Add / Edit / Delete (+ the existing "set as main").
 *
 * The list is a live query over accountCollection joined client-side with the
 * latest balance per account (account_balances). WRITES go through the services
 * layer (db/services/account-ops) — NOT the collection's optimistic path — so
 * the unique (bankName, last4) constraint and the main-account-pref cleanup
 * (ADR-0005) live in one place. After every write we refetch the accounts (and
 * balances) collections so the live query re-reads persisted rows, mirroring the
 * transactions.tsx refetch pattern. The app db (@/db) is passed to the services.
 *
 * The add/edit form is rendered inline (toggled by state) rather than a native
 * bottom-sheet to stay dependency-light and tsc-verifiable, mirroring the
 * transactions Add-sheet style.
 *
 * DEVICE-GATED QA (cannot run under vitest):
 *  - Add: open the form, enter bank name + last4 + currency, pick a kind; the
 *    credit-limit field only shows when kind=credit; Save adds the row.
 *  - Duplicate (bankName, last4) Save surfaces the rejection (Alert) and keeps
 *    the form open.
 *  - Edit: tap a row's "Edit", change fields, Save updates in place.
 *  - Delete: tap "Delete" → confirm dialog → row disappears; if it was the main
 *    account the ★ clears (main-account pref reset).
 *  - Set main: unchanged — tapping marks the chosen account.
 *  - NOTE: deleting an account that still has transactions currently fails (a
 *    pre-existing migration FK gap, see account-ops.test.ts); the Alert surfaces
 *    the error rather than silently swallowing it.
 */
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

interface FormState {
  bankName: string;
  accountLast4: string;
  currency: string;
  kind: AccountKind;
  creditLimit: string;
}

const EMPTY_FORM: FormState = {
  bankName: "",
  accountLast4: "",
  currency: "INR",
  kind: "bank",
  creditLimit: "",
};

export default function AccountsScreen() {
  const router = useRouter();
  // Sorted in the live query so ordering is maintained incrementally instead
  // of re-sorting on every render.
  const { data: accounts, isLoading } = useLiveQuery((q) =>
    q.from({ account: accountCollection }).orderBy(({ account }) => account.bankName, "asc"),
  );
  const { data: balances } = useLiveQuery((q) => q.from({ balance: accountBalanceCollection }));

  const mutedColor = useThemeColor("muted");

  const [mainAccountId, setMainAccountId] = useState<number | null>(null);

  // null = closed; "new" = add form; a number = editing that account id.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const refreshMain = useCallback(async () => {
    setMainAccountId(await getMainAccountId(appDb));
  }, []);

  useEffect(() => {
    void refreshMain();
  }, [refreshMain]);

  const onSetMain = useCallback(
    async (accountId: number) => {
      await setMainAccount(appDb, accountId);
      await refreshMain();
    },
    [refreshMain],
  );

  const refetchAll = useCallback(
    () =>
      Promise.all([accountCollection.utils.refetch(), accountBalanceCollection.utils.refetch()]),
    [],
  );

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditing("new");
  }, []);

  const openEdit = useCallback(
    (account: {
      id: number;
      bankName: string;
      accountLast4: string;
      currency: string;
      isWallet: boolean;
      isCreditCard: boolean;
      creditLimit: string | null;
    }) => {
      setForm({
        bankName: account.bankName,
        accountLast4: account.accountLast4,
        currency: account.currency,
        kind: account.isCreditCard ? "credit" : account.isWallet ? "wallet" : "bank",
        creditLimit: account.creditLimit ?? "",
      });
      setEditing(account.id);
    },
    [],
  );

  const closeForm = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
  }, []);

  const bankValid = form.bankName.trim().length > 0;
  const last4Valid = form.accountLast4.trim().length > 0;
  const currencyValid = form.currency.trim().length > 0;
  const canSubmit = bankValid && last4Valid && currencyValid && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit || editing === null) return;
    setSubmitting(true);
    try {
      const creditLimit =
        form.kind === "credit" && form.creditLimit.trim().length > 0
          ? form.creditLimit.trim()
          : null;

      if (editing === "new") {
        await createAccount(db, {
          bankName: form.bankName.trim(),
          accountLast4: form.accountLast4.trim(),
          currency: form.currency.trim().toUpperCase(),
          kind: form.kind,
          creditLimit,
        });
      } else {
        await editAccount(db, editing, {
          bankName: form.bankName.trim(),
          accountLast4: form.accountLast4.trim(),
          currency: form.currency.trim().toUpperCase(),
          // Only meaningful for credit accounts; cleared otherwise.
          creditLimit,
        });
      }
      await refetchAll();
      closeForm();
    } catch (e) {
      // The unique (bankName, last4) constraint (and any FK gap on delete-linked
      // rows) surfaces here — show it rather than silently failing.
      Alert.alert("Could not save account", String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, editing, form, refetchAll, closeForm]);

  const onDelete = useCallback(
    (accountId: number, bankName: string) => {
      Alert.alert(
        "Delete account?",
        `“${bankName}” will be removed. Linked balances are deleted; transactions are kept.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteAccount(db, accountId);
                  await Promise.all([refetchAll(), refreshMain()]);
                  if (editing === accountId) closeForm();
                } catch (e) {
                  Alert.alert(
                    "Could not delete account",
                    String(e instanceof Error ? e.message : e),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [refetchAll, refreshMain, editing, closeForm],
  );

  // account_balances grows with every transaction, so the latest-per-account
  // reduce must not run on every keystroke/render.
  const latest = useMemo(() => latestBalanceByAccount(balances ?? []), [balances]);
  const sorted = accounts ?? [];

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Accounts"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={editing === "new" ? closeForm : openAdd}
            className="rounded-xl bg-foreground px-4 py-2 active:opacity-70"
          >
            <Text className="text-background font-medium">
              {editing === "new" ? "Cancel" : "Add"}
            </Text>
          </Pressable>
        }
      />
      <Container className="px-4 pb-4">
        <Text className="text-muted text-sm mb-5">{sorted.length} accounts</Text>

        {editing !== null && (
          <View className="mb-6 rounded-xl border border-border p-4 gap-4">
            <Text className="text-foreground font-medium">
              {editing === "new" ? "New account" : "Edit account"}
            </Text>

            <View>
              <Text className="text-muted text-xs mb-1">Bank name</Text>
              <TextInput
                value={form.bankName}
                onChangeText={(v) => setForm((f) => ({ ...f, bankName: v }))}
                placeholder="e.g. HDFC"
                placeholderTextColor={mutedColor}
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">Last 4 digits</Text>
              <TextInput
                value={form.accountLast4}
                onChangeText={(v) => setForm((f) => ({ ...f, accountLast4: v }))}
                placeholder="1234"
                placeholderTextColor={mutedColor}
                keyboardType="number-pad"
                maxLength={4}
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">Currency</Text>
              <TextInput
                value={form.currency}
                onChangeText={(v) => setForm((f) => ({ ...f, currency: v }))}
                placeholder="INR"
                placeholderTextColor={mutedColor}
                autoCapitalize="characters"
                maxLength={3}
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-muted text-xs mb-2">Type</Text>
              <View className="flex-row flex-wrap gap-2">
                {KINDS.map((k) => {
                  const active = k === form.kind;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setForm((f) => ({ ...f, kind: k }))}
                      className={
                        active
                          ? "rounded-full bg-foreground px-3 py-2"
                          : "rounded-full border border-border px-3 py-2"
                      }
                    >
                      <Text
                        className={active ? "text-background text-xs" : "text-foreground text-xs"}
                      >
                        {k}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {form.kind === "credit" && (
              <View>
                <Text className="text-muted text-xs mb-1">Credit limit</Text>
                <TextInput
                  value={form.creditLimit}
                  onChangeText={(v) => setForm((f) => ({ ...f, creditLimit: v }))}
                  placeholder="0.00"
                  placeholderTextColor={mutedColor}
                  keyboardType="decimal-pad"
                  className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
                />
              </View>
            )}

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
                {submitting ? "Saving…" : editing === "new" ? "Add account" : "Save changes"}
              </Text>
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <Text className="text-muted text-sm">Loading…</Text>
        ) : sorted.length === 0 ? (
          <Text className="text-muted text-sm">No accounts yet — add one above.</Text>
        ) : (
          <View className="gap-2">
            {sorted.map((account) => {
              const reading = latest.get(account.id);
              const isMain = account.id === mainAccountId;
              return (
                <View key={account.id} className="rounded-xl border border-border p-3">
                  <View className="flex-row items-center">
                    <Icon
                      iconName={account.iconName}
                      color={account.color}
                      fallback={account.bankName}
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-foreground font-medium">{account.bankName}</Text>
                      <Text className="text-muted text-xs">
                        {account.accountLast4 ? `•••• ${account.accountLast4}` : account.currency}
                        {account.isCreditCard
                          ? " · credit"
                          : account.isWallet
                            ? " · wallet"
                            : " · bank"}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-foreground font-semibold">
                        {reading ? money.format(reading.balance, account.currency) : "—"}
                      </Text>
                      <Pressable
                        onPress={() => void onSetMain(account.id)}
                        className="mt-1 active:opacity-70"
                      >
                        <Text
                          className={
                            isMain ? "text-success text-xs font-medium" : "text-accent text-xs"
                          }
                        >
                          {isMain ? "★ Main" : "Set main"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View className="flex-row gap-4 mt-3 pl-1">
                    <Pressable onPress={() => openEdit(account)} className="active:opacity-70">
                      <Text className="text-accent text-xs">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(account.id, account.bankName)}
                      className="active:opacity-70"
                    >
                      <Text className="text-danger text-xs">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Container>
    </View>
  );
}
