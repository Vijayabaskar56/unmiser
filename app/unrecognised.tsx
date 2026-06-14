import { useLiveQuery } from "@tanstack/react-db";
import { useFocusEffect, useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Container } from "@/components/container";
import { AppBar, Badge, BottomBar, Card, Text } from "@/components/ui";
import { smsReviewCollection } from "@/db/collections";
import { accountCollection } from "@/db/collections/finance";
import { appDb } from "@/db/app-db";
import { dismissUnrecognized, resolveWithSenderRule } from "@/db/services/sms-review";

export default function UnrecognisedScreen() {
  const router = useRouter();
  const { data: review } = useLiveQuery((q) =>
    q.from({ r: smsReviewCollection }).orderBy(({ r }) => r.createdAt, "desc"),
  );
  const { data: accounts } = useLiveQuery((q) => q.from({ a: accountCollection }));

  // The unrecognised row whose "Add sender" picker is open.
  const [senderFor, setSenderFor] = useState<{ id: number; sender: string } | null>(null);

  const refetch = useCallback(() => smsReviewCollection.utils.refetch(), []);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const rows = review ?? [];

  const onDismiss = async (id: number) => {
    await dismissUnrecognized(appDb, id);
    await refetch();
  };

  const onPickAccount = async (accountName: string) => {
    if (!senderFor) return;
    await resolveWithSenderRule(appDb, { id: senderFor.id, sender: senderFor.sender, accountName });
    setSenderFor(null);
    await refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Unrecognised"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/rules"))}
      />
      <Container className="px-4">
        <View className="flex-row items-center justify-between py-3">
          <Text variant="caption">{rows.length} NEED A SENDER RULE</Text>
          {rows.length > 0 ? <Badge variant="accent">review</Badge> : null}
        </View>

        {rows.length === 0 ? (
          <Text variant="body" className="pt-2">
            Nothing to review — every SMS was filed automatically.
          </Text>
        ) : (
          rows.map((row) => (
            <Card key={row.id} variant="soft" className="mb-3 gap-3">
              <View className="flex-row items-center justify-between">
                <Text variant="heading" className="text-[15px]">
                  {row.sender}
                </Text>
                <Badge variant="gray">unknown</Badge>
              </View>
              <Text variant="body" className="text-[13px] text-foreground/80">
                “{row.smsBody}”
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => void onDismiss(row.id)}
                  className="flex-1 items-center rounded-[3px] border border-border py-2.5 active:opacity-70"
                >
                  <Text className="text-[14px] font-semibold text-foreground">Not a bank</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSenderFor({ id: row.id, sender: row.sender })}
                  className="flex-1 items-center rounded-[3px] bg-foreground py-2.5 active:opacity-70"
                >
                  <Text className="text-[14px] font-semibold text-background">Add sender →</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </Container>

      {rows.length > 0 ? (
        <BottomBar>
          <Pressable
            onPress={() => router.back()}
            className="items-center rounded-[3px] border border-border py-4 active:opacity-70"
          >
            <Text variant="heading" className="text-[16px]">
              Skip all for now
            </Text>
          </Pressable>
        </BottomBar>
      ) : null}

      {/* Account picker for "Add sender" */}
      <BottomSheet isOpen={senderFor !== null} onOpenChange={(o) => !o && setSenderFor(null)}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <BottomSheet.Title>File {senderFor?.sender} to…</BottomSheet.Title>
            <Text variant="body" className="pt-1 text-[13px]">
              Future SMS from this sender will be filed to the account you pick.
            </Text>
            <View className="gap-1 pt-3">
              {(accounts ?? []).map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => void onPickAccount(account.bankName)}
                  className="rounded-[3px] px-2 py-3 active:opacity-70"
                >
                  <Text className="text-[15px] text-foreground">{account.bankName}</Text>
                </Pressable>
              ))}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
