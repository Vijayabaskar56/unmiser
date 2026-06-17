import { cn } from "heroui-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SmsIllo } from "@/components/onboarding/illustrations";
import {
  CopyBlock,
  OnboardingButton,
  OnboardingScreen,
  ProgressDots,
} from "@/components/onboarding/onboarding-shell";
import {
  hasSmsPermissions,
  isAndroidSmsAdapterAvailable,
  requestSmsPermissions,
  type SmsPermissionState,
} from "@/lib/android-sms-adapter";

/**
 * Onboarding step 3 of 4 — SMS access. READ_SMS (historical scan) and
 * RECEIVE_SMS (realtime) are requested together via the Android system dialog
 * but degrade independently, so the two rows reflect their real granted state.
 * Denial is never a dead end: Continue is always enabled, and provider install
 * + paste-SMS live on the Extensions tab.
 */
export default function OnboardingSmsScreen() {
  const [permissions, setPermissions] = useState<SmsPermissionState>({
    read: false,
    receive: false,
  });
  const adapterAvailable = isAndroidSmsAdapterAvailable();

  useEffect(() => {
    void hasSmsPermissions().then(setPermissions);
  }, []);

  const onRequest = async () => {
    setPermissions(await requestSmsPermissions());
  };

  const granted = permissions.read || permissions.receive;

  return (
    <OnboardingScreen>
      <ProgressDots total={4} current={2} />
      <View className="px-[18px] pt-[4px]">
        <View className="h-[165px] w-full">
          <SmsIllo />
        </View>
      </View>
      <CopyBlock
        label="Step 3 of 4"
        title={"Allow SMS\naccess"}
        subtitle="Messages stay on this device only — nothing leaves your phone. Grant one, both, or neither."
        className="pb-[8px]"
      />
      <View className="flex-1 px-[18px] pt-[10px]">
        {!adapterAvailable && (
          <Text className="mb-2 text-muted text-xs">
            SMS access isn't available in this runtime (non-Android or Expo Go). You can still
            continue — paste and manual tracking work everywhere.
          </Text>
        )}
        <View className="gap-[8px]">
          <PermissionRow
            title="Read existing SMS"
            detail="READ_SMS — scan your inbox history"
            granted={permissions.read}
            onPress={() => void onRequest()}
          />
          <PermissionRow
            title="Receive new SMS"
            detail="RECEIVE_SMS — auto-log incoming"
            granted={permissions.receive}
            onPress={() => void onRequest()}
          />
        </View>
      </View>
      <View className="px-[18px] pb-[18px] gap-[8px]">
        <OnboardingButton
          onPress={() => (granted ? router.push("/sms-setup/done") : void onRequest())}
        >
          {granted ? "Continue →" : "Grant SMS access"}
        </OnboardingButton>
        {!granted && (
          <OnboardingButton variant="ghost" onPress={() => router.push("/sms-setup/done")}>
            Skip for now
          </OnboardingButton>
        )}
        <OnboardingButton variant="ghost" onPress={() => router.back()}>
          ← Back
        </OnboardingButton>
      </View>
    </OnboardingScreen>
  );
}

function PermissionRow({
  title,
  detail,
  granted,
  onPress,
}: {
  title: string;
  detail: string;
  granted: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start justify-between gap-3 rounded-[3px] border-[1.5px] border-border p-[12px] active:opacity-70"
    >
      <View className="flex-1">
        <Text className="mb-[3px] text-[13px] font-bold text-foreground">{title}</Text>
        <Text className="font-mono text-[10px] leading-[1.4] text-muted">{detail}</Text>
      </View>
      <Text className={cn("text-[11.5px] font-bold", granted ? "text-success" : "text-muted")}>
        {granted ? "✓ Granted" : "Tap to grant"}
      </Text>
    </Pressable>
  );
}
