import { useLiveQuery } from "@tanstack/react-db";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { Container } from "@/components/container";
import { accountCollection } from "@/db/collections";

/**
 * Wizard step 3 of 5: OPTIONAL account enrichment. Accounts are auto-created
 * from confident parses (ADR-0006), so this step never gates the wizard — it
 * only collects a friendlier display name for accounts that already exist.
 */
export default function SmsSetupAccountScreen() {
  const mutedColor = useThemeColor("muted");
  const { data: accounts } = useLiveQuery((q) =>
    q.from({ account: accountCollection }).orderBy(({ account }) => account.bankName, "asc"),
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const rows = accounts ?? [];

  const onSaveName = (accountId: number) => {
    const name = (drafts[accountId] ?? "").trim();
    if (name.length === 0) return;
    accountCollection.update(accountId, (draft) => {
      draft.bankName = name;
    });
  };

  return (
    <Container isScrollable={false} className="px-4 pt-14">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-16"
      >
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-muted text-xs">Step 3 of 5 · optional</Text>
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Name your accounts
            </Text>
            <Text className="text-muted text-sm">
              Unmiser creates accounts automatically from your bank SMS — you don't have to add
              anything here. If accounts already exist, you can give them friendlier names.
            </Text>
          </View>

          {rows.length === 0 ? (
            <View className="rounded-xl border border-border p-4">
              <Text className="text-muted text-sm">
                No accounts yet. They'll appear automatically once your SMS are scanned — you can
                rename them later from the Accounts tab.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {rows.map((account) => (
                <View key={account.id} className="rounded-xl border border-border p-4 gap-2">
                  <Text className="text-foreground font-medium">
                    {account.bankName} · {account.accountLast4}
                  </Text>
                  <View className="flex-row gap-2">
                    <TextInput
                      value={drafts[account.id] ?? ""}
                      onChangeText={(text) =>
                        setDrafts((current) => ({ ...current, [account.id]: text }))
                      }
                      placeholder="Display name"
                      placeholderTextColor={mutedColor}
                      className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2 text-foreground"
                    />
                    <Pressable
                      onPress={() => onSaveName(account.id)}
                      className="rounded-xl bg-foreground px-4 py-2 items-center justify-center active:opacity-70"
                    >
                      <Text className="text-background text-xs font-medium">Save</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => router.push("/sms-setup/permissions")}
            className="rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-background font-medium">Continue</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/sms-setup/permissions")}
            className="items-center py-2"
          >
            <Text className="text-muted text-sm underline">Skip this step</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
