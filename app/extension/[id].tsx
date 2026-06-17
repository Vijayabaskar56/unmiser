import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import {
  AppBar,
  AppSwitch,
  Badge,
  Card,
  Chip,
  ConfirmDialog,
  SpriteIcon,
  Text,
} from "@/components/ui";
import { appDb } from "@/db/app-db";
import { pluginCollection } from "@/db/collections";
import { accountCollection, transactionCollection } from "@/db/collections/finance";
import {
  installParserBundle,
  loadPluginBundle,
  setExtensionEnabled,
  uninstallExtension,
} from "@/db/services/extensions";
import { fetchCatalog, fetchManifestBundle } from "@/lib/registry/client";
import type { RegistryCatalog } from "@/lib/registry/types";
import { applyExtensionUpdate, compareVersions } from "@/lib/registry/updates";
import { listingsFromCatalog } from "@/lib/onboarding-state";
import { validateManifestFixtures } from "@/lib/parser/fixtures";
import { parseSmsWithManifest } from "@/lib/parser/engine";
import type { ManifestWithFixtures } from "@/lib/parser/types";
import {
  formatBytes,
  formatVersion,
  parsedCountsByPlugin,
  placeholderMeta,
} from "@/lib/extensions/catalog";
import { useAccent } from "@/lib/appearance/use-accent";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

/**
 * Extension detail (ROADMAP Phase 4): get/installed states for one extension.
 * Reads the active bundle from the DB when installed, or previews the registry
 * manifest (network) when not. Trust copy + "what it parses" come from the
 * manifest/fixtures; rating/installs are placeholders (see catalog.ts).
 */
export default function ExtensionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pluginId = String(id);
  const accent = useAccent();

  const [catalog, setCatalog] = useState<RegistryCatalog | null>(null);
  const [bundle, setBundle] = useState<ManifestWithFixtures | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const { data: plugins } = useLiveQuery((q) => q.from({ plugin: pluginCollection }), []);
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }), []);
  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);

  const plugin = (plugins ?? []).find((p) => p.pluginId === pluginId) ?? null;
  const installed = plugin != null;
  const parsedCount = useMemo(
    () => parsedCountsByPlugin(accounts ?? [], txns ?? [])[pluginId] ?? 0,
    [accounts, txns, pluginId],
  );

  const listing = useMemo(
    () => (catalog ? listingsFromCatalog(catalog).find((l) => l.pluginId === pluginId) : undefined),
    [catalog, pluginId],
  );
  const availableVersion = listing?.version;
  const updateAvailable =
    installed && availableVersion ? compareVersions(availableVersion, plugin.version) > 0 : false;

  // Load the catalog once (listing metadata + update detection + offline-safe
  // not-installed preview).
  useEffect(() => {
    void fetchCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  // Load the bundle to preview: installed → from the DB; otherwise from the
  // registry once the catalog (and thus the listing) is available.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBundleLoading(true);
      try {
        if (installed) {
          const loaded = await loadPluginBundle(appDb, pluginId);
          if (!cancelled) setBundle(loaded);
        } else if (listing?.registryEntry) {
          const verified = await fetchManifestBundle(listing.registryEntry);
          if (!cancelled) setBundle(verified.bundle);
        }
      } catch {
        if (!cancelled) setBundle(null);
      } finally {
        if (!cancelled) setBundleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [installed, pluginId, listing?.registryEntry]);

  const manifest = bundle?.manifest;
  const trust = plugin?.trust ?? manifest?.trust ?? "community";
  const currency = manifest?.currency ?? "INR";
  const name = plugin?.name ?? listing?.name ?? manifest?.name ?? pluginId;
  const version = plugin?.version ?? listing?.version ?? manifest?.version ?? "—";

  const fixturePass = useMemo(() => {
    if (!bundle || bundle.fixtures.length === 0) return null;
    const failures = validateManifestFixtures(bundle);
    return { total: bundle.fixtures.length, passed: bundle.fixtures.length - failures.length };
  }, [bundle]);

  // A representative parse for "what it parses": prefer a fixture that yields a
  // real transaction breakdown (amount + fields), not a mandate/review fixture
  // — run through the engine so the preview is genuine, not canned.
  const sample = useMemo(() => {
    if (!bundle || !manifest) return null;
    const parse = (f: ManifestWithFixtures["fixtures"][number]) =>
      parseSmsWithManifest(manifest, {
        sender: f.sender,
        body: f.body,
        receivedAt: f.receivedAt,
      });
    let fallback: { body: string; fields: ReturnType<typeof parse>["fields"] } | null = null;
    for (const fixture of bundle.fixtures) {
      const result = parse(fixture);
      const entry = { body: fixture.body, fields: result.fields };
      if (result.fields?.amount) return entry; // real transaction → best preview
      if (!fallback) fallback = entry;
    }
    return fallback;
  }, [bundle, manifest]);

  const meta = placeholderMeta(pluginId);
  const sizeLabel = formatBytes(listing?.registryEntry?.bytes ?? null);

  const refetchPlugins = () => pluginCollection.utils.refetch();

  const onToggle = async (next: boolean) => {
    await setExtensionEnabled(appDb, pluginId, next);
    await refetchPlugins();
  };

  const onInstall = async () => {
    if (!listing?.registryEntry || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const verified = await fetchManifestBundle(listing.registryEntry);
      await installParserBundle(appDb, verified.bundle, {
        source: "registry",
        checksum: verified.checksum,
      });
      await refetchPlugins();
      setMessage(`${name} installed`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Install failed");
    } finally {
      setBusy(false);
    }
  };

  const onUpdate = async () => {
    if (!listing?.registryEntry || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const verified = await fetchManifestBundle(listing.registryEntry);
      const summary = await applyExtensionUpdate(appDb, verified);
      await refetchPlugins();
      setBundle(verified.bundle);
      setMessage(
        `Updated to v${summary.version} · re-checked ${summary.reprocessed} review item(s)`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const onShare = () => {
    void Share.share({
      message: `${name} — a bank SMS parser for Unmiser (${pluginId}). unmiser://extension/${pluginId}`,
    });
  };

  const onRemove = async () => {
    setRemoving(true);
    try {
      await uninstallExtension(appDb, pluginId);
      await refetchPlugins();
      setConfirmRemove(false);
      router.back();
    } catch (caught) {
      setConfirmRemove(false);
      setMessage(caught instanceof Error ? caught.message : "Could not remove extension");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Extension"
        onBack={() => router.back()}
        right={
          <View className="flex-row gap-2">
            <Pressable
              onPress={onShare}
              accessibilityLabel="Share extension"
              className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
            >
              <StyledIonicons name="share-outline" size={18} className="text-foreground" />
            </Pressable>
            {installed ? (
              <Pressable
                onPress={() => setConfirmRemove(true)}
                accessibilityLabel="Remove extension"
                className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-danger active:opacity-70"
              >
                <StyledIonicons name="trash-outline" size={18} className="text-danger" />
              </Pressable>
            ) : null}
          </View>
        }
      />
      <Container isScrollable={false} className="px-4">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-40 pt-2 gap-4"
        >
          {/* Header card */}
          <Card variant="ink" className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
              <SpriteIcon name="bank" size={22} />
            </View>
            <View className="min-w-0 flex-1">
              <Text variant="heading" numberOfLines={1} className="text-[18px]">
                {name}
              </Text>
              <Text numberOfLines={1} className="font-mono text-[13px] text-muted">
                {pluginId} · v{version}
              </Text>
            </View>
            {installed ? (
              <AppSwitch
                value={plugin.enabled}
                onChange={(v) => void onToggle(v)}
                accessibilityLabel={`${name} enabled`}
              />
            ) : (
              <Badge variant="gray">Not added</Badge>
            )}
          </Card>

          <View className="flex-row flex-wrap gap-2">
            <Chip>{manifest?.type ?? "sms-parser"}</Chip>
            <Chip>{currency}</Chip>
            {installed ? (
              <Chip>{`${parsedCount.toLocaleString()} parsed`}</Chip>
            ) : (
              <Chip>{trust}</Chip>
            )}
          </View>

          {/* Trust tier */}
          <Card variant="inverted" className="gap-1.5">
            <Text className="font-mono text-[9px] font-bold uppercase tracking-widest text-background/50">
              Trust tier · {trust}
            </Text>
            <Text variant="heading" className="text-[17px] text-background">
              Safe by construction.
            </Text>
            <Text className="text-[13px] text-background/70">
              Reads only matching SMS — no network, no credentials. Installs without review.
            </Text>
          </Card>

          {/* What it parses */}
          <View className="gap-2">
            <Text variant="caption" className="ml-1">
              What it parses
            </Text>
            {bundleLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : sample ? (
              <Card variant="soft" className="gap-3">
                <HighlightedBody
                  body={sample.body}
                  merchant={sample.fields?.merchant}
                  accent={accent}
                />
                {sample.fields ? (
                  <View className="gap-1.5">
                    <FieldRow
                      label="amount"
                      value={money.format(sample.fields.amount ?? "0", currency)}
                    />
                    {sample.fields.merchant ? (
                      <FieldRow label="merchant" value={sample.fields.merchant} />
                    ) : null}
                    {sample.fields.accountLast4 ? (
                      <FieldRow label="account" value={`••${sample.fields.accountLast4}`} />
                    ) : null}
                    {sample.fields.transactionType ? (
                      <FieldRow label="type" value={sample.fields.transactionType.toLowerCase()} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ) : (
              <Card variant="soft">
                <Text variant="body" className="text-[13px] text-muted">
                  No sample available for this extension.
                </Text>
              </Card>
            )}
          </View>

          {/* Meta line */}
          <View className="flex-row items-center gap-3 px-1">
            <Text className="text-[13px] text-muted">★ {meta.rating}</Text>
            <Text className="text-[13px] text-muted">· {meta.installs} installs</Text>
            <Text className="text-[13px] text-muted">· {meta.license}</Text>
            <Text className="text-[13px] text-muted">· {sizeLabel}</Text>
          </View>

          {fixturePass ? (
            <View className="flex-row items-center gap-2 px-1">
              <SpriteIcon name="check-circle" size={16} color={accent} />
              <Text className="text-[13px] text-foreground">
                {fixturePass.passed === fixturePass.total
                  ? `${fixturePass.total} fixtures pass`
                  : `${fixturePass.passed}/${fixturePass.total} fixtures pass`}{" "}
                · verified on this device
              </Text>
            </View>
          ) : null}

          {message.length > 0 ? (
            <Text selectable variant="body" className="px-1 text-[13px]">
              {message}
            </Text>
          ) : null}

          {/* Update banner (installed + newer in catalog) */}
          {installed && updateAvailable ? (
            <Card variant="soft" className="flex-row items-center gap-3">
              <SpriteIcon name="download-01" size={20} />
              <View className="flex-1">
                <Text variant="heading" className="text-[14px]">
                  Update to {formatVersion(availableVersion!)}
                </Text>
                <Text className="text-[12px] text-muted">ships as a manifest · no app update</Text>
              </View>
              <Pressable
                onPress={() => void onUpdate()}
                disabled={busy}
                className="rounded-[3px] bg-foreground px-5 py-2.5 active:opacity-70"
                style={{ backgroundColor: accent }}
              >
                <Text className="text-[13px] font-bold text-accent-foreground">
                  {busy ? "…" : "Get"}
                </Text>
              </Pressable>
            </Card>
          ) : null}
        </ScrollView>

        {/* Install CTA pinned for the not-installed state */}
        {!installed ? (
          <Pressable
            onPress={() => void onInstall()}
            disabled={busy || !listing?.registryEntry}
            className="mb-6 items-center rounded-[3px] py-4 active:opacity-70"
            style={{ backgroundColor: accent }}
          >
            <Text className="text-[15px] font-bold text-accent-foreground">
              {busy ? "Installing…" : listing?.registryEntry ? "Install extension" : "Unavailable"}
            </Text>
          </Pressable>
        ) : null}
      </Container>

      <ConfirmDialog
        isOpen={confirmRemove}
        onOpenChange={setConfirmRemove}
        icon="trash-outline"
        title="Remove extension?"
        description={`“${name}” will stop parsing new SMS. Transactions it already created are kept. You can reinstall it anytime.`}
        confirmLabel="Remove"
        busy={removing}
        onConfirm={() => void onRemove()}
      />
    </View>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-[13px] text-muted">{label}</Text>
      <Text selectable className="flex-1 text-right text-[13px] font-semibold text-foreground">
        {value}
      </Text>
    </View>
  );
}

/** Renders the sample SMS with the detected merchant highlighted in accent. */
function HighlightedBody({
  body,
  merchant,
  accent,
}: {
  body: string;
  merchant?: string;
  accent: string;
}) {
  if (!merchant) {
    return <Text className="font-mono text-[12px] leading-5 text-muted">{body}</Text>;
  }
  const index = body.toLowerCase().indexOf(merchant.toLowerCase());
  if (index < 0) {
    return <Text className="font-mono text-[12px] leading-5 text-muted">{body}</Text>;
  }
  return (
    <Text className="font-mono text-[12px] leading-5 text-muted">
      {body.slice(0, index)}
      <Text className="font-bold text-foreground" style={{ backgroundColor: accent }}>
        {body.slice(index, index + merchant.length)}
      </Text>
      {body.slice(index + merchant.length)}
    </Text>
  );
}
