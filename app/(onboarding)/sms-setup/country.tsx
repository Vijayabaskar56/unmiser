import { cn } from "heroui-native";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import {
  CopyBlock,
  OnboardingButton,
  OnboardingScreen,
  ProgressDots,
} from "@/components/onboarding/onboarding-shell";
import {
  countriesFromListings,
  countryDisplayName,
  loadProviderListings,
  type ProviderListingsResult,
} from "@/lib/onboarding-state";

/**
 * Onboarding step 2 of 4 — country. Countries come from the registry catalog
 * with an offline bundled-manifest fallback (same loader the old wizard used),
 * so the list is always real and never hardcoded. The selection is a pure
 * engagement question for now (provider install happens later on the Extensions
 * tab and isn't pre-filtered by it yet) — wire it through if/when the Extensions
 * Discover tab gains a country default.
 */
export default function OnboardingCountryScreen() {
  const [result, setResult] = useState<ProviderListingsResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadProviderListings().then((next) => {
      if (!active) return;
      setResult(next);
      const countries = countriesFromListings(next.listings);
      // Prefer India (the v1 launch market), else the first available country.
      setSelected(countries.includes("IN") ? "IN" : (countries[0] ?? null));
    });
    return () => {
      active = false;
    };
  }, []);

  const countries = result ? countriesFromListings(result.listings) : [];

  return (
    <OnboardingScreen>
      <ProgressDots total={4} current={1} />
      <CopyBlock
        label="Step 2 of 4"
        title={"Where do\nyou bank?"}
        subtitle="Pick your country to see supported banks and wallets."
        className="pb-[8px]"
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-[18px] pt-[10px] pb-[18px]"
      >
        {result === null ? (
          <View className="items-center py-10">
            <ActivityIndicator />
            <Text className="mt-3 text-muted text-xs">Loading supported countries…</Text>
          </View>
        ) : (
          <View>
            {result.source === "bundled" && (
              <Text className="mb-2 text-muted text-xs">
                Offline — showing the extensions bundled with the app.
              </Text>
            )}
            {countries.map((code) => {
              const isSelected = selected === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setSelected(code)}
                  className="flex-row items-center justify-between border-b border-separator py-[13px] active:opacity-60"
                >
                  <Text
                    className={cn(
                      "flex-1 text-[14px] text-foreground",
                      isSelected ? "font-extrabold" : "font-semibold",
                    )}
                  >
                    {countryDisplayName(code)}
                  </Text>
                  <Text
                    className={cn(
                      "font-mono text-[11px]",
                      isSelected ? "text-foreground" : "text-muted",
                    )}
                  >
                    {code}
                  </Text>
                  {isSelected && (
                    <View className="ml-[8px] h-[6px] w-[6px] rounded-full bg-foreground" />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <View className="px-[18px] pb-[18px] gap-[8px]">
        <OnboardingButton
          disabled={selected === null}
          onPress={() => router.push("/sms-setup/permissions")}
        >
          {selected ? `Continue with ${countryDisplayName(selected)} →` : "Pick a country"}
        </OnboardingButton>
        <OnboardingButton variant="ghost" onPress={() => router.back()}>
          ← Back
        </OnboardingButton>
      </View>
    </OnboardingScreen>
  );
}
