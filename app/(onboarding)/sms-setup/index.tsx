import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { appDb } from "@/db/app-db";
import { appSettingsCollection } from "@/db/collections";
import {
  countriesFromListings,
  countryDisplayName,
  loadProviderListings,
  markSmsSetupCompleted,
  type ProviderListingsResult,
} from "@/lib/onboarding-state";

/**
 * Wizard step 1 of 5: country select. Countries come from the registry
 * catalog; offline we fall back to the bundled manifest set.
 */
export default function SmsSetupCountryScreen() {
  const [result, setResult] = useState<ProviderListingsResult | null>(null);

  useEffect(() => {
    let active = true;
    void loadProviderListings().then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSetUpLater = async () => {
    // "Set up later" sets the flag too — the gate must never trap the user.
    await markSmsSetupCompleted(appDb);
    await appSettingsCollection.utils.refetch();
    router.replace("/(tabs)");
  };

  const countries = result ? countriesFromListings(result.listings) : [];

  return (
    <Container isScrollable={false} className="px-4 pt-14">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-muted text-xs">Step 1 of 5</Text>
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Where do you bank?
            </Text>
            <Text className="text-muted text-sm">
              Unmiser reads bank SMS with installable extensions. Pick your country to see which
              banks and wallets are supported.
            </Text>
          </View>

          {result === null ? (
            <View className="items-center py-10">
              <ActivityIndicator />
              <Text className="text-muted text-xs mt-3">Loading supported countries…</Text>
            </View>
          ) : (
            <View className="gap-2">
              {result.source === "bundled" && (
                <Text className="text-muted text-xs">
                  Offline — showing the extensions bundled with the app.
                </Text>
              )}
              {countries.map((country) => (
                <Pressable
                  key={country}
                  onPress={() =>
                    router.push({
                      pathname: "/sms-setup/providers",
                      params: { country },
                    })
                  }
                  className="rounded-xl border border-border p-4 flex-row items-center justify-between active:opacity-70"
                >
                  <Text className="text-foreground font-medium">{countryDisplayName(country)}</Text>
                  <Text className="text-muted text-xs">{country}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable onPress={() => void onSetUpLater()} className="items-center py-3">
            <Text className="text-muted text-sm underline">Set up later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
