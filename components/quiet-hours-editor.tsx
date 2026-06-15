import { requireOptionalNativeModule } from "expo-modules-core";
import { useState, type ComponentType } from "react";
import { Pressable, View } from "react-native";

import { SpriteIcon, Text } from "@/components/ui";
import { formatTime } from "@/lib/notifications/prefs";

/**
 * Quiet-hours window editor. Uses the native `@expo/ui` time picker when the
 * native module is present (dev/release builds that include it); otherwise it
 * degrades to ±15-minute steppers so the current dev client — built before
 * `@expo/ui` was added — still works. Mirrors the biometric feature-detection.
 */
const EXPO_UI_AVAILABLE = requireOptionalNativeModule("ExpoUI") != null;

type DateTimePickerProps = {
  value: Date;
  mode: "time";
  presentation?: "dialog" | "inline";
  onValueChange?: (event: unknown, date: Date) => void;
  onDismiss?: () => void;
};
let NativeDateTimePicker: ComponentType<DateTimePickerProps> | null = null;
if (EXPO_UI_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeDateTimePicker = require("@expo/ui/community/datetime-picker").default;
  } catch {
    NativeDateTimePicker = null;
  }
}

const STEP_MINUTES = 15;

function minuteToDate(minuteOfDay: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return d;
}
function dateToMinute(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
function step(minuteOfDay: number, delta: number): number {
  return (((minuteOfDay + delta) % 1440) + 1440) % 1440;
}

function TimeRow({
  label,
  minute,
  onChange,
  first,
}: {
  label: string;
  minute: number;
  onChange: (next: number) => void;
  first: boolean;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <View>
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3">
        <Text variant="heading" className="flex-1 text-[15px]">
          {label}
        </Text>

        {NativeDateTimePicker ? (
          <>
            <Pressable
              onPress={() => setPicking(true)}
              className="rounded-[3px] border border-border px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-[15px] font-semibold text-foreground">
                {formatTime(minute)}
              </Text>
            </Pressable>
            {picking ? (
              <NativeDateTimePicker
                value={minuteToDate(minute)}
                mode="time"
                presentation="dialog"
                onValueChange={(_e, date) => {
                  setPicking(false);
                  onChange(dateToMinute(date));
                }}
                onDismiss={() => setPicking(false)}
              />
            ) : null}
          </>
        ) : (
          <View className="flex-row items-center gap-2">
            <Stepper label="−" onPress={() => onChange(step(minute, -STEP_MINUTES))} />
            <Text className="w-[78px] text-center text-[15px] font-semibold text-foreground">
              {formatTime(minute)}
            </Text>
            <Stepper label="+" onPress={() => onChange(step(minute, STEP_MINUTES))} />
          </View>
        )}
      </View>
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label === "+" ? "Later" : "Earlier"}
      className="h-8 w-8 items-center justify-center rounded-[3px] border-[1.3px] border-foreground active:opacity-70"
    >
      <Text className="text-[17px] font-bold text-foreground">{label}</Text>
    </Pressable>
  );
}

export function QuietHoursEditor({
  startMin,
  endMin,
  onChange,
}: {
  startMin: number;
  endMin: number;
  onChange: (startMin: number, endMin: number) => void;
}) {
  const isOff = startMin === endMin;
  return (
    <View>
      <TimeRow label="From" minute={startMin} onChange={(m) => onChange(m, endMin)} first />
      <TimeRow label="To" minute={endMin} onChange={(m) => onChange(startMin, m)} first={false} />
      <View className="flex-row items-center gap-2 px-3.5 pb-3 pt-1">
        <SpriteIcon name="moon-01" size={13} />
        <Text variant="body" className="flex-1 text-[12px]">
          {isOff
            ? "Quiet hours off — set different times to silence instant alerts."
            : "Instant alerts are silenced during this window. Scheduled ones still arrive."}
        </Text>
      </View>
    </View>
  );
}
