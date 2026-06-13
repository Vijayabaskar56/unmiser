import { Ionicons } from "@expo/vector-icons";
import { cn } from "heroui-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export interface AppBarProps {
  /** Screen title (the design system `.ab-bar .ttl`). */
  title: string;
  /** Smaller 17px title instead of the default 21px. */
  sm?: boolean;
  /** When provided, renders a leading `‹` chevron that calls this. */
  onBack?: () => void;
  /** Right-aligned actions (icon buttons, toggles…). */
  right?: ReactNode;
  /** Pad the top by the status-bar inset. Default true; set false inside a sheet. */
  safeArea?: boolean;
  className?: string;
}

/**
 * AppBar — the design system screen header (`appbar()` in the wireframes).
 *
 * A bare `‹` chevron (no circle) + a big bold title on the left, optional
 * actions on the right. Replaces Expo Router's native Stack header (hide it
 * with `options={{ headerShown: false }}`). Adds the top safe-area inset itself
 * so screens can render edge-to-edge under it.
 */
export function AppBar({
  title,
  sm = false,
  onBack,
  right,
  safeArea = true,
  className,
}: AppBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={safeArea ? { paddingTop: insets.top } : undefined}
      className={cn("bg-background px-5", className)}
    >
      <View className="flex-row items-center justify-between py-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              className="-ml-1"
            >
              <StyledIonicons name="chevron-back" size={24} className="text-foreground" />
            </Pressable>
          ) : null}
          <Text
            numberOfLines={1}
            className={cn(
              "font-extrabold tracking-tight text-foreground",
              sm ? "text-[17px]" : "text-[21px]",
            )}
          >
            {title}
          </Text>
        </View>
        {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
      </View>
    </View>
  );
}
