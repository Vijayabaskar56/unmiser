import { useLiveQuery } from "@tanstack/react-db";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { Container } from "@/components/container";
import { PasteSmsSheet } from "@/components/paste-sms-sheet";
import { appDb } from "@/db/app-db";
import { pluginCollection, smsReviewCollection } from "@/db/collections";
import { transactionCollection } from "@/db/collections/finance";
import { fetchCatalog, fetchManifestBundle } from "@/lib/registry/client";
import type { RegistryCatalog } from "@/lib/registry/types";
import {
  applyExtensionUpdate,
  checkForUpdates,
  markRegistryChecked,
  type ExtensionUpdate,
} from "@/lib/registry/updates";
import { installParserBundle } from "@/db/services/extensions";
import {
  countryDisplayName,
  filterListings,
  groupListingsByCountry,
  listingsFromCatalog,
  providerInstallState,
  type ProviderListing,
} from "@/lib/onboarding-state";

/**
 * Registry browse screen (ROADMAP Phase 2, workstream A): the 99-extension
 * unmiser-extensions store over jsDelivr. Browse needs network; installed
 * extensions are cached in the DB and keep working offline.
 */
export default function StoreScreen() {
  const mutedColor = useThemeColor("muted");
  const [catalog, setCatalog] = useState<RegistryCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [pasteVisible, setPasteVisible] = useState(false);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<ExtensionUpdate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const { data: installedPlugins } = useLiveQuery((q) => q.from({ plugin: pluginCollection }));
  const installed = (installedPlugins ?? []).map((plugin) => ({
    pluginId: plugin.pluginId,
    version: plugin.version,
  }));

  const loadCatalog = async () => {
    setLoadError("");
    try {
      const next = await fetchCatalog();
      setCatalog(next);
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? `Couldn't reach the extension store: ${caught.message}`
          : "Couldn't reach the extension store.",
      );
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const listings = catalog ? listingsFromCatalog(catalog) : [];
  const groups = groupListingsByCountry(filterListings(listings, search));
  const updateByPluginId = new Map((updates ?? []).map((update) => [update.pluginId, update]));

  const onInstall = async (listing: ProviderListing) => {
    if (!listing.registryEntry || busyPluginId) return;
    setBusyPluginId(listing.pluginId);
    setMessage("");
    try {
      const verified = await fetchManifestBundle(listing.registryEntry);
      await installParserBundle(appDb, verified.bundle, {
        source: "registry",
        checksum: verified.checksum,
      });
      await pluginCollection.utils.refetch();
      setMessage(`${listing.name} installed`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Install failed");
    } finally {
      setBusyPluginId(null);
    }
  };

  const onUpdate = async (listing: ProviderListing) => {
    if (!listing.registryEntry || busyPluginId) return;
    setBusyPluginId(listing.pluginId);
    setMessage("");
    try {
      const verified = await fetchManifestBundle(listing.registryEntry);
      const summary = await applyExtensionUpdate(appDb, verified);
      await Promise.all([
        pluginCollection.utils.refetch(),
        smsReviewCollection.utils.refetch(),
        transactionCollection.utils.refetch(),
      ]);
      setUpdates((current) =>
        current ? current.filter((update) => update.pluginId !== listing.pluginId) : current,
      );
      setMessage(
        `${listing.name} updated to v${summary.version} · re-checked ${summary.reprocessed} review item(s), ${summary.saved} saved`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setBusyPluginId(null);
    }
  };

  const onCheckForUpdates = async () => {
    setChecking(true);
    setMessage("");
    try {
      const next = await fetchCatalog();
      setCatalog(next);
      const found = await checkForUpdates(appDb, next);
      await markRegistryChecked(appDb);
      setUpdates(found);
      setMessage(
        found.length > 0 ? `Updates available (${found.length})` : "Everything is up to date",
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update check failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Container isScrollable={false} className="px-4 pt-6">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-40"
      >
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-3xl font-semibold text-foreground tracking-tight">Store</Text>
            <Text className="text-muted text-sm">
              Bank and wallet extensions from the Unmiser store. Installed extensions keep working
              offline.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/sms-setup")}
            className="rounded-xl border border-border p-4 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-1">
              <Text className="text-foreground font-medium">SMS setup</Text>
              <Text className="text-muted text-xs">
                Re-run the guided setup: country, extensions, permissions, scan.
              </Text>
            </View>
            <Text className="text-muted text-xs">Open</Text>
          </Pressable>

          {/* Production paste fallback (ROADMAP Phase 2 workstream B): works
              without SMS permission — paste a bank SMS, parse, confirm. */}
          <Pressable
            onPress={() => setPasteVisible(true)}
            className="rounded-xl border border-border p-4 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-1">
              <Text className="text-foreground font-medium">Add from SMS</Text>
              <Text className="text-muted text-xs">
                Paste a bank SMS to capture it as a transaction — no SMS permission needed.
              </Text>
            </View>
            <Text className="text-muted text-xs">Open</Text>
          </Pressable>
          <PasteSmsSheet visible={pasteVisible} onClose={() => setPasteVisible(false)} />

          <View className="flex-row gap-2">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search banks and wallets"
              placeholderTextColor={mutedColor}
              className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
            />
            <Pressable
              onPress={() => void onCheckForUpdates()}
              disabled={checking}
              className={
                checking
                  ? "rounded-xl bg-secondary px-3 py-3 items-center justify-center"
                  : "rounded-xl bg-foreground px-3 py-3 items-center justify-center active:opacity-70"
              }
            >
              <Text
                className={checking ? "text-muted text-xs" : "text-background text-xs font-medium"}
              >
                {checking ? "Checking…" : "Check for updates"}
              </Text>
            </Pressable>
          </View>

          {message.length > 0 && (
            <Text selectable className="text-foreground text-sm">
              {message}
            </Text>
          )}

          {catalog === null && loadError.length === 0 && (
            <View className="items-center py-10">
              <ActivityIndicator />
              <Text className="text-muted text-xs mt-3">Loading the extension catalog…</Text>
            </View>
          )}

          {loadError.length > 0 && (
            <View className="rounded-xl border border-border p-4 gap-2">
              <Text className="text-danger text-sm">{loadError}</Text>
              <Text className="text-muted text-xs">
                Your installed extensions still work offline. Bundled defaults can be installed from
                the SMS setup wizard.
              </Text>
              <Pressable
                onPress={() => void loadCatalog()}
                className="rounded-xl border border-foreground px-4 py-2 items-center"
              >
                <Text className="text-foreground text-sm font-medium">Retry</Text>
              </Pressable>
            </View>
          )}

          {groups.map((group) => (
            <View key={group.country} className="gap-2">
              <Text className="text-foreground text-lg font-semibold">
                {countryDisplayName(group.country)}
              </Text>
              {group.listings.map((listing) => {
                const state = providerInstallState(installed, listing);
                const pendingUpdate = updateByPluginId.get(listing.pluginId);
                const busy = busyPluginId === listing.pluginId;
                return (
                  <View
                    key={listing.pluginId}
                    className="rounded-xl border border-border p-4 flex-row items-center justify-between gap-3"
                  >
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">{listing.name}</Text>
                      <Text selectable className="text-muted text-xs">
                        {listing.pluginId} · v{listing.version}
                        {pendingUpdate ? ` (installed v${pendingUpdate.installedVersion})` : ""}
                      </Text>
                    </View>
                    {state === "not-installed" ? (
                      <Pressable
                        onPress={() => void onInstall(listing)}
                        disabled={busy}
                        className={
                          busy
                            ? "rounded-full bg-secondary px-4 py-2"
                            : "rounded-full bg-foreground px-4 py-2 active:opacity-70"
                        }
                      >
                        <Text className={busy ? "text-muted text-xs" : "text-background text-xs"}>
                          {busy ? "Installing…" : "Install"}
                        </Text>
                      </Pressable>
                    ) : state === "update-available" ? (
                      <Pressable
                        onPress={() => void onUpdate(listing)}
                        disabled={busy}
                        className={
                          busy
                            ? "rounded-full bg-secondary px-4 py-2"
                            : "rounded-full bg-foreground px-4 py-2 active:opacity-70"
                        }
                      >
                        <Text className={busy ? "text-muted text-xs" : "text-background text-xs"}>
                          {busy ? "Updating…" : "Update"}
                        </Text>
                      </Pressable>
                    ) : (
                      <View className="rounded-full border border-border px-4 py-2">
                        <Text className="text-muted text-xs">Installed</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </Container>
  );
}
