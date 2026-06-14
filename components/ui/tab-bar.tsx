import { Ionicons } from "@expo/vector-icons";
import { cn } from "heroui-native";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The slice of react-navigation's `BottomTabBarProps` we use. Declared locally
 * because `@react-navigation/bottom-tabs` isn't a top-level dependency (it ships
 * nested inside expo-router) so a direct type import isn't reliably resolvable.
 */
export type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

/** The four real tabs, in bar order; the centre slot is the ＋ action. */
const TABS: { route: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { route: "index", icon: "home-outline", iconActive: "home" },
  { route: "transactions", icon: "receipt-outline", iconActive: "receipt" },
  { route: "grow", icon: "trending-up-outline", iconActive: "trending-up" },
  { route: "settings", icon: "grid-outline", iconActive: "grid" },
];

function TabButton({
  icon,
  iconActive,
  active,
  onPress,
}: {
  icon: IoniconName;
  iconActive: IoniconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="flex-1 items-center justify-center gap-1.5 py-1"
    >
      <StyledIonicons
        name={active ? iconActive : icon}
        size={24}
        className={active ? "text-background" : "text-background/45"}
      />
      {/* yellow active-dot indicator */}
      <View className={cn("h-1.5 w-1.5 rounded-full", active && "bg-accent")} />
    </Pressable>
  );
}

/**
 * Design-system bottom tab bar (design/Settings hub reference): a flush dark
 * (inverted) bar of icon-only tabs with a yellow active-dot, plus an inline ＋
 * for manual capture. Passed to expo-router `Tabs` via the `tabBar` prop.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeRoute = state.routes[state.index]?.name;

  const navigate = (route: string) => {
    const target = state.routes.find((r) => r.name === route);
    if (!target) return;
    const event = navigation.emit({
      type: "tabPress",
      target: target.key,
      canPreventDefault: true,
    });
    if (activeRoute !== route && !event.defaultPrevented) {
      navigation.navigate(route);
    }
  };

  const [home, log, grow, hub] = TABS;

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="flex-row items-center justify-around bg-foreground px-2 pt-2"
    >
      <TabButton
        {...home}
        active={activeRoute === home.route}
        onPress={() => navigate(home.route)}
      />
      <TabButton {...log} active={activeRoute === log.route} onPress={() => navigate(log.route)} />

      {/* Centre ＋ — manual capture, an action (not a tab) */}
      <Pressable
        onPress={() => router.push("/add")}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        className="flex-1 items-center justify-center gap-1.5 py-1"
      >
        <StyledIonicons name="add" size={28} className="text-background" />
        <View className="h-1.5 w-1.5" />
      </Pressable>

      <TabButton
        {...grow}
        active={activeRoute === grow.route}
        onPress={() => navigate(grow.route)}
      />
      <TabButton {...hub} active={activeRoute === hub.route} onPress={() => navigate(hub.route)} />
    </View>
  );
}
