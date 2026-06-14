import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Defs, Line, Pattern, Rect, Svg } from "react-native-svg";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, ConfirmDialog, SpriteIcon, Text } from "@/components/ui";
import { accountBalanceCollection, accountCollection } from "@/db/collections/finance";
import {
  categoryCollection,
  merchantMappingCollection,
  subcategoryCollection,
} from "@/db/collections";
import { subscriptionCollection, transactionCollection } from "@/db/collections";
import { db } from "@/db/index";
import { deleteAllData } from "@/db/services/data-ops";

const StyledIonicons = withUniwind(Ionicons);

interface ActionRow {
  key: string;
  icon: string;
  title: string;
  description: string;
  value?: string;
}

const ACTIONS: ActionRow[] = [
  { key: "export", icon: "upload-01", title: "Export data", description: "CSV · JSON · encrypted" },
  { key: "import", icon: "file-02", title: "Import from PDF", description: "bank statements" },
  { key: "webhooks", icon: "dataflow-03", title: "Webhooks", description: "local automation" },
  {
    key: "applock",
    icon: "lock-01",
    title: "App lock",
    description: "PIN · biometric",
    value: "Off",
  },
];

export default function DataPrivacyScreen() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wiping, setWiping] = useState(false);

  const onWipe = useCallback(async () => {
    setWiping(true);
    try {
      await deleteAllData(db);
      await Promise.all([
        transactionCollection.utils.refetch(),
        accountCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
        categoryCollection.utils.refetch(),
        subcategoryCollection.utils.refetch(),
        subscriptionCollection.utils.refetch(),
        merchantMappingCollection.utils.refetch(),
      ]);
      setConfirmOpen(false);
      router.replace("/settings");
    } catch (e) {
      setConfirmOpen(false);
      Alert.alert("Could not delete", String(e instanceof Error ? e.message : e));
    } finally {
      setWiping(false);
    }
  }, [router]);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Data & Privacy"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        {/* Illustration hero */}
        <View
          className="mt-2 items-center justify-center overflow-hidden rounded-[10px] border border-border"
          style={{ height: 150 }}
        >
          <Stripes />
          <View className="h-20 w-20 items-center justify-center rounded-full bg-background/70">
            <SpriteIcon name="shield-tick" size={48} />
          </View>
        </View>

        {/* On-device statement */}
        <View className="mt-4 rounded-[10px] bg-foreground p-5">
          <Text className="font-mono text-[11px] uppercase tracking-wider text-background/55">
            Stored on this device only
          </Text>
          <Text className="mt-2 text-[26px] font-extrabold leading-8 text-background">
            Nothing has ever{"\n"}left this phone.
          </Text>
        </View>

        {/* Actions */}
        <Card variant="soft" className="mt-4 gap-0 p-0">
          {ACTIONS.map((row, i) => (
            <Pressable
              key={row.key}
              onPress={() => Alert.alert(row.title, "Coming soon — not built yet.")}
              className="active:opacity-70"
            >
              {i > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
              <View className="flex-row items-center gap-3.5 px-4 py-4">
                <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-foreground">
                  <SpriteIcon name={row.icon} size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="heading" className="text-[17px]">
                    {row.title}
                  </Text>
                  <Text variant="body" className="text-[13px]">
                    {row.description}
                  </Text>
                </View>
                {row.value ? (
                  <Text variant="heading" className="text-[15px]">
                    {row.value}
                  </Text>
                ) : null}
                <StyledIonicons name="chevron-forward" size={18} className="text-muted" />
              </View>
            </Pressable>
          ))}
        </Card>

        {/* Delete all data */}
        <Card variant="soft" className="mb-6 mt-4 p-0">
          <Pressable onPress={() => setConfirmOpen(true)} className="active:opacity-70">
            <View className="flex-row items-center gap-3.5 px-4 py-4">
              <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-foreground">
                <SpriteIcon name="trash-01" size={22} />
              </View>
              <View className="min-w-0 flex-1">
                <Text variant="heading" className="text-[17px]">
                  Delete all data
                </Text>
                <Text variant="body" className="text-[13px]">
                  irreversible
                </Text>
              </View>
              <StyledIonicons name="chevron-forward" size={18} className="text-muted" />
            </View>
          </Pressable>
        </Card>
      </Container>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete all data?"
        description="Every account, transaction, category and subscription on this device will be permanently erased. This cannot be undone."
        confirmLabel="Delete all"
        busy={wiping}
        onConfirm={() => void onWipe()}
      />
    </View>
  );
}

/** Subtle diagonal hatch behind the hero illustration. */
function Stripes() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern
          id="hatch"
          width={16}
          height={16}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Line x1={0} y1={0} x2={0} y2={16} stroke="#E7E4D8" strokeWidth={7} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}
