import { cn, useThemeColor } from "heroui-native";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { archetypeCardIllo } from "@/components/onboarding/illustrations";
import {
  CopyBlock,
  OnboardingButton,
  OnboardingScreen,
  ProgressDots,
} from "@/components/onboarding/onboarding-shell";
import { appDb } from "@/db/app-db";
import { ARCHETYPES, getArchetype } from "@/lib/profile/archetypes";
import { setProfileArchetypeId } from "@/db/services/app-settings";

/**
 * Onboarding step 1 of 4 — money style. The four cards map 1:1 to the canonical
 * archetypes in `lib/profile/archetypes` (planner / saver / spender / investor),
 * whose ids are durable (avatar + pillar-2 nudges key off them). The design's
 * "Free Spirit"/"Builder" concepts map to spender/investor respectively. The
 * chosen id persists to `profile.archetype` on Continue.
 */
export default function OnboardingArchetypeScreen() {
  const canvas = useThemeColor("background");
  const [selected, setSelected] = useState<string | null>(null);

  const onContinue = async () => {
    if (!selected) return;
    await setProfileArchetypeId(appDb, selected);
    router.push("/sms-setup/country");
  };

  return (
    <OnboardingScreen>
      <ProgressDots total={4} current={0} />
      <CopyBlock
        label="Step 1 of 4"
        title={"What's your\nmoney style?"}
        subtitle="Pick the one that fits — it shapes how unmiser presents your data."
        className="pb-[10px]"
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-[18px] pt-[10px] pb-[18px]"
      >
        <View className="flex-row flex-wrap gap-[8px]">
          {ARCHETYPES.map((archetype) => {
            const Illo = archetypeCardIllo(archetype.id);
            const isSelected = selected === archetype.id;
            return (
              <Pressable
                key={archetype.id}
                onPress={() => setSelected(archetype.id)}
                className={cn(
                  "w-[48%] overflow-hidden rounded-[6px]",
                  isSelected ? "border-[2px] border-foreground" : "border-[1.5px] border-border",
                )}
              >
                <View
                  className={cn(
                    "relative h-[96px] items-center justify-center border-b",
                    isSelected ? "border-foreground bg-foreground" : "border-separator bg-surface",
                  )}
                >
                  <View className="h-[80px] w-full px-2">
                    <Illo color={isSelected ? canvas : undefined} />
                  </View>
                  {isSelected && (
                    <View className="absolute right-[7px] top-[7px] h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-foreground bg-accent">
                      <Text className="text-[10px] font-black text-foreground">✓</Text>
                    </View>
                  )}
                </View>
                <View className="px-[10px] pb-[10px] pt-[8px]">
                  <Text className="text-[12.5px] font-extrabold tracking-tight text-foreground">
                    {archetype.name}
                  </Text>
                  <Text className="mt-[2px] font-mono text-[9.5px] leading-[1.3] text-muted">
                    {archetype.tagline}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View className="px-[18px] pb-[18px] gap-[8px]">
        <OnboardingButton disabled={!selected} onPress={() => void onContinue()}>
          {selected
            ? `Continue as ${getArchetype(selected).name} →`
            : "Pick your style to continue"}
        </OnboardingButton>
        <OnboardingButton variant="ghost" onPress={() => router.back()}>
          ← Back
        </OnboardingButton>
      </View>
    </OnboardingScreen>
  );
}
