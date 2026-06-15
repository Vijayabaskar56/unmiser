import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { cn, useThemeColor } from "heroui-native";
import { withUniwind } from "uniwind";

import { Text } from "@/components/ui";

const StyledIonicons = withUniwind(Ionicons);

/**
 * Reusable numeric PIN pad: a row of `length` dots that fill as digits are
 * entered, plus the 3×4 keypad from the App-lock design (1–9, a decorative
 * `.`, 0, and backspace). Controlled — the parent owns the entered string and
 * decides what to do when it reaches `length`.
 */
export interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  length: number;
  /** Brief shake/error styling on the dots (e.g. wrong PIN). */
  error?: boolean;
}

export function PinPad({ value, onChange, length, error }: PinPadProps) {
  const foreground = useThemeColor("foreground");

  const press = (digit: string) => {
    if (value.length >= length) return;
    onChange(value + digit);
  };
  const backspace = () => onChange(value.slice(0, -1));

  return (
    <View className="items-center gap-7">
      {/* Dots */}
      <View className="flex-row gap-5">
        {Array.from({ length }, (_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-[1.5px]",
                error ? "border-danger" : "border-foreground",
                filled && (error ? "bg-danger" : "bg-foreground"),
              )}
            />
          );
        })}
      </View>

      {/* Keypad */}
      <View className="w-[260px] overflow-hidden rounded-[6px] border border-border">
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          [".", "0", "back"],
        ].map((row, r) => (
          <View key={r} className={cn("flex-row", r > 0 && "border-t border-border")}>
            {row.map((key, c) => (
              <Pressable
                key={key}
                onPress={() =>
                  key === "back" ? backspace() : key === "." ? undefined : press(key)
                }
                disabled={key === "."}
                className={cn(
                  "h-[72px] flex-1 items-center justify-center active:bg-secondary",
                  c > 0 && "border-l border-border",
                )}
                accessibilityLabel={key === "back" ? "Delete" : key === "." ? undefined : key}
              >
                {key === "back" ? (
                  <StyledIonicons name="backspace-outline" size={26} color={foreground} />
                ) : key === "." ? (
                  <Text className="text-[26px] font-bold text-muted">.</Text>
                ) : (
                  <Text className="text-[26px] font-bold text-foreground">{key}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
