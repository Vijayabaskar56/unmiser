import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "heroui-native";

/**
 * Pinned bottom action bar — holds a screen's primary CTA flush to the bottom
 * edge (above the safe-area inset), so the button stays anchored while the
 * content scrolls above it. Use it as a sibling AFTER a scrollable `Container`.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn("bg-background px-4 pt-2", className)}
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      {children}
    </View>
  );
}
