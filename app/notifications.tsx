import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { QuietHoursEditor } from "@/components/quiet-hours-editor";
import { AppBar, AppSwitch, Card, SpriteIcon, Text } from "@/components/ui";
import { appSettingsCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import {
  setLargeThreshold,
  setNotificationPref,
  setQuietHours,
} from "@/db/services/notification-settings";
import {
  type NotificationToggleField,
  notificationPrefsFromMap,
  quietHoursLabel,
} from "@/lib/notifications/prefs";
import { ensureNotificationPermission, syncScheduledNotifications } from "@/lib/notifications";
import * as money from "@/lib/money";

const StyledIonicons = withUniwind(Ionicons);

type PrefField = NotificationToggleField;

interface ToggleDef {
  field: PrefField;
  title: string;
  description: string;
}

const MONEY_TOGGLES: ToggleDef[] = [
  {
    field: "everyTransaction",
    title: "Every transaction",
    description: "a ping as each SMS is logged",
  },
  {
    field: "largeTransaction",
    title: "Large transactions",
    description: "over ₹5,000",
  },
  {
    field: "budgetWarnings",
    title: "Budget warnings",
    description: "at 80% and 100% of a limit",
  },
  {
    field: "subscriptionRenewals",
    title: "Subscription renewals",
    description: "2 days before a charge",
  },
];

const APP_TOGGLES: ToggleDef[] = [
  {
    field: "unrecognisedSms",
    title: "Unrecognised SMS",
    description: "when a sender needs a rule",
  },
  {
    field: "weeklyReview",
    title: "Weekly review",
    description: "Sunday, 6:00 pm",
  },
];

function ToggleRow({
  def,
  value,
  onChange,
  first,
  disabled,
}: {
  def: ToggleDef;
  value: boolean;
  onChange: (v: boolean) => void;
  first: boolean;
  disabled?: boolean;
}) {
  return (
    <View>
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <View className="min-w-0 flex-1">
          <Text variant="heading" className="text-[16px]">
            {def.title}
          </Text>
          <Text variant="body" className="text-[13px]">
            {def.description}
          </Text>
        </View>
        <AppSwitch
          value={value}
          onChange={onChange}
          isDisabled={disabled}
          accessibilityLabel={def.title}
        />
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();

  // Preferences are persisted in app_settings and read reactively here, like the
  // rest of the app (profile/appearance). Writes go through the service and then
  // refetch the collection so the live query re-renders.
  const { data: settingRows } = useLiveQuery((q) => q.from({ setting: appSettingsCollection }), []);
  const prefs = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of settingRows ?? []) map[row.key] = row.value;
    return notificationPrefsFromMap(map);
  }, [settingRows]);

  const persist = async (field: PrefField, value: boolean) => {
    await setNotificationPref(appDb, field, value);
    await appSettingsCollection.utils.refetch();
    // Re-evaluate scheduled notifications (weekly review / subscription renewals)
    // whenever a relevant pref or the master switch changes.
    await syncScheduledNotifications(appDb);
  };

  const onToggleMaster = async (value: boolean) => {
    // Turning the master switch on prompts for OS permission (Android 13+/iOS).
    if (value) await ensureNotificationPermission();
    await persist("pushEnabled", value);
  };

  const setField = (field: PrefField) => (value: boolean) => void persist(field, value);

  const mutedColor = useThemeColor("muted");
  const [quietOpen, setQuietOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);

  const persistQuiet = async (startMin: number, endMin: number) => {
    await setQuietHours(appDb, startMin, endMin);
    await appSettingsCollection.utils.refetch();
  };

  const commitThreshold = async () => {
    if (thresholdDraft == null) return;
    // Floor at 1: a threshold of 0 would make every transaction "large" and spam notifications.
    const next = Math.max(1, Math.round(Number(thresholdDraft) || 0));
    setThresholdDraft(null);
    await setLargeThreshold(appDb, next);
    await appSettingsCollection.utils.refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Notifications"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        {/* Master switch */}
        <Card variant="ink" className="mt-3 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-border">
            <SpriteIcon name="bell-02" size={18} />
          </View>
          <Text variant="heading" className="flex-1 text-[15px]">
            Push notifications delivered on-device · no servers
          </Text>
          <AppSwitch
            value={prefs.pushEnabled}
            onChange={(v) => void onToggleMaster(v)}
            accessibilityLabel="Push notifications"
          />
        </Card>

        {/* Money */}
        <Text variant="caption" className="mb-2 ml-1 mt-5">
          Money
        </Text>
        <Card variant="soft" className="gap-0 p-0">
          {MONEY_TOGGLES.map((def, i) => {
            const showThreshold =
              def.field === "largeTransaction" && prefs.pushEnabled && prefs.largeTransaction;
            const rowDef =
              def.field === "largeTransaction"
                ? {
                    ...def,
                    description: `over ${money.format(String(prefs.largeThreshold), "INR")}`,
                  }
                : def;
            return (
              <View key={def.field}>
                <ToggleRow
                  def={rowDef}
                  value={prefs.pushEnabled && prefs[def.field]}
                  onChange={setField(def.field)}
                  first={i === 0}
                  disabled={!prefs.pushEnabled}
                />
                {showThreshold ? (
                  <View className="flex-row items-center gap-3 px-3.5 pb-3.5">
                    <View className="w-10" />
                    <Text variant="body" className="flex-1 text-[13px]">
                      Alert above
                    </Text>
                    <View className="flex-row items-center rounded-[3px] border border-border bg-surface px-3 py-1.5">
                      <Text className="text-[15px] font-semibold text-foreground">₹</Text>
                      <TextInput
                        value={thresholdDraft ?? String(prefs.largeThreshold)}
                        onChangeText={setThresholdDraft}
                        onEndEditing={() => void commitThreshold()}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        placeholderTextColor={mutedColor}
                        className="min-w-[64px] text-[15px] font-semibold text-foreground"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        {/* App */}
        <Text variant="caption" className="mb-2 ml-1 mt-5">
          App
        </Text>
        <Card variant="soft" className="gap-0 p-0">
          {APP_TOGGLES.map((def, i) => (
            <ToggleRow
              key={def.field}
              def={def}
              value={prefs.pushEnabled && prefs[def.field]}
              onChange={setField(def.field)}
              first={i === 0}
              disabled={!prefs.pushEnabled}
            />
          ))}
          <View className="mx-3.5 h-px bg-separator" />
          <Pressable
            onPress={() => setQuietOpen((o) => !o)}
            className="flex-row items-center gap-3 px-3.5 py-3.5 active:opacity-70"
            accessibilityRole="button"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full border border-border">
              <SpriteIcon name="moon-01" size={18} />
            </View>
            <Text variant="heading" className="flex-1 text-[16px]">
              Quiet hours
            </Text>
            <Text className="text-[15px] font-semibold text-foreground">
              {quietHoursLabel(prefs.quietStartMin, prefs.quietEndMin)}
            </Text>
            <StyledIonicons
              name={quietOpen ? "chevron-down" : "chevron-forward"}
              size={16}
              className="text-muted"
            />
          </Pressable>
          {quietOpen ? (
            <>
              <View className="mx-3.5 h-px bg-separator" />
              <QuietHoursEditor
                startMin={prefs.quietStartMin}
                endMin={prefs.quietEndMin}
                onChange={(s, e) => void persistQuiet(s, e)}
              />
            </>
          ) : null}
        </Card>

        <View className="h-8" />
      </Container>
    </View>
  );
}
