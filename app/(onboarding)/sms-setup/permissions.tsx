import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { PasteSmsSheet } from "@/components/paste-sms-sheet";
import {
  hasSmsPermissions,
  isAndroidSmsAdapterAvailable,
  requestSmsPermissions,
  type SmsPermissionState,
} from "@/lib/android-sms-adapter";

function PermissionRow({
  label,
  detail,
  granted,
}: {
  label: string;
  detail: string;
  granted: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border p-4">
      <View className="flex-1">
        <Text className="text-foreground font-medium">{label}</Text>
        <Text className="text-muted text-xs">{detail}</Text>
      </View>
      <Text className={granted ? "text-foreground text-xs font-medium" : "text-muted text-xs"}>
        {granted ? "Granted" : "Not granted"}
      </Text>
    </View>
  );
}

/**
 * Wizard step 4 of 5: SMS permission. READ_SMS (historical scan) and
 * RECEIVE_SMS (realtime) degrade independently, and denial is never a dead
 * end — the paste sheet is the fallback path and Continue is always enabled.
 */
export default function SmsSetupPermissionsScreen() {
  const [permissions, setPermissions] = useState<SmsPermissionState>({
    read: false,
    receive: false,
  });
  const [requested, setRequested] = useState(false);
  const [pasteVisible, setPasteVisible] = useState(false);

  useEffect(() => {
    void hasSmsPermissions().then(setPermissions);
  }, []);

  const onRequest = async () => {
    const next = await requestSmsPermissions();
    setPermissions(next);
    setRequested(true);
  };

  const anyDenied = !permissions.read || !permissions.receive;
  const adapterAvailable = isAndroidSmsAdapterAvailable();

  return (
    <Container isScrollable={false} className="px-4 pt-14">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-muted text-xs">Step 4 of 5</Text>
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Allow SMS access
            </Text>
            <Text className="text-muted text-sm">
              Your messages are read on this device only — nothing leaves your phone. Each
              permission works on its own; you can grant one, both, or neither.
            </Text>
          </View>

          {!adapterAvailable && (
            <Text className="text-muted text-xs">
              SMS access isn't available in this runtime (non-Android or Expo Go). You can still
              continue and use paste.
            </Text>
          )}

          <PermissionRow
            label="Read existing SMS"
            detail="READ_SMS — lets the next step scan your inbox history."
            granted={permissions.read}
          />
          <PermissionRow
            label="Receive new SMS"
            detail="RECEIVE_SMS — saves new transactions automatically as texts arrive."
            granted={permissions.receive}
          />

          <Pressable
            onPress={() => void onRequest()}
            className="rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-background font-medium">
              {anyDenied ? "Grant SMS access" : "Permissions granted"}
            </Text>
          </Pressable>

          {requested && anyDenied && (
            <View className="rounded-xl border border-border p-4 gap-2">
              <Text className="text-foreground font-medium">No problem — you can paste</Text>
              <Text className="text-muted text-sm">
                Without SMS access, Unmiser can't read messages automatically, but you can paste any
                bank SMS and it will be parsed the same way. You can grant access later from system
                settings.
              </Text>
              <Pressable
                onPress={() => setPasteVisible(true)}
                className="rounded-xl border border-foreground px-4 py-2 items-center"
              >
                <Text className="text-foreground text-sm font-medium">Try the paste sheet</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => router.push("/sms-setup/scan")}
            className="rounded-xl border border-border px-4 py-3 items-center active:opacity-70"
          >
            <Text className="text-foreground font-medium">Continue</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PasteSmsSheet visible={pasteVisible} onClose={() => setPasteVisible(false)} />
    </Container>
  );
}
