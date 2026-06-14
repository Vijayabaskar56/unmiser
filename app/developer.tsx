import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Platform, Pressable, ToastAndroid, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, AppSwitch, Card, ConfirmDialog, SpriteIcon, Text } from "@/components/ui";
import { appDb } from "@/db/app-db";
import { subscriptionCollection } from "@/db/collections";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { seedDemoData } from "@/db/services/demo-seed";
import { getHistoricalSmsCount } from "@/lib/android-sms-adapter";
import { sendTestNotification } from "@/lib/notifications";
import { clearParseCache, smsScanTask } from "@/lib/scan";

const StyledIonicons = withUniwind(Ionicons);

// Matches the About screen's version chip.
const APP_VERSION = "1.4.0";
const BUILD_NUMBER = "412";

/** Lightweight transient feedback — Android toast, Alert fallback elsewhere. */
function toast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}

interface DebugToggle {
  key: string;
  title: string;
  description: string;
}

const DEBUG_TOGGLES: DebugToggle[] = [
  { key: "parserLogs", title: "Show parser logs", description: "live SMS → transaction trace" },
  { key: "inspectManifests", title: "Inspect manifests", description: "raw extension JSON" },
  { key: "perfOverlay", title: "Performance overlay", description: "" },
];

interface ConfirmSpec {
  title: string;
  description: string;
  confirmLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  run: () => Promise<void> | void;
}

function runtimeBuildLine(): string {
  // Real values where the runtime exposes them; honest about debug vs release.
  const v = (
    Platform.constants as {
      reactNativeVersion?: { major: number; minor: number; patch: number };
    }
  ).reactNativeVersion;
  const rn = v ? `${v.major}.${v.minor}.${v.patch}` : "—";
  const engine = "HermesInternal" in global ? "hermes" : "jsc";
  return `${engine} · rn ${rn} · ${Platform.OS}`;
}

function ActionRow({
  icon,
  title,
  description,
  onPress,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  onPress: () => void;
  first: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-70" accessibilityRole="button">
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
          <StyledIonicons name={icon} size={20} className="text-foreground" />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="heading" numberOfLines={1} className="text-[16px]">
            {title}
          </Text>
          {description ? (
            <Text variant="body" className="text-[13px]">
              {description}
            </Text>
          ) : null}
        </View>
        <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
      </View>
    </Pressable>
  );
}

export default function DeveloperScreen() {
  const router = useRouter();

  // Debug flags are ephemeral dev-only state (no persistence needed).
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const setFlag = (key: string) => (v: boolean) => setFlags((prev) => ({ ...prev, [key]: v }));

  const [smsCount, setSmsCount] = useState<number | null>(null);
  useEffect(() => {
    void getHistoricalSmsCount()
      .then(setSmsCount)
      .catch(() => setSmsCount(null));
  }, []);

  const refreshDataCollections = () =>
    Promise.all([
      accountCollection.utils.refetch(),
      accountBalanceCollection.utils.refetch(),
      transactionCollection.utils.refetch(),
      categoryCollection.utils.refetch(),
      subscriptionCollection.utils.refetch(),
    ]);

  // Live scan progress for the Re-parse row + a toast when a run settles.
  const scan = useSyncExternalStore(smsScanTask.subscribe, smsScanTask.getState);
  const wasRunning = useRef(scan.running);
  useEffect(() => {
    if (wasRunning.current && !scan.running) {
      void refreshDataCollections();
      if (scan.phase === "completed") {
        toast(`Re-parse complete · ${scan.saved} saved · ${scan.review} to review`);
      } else if (scan.phase === "cancelled") {
        toast(`Re-parse stopped at ${scan.processed.toLocaleString()}`);
      } else if (scan.phase === "error") {
        toast(`Re-parse failed${scan.error ? `: ${scan.error}` : ""}`);
      }
    }
    wasRunning.current = scan.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.running, scan.phase]);

  // Single confirm dialog, parameterised by the pending action.
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const onTestNotification = async () => {
    const ok = await sendTestNotification();
    toast(ok ? "Test notification sent" : "Notifications blocked — enable them in settings");
  };

  const onReparse = () => {
    if (scan.running) {
      smsScanTask.cancel();
      return;
    }
    setConfirm({
      title: "Re-parse all SMS",
      description:
        "Re-scan the whole inbox through the enabled parsers. Existing transactions are de-duplicated, so this is safe.",
      confirmLabel: "Re-parse",
      icon: "refresh",
      // Fire-and-forget: progress shows in the row, a toast fires on completion.
      run: () => {
        void smsScanTask.start({ resume: false });
        toast("Re-parse started");
      },
    });
  };

  const onSeed = () => {
    setConfirm({
      title: "Seed demo data",
      description: "Insert sample accounts, transactions and a subscription?",
      confirmLabel: "Seed",
      icon: "add",
      run: async () => {
        const result = await seedDemoData(appDb);
        await refreshDataCollections();
        toast(
          result.seeded
            ? `Seeded ${result.accounts} accounts · ${result.transactions} txns · 1 subscription`
            : (result.reason ?? "Already seeded"),
        );
      },
    });
  };

  const onClearCache = () => {
    setConfirm({
      title: "Clear parse cache",
      description:
        "Drop the scan checkpoint and cached parser manifests. Your transactions are not touched.",
      confirmLabel: "Clear",
      icon: "trash-outline",
      run: async () => {
        await clearParseCache();
        toast("Parse cache cleared");
      },
    });
  };

  const onConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
    } catch (e) {
      toast(`Failed: ${String((e as Error)?.message ?? e)}`);
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const smsCountLabel =
    smsCount == null ? "scan inbox to count" : `${smsCount.toLocaleString()} messages`;
  const reparseLabel = scan.running
    ? `scanning ${scan.processed.toLocaleString()}/${scan.total ? scan.total.toLocaleString() : "…"} · tap to stop`
    : smsCountLabel;

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Developer options"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        right={
          <Pressable
            onPress={() => router.push("/extensions")}
            accessibilityLabel="SMS console"
            className="h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
          >
            <StyledIonicons name="code-slash" size={18} className="text-foreground" />
          </Pressable>
        }
      />
      <Container className="px-4">
        {/* Warning callout */}
        <View className="mt-3 flex-row items-start gap-2.5 rounded-[3px] bg-surface-secondary px-3.5 py-3">
          <SpriteIcon name="info-circle" size={18} />
          <Text variant="body" className="flex-1 text-[13px]">
            Hidden behind 7 taps on the version number. Be careful in here.
          </Text>
        </View>

        {/* Debug */}
        <Text variant="caption" className="mb-2 ml-1 mt-5">
          Debug
        </Text>
        <Card variant="soft" className="gap-0 p-0">
          {DEBUG_TOGGLES.map((t, i) => (
            <View key={t.key}>
              {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
              <View className="flex-row items-center gap-3 px-3.5 py-3.5">
                <View className="min-w-0 flex-1">
                  <Text variant="heading" className="text-[16px]">
                    {t.title}
                  </Text>
                  {t.description ? (
                    <Text variant="body" className="text-[13px]">
                      {t.description}
                    </Text>
                  ) : null}
                </View>
                <AppSwitch
                  value={flags[t.key] ?? false}
                  onChange={setFlag(t.key)}
                  accessibilityLabel={t.title}
                />
              </View>
            </View>
          ))}
        </Card>

        {/* Actions */}
        <Text variant="caption" className="mb-2 ml-1 mt-5">
          Actions
        </Text>
        <Card variant="soft" className="gap-0 p-0">
          <ActionRow
            icon="notifications-outline"
            title="Send test notification"
            description="fire a local notification now"
            onPress={() => void onTestNotification()}
            first
          />
          <ActionRow
            icon={scan.running ? "stop-circle-outline" : "refresh"}
            title="Re-parse all SMS"
            description={reparseLabel}
            onPress={onReparse}
            first={false}
          />
          <ActionRow
            icon="add"
            title="Seed demo data"
            description="sample accounts & txns"
            onPress={onSeed}
            first={false}
          />
          <ActionRow
            icon="trash-outline"
            title="Clear parse cache"
            onPress={onClearCache}
            first={false}
          />
        </Card>

        {/* Build info */}
        <Card variant="inverted" className="mt-5 gap-1">
          <Text className="font-mono text-[11px] uppercase tracking-wider text-background/50">
            Build
          </Text>
          <Text className="font-mono text-[13px] text-accent">
            {APP_VERSION} ({BUILD_NUMBER}) · {__DEV__ ? "debug" : "release"}
          </Text>
          <Text className="font-mono text-[13px] text-accent">{runtimeBuildLine()}</Text>
        </Card>

        <View className="h-8" />
      </Container>

      <ConfirmDialog
        isOpen={confirm != null}
        onOpenChange={(open) => !open && setConfirm(null)}
        icon={confirm?.icon}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        busy={confirmBusy}
        onConfirm={onConfirm}
      />
    </View>
  );
}
