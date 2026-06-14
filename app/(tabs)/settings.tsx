import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { ListGroup, Separator } from "heroui-native";
import { useRouter, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { Card, Text } from "@/components/ui";
import { transactionCollection } from "@/db/collections";

const StyledIonicons = withUniwind(Ionicons);

type IoniconName = keyof typeof Ionicons.glyphMap;

interface SettingsRow {
  key: string;
  icon: IoniconName;
  title: string;
  description: string;
  /** Optional right-aligned value (e.g. current language). */
  value?: string;
  href: Href;
}

/**
 * Settings hub (design/Settings hub.png). The "Hub" tab destination — an ink
 * profile card over one grouped card of icon rows. Subtitles are static
 * descriptive copy per the design; only the profile transaction count is live.
 */
const ROWS: SettingsRow[] = [
  {
    key: "appearance",
    icon: "color-palette-outline",
    title: "Appearance",
    description: "theme · accent · text size",
    href: "/appearance",
  },
  {
    key: "language",
    icon: "globe-outline",
    title: "Language",
    description: "app language",
    value: "English",
    href: "/language",
  },
  {
    key: "accounts",
    icon: "wallet-outline",
    title: "Accounts",
    description: "add & update balances",
    href: "/accounts",
  },
  {
    key: "budgets",
    icon: "pie-chart-outline",
    title: "Budgets",
    description: "monthly spending limits",
    href: "/budgets",
  },
  {
    key: "categories",
    icon: "grid-outline",
    title: "Categories",
    description: "expense & income",
    href: "/categories",
  },
  {
    key: "rules",
    icon: "options-outline",
    title: "Smart Rules",
    description: "auto-categorise",
    href: "/rules",
  },
  {
    key: "data-privacy",
    icon: "shield-checkmark-outline",
    title: "Data & Privacy",
    description: "export · import · on-device AI",
    href: "/data-privacy",
  },
];

function RowIcon({ name }: { name: IoniconName }) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full border border-border">
      <StyledIonicons name={name} size={18} className="text-foreground" />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useLiveQuery((q) => q.from({ txn: transactionCollection }));
  const txnCount = (data ?? []).filter((t) => !t.isDeleted).length;

  return (
    <View className="flex-1 bg-background">
      {/* Page title (root tab — no back chevron) */}
      <View style={{ paddingTop: insets.top }} className="px-5 pb-3 pt-2">
        <Text variant="title">Settings</Text>
      </View>

      <Container className="px-5">
        {/* Profile card */}
        <Pressable onPress={() => router.push("/profile")} accessibilityRole="button">
          <Card variant="inverted" className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full border border-background/40">
              <StyledIonicons name="person-outline" size={18} className="text-background" />
            </View>
            <View className="flex-1">
              <Text variant="heading" className="text-background">
                Vijay
              </Text>
              <Text
                className="text-[12px] text-background/60"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {txnCount.toLocaleString()} transactions
              </Text>
            </View>
            <StyledIonicons name="chevron-forward" size={18} className="text-background/60" />
          </Card>
        </Pressable>

        {/* Grouped settings rows */}
        <ListGroup variant="transparent" className="mt-4 rounded-[3px] border border-border">
          {ROWS.map((row, i) => (
            <View key={row.key}>
              {i > 0 ? <Separator className="mx-3" /> : null}
              <ListGroup.Item onPress={() => router.push(row.href)} className="px-3 py-3">
                <ListGroup.ItemPrefix>
                  <RowIcon name={row.icon} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent className="ml-3">
                  <Text className="text-[15px] font-bold text-foreground">{row.title}</Text>
                  <Text className="text-[12px] text-muted">{row.description}</Text>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <View className="flex-row items-center gap-1">
                    {row.value ? <Text className="text-[13px] text-muted">{row.value}</Text> : null}
                    <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
                  </View>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            </View>
          ))}
        </ListGroup>

        <View className="h-8" />
      </Container>
    </View>
  );
}
