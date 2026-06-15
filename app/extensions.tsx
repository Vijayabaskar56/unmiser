import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { cn, useThemeColor } from "heroui-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, AppSwitch, Badge, IconButton, SpriteIcon, Text } from "@/components/ui";
import { appDb } from "@/db/app-db";
import { pluginCollection } from "@/db/collections";
import { accountCollection, transactionCollection } from "@/db/collections/finance";
import { installParserBundle, setExtensionEnabled } from "@/db/services/extensions";
import { fetchCatalog, fetchManifestBundle } from "@/lib/registry/client";
import type { RegistryCatalog } from "@/lib/registry/types";
import { checkForUpdates, markRegistryChecked, type ExtensionUpdate } from "@/lib/registry/updates";
import {
  filterListings,
  listingsFromCatalog,
  providerInstallState,
  type ProviderListing,
} from "@/lib/onboarding-state";
import { parsedCountsByPlugin, placeholderMeta, statusBadge } from "@/lib/extensions/catalog";

const StyledIonicons = withUniwind(Ionicons);

type Tab = "installed" | "discover";

/**
 * Unified Extensions screen (replaces the old Store + dev SMS-console split).
 * Two tabs: Installed (manage what you have) and Discover (browse + install
 * the 99-extension registry over jsDelivr). The SMS engine console
 * (permissions, scan, paste-harness, review queue) now lives behind the
 * developer gate at `/sms-console`.
 */
export default function ExtensionsScreen() {
  const router = useRouter();
  const mutedColor = useThemeColor("muted");
  // Optional deep-link entry point: `unmiser://extensions?tab=discover`.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<Tab>(tabParam === "discover" ? "discover" : "installed");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalog, setCatalog] = useState<RegistryCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<ExtensionUpdate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const { data: plugins } = useLiveQuery((q) =>
    q.from({ plugin: pluginCollection }).orderBy(({ plugin }) => plugin.name, "asc"),
  );
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }));

  const installedPlugins = plugins ?? [];
  const installed = installedPlugins.map((p) => ({ pluginId: p.pluginId, version: p.version }));
  const parsedCounts = useMemo(
    () => parsedCountsByPlugin(accounts ?? [], txns ?? []),
    [accounts, txns],
  );
  const updateByPluginId = useMemo(
    () => new Map((updates ?? []).map((u) => [u.pluginId, u])),
    [updates],
  );

  const loadCatalog = async () => {
    setLoadError("");
    try {
      setCatalog(await fetchCatalog());
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? `Couldn't reach the extension store: ${caught.message}`
          : "Couldn't reach the extension store.",
      );
    }
  };

  // Lazy-load the catalog the first time Discover is opened.
  useEffect(() => {
    if (tab === "discover" && catalog === null && loadError.length === 0) void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const listings = catalog ? listingsFromCatalog(catalog) : [];
  const discoverListings = filterListings(listings, search).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const filteredInstalled = installedPlugins.filter((p) => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return true;
    return p.name.toLowerCase().includes(needle) || p.pluginId.toLowerCase().includes(needle);
  });

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

  const onCheckForUpdates = async () => {
    setChecking(true);
    setMessage("");
    try {
      const next = await fetchCatalog();
      setCatalog(next);
      const found = await checkForUpdates(appDb, next);
      await markRegistryChecked(appDb);
      setUpdates(found);
      setMessage(found.length > 0 ? `Updates available (${found.length})` : "Up to date");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update check failed");
    } finally {
      setChecking(false);
    }
  };

  const goToDetail = (pluginId: string) =>
    router.push({ pathname: "/extension/[id]", params: { id: pluginId } });

  const onToggleInstalled = async (pluginId: string, next: boolean) => {
    await setExtensionEnabled(appDb, pluginId, next);
    await pluginCollection.utils.refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Extensions"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <IconButton
            name="search"
            label="Search extensions"
            onPress={() => setSearchOpen((open) => !open)}
          />
        }
      />
      <Container isScrollable={false} className="px-4">
        {/* Tabs */}
        <View className="mt-1 flex-row overflow-hidden rounded-[3px] border-[1.5px] border-foreground">
          <TabButton
            label={`Installed · ${installedPlugins.length}`}
            active={tab === "installed"}
            onPress={() => setTab("installed")}
          />
          <TabButton
            label={`Discover · ${catalog ? listings.length : 99}`}
            active={tab === "discover"}
            onPress={() => setTab("discover")}
          />
        </View>

        {searchOpen ? (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search banks and wallets"
            placeholderTextColor={mutedColor}
            autoFocus
            className="mt-3 rounded-[3px] border border-border bg-secondary px-4 py-3 text-foreground"
          />
        ) : null}

        {message.length > 0 ? (
          <Text selectable variant="body" className="mt-3 text-[13px]">
            {message}
          </Text>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-40 pt-3 gap-3"
        >
          {tab === "installed" ? (
            <InstalledTab
              plugins={filteredInstalled}
              parsedCounts={parsedCounts}
              updateByPluginId={updateByPluginId}
              onToggle={(pluginId, next) => void onToggleInstalled(pluginId, next)}
              onOpen={goToDetail}
              checking={checking}
              onCheckUpdates={() => void onCheckForUpdates()}
            />
          ) : (
            <DiscoverTab
              listings={discoverListings}
              loading={catalog === null && loadError.length === 0}
              loadError={loadError}
              onRetry={() => void loadCatalog()}
              installed={installed}
              busyPluginId={busyPluginId}
              onInstall={(l) => void onInstall(l)}
              onOpen={goToDetail}
            />
          )}
        </ScrollView>
      </Container>
    </View>
  );
}

// ---------------------------------------------------------------------------

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className={cn("flex-1 py-2.5", active && "bg-foreground")}>
      <Text
        className={cn(
          "text-center text-[13px] font-bold",
          active ? "text-background" : "text-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Avatar() {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
      <SpriteIcon name="bank" size={20} />
    </View>
  );
}

function StatusPill({ enabled, pendingVersion }: { enabled: boolean; pendingVersion?: string }) {
  const badge = statusBadge(enabled, pendingVersion);
  if (badge.kind === "update") return <Badge variant="accent">{badge.label}</Badge>;
  if (badge.kind === "live") {
    return (
      <View className="self-start rounded-[2px] border-[1.3px] border-success px-[6px] py-[2px]">
        <Text className="font-mono text-[9px] font-bold uppercase tracking-wide text-success">
          {badge.label}
        </Text>
      </View>
    );
  }
  return <Badge variant="gray">{badge.label}</Badge>;
}

// ---------------------------------------------------------------------------

function InstalledTab({
  plugins,
  parsedCounts,
  updateByPluginId,
  onToggle,
  onOpen,
  checking,
  onCheckUpdates,
}: {
  plugins: Array<{ pluginId: string; name: string; version: string; enabled: boolean }>;
  parsedCounts: Record<string, number>;
  updateByPluginId: Map<string, ExtensionUpdate>;
  onToggle: (pluginId: string, next: boolean) => void;
  onOpen: (pluginId: string) => void;
  checking: boolean;
  onCheckUpdates: () => void;
}) {
  if (plugins.length === 0) {
    return (
      <View className="items-center pt-16 gap-2">
        <Text variant="body">No extensions installed yet.</Text>
        <Text variant="body" className="text-[13px] text-muted">
          Open Discover to install a bank or wallet.
        </Text>
      </View>
    );
  }
  return (
    <>
      <Pressable
        onPress={onCheckUpdates}
        disabled={checking}
        className="self-end flex-row items-center gap-1.5 active:opacity-70"
      >
        {checking ? <ActivityIndicator size="small" /> : null}
        <Text className="text-[12px] font-semibold text-muted">
          {checking ? "Checking…" : "Check for updates"}
        </Text>
      </Pressable>
      {plugins.map((plugin) => {
        const pending = updateByPluginId.get(plugin.pluginId);
        const count = parsedCounts[plugin.pluginId] ?? 0;
        return (
          <Pressable
            key={plugin.pluginId}
            onPress={() => onOpen(plugin.pluginId)}
            className="rounded-[3px] border border-border p-4 active:opacity-70"
          >
            <View className="flex-row items-start gap-3">
              <Avatar />
              <View className="min-w-0 flex-1">
                <Text variant="heading" numberOfLines={1} className="text-[16px]">
                  {plugin.name}
                </Text>
                <Text numberOfLines={1} className="font-mono text-[13px] text-muted">
                  {plugin.pluginId} · v{plugin.version}
                </Text>
              </View>
              <AppSwitch
                value={plugin.enabled}
                onChange={(next) => onToggle(plugin.pluginId, next)}
                accessibilityLabel={`${plugin.name} enabled`}
              />
            </View>
            <View className="mt-3 flex-row items-center gap-2.5">
              <StatusPill enabled={plugin.enabled} pendingVersion={pending?.availableVersion} />
              <Text className="flex-1 text-[13px] text-muted">
                {count.toLocaleString()} msgs parsed
              </Text>
              <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

function DiscoverTab({
  listings,
  loading,
  loadError,
  onRetry,
  installed,
  busyPluginId,
  onInstall,
  onOpen,
}: {
  listings: ProviderListing[];
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  installed: Array<{ pluginId: string; version: string }>;
  busyPluginId: string | null;
  onInstall: (listing: ProviderListing) => void;
  onOpen: (pluginId: string) => void;
}) {
  if (loading) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator />
        <Text className="mt-3 text-[13px] text-muted">Loading the extension catalog…</Text>
      </View>
    );
  }
  if (loadError.length > 0) {
    return (
      <View className="rounded-[3px] border border-border p-4 gap-2">
        <Text className="text-[14px] text-danger">{loadError}</Text>
        <Text className="text-[13px] text-muted">
          Your installed extensions still work offline.
        </Text>
        <Pressable
          onPress={onRetry}
          className="self-start rounded-[3px] border-[1.5px] border-foreground px-4 py-2 active:opacity-70"
        >
          <Text className="text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <>
      {/* Featured promo (cosmetic until the registry carries featured flags). */}
      <View className="rounded-[3px] bg-foreground p-4 gap-2">
        <Text className="font-mono text-[9px] font-bold uppercase tracking-widest text-background/50">
          Featured
        </Text>
        <Text variant="heading" className="text-[19px] text-background">
          UPI everywhere
        </Text>
        <Text className="text-[13px] text-background/70">
          One manifest reads GPay, PhonePe & Paytm across every bank.
        </Text>
      </View>

      {listings.map((listing) => {
        const state = providerInstallState(installed, listing);
        const busy = busyPluginId === listing.pluginId;
        const meta = placeholderMeta(listing.pluginId);
        return (
          <Pressable
            key={listing.pluginId}
            onPress={() => onOpen(listing.pluginId)}
            className="flex-row items-center gap-3 rounded-[3px] border border-border p-4 active:opacity-70"
          >
            <Avatar />
            <View className="min-w-0 flex-1">
              <Text variant="heading" numberOfLines={1} className="text-[16px]">
                {listing.name}
              </Text>
              <Text numberOfLines={1} className="font-mono text-[13px] text-muted">
                {listing.pluginId} · ★ {meta.rating}
              </Text>
            </View>
            {state === "not-installed" ? (
              <Pressable
                onPress={() => onInstall(listing)}
                disabled={busy}
                className={cn(
                  "rounded-[3px] px-5 py-2.5",
                  busy ? "bg-secondary" : "bg-foreground active:opacity-70",
                )}
              >
                <Text
                  className={cn("text-[13px] font-bold", busy ? "text-muted" : "text-background")}
                >
                  {busy ? "…" : "Get"}
                </Text>
              </Pressable>
            ) : (
              <View className="rounded-[3px] border-[1.3px] border-success px-3 py-2">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-success">
                  {state === "update-available" ? "Update" : "Added"}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </>
  );
}
