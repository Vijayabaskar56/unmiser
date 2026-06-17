import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { ListGroup, Separator } from "heroui-native";
import { useRouter, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { Card, SpriteIcon, Text } from "@/components/ui";
import { transactionCollection } from "@/db/collections";
import { useI18n } from "@/lib/i18n/use-i18n";
import { LANGUAGES } from "@/lib/i18n/translations";

const StyledIonicons = withUniwind(Ionicons);

interface SettingsRow {
  key: string;
  /** UI-sprite icon id (rendered with <SpriteIcon>). */
  icon: string;
  title: string;
  description: string;
  /** Optional right-aligned value (e.g. current language). */
  value?: string;
  href: Href;
}

interface SettingsSection {
  /** Section key → `settings.sections.<key>` translation. */
  key: "money" | "app" | "data" | "about";
  rows: SettingsRow[];
}

/**
 * Settings hub — the "Hub" tab. An ink profile card over grouped sections of
 * icon rows (Money · App · Data), each linking a config screen. Every config
 * screen is reachable from here, including the ones folded out of the tab bar
 * (Subscriptions, Extensions, Store).
 */
const SECTIONS: SettingsSection[] = [
  {
    key: "money",
    rows: [
      {
        key: "accounts",
        icon: "wallet-01",
        title: "Accounts",
        description: "add & update balances",
        href: "/accounts",
      },
      {
        key: "budgets",
        icon: "pie-chart-01",
        title: "Budgets",
        description: "monthly spending limits",
        href: "/budgets",
      },
      {
        key: "categories",
        icon: "grid-01",
        title: "Categories",
        description: "expense & income",
        href: "/categories",
      },
      {
        key: "rules",
        icon: "settings-01",
        title: "Smart Rules",
        description: "auto-categorise",
        href: "/rules",
      },
      {
        key: "subscriptions",
        icon: "repeat-04",
        title: "Subscriptions",
        description: "recurring payments",
        href: "/subscriptions",
      },
    ],
  },
  {
    key: "app",
    rows: [
      {
        key: "appearance",
        icon: "palette",
        title: "Appearance",
        description: "theme · accent · text size",
        href: "/appearance",
      },
      {
        key: "language",
        icon: "globe-01",
        title: "Language",
        description: "app language",
        value: "English",
        href: "/language",
      },
      {
        key: "notifications",
        icon: "bell-02",
        title: "Notifications",
        description: "on-device reminders",
        href: "/notifications",
      },
      {
        key: "extensions",
        icon: "puzzle-piece-01",
        title: "Extensions",
        description: "browse · install · manage",
        href: "/extensions",
      },
    ],
  },
  {
    key: "data",
    rows: [
      {
        key: "data-privacy",
        icon: "shield-tick",
        title: "Data & Privacy",
        description: "export · import · backup",
        href: "/data-privacy",
      },
    ],
  },
  {
    key: "about",
    rows: [
      {
        key: "about",
        icon: "info-circle",
        title: "About",
        description: "version · licenses · legal",
        href: "/about",
      },
    ],
  },
];

function RowIcon({ name }: { name: string }) {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full border border-border">
      <SpriteIcon name={name} size={18} />
    </View>
  );
}

function SettingsRowItem({
  icon,
  title,
  description,
  value,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <ListGroup.Item onPress={onPress} className="px-3 py-3">
      <ListGroup.ItemPrefix>
        <RowIcon name={icon} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent className="ml-3">
        <Text className="text-[15px] font-bold text-foreground">{title}</Text>
        <Text className="text-[12px] text-muted">{description}</Text>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <View className="flex-row items-center gap-1">
          {value ? <Text className="text-[13px] text-muted">{value}</Text> : null}
          <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
        </View>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { data } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);
  const txnCount = (data ?? []).filter((tx) => !tx.isDeleted).length;
  const currentLanguageName = LANGUAGES.find((l) => l.code === locale)?.native ?? "English";

  return (
    <View className="flex-1 bg-background">
      {/* Page title (root tab — no back chevron) */}
      <View style={{ paddingTop: insets.top }} className="px-5 pb-3 pt-2">
        <Text variant="title">{t("settings.title")}</Text>
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

        {/* Grouped sections */}
        {SECTIONS.map((section) => (
          <View key={section.key} className="mt-5">
            <Text variant="caption" className="mb-2 ml-1">
              {t(`settings.sections.${section.key}`)}
            </Text>
            <ListGroup variant="transparent" className="rounded-[3px] border border-border">
              {section.rows.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <Separator className="mx-3" /> : null}
                  <SettingsRowItem
                    icon={row.icon}
                    title={t(`settings.rows.${row.key}.title`)}
                    description={t(`settings.rows.${row.key}.desc`)}
                    value={row.key === "language" ? currentLanguageName : undefined}
                    onPress={() => router.push(row.href)}
                  />
                </View>
              ))}
            </ListGroup>
          </View>
        ))}

        <View className="h-8" />
      </Container>
    </View>
  );
}
