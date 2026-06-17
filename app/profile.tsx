import { Ionicons } from "@expo/vector-icons";
import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, TextInput, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, Chip, SpriteIcon, Text } from "@/components/ui";
import {
  appSettingsCollection,
  subscriptionCollection,
  transactionCollection,
} from "@/db/collections";
import { accountBalanceCollection, accountCollection } from "@/db/collections/finance";
import { appDb } from "@/db/app-db";
import {
  setProfileArchetypeId,
  setProfileBannerId,
  setProfileName,
} from "@/db/services/app-settings";
import { APP_SETTING_KEYS } from "@/db/schema";
import * as money from "@/lib/money";
import { ARCHETYPES, getArchetype } from "@/lib/profile/archetypes";
import { avatarForArchetype } from "@/lib/profile/avatars";
import { BANNERS, getBanner } from "@/lib/profile/banners";
import {
  monthTotal,
  monthsTracked,
  netWorth,
  transactionCount,
  upcomingSubscriptionCount,
} from "@/lib/profile/overview";

const StyledIonicons = withUniwind(Ionicons);

const BANNER_HEIGHT = 132;
const AVATAR_SIZE = 96;

// v1 has no FX layer (accounts/transactions screens format per-currency, never
// convert), so net worth and monthly totals sum at face value in the base
// currency. Swap this for a real exchange-rate converter when FX lands.
const identityConvert = (amount: string) => amount;

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // --- profile prefs (reactive) ---
  const { data: settingRows } = useLiveQuery((q) => q.from({ setting: appSettingsCollection }), []);
  const settings = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of settingRows ?? []) map[row.key] = row.value;
    return map;
  }, [settingRows]);

  const archetype = getArchetype(settings[APP_SETTING_KEYS.profileArchetype]);
  const banner = getBanner(settings[APP_SETTING_KEYS.profileBannerId]);
  const persistedName = settings[APP_SETTING_KEYS.profileName] ?? "";

  // Local input state drives the header instantly; persistence is debounced.
  const [name, setName] = useState(persistedName);
  const hydrated = useRef(false);
  useEffect(() => {
    // Hydrate once from the persisted value when the live query first resolves.
    if (!hydrated.current && settingRows) {
      setName(persistedName);
      hydrated.current = true;
    }
  }, [settingRows, persistedName]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeName = (value: string) => {
    setName(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void (async () => {
        await setProfileName(appDb, value.trim());
        await appSettingsCollection.utils.refetch();
      })();
    }, 300);
  };
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const pickArchetype = async (id: string) => {
    await setProfileArchetypeId(appDb, id);
    await appSettingsCollection.utils.refetch();
  };
  const pickBanner = async (id: string) => {
    await setProfileBannerId(appDb, id);
    await appSettingsCollection.utils.refetch();
  };

  // --- financial overview (reactive) ---
  const { data: accounts } = useLiveQuery((q) => q.from({ account: accountCollection }), []);
  const { data: balances } = useLiveQuery((q) => q.from({ balance: accountBalanceCollection }), []);
  const { data: txns } = useLiveQuery((q) => q.from({ txn: transactionCollection }), []);
  const { data: subs } = useLiveQuery((q) => q.from({ subscription: subscriptionCollection }), []);

  const overview = useMemo(() => {
    const now = new Date();
    const accountRows = accounts ?? [];
    const mainId = Number(settings[APP_SETTING_KEYS.mainAccountId]);
    const baseCurrency =
      accountRows.find((a) => a.id === mainId)?.currency ?? accountRows[0]?.currency ?? "INR";
    return {
      baseCurrency,
      netWorth: netWorth(accountRows, balances ?? [], identityConvert),
      expense: monthTotal(txns ?? [], "EXPENSE", now, identityConvert),
      income: monthTotal(txns ?? [], "INCOME", now, identityConvert),
      upcoming: upcomingSubscriptionCount(subs ?? [], now),
      txnCount: transactionCount(txns ?? []),
      accountCount: accountRows.length,
      months: monthsTracked(txns ?? [], now),
    };
  }, [accounts, balances, txns, subs, settings]);

  const Avatar = avatarForArchetype(archetype.id);
  const [sheet, setSheet] = useState<null | "archetype" | "banner">(null);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="Profile"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container>
        {/* Banner + avatar header */}
        <Pressable onPress={() => setSheet("banner")} accessibilityLabel="Change banner">
          <Svg width={width} height={BANNER_HEIGHT}>
            <Defs>
              <LinearGradient id="banner" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={banner.from} />
                <Stop offset="1" stopColor={banner.to} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={BANNER_HEIGHT} fill="url(#banner)" />
          </Svg>
        </Pressable>

        <View className="items-center px-4" style={{ marginTop: -AVATAR_SIZE / 2 }}>
          <Pressable
            onPress={() => setSheet("archetype")}
            accessibilityLabel="Change archetype"
            className="active:opacity-80"
          >
            <View
              className="items-center justify-center rounded-full bg-surface"
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderWidth: 3,
                borderColor: archetype.accent,
              }}
            >
              <Avatar width={AVATAR_SIZE - 12} height={AVATAR_SIZE - 12} />
            </View>
            <View
              className="absolute bottom-0 right-0 items-center justify-center rounded-full border-2 border-background"
              style={{ width: 30, height: 30, backgroundColor: archetype.accent }}
            >
              <StyledIonicons name="pencil" size={14} className="text-background" />
            </View>
          </Pressable>

          <Text variant="title" className="mt-3">
            {name.trim().length > 0 ? `Hi ${name.trim()}!` : "Hi there!"}
          </Text>
          <Chip variant="default" className="mt-2" onPress={() => setSheet("archetype")}>
            {archetype.name}
          </Chip>
        </View>

        {/* Editable fields */}
        <View className="px-4 pt-6">
          <Card variant="soft" className="gap-0 p-0">
            <Row label="Name">
              <TextInput
                value={name}
                onChangeText={onChangeName}
                placeholder="Your name"
                placeholderTextColor="#9a988c"
                className="min-w-[120px] text-right text-[16px] font-semibold text-foreground"
                returnKeyType="done"
              />
            </Row>
            <Divider />
            <NavRow
              label="Archetype"
              value={archetype.name}
              onPress={() => setSheet("archetype")}
            />
            <Divider />
            <NavRow label="Banner" value={banner.name} onPress={() => setSheet("banner")} />
          </Card>
        </View>

        {/* Financial overview */}
        <View className="px-4 pt-4">
          <Card variant="soft" className="gap-3">
            <Text variant="heading">Financial Overview</Text>
            <View className="flex-row gap-3">
              <StatTile
                icon="wallet-01"
                tint="#1f7a3d"
                label="Net Worth"
                value={money.format(overview.netWorth, overview.baseCurrency)}
              />
              <StatTile
                icon="calendar"
                tint="#d98a2b"
                label="Upcoming"
                value={`${overview.upcoming} sub${overview.upcoming === 1 ? "" : "s"}`}
              />
            </View>
            <View className="flex-row gap-3">
              <StatTile
                icon="trend-down-01"
                tint="#e0578a"
                label="Expense"
                value={money.format(overview.expense, overview.baseCurrency)}
              />
              <StatTile
                icon="trend-up-01"
                tint="#5b8def"
                label="Income"
                value={money.format(overview.income, overview.baseCurrency)}
              />
            </View>
          </Card>
        </View>

        {/* Stats strip */}
        <View className="flex-row px-4 pb-8 pt-5">
          <Stat value={overview.txnCount.toLocaleString()} label="Transactions" />
          <StatSep />
          <Stat value={String(overview.accountCount)} label="Accounts" />
          <StatSep />
          <Stat value={`${overview.months}mo`} label="Tracked" />
        </View>
      </Container>

      {/* Archetype picker */}
      <BottomSheet isOpen={sheet === "archetype"} onOpenChange={(o) => !o && setSheet(null)}>
        <BottomSheet.Portal>
          <SheetOverlay />
          <BottomSheet.Content>
            <BottomSheet.Title>Choose your archetype</BottomSheet.Title>
            <BottomSheet.Description>
              Your money personality — it shapes your avatar and helps tailor nudges later.
            </BottomSheet.Description>
            <View className="gap-2 pt-3">
              {ARCHETYPES.map((a) => {
                const A = avatarForArchetype(a.id);
                const selected = a.id === archetype.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={async () => {
                      await pickArchetype(a.id);
                      setSheet(null);
                    }}
                    className="flex-row items-center gap-3 rounded-[3px] border p-2.5"
                    style={{ borderColor: selected ? a.accent : "transparent" }}
                  >
                    <View
                      className="items-center justify-center rounded-full bg-surface-secondary"
                      style={{ width: 48, height: 48, borderWidth: 2, borderColor: a.accent }}
                    >
                      <A width={40} height={40} />
                    </View>
                    <View className="flex-1">
                      <Text variant="heading" className="text-[15px]">
                        {a.name}
                      </Text>
                      <Text variant="caption" className="normal-case tracking-normal">
                        {a.tagline}
                      </Text>
                    </View>
                    {selected ? (
                      <StyledIonicons
                        name="checkmark-circle"
                        size={22}
                        className="text-foreground"
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Banner picker */}
      <BottomSheet isOpen={sheet === "banner"} onOpenChange={(o) => !o && setSheet(null)}>
        <BottomSheet.Portal>
          <SheetOverlay />
          <BottomSheet.Content>
            <BottomSheet.Title>Choose a banner</BottomSheet.Title>
            <View className="flex-row flex-wrap gap-3 pt-3">
              {BANNERS.map((b) => {
                const selected = b.id === banner.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={async () => {
                      await pickBanner(b.id);
                      setSheet(null);
                    }}
                    style={{ width: "47%" }}
                  >
                    <View
                      className="overflow-hidden rounded-[3px]"
                      style={{
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? "#15140f" : "#cdcbbf",
                      }}
                    >
                      <Svg width="100%" height={56}>
                        <Defs>
                          <LinearGradient id={`b-${b.id}`} x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={b.from} />
                            <Stop offset="1" stopColor={b.to} />
                          </LinearGradient>
                        </Defs>
                        <Rect width="100%" height="100%" fill={`url(#b-${b.id})`} />
                      </Svg>
                    </View>
                    <Text variant="caption" className="pt-1 normal-case tracking-normal">
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-3.5 py-3">
      <Text variant="heading" className="text-[15px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

function NavRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-3.5 py-3 active:opacity-70"
    >
      <Text variant="heading" className="text-[15px]">
        {label}
      </Text>
      <View className="flex-row items-center gap-1">
        <Text className="text-[15px] font-semibold text-foreground">{value}</Text>
        <StyledIonicons name="chevron-forward" size={16} className="text-muted" />
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-separator" />;
}

function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-2.5 rounded-[3px] bg-surface-secondary p-2.5">
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: `${tint}22` }}
      >
        <SpriteIcon name={icon} size={18} color={tint} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="caption">{label}</Text>
        <Text variant="balance" numberOfLines={1} className="text-[16px]">
          {value}
        </Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1">
      <Text variant="display" className="text-[28px]">
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function StatSep() {
  return <View className="mx-3 w-px self-stretch bg-separator" />;
}
