import "@/global.css";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { Redirect, Stack, useSegments } from "expo-router";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { HeroUINativeProvider } from "heroui-native";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { expoDb } from "@/db";
import { appSettingsCollection } from "@/db/collections";
import { useMigrations } from "@/db/use-migrations";
import { shouldShowSmsOnboarding, SMS_SETUP_COMPLETED_AT_KEY } from "@/lib/onboarding-state";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

/**
 * First-run gate (ROADMAP Phase 2, workstream B): on Android, until the
 * `smsSetupCompletedAt` pref is set (finishing the wizard OR "Set up later"),
 * redirect into the SMS-setup wizard. Reactive via the app-settings live
 * query, so completing the wizard releases the gate immediately.
 */
function SmsOnboardingGate() {
  const segments = useSegments();
  const { data: settings, isReady } = useLiveQuery((q) =>
    q
      .from({ setting: appSettingsCollection })
      .where(({ setting }) => eq(setting.key, SMS_SETUP_COMPLETED_AT_KEY)),
  );
  const redirect = shouldShowSmsOnboarding({
    platform: Platform.OS,
    isReady,
    completedAt: settings?.[0]?.value ?? null,
    inOnboardingGroup: segments[0] === "(onboarding)",
  });
  return redirect ? <Redirect href="/sms-setup" /> : null;
}

function StackLayout() {
  return (
    <>
      <Stack screenOptions={{}}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
        <Stack.Screen
          name="transaction/[id]"
          options={{ title: "Transaction", presentation: "modal" }}
        />
      </Stack>
      <SmsOnboardingGate />
    </>
  );
}

export default function Layout() {
  // On-device Drizzle Studio dev tool (no-op in production builds).
  useDrizzleStudio(expoDb);

  // Apply bundled migrations on startup before rendering the app.
  const { success, error } = useMigrations();

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "red" }}>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppThemeProvider>
          <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
            <StackLayout />
          </HeroUINativeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
