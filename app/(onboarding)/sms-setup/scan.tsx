import { router } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { appDb } from "@/db/app-db";
import { appSettingsCollection, smsReviewCollection } from "@/db/collections";
import {
  accountBalanceCollection,
  accountCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { hasSmsPermissions } from "@/lib/android-sms-adapter";
import { markSmsSetupCompleted } from "@/lib/onboarding-state";
import { smsScanTask } from "@/lib/scan";

async function refreshCollections() {
  await Promise.all([
    transactionCollection.utils.refetch(),
    smsReviewCollection.utils.refetch(),
    accountCollection.utils.refetch(),
    accountBalanceCollection.utils.refetch(),
  ]);
}

/**
 * Wizard step 5 of 5: historical inbox scan, then done. Drives the singleton
 * scan-task store (lib/scan, workstream D) — the same task the Extensions tab
 * observes, so a scan started here keeps reporting progress there. Supports
 * checkpoint resume ("Resume scan 4,000/5,300") after cancel/kill.
 */
export default function SmsSetupScanScreen() {
  const scan = useSyncExternalStore(smsScanTask.subscribe, smsScanTask.getState);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    void hasSmsPermissions().then((permissions) => setCanScan(permissions.read));
    void smsScanTask.refreshResumeAvailable();
  }, []);

  const onStart = async (resume: boolean) => {
    await smsScanTask.start({ resume });
    await refreshCollections();
  };

  const onFinish = async () => {
    await markSmsSetupCompleted(appDb);
    await appSettingsCollection.utils.refetch();
    router.replace("/(tabs)");
  };

  const showSummary = scan.processed > 0 || scan.phase !== "idle";

  return (
    <Container isScrollable={false} className="px-4 pt-14">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-16">
        <View className="gap-5">
          <View className="gap-1">
            <Text className="text-muted text-xs">Step 5 of 5</Text>
            <Text className="text-3xl font-semibold text-foreground tracking-tight">
              Scan your inbox
            </Text>
            <Text className="text-muted text-sm">
              Unmiser will read your existing bank SMS and build your transaction history. Confident
              matches save automatically; anything uncertain goes to SMS Review.
            </Text>
          </View>

          {!canScan && (
            <View className="rounded-xl border border-border p-4">
              <Text className="text-muted text-sm">
                Reading existing SMS isn't allowed (READ_SMS not granted), so the scan is skipped.
                New messages can still be parsed if you granted RECEIVE_SMS, and you can always
                paste a message manually.
              </Text>
            </View>
          )}

          {canScan && !scan.running && (
            <Pressable
              onPress={() => void onStart(scan.resumeAvailable)}
              className="rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
            >
              <Text className="text-background font-medium">
                {scan.resumeAvailable
                  ? `Resume scan ${scan.processed.toLocaleString()}/${scan.total.toLocaleString()}`
                  : scan.phase === "completed"
                    ? "Scan again"
                    : "Start scan"}
              </Text>
            </Pressable>
          )}

          {scan.running && (
            <Pressable
              onPress={() => smsScanTask.cancel()}
              className="rounded-xl border border-border px-4 py-3 items-center active:opacity-70"
            >
              <Text className="text-foreground font-medium">Cancel scan</Text>
            </Pressable>
          )}

          {showSummary && (
            <View className="rounded-xl border border-border p-4 gap-1">
              <Text className="text-foreground font-medium">
                {scan.running
                  ? `Scanning… ${scan.processed.toLocaleString()}${
                      scan.total > 0 ? ` of ${scan.total.toLocaleString()}` : ""
                    }`
                  : scan.phase === "cancelled"
                    ? "Scan paused — you can resume any time"
                    : scan.phase === "error"
                      ? "Scan stopped"
                      : scan.phase === "completed"
                        ? "Scan complete"
                        : "Ready to scan"}
              </Text>
              <Text className="text-muted text-sm">
                {scan.saved} transactions saved · {scan.review} for review · {scan.rejected} skipped
              </Text>
              {scan.error && <Text className="text-danger text-sm">{scan.error}</Text>}
            </View>
          )}

          <Pressable
            onPress={() => void onFinish()}
            disabled={scan.running}
            className={
              scan.running
                ? "rounded-xl bg-secondary px-4 py-3 items-center"
                : "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
            }
          >
            <Text
              className={scan.running ? "text-muted font-medium" : "text-background font-medium"}
            >
              {canScan && scan.phase === "idle" ? "Skip scan and finish" : "Finish setup"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
