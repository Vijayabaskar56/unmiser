import { Tabs } from "expo-router";

import { TabBar } from "@/components/ui";

/**
 * Bottom navigation (wireframe IA): Home · Log · ＋ · Grow · Hub, rendered by the
 * design-system `TabBar` (custom `tabBar` prop). The four real tabs are index
 * (Home), transactions (Log), grow, and settings (Hub); the centre FAB opens
 * manual capture (/add).
 *
 * The secondary screens (accounts, categories, rules, extensions, store,
 * subscriptions) stay in this navigator but drop out of the bar (`href: null`).
 * They're reached by pushing from the Hub/Settings hub. `backBehavior="history"`
 * so hardware-back returns to the screen you came from.
 */
export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="grow" />
      <Tabs.Screen name="settings" />

      {/* Secondary screens — routable from the Hub, not shown in the tab bar. */}
      <Tabs.Screen name="accounts" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="rules" options={{ href: null }} />
      <Tabs.Screen name="extensions" options={{ href: null }} />
      <Tabs.Screen name="store" options={{ href: null }} />
      <Tabs.Screen name="subscriptions" options={{ href: null }} />
    </Tabs>
  );
}
