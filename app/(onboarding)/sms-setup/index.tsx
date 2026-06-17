import { router } from "expo-router";
import { Text, View } from "react-native";

import { WelcomeIllo } from "@/components/onboarding/illustrations";
import {
  LogoLockup,
  OnboardingButton,
  OnboardingScreen,
} from "@/components/onboarding/onboarding-shell";
import { appDb } from "@/db/app-db";
import { appSettingsCollection } from "@/db/collections";
import { markSmsSetupCompleted } from "@/lib/onboarding-state";

/**
 * Onboarding step 0 of 5 — welcome splash. No progress dots (this is the intro).
 * "Set up later" preserves the never-trap-the-user invariant: the first-run
 * gate must always be escapable, so it completes onboarding without SMS.
 */
export default function OnboardingWelcomeScreen() {
  const onSetUpLater = async () => {
    await markSmsSetupCompleted(appDb);
    await appSettingsCollection.utils.refetch();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingScreen>
      <View className="h-[18px]" />
      <LogoLockup />
      <View className="flex-1 items-center justify-center px-[18px]">
        <WelcomeIllo />
      </View>
      <View className="px-[20px] pb-[6px]">
        <Text className="text-[30px] font-black leading-[1.04] tracking-[-0.04em] text-foreground">
          {"Your money.\nYour terms."}
        </Text>
        <Text className="mt-[9px] text-[13.5px] leading-[1.55] text-muted">
          unmiser reads your bank SMS on-device — no cloud, no login, nothing leaves your phone.
        </Text>
      </View>
      <View className="px-[18px] pb-[18px] gap-[9px]">
        <OnboardingButton onPress={() => router.push("/sms-setup/archetype")}>
          Get started →
        </OnboardingButton>
        <OnboardingButton variant="ghost" onPress={() => void onSetUpLater()}>
          Set up later
        </OnboardingButton>
        <Text className="text-center font-mono text-[9.5px] uppercase tracking-[0.04em] text-muted">
          100% offline · no account needed
        </Text>
      </View>
    </OnboardingScreen>
  );
}
