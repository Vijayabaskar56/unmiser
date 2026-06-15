import { requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheet } from "heroui-native";

import { useBackgroundBlur } from "@/lib/appearance/use-background-blur";

/**
 * Drop-in replacement for `<BottomSheet.Overlay />` that adds a blurred backdrop
 * when the Appearance "background blur" preference is on AND expo-blur's native
 * module is present. The blur is layered ON TOP of the default dim overlay with
 * `pointerEvents="none"`, so tap-to-close still works and we don't depend on any
 * heroui internals. expo-blur is native — a dev client built before it was added
 * cleanly degrades to the flat dim (mirrors the biometric feature-detection).
 */
const BLUR_AVAILABLE = requireOptionalNativeModule("ExpoBlurView") != null;

type BlurViewProps = {
  intensity?: number;
  tint?: string;
  style?: unknown;
  pointerEvents?: "none" | "auto";
};
let BlurView: ComponentType<BlurViewProps> | null = null;
if (BLUR_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    BlurView = require("expo-blur").BlurView;
  } catch {
    BlurView = null;
  }
}

export function SheetOverlay() {
  const blur = useBackgroundBlur();
  return (
    <>
      <BottomSheet.Overlay />
      {blur && BlurView ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
    </>
  );
}
