import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { DoneIllo } from "@/components/onboarding/illustrations";
import {
  OnboardingButton,
  OnboardingScreen,
  ProgressDots,
} from "@/components/onboarding/onboarding-shell";
import { appDb } from "@/db/app-db";
import { appSettingsCollection } from "@/db/collections";
import { getProfile, type ProfilePrefs } from "@/db/services/app-settings";
import { getArchetype } from "@/lib/profile/archetypes";
import { markSmsSetupCompleted } from "@/lib/onboarding-state";

/**
 * Onboarding step 4 of 4 — celebration. Reads the archetype the user picked on
 * step 1 (saved to `profile.archetype`), then marks the wizard complete so the
 * first-run gate releases and the user lands in the app.
 */
export default function OnboardingDoneScreen() {
  const [profile, setProfile] = useState<ProfilePrefs | null>(null);

  useEffect(() => {
    void getProfile(appDb).then(setProfile);
  }, []);

  const archetype = getArchetype(profile?.archetypeId);

  const onEnter = async () => {
    await markSmsSetupCompleted(appDb);
    await appSettingsCollection.utils.refetch();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingScreen>
      <ProgressDots total={4} current={3} />
      <View className="flex-1 items-center px-[20px] pt-[12px]">
        <View className="h-[210px] w-full">
          <DoneIllo />
        </View>
        <Text className="mt-[4px] text-center text-[48px] font-black leading-none tracking-[-0.04em] text-foreground">
          ALL SET!
        </Text>
        <Text className="mt-[8px] text-center text-[14px] leading-[1.5] text-muted">
          <Text className="font-bold text-foreground">{archetype.name}</Text> is ready.
          {"\n"}Your finances, entirely on your terms.
        </Text>
        <View className="mt-[14px] rounded-[3px] bg-accent px-3 py-1.5">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            {archetype.name}
          </Text>
        </View>
      </View>
      <View className="px-[20px] pb-[22px] gap-[8px]">
        <OnboardingButton onPress={() => void onEnter()}>Enter unmiser →</OnboardingButton>
        <Text className="text-center font-mono text-[9.5px] uppercase tracking-[0.04em] text-muted">
          on-device · private · yours
        </Text>
      </View>
    </OnboardingScreen>
  );
}
