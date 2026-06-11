import { useLiveQuery } from "@tanstack/react-db";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { appDb } from "@/db/app-db";
import { pluginCollection } from "@/db/collections";
import {
  countryDisplayName,
  installProviderListing,
  loadProviderListings,
  providerInstallState,
  providersForCountry,
  type ProviderListing,
  type ProviderListingsResult,
} from "@/lib/onboarding-state";

/**
 * Wizard step 2 of 5: pick provider extensions for the chosen country and
 * install them. Installs are idempotent upserts, so re-running this step (or
 * the whole wizard) is safe.
 */
export default function SmsSetupProvidersScreen() {
  const { country: countryParam } = useLocalSearchParams<{ country?: string }>();
  const country = (countryParam ?? "IN").toUpperCase();

  const [result, setResult] = useState<ProviderListingsResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");

  const { data: installedPlugins } = useLiveQuery((q) => q.from({ plugin: pluginCollection }));
  const installed = (installedPlugins ?? []).map((plugin) => ({
    pluginId: plugin.pluginId,
    version: plugin.version,
  }));

  useEffect(() => {
    let active = true;
    void loadProviderListings().then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const providers = result ? providersForCountry(result.listings, country) : [];

  const toggle = (pluginId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(pluginId)) next.delete(pluginId);
      else next.add(pluginId);
      return next;
    });
  };

  const onInstallAndContinue = async () => {
    const toInstall: ProviderListing[] = providers.filter((listing) =>
      selected.has(listing.pluginId),
    );
    setInstalling(true);
    setMessage("");
    try {
      for (const listing of toInstall) {
        setMessage(`Installing ${listing.name}…`);
        await installProviderListing(appDb, listing);
      }
      await pluginCollection.utils.refetch();
      router.push("/sms-setup/account");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Container isScrollable={false} className="px-4 pt-14">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-muted text-xs">Step 2 of 5</Text>
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Your banks in {countryDisplayName(country)}
            </Text>
            <Text className="text-muted text-sm">
              Pick the banks and wallets that text you. Only the extensions you install can read
              your SMS — install just what you need.
            </Text>
          </View>

          {result === null ? (
            <View className="items-center py-10">
              <ActivityIndicator />
            </View>
          ) : providers.length === 0 ? (
            <Text className="text-muted">No extensions available for this country yet.</Text>
          ) : (
            <View className="gap-2">
              {result.source === "bundled" && (
                <Text className="text-muted text-xs">
                  Offline — showing bundled extensions. More are available from the Store when
                  you're back online.
                </Text>
              )}
              {providers.map((listing) => {
                const state = providerInstallState(installed, listing);
                const checked = selected.has(listing.pluginId) || state !== "not-installed";
                return (
                  <Pressable
                    key={listing.pluginId}
                    onPress={() => state === "not-installed" && toggle(listing.pluginId)}
                    className={
                      checked
                        ? "rounded-xl border border-foreground p-4 flex-row items-center justify-between"
                        : "rounded-xl border border-border p-4 flex-row items-center justify-between"
                    }
                  >
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">{listing.name}</Text>
                      <Text className="text-muted text-xs">
                        v{listing.version}
                        {listing.registryEntry === null ? " · bundled" : ""}
                      </Text>
                    </View>
                    <Text className="text-muted text-xs">
                      {state === "installed"
                        ? "Installed"
                        : state === "update-available"
                          ? "Installed · update in Store"
                          : checked
                            ? "Selected"
                            : "Tap to select"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {message.length > 0 && <Text className="text-muted text-sm">{message}</Text>}

          <Pressable
            onPress={() => void onInstallAndContinue()}
            disabled={installing || result === null}
            className={
              installing
                ? "rounded-xl bg-secondary px-4 py-3 items-center"
                : "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
            }
          >
            <Text className={installing ? "text-muted font-medium" : "text-background font-medium"}>
              {installing
                ? "Installing…"
                : selected.size > 0
                  ? `Install ${selected.size} and continue`
                  : "Continue"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
