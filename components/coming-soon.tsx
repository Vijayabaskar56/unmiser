import { Stack, useRouter } from "expo-router";
import { View } from "react-native";

import { AppBar, Text } from "@/components/ui";

/**
 * Placeholder for settings sub-screens that have a design but aren't built yet
 * (Appearance, Data & Privacy, Profile, Language, Budgets). Keeps the Settings
 * hub fully navigable; replace each route's body as the real screen lands.
 */
export function ComingSoon({ title, showBack = true }: { title: string; showBack?: boolean }) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <AppBar
        title={title}
        onBack={
          showBack
            ? () => (router.canGoBack() ? router.back() : router.replace("/settings"))
            : undefined
        }
      />
      <View className="flex-1 items-center justify-center px-8">
        <Text variant="heading" className="text-center">
          Coming soon
        </Text>
        <Text variant="body" className="mt-2 text-center">
          This screen isn’t built yet.
        </Text>
      </View>
    </View>
  );
}
