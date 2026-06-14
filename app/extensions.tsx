import { count, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, ToastAndroid, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { Container } from "@/components/container";
import {
  accountBalanceCollection,
  accountCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { pluginCollection, smsReviewCollection, subscriptionCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import { createAccount } from "@/db/services/account-ops";
import {
  installBundledParserExtensions,
  loadEnabledParserManifests,
  setExtensionEnabled,
} from "@/db/services/extensions";
import { processSms, pruneReviewRows, type SmsProcessOutcome } from "@/db/services/sms-processing";
import { runPhase3Uat } from "@/db/services/phase3-uat";
import {
  hasSmsPermissions,
  isAndroidSmsAdapterAvailable,
  requestSmsPermissions,
  showSmsNotification,
  subscribeToIncomingSms,
  type SmsPermissionState,
} from "@/lib/android-sms-adapter";
import { getScanEngineMode, smsScanTask } from "@/lib/scan";
import { bundledParserBundles } from "@/lib/parser/manifests";
import type { Plugin, UnrecognizedSms } from "@/db/schema";

const DEFAULT_BODY =
  "Rs.1250.00 debited from HDFC Bank A/c XX1234 at AMAZON on 09/06/26. Avl bal:INR 88,750.20";
const PASTE_FIXTURES = [
  {
    label: "Mandate",
    body: "E-Mandate! Rs.1,499 will be deducted on 15/07/26, 09:00:00 For NETFLIX mandate UMN HDFCUMN12345",
  },
  {
    label: "Bad mandate",
    body: "E-Mandate! Rs.1,499 will be deducted soon For NETFLIX mandate UMN HDFCUMN12345",
  },
  {
    label: "Swiggy",
    body: "Rs.322.00 debited from HDFC Bank A/c XX1234 at SWIGGY on 13/06/26. Avl bal:INR 87,900.00",
  },
  {
    label: "Block",
    body: "Rs.654.00 debited from HDFC Bank A/c XX1234 at TEST-BLOCK on 12/06/26. Avl bal:INR 87,000.00",
  },
] as const;
// The review list renders inside a plain ScrollView (no virtualization); a full
// historical scan can leave thousands of review rows, and mounting them all
// hangs the JS thread and crashes Fabric. Render only the newest few.
const REVIEW_RENDER_LIMIT = 25;

function outcomeText(outcome: SmsProcessOutcome | null): string {
  if (!outcome) return "";
  if (outcome.kind === "saved") return `Saved transaction #${outcome.transactionId}`;
  if (outcome.kind === "mandate") return `Saved subscription #${outcome.subscriptionId}`;
  if (outcome.kind === "review") return `Sent to SMS Review: ${outcome.status}`;
  if (outcome.kind === "duplicate") return `Duplicate skipped: #${outcome.transactionId}`;
  return `Rejected: ${outcome.result.reasons.join(", ")}`;
}

function reviewTitle(row: UnrecognizedSms): string {
  if (row.reviewReason === "BLOCKED_BY_RULE") {
    try {
      const fields = row.parsedFieldsJson ? JSON.parse(row.parsedFieldsJson) : null;
      if (typeof fields?.blockingRuleName === "string" && fields.blockingRuleName.length > 0) {
        return `Blocked by ${fields.blockingRuleName}`;
      }
    } catch {
      // Fall through to the stored reason.
    }
  }
  return `${row.status} · ${row.reviewReason}`;
}

function reviewSubtitle(row: UnrecognizedSms): string | null {
  if (row.reviewReason !== "BLOCKED_BY_RULE") return null;
  try {
    const fields = row.parsedFieldsJson ? JSON.parse(row.parsedFieldsJson) : null;
    if (typeof fields?.blockingRuleId === "string" && fields.blockingRuleId.length > 0) {
      return `Edit rule ${fields.blockingRuleId}`;
    }
  } catch {
    return null;
  }
  return null;
}

function showTestToast(message: string): void {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

export default function ExtensionsScreen() {
  const mutedColor = useThemeColor("muted");
  // Ordering, the newest-25 cap, and the review count all live in the live
  // queries so they are maintained incrementally (d2ts) instead of re-sorting
  // full arrays on the JS thread every render.
  const { data: plugins } = useLiveQuery((q) =>
    q.from({ plugin: pluginCollection }).orderBy(({ plugin }) => plugin.name, "asc"),
  );
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }));
  const { data: reviewItems } = useLiveQuery((q) =>
    q
      .from({ review: smsReviewCollection })
      .orderBy(({ review }) => review.createdAt, "desc")
      .limit(REVIEW_RENDER_LIMIT),
  );
  const { data: reviewCounts } = useLiveQuery((q) =>
    q.from({ review: smsReviewCollection }).select(({ review }) => ({ total: count(review.id) })),
  );

  const [selectedPluginId, setSelectedPluginId] = useState("in.hdfc.bank");
  const [last4, setLast4] = useState("1234");
  const [sender, setSender] = useState("VM-HDFCBK-S");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<SmsProcessOutcome | null>(null);
  const [permissions, setPermissions] = useState<SmsPermissionState>({
    read: false,
    receive: false,
  });
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  // Scan progress comes from the singleton scan-task store (lib/scan), which
  // the onboarding wizard's final step will also observe.
  const scan = useSyncExternalStore(smsScanTask.subscribe, smsScanTask.getState);

  const sortedPlugins = plugins ?? [];
  const selectedPlugin =
    sortedPlugins.find((plugin) => plugin.pluginId === selectedPluginId) ??
    sortedPlugins[0] ??
    null;
  const providerAccounts = useMemo(
    () =>
      [...(accounts ?? [])]
        .filter((account) => account.canonicalBank === selectedPlugin?.pluginId)
        .sort((a, b) => a.accountLast4.localeCompare(b.accountLast4)),
    [accounts, selectedPlugin],
  );
  const reviewItemCount = reviewCounts?.[0]?.total ?? 0;
  const sortedReviewItems = reviewItems ?? [];

  useEffect(() => {
    void hasSmsPermissions().then(setPermissions);
    // Surface "Resume scan N/M" when an interrupted checkpoint exists.
    void smsScanTask.refreshResumeAvailable();
  }, []);

  // Refresh the live collections once a scan settles (the task itself stays
  // UI-agnostic; collection refetches are a screen concern).
  useEffect(() => {
    if (scan.running || scan.phase === "idle") return;
    void refreshPhase2Collections();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.running, scan.phase]);

  // Hygiene pass on mount: drop review rows that fail the ADR-0015 capture
  // gate (rows hoarded before the gate existed). Mirrors the original app's
  // post-scan cleanupOldEntries().
  useEffect(() => {
    void (async () => {
      const pruned = await pruneReviewRows(appDb);
      if (pruned > 0) await smsReviewCollection.utils.refetch();
    })();
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;
    return subscribeToIncomingSms((record) => {
      void (async () => {
        const manifests = await loadEnabledParserManifests(appDb);
        const nextOutcome = await processSms(appDb, manifests, record);
        const text = outcomeText(nextOutcome);
        setOutcome(nextOutcome);
        setMessage(`Realtime SMS: ${text}`);
        await showSmsNotification("Unmiser SMS parsed", text);
        await refreshPhase2Collections();
      })();
    });
  }, [realtimeEnabled]);

  const refreshPhase2Collections = async () => {
    await Promise.all([
      pluginCollection.utils.refetch(),
      smsReviewCollection.utils.refetch(),
      subscriptionCollection.utils.refetch(),
      accountCollection.utils.refetch(),
      transactionCollection.utils.refetch(),
      accountBalanceCollection.utils.refetch(),
    ]);
  };

  const onInstallBundled = async () => {
    await installBundledParserExtensions(appDb);
    await refreshPhase2Collections();
    setMessage("Bundled extensions installed");
  };

  const onTogglePlugin = async (plugin: Plugin) => {
    await setExtensionEnabled(appDb, plugin.pluginId, !plugin.enabled);
    await refreshPhase2Collections();
  };

  const onCreateProviderAccount = async () => {
    if (!selectedPlugin || last4.trim().length === 0) return;
    await createAccount(appDb, {
      bankName: selectedPlugin.name,
      accountLast4: last4.trim(),
      canonicalBank: selectedPlugin.pluginId,
      currency: "INR",
      kind: "bank",
      iconName: "type_finance_bank",
    });
    await refreshPhase2Collections();
    setMessage(`Linked ${selectedPlugin.name} account ${last4.trim()}`);
  };

  const processBody = async (bodyToProcess: string) => {
    setProcessing(true);
    setMessage("");
    try {
      const manifests = await loadEnabledParserManifests(appDb);
      const nextOutcome = await processSms(appDb, manifests, {
        sender,
        body: bodyToProcess,
        receivedAt: new Date().toISOString(),
      });
      setOutcome(nextOutcome);
      const text = outcomeText(nextOutcome);
      setMessage(text);
      showTestToast(text);
      await refreshPhase2Collections();
    } catch (error) {
      const text = error instanceof Error ? error.message : "SMS processing failed";
      setMessage(text);
      showTestToast(text);
    } finally {
      setProcessing(false);
    }
  };

  const onProcessPaste = async () => {
    await processBody(body);
  };

  const onProcessFixture = async (fixture: (typeof PASTE_FIXTURES)[number]) => {
    setBody(fixture.body);
    await processBody(fixture.body);
  };

  const onRunPhase3Uat = async () => {
    setProcessing(true);
    setMessage("");
    try {
      const result = await runPhase3Uat(appDb);
      await refreshPhase2Collections();
      setMessage(`Phase 3 UAT ${JSON.stringify(result)}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Phase 3 UAT failed";
      setMessage(text);
      showTestToast(text);
    } finally {
      setProcessing(false);
    }
  };

  const onRequestPermissions = async () => {
    const next = await requestSmsPermissions();
    setPermissions(next);
    setMessage(
      next.read && next.receive ? "SMS permissions granted" : "SMS permissions not granted",
    );
  };

  const onStartScan = (resume: boolean) => {
    if (scan.running) return;
    void smsScanTask.start({ resume });
  };

  const onCancelScan = () => {
    smsScanTask.cancel();
  };

  const scanStatusText = (() => {
    if (scan.phase === "idle" && !scan.resumeAvailable) return "No scan run yet.";
    const counts = `${scan.processed}/${scan.total || "?"} · ${scan.saved} saved · ${scan.mandates} mandates · ${scan.review} review · ${scan.rejected} rejected/skipped`;
    if (scan.running) return `Scanning ${counts} · engine: ${getScanEngineMode()}`;
    if (scan.phase === "error") return `Scan failed: ${scan.error ?? "unknown"} · ${counts}`;
    if (scan.phase === "cancelled") return `Scan cancelled at ${counts}`;
    if (scan.phase === "completed") return `Scan complete: ${counts}`;
    return counts;
  })();

  return (
    <Container isScrollable={false} className="px-4 pt-6">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-40"
      >
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Extensions
            </Text>
            <Text className="text-muted text-sm">
              Install parser extensions, link accounts, and run SMS parsing.
            </Text>
          </View>

          <View className="rounded-xl border border-border p-4 gap-3">
            <Text className="text-foreground text-lg font-semibold">Android SMS Adapter</Text>
            <Text className="text-muted text-xs">
              {isAndroidSmsAdapterAvailable()
                ? "Native adapter available"
                : "Native adapter unavailable in this runtime"}
            </Text>
            <Text className="text-muted text-xs">
              READ_SMS {permissions.read ? "granted" : "denied"} · RECEIVE_SMS{" "}
              {permissions.receive ? "granted" : "denied"}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => void onRequestPermissions()}
                className="flex-1 rounded-xl bg-foreground px-3 py-3 items-center active:opacity-70"
              >
                <Text className="text-background text-xs font-medium">Request SMS</Text>
              </Pressable>
              <Pressable
                onPress={() => (scan.running ? onCancelScan() : onStartScan(false))}
                disabled={!permissions.read}
                className={
                  !permissions.read
                    ? "flex-1 rounded-xl bg-secondary px-3 py-3 items-center"
                    : "flex-1 rounded-xl bg-foreground px-3 py-3 items-center active:opacity-70"
                }
              >
                <Text
                  className={
                    !permissions.read
                      ? "text-muted text-xs font-medium"
                      : "text-background text-xs font-medium"
                  }
                >
                  {scan.running ? "Cancel scan" : "Full scan"}
                </Text>
              </Pressable>
            </View>
            {scan.resumeAvailable && !scan.running && (
              <Pressable
                onPress={() => onStartScan(true)}
                disabled={!permissions.read}
                className="rounded-xl border border-foreground px-3 py-3 items-center active:opacity-70"
              >
                <Text className="text-foreground text-xs font-medium">
                  Resume scan {scan.processed}/{scan.total || "?"}
                </Text>
              </Pressable>
            )}
            <Text className="text-muted text-xs">{scanStatusText}</Text>
            <Pressable
              onPress={() => setRealtimeEnabled((enabled) => !enabled)}
              className={
                realtimeEnabled
                  ? "rounded-xl border border-foreground px-3 py-3 items-center"
                  : "rounded-xl border border-border px-3 py-3 items-center"
              }
            >
              <Text className="text-foreground text-xs font-medium">
                Realtime listener {realtimeEnabled ? "enabled" : "disabled"}
              </Text>
            </Pressable>
          </View>

          <View className="rounded-xl border border-border p-4 gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-foreground text-lg font-semibold">Installed extensions</Text>
                <Text className="text-muted text-xs">
                  {sortedPlugins.length} available from bundled manifests
                </Text>
              </View>
              <Pressable
                onPress={() => void onInstallBundled()}
                className="rounded-xl bg-foreground px-3 py-2 active:opacity-70"
              >
                <Text className="text-background text-xs font-medium">Install</Text>
              </Pressable>
            </View>

            {sortedPlugins.length === 0 ? (
              <Text className="text-muted">No extensions installed yet.</Text>
            ) : (
              sortedPlugins.map((plugin) => (
                <Pressable
                  key={plugin.pluginId}
                  onPress={() => setSelectedPluginId(plugin.pluginId)}
                  className={
                    selectedPluginId === plugin.pluginId
                      ? "rounded-xl border border-foreground p-3 gap-2"
                      : "rounded-xl border border-border p-3 gap-2"
                  }
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">{plugin.name}</Text>
                      <Text selectable className="text-muted text-xs">
                        {plugin.pluginId} · v{plugin.version}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void onTogglePlugin(plugin)}
                      className={
                        plugin.enabled
                          ? "rounded-full bg-foreground px-3 py-2"
                          : "rounded-full border border-border px-3 py-2"
                      }
                    >
                      <Text
                        className={
                          plugin.enabled ? "text-background text-xs" : "text-foreground text-xs"
                        }
                      >
                        {plugin.enabled ? "Enabled" : "Disabled"}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <View className="rounded-xl border border-border p-4 gap-4">
            <View>
              <Text className="text-foreground text-lg font-semibold">Provider account</Text>
              <Text className="text-muted text-xs">
                Add account last-4 so high-confidence SMS can save automatically.
              </Text>
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">Account last 4</Text>
              <TextInput
                value={last4}
                onChangeText={setLast4}
                keyboardType="number-pad"
                placeholder="1234"
                placeholderTextColor={mutedColor}
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <Pressable
              onPress={() => void onCreateProviderAccount()}
              className="rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
            >
              <Text className="text-background font-medium">Link account</Text>
            </Pressable>

            {providerAccounts.length > 0 && (
              <View className="gap-1">
                <Text className="text-muted text-xs">Linked accounts</Text>
                {providerAccounts.map((account) => (
                  <Text key={account.id} className="text-foreground text-sm">
                    {account.bankName} · {account.accountLast4}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border p-4 gap-4">
            <View>
              <Text className="text-foreground text-lg font-semibold">Paste SMS</Text>
              <Text className="text-muted text-xs">
                Runs the DB-backed parser pipeline and writes transactions or review items.
              </Text>
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">Sender</Text>
              <TextInput
                value={sender}
                onChangeText={setSender}
                placeholder="VM-HDFCBK-S"
                placeholderTextColor={mutedColor}
                autoCapitalize="characters"
                className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-muted text-xs mb-1">SMS body</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Paste bank SMS"
                placeholderTextColor={mutedColor}
                multiline
                textAlignVertical="top"
                className="min-h-32 rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
              />
            </View>

            {__DEV__ ? (
              <View className="gap-2">
                <Pressable
                  disabled={processing}
                  accessibilityLabel="Run Phase 3 UAT"
                  accessibilityRole="button"
                  className="rounded-lg border border-primary px-3 py-2 items-center active:opacity-70"
                  onPress={() => void onRunPhase3Uat()}
                >
                  <Text className="text-primary text-xs font-semibold">Run Phase 3 UAT</Text>
                </Pressable>
                {PASTE_FIXTURES.map((fixture) => (
                  <Pressable
                    key={fixture.label}
                    disabled={processing}
                    accessibilityLabel={`Process ${fixture.label}`}
                    accessibilityRole="button"
                    className="rounded-lg border border-border px-3 py-2 items-center active:opacity-70"
                    onPress={() => void onProcessFixture(fixture)}
                  >
                    <Text className="text-foreground text-xs font-medium">
                      Process {fixture.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => void onProcessPaste()}
              disabled={processing}
              className={
                processing
                  ? "rounded-xl bg-secondary px-4 py-3 items-center"
                  : "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
              }
            >
              <Text
                className={processing ? "text-muted font-medium" : "text-background font-medium"}
              >
                {processing ? "Processing..." : "Process SMS"}
              </Text>
            </Pressable>

            {message.length > 0 && (
              <Text selectable className="text-foreground text-sm">
                {message}
              </Text>
            )}

            {outcome?.result.fields && (
              <View className="gap-1">
                <Text className="text-muted text-xs">Parsed fields</Text>
                {Object.entries(outcome.result.fields).map(([key, value]) => (
                  <View key={key} className="flex-row justify-between gap-3">
                    <Text className="text-muted text-sm">{key}</Text>
                    <Text selectable className="text-foreground text-sm text-right flex-1">
                      {String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border p-4 gap-3">
            <View>
              <Text className="text-foreground text-lg font-semibold">SMS Review</Text>
              <Text className="text-muted text-xs">
                {reviewItemCount} messages need attention
                {reviewItemCount > REVIEW_RENDER_LIMIT
                  ? ` · showing latest ${REVIEW_RENDER_LIMIT}`
                  : ""}
              </Text>
            </View>

            {sortedReviewItems.length === 0 ? (
              <Text className="text-muted">No review items.</Text>
            ) : (
              sortedReviewItems.map((item) => (
                <View key={item.id} className="rounded-xl border border-border p-3 gap-1">
                  <Text className="text-foreground font-medium">{reviewTitle(item)}</Text>
                  {reviewSubtitle(item) ? (
                    <Text className="text-primary text-xs font-medium">{reviewSubtitle(item)}</Text>
                  ) : null}
                  <Text selectable className="text-muted text-xs">
                    {item.sender} · {item.receivedAt}
                  </Text>
                  <Text selectable className="text-foreground text-sm">
                    {item.smsBody}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View className="rounded-xl border border-border p-4 gap-2">
            <Text className="text-foreground text-lg font-semibold">Bundled fixtures</Text>
            {bundledParserBundles.map((bundle) => (
              <Text key={bundle.manifest.pluginId} className="text-muted text-sm">
                {bundle.manifest.name}: {bundle.fixtures.length} fixture(s)
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
