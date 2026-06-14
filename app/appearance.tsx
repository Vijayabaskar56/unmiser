import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Container } from "@/components/container";
import { AppBar, AppSlider, AppSwitch, Card, Segmented, Text } from "@/components/ui";
import { appSettingsCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import {
  setAccent,
  setAppearanceToggle,
  setTextScale,
  setTheme,
} from "@/db/services/appearance-settings";
import {
  ACCENTS,
  accentHex,
  appearancePrefsFromMap,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  type ThemeMode,
} from "@/lib/appearance/prefs";

const THEME_TABS = ["Light", "Dark", "Auto"];
const themeToTab = (t: ThemeMode) => (t === "light" ? "Light" : t === "dark" ? "Dark" : "Auto");
const tabToTheme = (t: string): ThemeMode =>
  t === "Light" ? "light" : t === "Dark" ? "dark" : "auto";

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-3.5 py-3.5">
      <Text variant="heading" className="text-[15px]">
        {label}
      </Text>
      <AppSwitch value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

export default function AppearanceScreen() {
  const router = useRouter();
  const { data: settingRows } = useLiveQuery((q) => q.from({ s: appSettingsCollection }));
  const prefs = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of settingRows ?? []) map[row.key] = row.value;
    return appearancePrefsFromMap(map);
  }, [settingRows]);

  // Local mirror so the Preview tracks the slider drag live; persisted on release.
  const [dragScale, setDragScale] = useState<number | null>(null);
  const previewScale = dragScale ?? prefs.textScale;

  const refetch = () => appSettingsCollection.utils.refetch();
  const onTheme = (tab: string) => void setTheme(appDb, tabToTheme(tab)).then(refetch);
  const onAccent = (id: string) => void setAccent(appDb, id).then(refetch);
  const onToggle = (field: "backgroundBlur" | "compactDensity" | "tabBarLabels", v: boolean) =>
    void setAppearanceToggle(appDb, field, v).then(refetch);

  const previewAccent = accentHex(prefs.accentId);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Appearance"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        {/* THEME */}
        <Text variant="caption" className="mb-2 mt-3">
          Theme
        </Text>
        <Segmented options={THEME_TABS} value={themeToTab(prefs.theme)} onChange={onTheme} />

        {/* ACCENT */}
        <Text variant="caption" className="mb-2 mt-6">
          Accent
        </Text>
        <View className="flex-row gap-4">
          {ACCENTS.map((a) => {
            const selected = a.id === prefs.accentId;
            return (
              <Pressable
                key={a.id}
                onPress={() => onAccent(a.id)}
                accessibilityLabel={`Accent ${a.id}`}
                className={
                  selected
                    ? "h-14 w-14 items-center justify-center rounded-full border-[2px] border-foreground"
                    : "h-14 w-14 items-center justify-center rounded-full"
                }
              >
                <View
                  className="rounded-full border-[1.3px] border-foreground"
                  style={{ width: 40, height: 40, backgroundColor: a.hex }}
                />
              </Pressable>
            );
          })}
        </View>

        {/* TEXT SIZE */}
        <Text variant="caption" className="mb-2 mt-6">
          Text size
        </Text>
        {settingRows ? (
          <AppSlider
            defaultValue={prefs.textScale}
            minValue={MIN_TEXT_SCALE}
            maxValue={MAX_TEXT_SCALE}
            step={0.01}
            onChange={setDragScale}
            onChangeEnd={(scale) => {
              setDragScale(scale);
              // Persist only on release (the DB write is naturally debounced to
              // gesture end — no per-tick writes), then re-read.
              void setTextScale(appDb, scale).then(refetch);
            }}
          />
        ) : (
          <View className="h-7" />
        )}

        {/* Toggles */}
        <Card variant="soft" className="mt-6 gap-0 p-0">
          <ToggleRow
            label="Background blur"
            value={prefs.backgroundBlur}
            onChange={(v) => onToggle("backgroundBlur", v)}
          />
          <View className="mx-3.5 h-px bg-separator" />
          <ToggleRow
            label="Compact density"
            value={prefs.compactDensity}
            onChange={(v) => onToggle("compactDensity", v)}
          />
          <View className="mx-3.5 h-px bg-separator" />
          <ToggleRow
            label="Tab bar labels"
            value={prefs.tabBarLabels}
            onChange={(v) => onToggle("tabBarLabels", v)}
          />
        </Card>

        {/* PREVIEW */}
        <Text variant="caption" className="mb-2 mt-6">
          Preview
        </Text>
        <Card variant="ink" className="gap-3">
          <Text
            variant="balance"
            style={{ fontSize: 34 * previewScale }}
            className="font-extrabold text-foreground"
          >
            ₹42,300
          </Text>
          <View className="flex-row items-center gap-2">
            <View
              className="self-start rounded-[3px] border-[1.3px] border-foreground px-2.5 py-1"
              style={{ backgroundColor: previewAccent }}
            >
              <Text
                style={{ fontSize: 13 * previewScale }}
                className="font-bold text-accent-foreground"
              >
                on track
              </Text>
            </View>
            <View className="self-start rounded-[3px] border border-border px-2.5 py-1">
              <Text
                style={{ fontSize: 13 * previewScale }}
                className="font-semibold text-foreground"
              >
                June
              </Text>
            </View>
          </View>
        </Card>
        <View className="h-8" />
      </Container>
    </View>
  );
}
