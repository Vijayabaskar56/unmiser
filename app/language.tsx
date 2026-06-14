import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SearchField } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { Container } from "@/components/container";
import { AppBar, Card, SpriteIcon, Text } from "@/components/ui";

const StyledIonicons = withUniwind(Ionicons);

interface Language {
  /** BCP-47-ish code, used as the selection key. */
  code: string;
  /** Native (endonym) name — the bold primary line. */
  native: string;
  /** English name — the muted secondary line. */
  english: string;
}

// UI-only catalogue (no i18n runtime yet). English is the default; selecting
// another locale just moves the checkmark — nothing is persisted.
const LANGUAGES: Language[] = [
  { code: "en", native: "English", english: "Default" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "ur", native: "اردو", english: "Urdu" },
  { code: "as", native: "অসমীয়া", english: "Assamese" },
  { code: "es", native: "Español", english: "Spanish" },
];

export default function LanguageScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("en");

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
        title="Language"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
      />
      <Container className="px-4">
        <SearchField value={query} onChange={setQuery} className="my-3">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={`Search ${LANGUAGES.length} languages…`} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <Text variant="caption" className="mb-2 ml-1">
          App Language
        </Text>

        {rows.length === 0 ? (
          <Text variant="body" className="pt-2">
            No languages match “{query.trim()}”.
          </Text>
        ) : (
          <Card variant="soft" className="gap-0 p-0">
            {rows.map((lang, i) => {
              const isSelected = lang.code === selected;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setSelected(lang.code)}
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
            SMS parsing always reads English bank senders, whatever the app language.
          </Text>
        </View>

        <View className="h-8" />
      </Container>
    </View>
  );
}
