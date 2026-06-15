import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, Text } from "@/components/ui";
import { openExternal } from "@/lib/legal";
import { LICENSE_URLS, LICENSES, type LicenseEntry, type SpdxId } from "@/lib/licenses";

const StyledIonicons = withUniwind(Ionicons);

function LicenseRow({ entry, first }: { entry: LicenseEntry; first: boolean }) {
  return (
    <Pressable
      onPress={() => openExternal(entry.url)}
      className="active:opacity-70"
      accessibilityRole="link"
      accessibilityLabel={`${entry.name}, ${entry.license} license`}
    >
      {!first ? <View className="mx-3.5 h-px bg-separator" /> : null}
      <View className="flex-row items-center gap-3 px-3.5 py-3">
        <View className="min-w-0 flex-1">
          <Text variant="heading" numberOfLines={1} className="text-[15px]">
            {entry.name}
          </Text>
        </View>
        <View className="rounded-[3px] border border-border px-2 py-0.5">
          <Text className="font-mono text-[11px] text-muted">{entry.license}</Text>
        </View>
        <StyledIonicons name="open-outline" size={14} className="text-muted" />
      </View>
    </Pressable>
  );
}

export default function LicensesScreen() {
  const router = useRouter();

  // The distinct licenses present, for the "full text" footer links.
  const usedLicenses = useMemo(() => {
    const set = new Set<SpdxId>();
    for (const l of LICENSES) set.add(l.license);
    return Array.from(set);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Open-source licenses"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/about"))}
      />
      <Container className="px-4">
        <Text variant="body" className="mt-3 text-[14px]">
          Unmiser is built on the open-source projects below. Tap a project to open its source, or a
          license at the bottom to read the full text.
        </Text>

        <Card variant="soft" className="mt-4 gap-0 p-0">
          {LICENSES.map((entry, i) => (
            <LicenseRow key={entry.name} entry={entry} first={i === 0} />
          ))}
        </Card>

        <Text variant="caption" className="mb-2 mt-6 uppercase tracking-wider">
          Full license texts
        </Text>
        <Card variant="soft" className="gap-0 p-0">
          {usedLicenses.map((id, i) => (
            <Pressable
              key={id}
              onPress={() => openExternal(LICENSE_URLS[id])}
              className="active:opacity-70"
              accessibilityRole="link"
            >
              {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
              <View className="flex-row items-center gap-3 px-3.5 py-3">
                <Text variant="heading" className="min-w-0 flex-1 text-[15px]">
                  {id}
                </Text>
                <StyledIonicons name="open-outline" size={14} className="text-muted" />
              </View>
            </Pressable>
          ))}
        </Card>

        <View className="h-8" />
      </Container>
    </View>
  );
}
