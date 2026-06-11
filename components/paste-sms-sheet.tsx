import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { appDb } from "@/db/app-db";
import {
  accountBalanceCollection,
  accountCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { smsReviewCollection } from "@/db/collections";
import { loadEnabledParserManifests } from "@/db/services/extensions";
import { processSms, type SmsProcessOutcome } from "@/db/services/sms-processing";
import { friendlyOutcomeCopy } from "@/lib/onboarding-state";

/**
 * Production "Add from SMS" paste fallback (ROADMAP Phase 2, workstream B):
 * the path for users who denied SMS permission, or want to re-run a missed
 * message. Paste body (+ optional sender) → processSms → friendly confirm.
 * The raw-matches dev harness on the Extensions tab stays __DEV__-oriented;
 * this sheet is the user-facing flow.
 */
export function PasteSmsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const mutedColor = useThemeColor("muted");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<SmsProcessOutcome | null>(null);

  const reset = () => {
    setOutcome(null);
    setError("");
    setBody("");
  };

  const onParse = async () => {
    if (body.trim().length === 0) {
      setError("Paste the SMS message text first.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const manifests = await loadEnabledParserManifests(appDb);
      const nextOutcome = await processSms(appDb, manifests, {
        sender: sender.trim(),
        body: body.trim(),
        receivedAt: new Date().toISOString(),
      });
      setOutcome(nextOutcome);
      await Promise.all([
        transactionCollection.utils.refetch(),
        smsReviewCollection.utils.refetch(),
        accountCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not process this message.");
    } finally {
      setProcessing(false);
    }
  };

  const copy = outcome ? friendlyOutcomeCopy(outcome) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-2xl bg-background px-4 pt-5 pb-8">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-semibold text-foreground">Add from SMS</Text>
                <Pressable
                  onPress={onClose}
                  className="rounded-full border border-border px-3 py-1"
                >
                  <Text className="text-foreground text-xs">Close</Text>
                </Pressable>
              </View>

              {copy === null ? (
                <>
                  <Text className="text-muted text-sm">
                    Paste a bank SMS and Unmiser will read it with your installed extensions.
                  </Text>

                  <View>
                    <Text className="text-muted text-xs mb-1">Sender (optional)</Text>
                    <TextInput
                      value={sender}
                      onChangeText={setSender}
                      placeholder="e.g. VM-HDFCBK-S"
                      placeholderTextColor={mutedColor}
                      autoCapitalize="characters"
                      className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
                    />
                  </View>

                  <View>
                    <Text className="text-muted text-xs mb-1">Message</Text>
                    <TextInput
                      value={body}
                      onChangeText={setBody}
                      placeholder="Paste the SMS text here"
                      placeholderTextColor={mutedColor}
                      multiline
                      textAlignVertical="top"
                      className="min-h-32 rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
                    />
                  </View>

                  {error.length > 0 && <Text className="text-danger text-sm">{error}</Text>}

                  <Pressable
                    onPress={() => void onParse()}
                    disabled={processing}
                    className={
                      processing
                        ? "rounded-xl bg-secondary px-4 py-3 items-center"
                        : "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
                    }
                  >
                    <Text
                      className={
                        processing ? "text-muted font-medium" : "text-background font-medium"
                      }
                    >
                      {processing ? "Reading message..." : "Read message"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View className="gap-4">
                  <View className="rounded-xl border border-border p-4 gap-1">
                    <Text className="text-foreground text-lg font-semibold">{copy.title}</Text>
                    <Text className="text-muted text-sm">{copy.detail}</Text>
                  </View>

                  {outcome?.result.fields && (
                    <View className="rounded-xl border border-border p-4 gap-1">
                      <Text className="text-muted text-xs mb-1">What we read</Text>
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

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={reset}
                      className="flex-1 rounded-xl border border-border px-4 py-3 items-center"
                    >
                      <Text className="text-foreground font-medium">Paste another</Text>
                    </Pressable>
                    <Pressable
                      onPress={onClose}
                      className="flex-1 rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
                    >
                      <Text className="text-background font-medium">Done</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
