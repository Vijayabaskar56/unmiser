import { eq, useLiveQuery } from "@tanstack/react-db";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAppTheme } from "@/contexts/app-theme-context";
import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema";
import { parseTabBarLabels } from "@/lib/appearance/prefs";
import { useAccent } from "@/lib/appearance/use-accent";

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
  const { isDark } = useAppTheme();
  // Runtime accent (reflects the Appearance preference) — NOT the static
  // `useThemeColor("accent")`, which can't change at runtime on native.
  const accent = useAccent();
  const ink = isDark ? "#f1f0e8" : "#15140f";
  // Tab-bar labels are an Appearance preference (default on).
  const { data: labelPref } = useLiveQuery(
    (q) =>
      q
        .from({ s: appSettingsCollection })
        .where(({ s }) => eq(s.key, APP_SETTING_KEYS.appearanceTabBarLabels)),
    [],
  );
  const showLabels = parseTabBarLabels(labelPref?.[0]?.value);

  // Inactive icon: a bright dim that tracks the bar (paper-ish on the dark bar in
  // light mode, ink-ish on the light bar in dark mode). Active = yellow + filled
  // icon — no oval indicator (it clashes with the boxy design language).
  const inactiveIcon = isDark ? "rgba(14,13,11,0.55)" : "rgba(244,243,236,0.78)";

  return (
    <NativeTabs
      backgroundColor={ink}
      iconColor={{ default: inactiveIcon, selected: accent }}
      // No pill/oval active indicator — active state is conveyed purely by the
      // icon turning accent-yellow and filled (Home → home_filled, Hub →
      // dashboard). `rippleColor` transparent removes the dark tap splash too.
      disableIndicator
      tintColor={accent}
      rippleColor="transparent"
      labelVisibilityMode={showLabels ? "labeled" : "unlabeled"}
      backBehavior="history"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label hidden={!showLabels}>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="receipt_long" />
        <NativeTabs.Trigger.Label hidden={!showLabels}>Log</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Icon sf="plus" md="add" />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="grow">
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
        <NativeTabs.Trigger.Label hidden={!showLabels}>Grow</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md={{ default: "grid_view", selected: "dashboard" }}
        />
        <NativeTabs.Trigger.Label hidden={!showLabels}>Hub</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
