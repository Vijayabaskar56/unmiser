import { useThemeColor } from "heroui-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAppTheme } from "@/contexts/app-theme-context";

/**
 * Bottom navigation — NATIVE tabs (`expo-router/unstable-native-tabs`).
 * Home · Log · ＋ · Grow · Hub styled to the design: inverted dark bar
 * (`backgroundColor`), yellow Android active indicator (`indicatorColor`),
 * icon-only (`labelVisibilityMode`), filled-on-active icons where a filled glyph
 * exists (Home → home_filled, Hub → dashboard; line icons stay as-is).
 *
 * Inactive icons use a higher-contrast tint (brighter than `muted`) so they read
 * clearly on the dark bar; the active icon is ink on the yellow pill.
 */
export default function TabLayout() {
  const ink = useThemeColor("foreground");
  const accent = useThemeColor("accent");
  const { isDark } = useAppTheme();

  // Inactive icon: a bright dim that tracks the bar (paper-ish on the dark bar in
  // light mode, ink-ish on the light bar in dark mode). Active icon: ink, for
  // contrast on the constant yellow pill.
  const inactiveIcon = isDark ? "rgba(14,13,11,0.55)" : "rgba(244,243,236,0.78)";
  const activeIcon = "#15140f";

  return (
    <NativeTabs
      backgroundColor={ink}
      iconColor={{ default: inactiveIcon, selected: activeIcon }}
      indicatorColor={accent}
      tintColor={activeIcon}
      labelVisibilityMode="unlabeled"
      backBehavior="history"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="receipt_long" />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Icon sf="plus" md="add" />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="grow">
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md={{ default: "grid_view", selected: "dashboard" }}
        />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
