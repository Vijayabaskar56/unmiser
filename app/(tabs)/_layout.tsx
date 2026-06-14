import { useThemeColor } from "heroui-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";

/**
 * Bottom navigation — NATIVE tabs variant (`expo-router/unstable-native-tabs`)
 * for comparison against the custom bar. Home · Log · ＋ · Grow · Hub as real
 * native tab items, styled to the design with the native styling props:
 * inverted dark bar (`backgroundColor`), dim/white icons (`iconColor`), yellow
 * Android active indicator (`indicatorColor`), icon-only (`labelVisibilityMode`).
 *
 * Tradeoffs vs the custom bar (alpha API): the active marker is Android's
 * Material pill (not a yellow dot), iOS shows only a tint, and ＋ is a real tab
 * (native tabs can't host a non-navigating centre action). The secondary screens
 * (accounts/categories/rules/extensions/store/subscriptions) had to move to the
 * root stack — native tabs can't keep hidden-but-navigable routes.
 */
export default function TabLayout() {
  const ink = useThemeColor("foreground");
  const paper = useThemeColor("background");
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");

  return (
    <NativeTabs
      backgroundColor={ink}
      iconColor={{ default: muted, selected: paper }}
      indicatorColor={accent}
      tintColor={paper}
      labelVisibilityMode="unlabeled"
      backBehavior="history"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
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
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
        <NativeTabs.Trigger.Label hidden />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
