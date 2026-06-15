import { Ionicons } from "@expo/vector-icons";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { SearchField } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, SpriteIcon, Text } from "@/components/ui";
import { appSettingsCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import { APP_SETTING_KEYS } from "@/db/schema";
import { setAppLanguage, useT } from "@/lib/i18n/use-i18n";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LANGUAGES,
  type LocaleCode,
} from "@/lib/i18n/translations";

const StyledIonicons = withUniwind(Ionicons);

export default function LanguageScreen() {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");

  // Selected language is persisted in app_settings and read reactively, so the
  // checkmark + the whole app update the instant it changes.
  const { data: langRows } = useLiveQuery((q) =>
    q.from({ s: appSettingsCollection }).where(({ s }) => eq(s.key, APP_SETTING_KEYS.appLanguage)),
  );
  const stored = langRows?.[0]?.value;
  const selected: LocaleCode = isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;

  const onSelect = async (code: LocaleCode) => {
    await setAppLanguage(appDb, code);
    await appSettingsCollection.utils.refetch();
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.native.toLowerCase().includes(q) || l.english.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title={t("language.title")}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        <SearchField value={query} onChange={setQuery} className="my-3">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t("language.search", { count: LANGUAGES.length })} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <Text variant="caption" className="mb-2 ml-1">
          {t("language.heading")}
        </Text>

        {rows.length === 0 ? (
          <Text variant="body" className="pt-2">
            {t("language.empty", { query: query.trim() })}
          </Text>
        ) : (
          <Card variant="soft" className="gap-0 p-0">
            {rows.map((lang, i) => {
              const isSelected = lang.code === selected;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => void onSelect(lang.code)}
                  className="active:opacity-70"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  {i > 0 ? <View className="mx-3.5 h-px bg-separator" /> : null}
                  <View className="flex-row items-center gap-3 px-3.5 py-3.5">
                    <View className="min-w-0 flex-1">
                      <Text variant="heading" numberOfLines={1} className="text-[17px]">
                        {lang.native}
                      </Text>
                      <Text variant="body" className="text-[13px]">
                        {lang.english}
                      </Text>
                    </View>
                    {isSelected ? (
                      <StyledIonicons name="checkmark" size={22} className="text-foreground" />
                    ) : (
                      <View className="h-[22px] w-[22px] rounded-full border-[1.5px] border-border" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}

        <View className="mt-4 flex-row items-start gap-2.5 rounded-[3px] bg-surface-secondary px-3.5 py-3">
          <SpriteIcon name="info-circle" size={18} />
          <Text variant="body" className="flex-1 text-[13px]">
            {t("language.note")}
          </Text>
        </View>

        <View className="h-8" />
      </Container>
    </View>
  );
}
