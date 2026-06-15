import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Pressable, Share, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, SpriteIcon, Text } from "@/components/ui";
import { APP_VERSION, BUILD_NUMBER } from "@/lib/app-meta";
import { useAccent } from "@/lib/appearance/use-accent";
import { LEGAL_URLS, SHARE_MESSAGE, openExternal } from "@/lib/legal";

const StyledIonicons = withUniwind(Ionicons);

interface AboutRow {
  key: string;
  icon: string;
  title: string;
  description?: string;
  onPress: () => void;
}

function RowIcon({ name }: { name: string }) {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-border">
      <SpriteIcon name={name} size={20} />
    </View>
  );
}

function AboutRowItem({ row, first }: { row: AboutRow; first: boolean }) {
  return (
    <Pressable onPress={row.onPress} className="active:opacity-70" accessibilityRole="button">
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3.5">
        <RowIcon name={row.icon} />
        <View className="min-w-0 flex-1">
          <Text variant="heading" numberOfLines={1} className="text-[16px]">
            {row.title}
          </Text>
          {row.description ? (
            <Text variant="body" className="text-[13px]">
              {row.description}
            </Text>
          ) : null}
        </View>
        <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
      </View>
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  const accent = useAccent();

  // Developer options are hidden behind 7 taps on the version number.
  const versionTaps = useRef(0);
  const onTapVersion = () => {
    versionTaps.current += 1;
    if (versionTaps.current >= 7) {
      versionTaps.current = 0;
      router.push("/developer");
    }
  };

  const onShare = () => {
    void Share.share({ message: SHARE_MESSAGE }).catch(() => {});
  };

  const primary: AboutRow[] = [
    {
      key: "whats-new",
      icon: "stars-01",
      title: "What's new",
      description: `v${APP_VERSION} · release notes`,
      onPress: () => openExternal(LEGAL_URLS.whatsNew),
    },
    {
      key: "rate",
      icon: "star-01",
      title: "Rate unmiser",
      description: "on the Play Store",
      onPress: () => openExternal(LEGAL_URLS.rate),
    },
    { key: "share", icon: "share-01", title: "Tell a friend", onPress: onShare },
  ];

  const legal: AboutRow[] = [
    {
      key: "licenses",
      icon: "file-02",
      title: "Open-source licenses",
      onPress: () => router.push("/licenses"),
    },
    {
      key: "privacy",
      icon: "shield-tick",
      title: "Privacy policy",
      onPress: () => openExternal(LEGAL_URLS.privacy),
    },
    {
      key: "terms",
      icon: "receipt",
      title: "Terms of use",
      onPress: () => openExternal(LEGAL_URLS.terms),
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="About"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        {/* Hero card */}
        <Card variant="ink" className="mt-3 items-center gap-0 py-7">
          <View className="flex-row items-center gap-2">
            <Text variant="title" className="text-[30px]">
              unmiser
            </Text>
            <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: accent }} />
          </View>
          <Text variant="body" className="mt-1.5 text-[14px]">
            Money that never leaves your phone.
          </Text>
          <View className="mt-4 flex-row gap-2.5">
            <Pressable
              onPress={onTapVersion}
              accessibilityLabel="App version"
              className="rounded-[3px] border border-border px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-[13px] font-bold text-foreground">v{APP_VERSION}</Text>
            </Pressable>
            <View className="rounded-[3px] border border-border px-3 py-1.5">
              <Text className="text-[13px] font-bold text-foreground">build {BUILD_NUMBER}</Text>
            </View>
          </View>
        </Card>

        <Card variant="soft" className="mt-5 gap-0 p-0">
          {primary.map((row, i) => (
            <AboutRowItem key={row.key} row={row} first={i === 0} />
          ))}
        </Card>

        <Card variant="soft" className="mt-5 gap-0 p-0">
          {legal.map((row, i) => (
            <AboutRowItem key={row.key} row={row} first={i === 0} />
          ))}
        </Card>

        <Text variant="caption" className="mt-6 text-center">
          Made with care · for people who hate spreadsheets
        </Text>

        <View className="h-8" />
      </Container>
    </View>
  );
}
