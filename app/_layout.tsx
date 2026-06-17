import "@/global.css";
import { eq, useLiveQuery } from "@tanstack/react-db";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  HankenGrotesk_900Black,
} from "@expo-google-fonts/hanken-grotesk";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { Redirect, router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

SplashScreen.preventAutoHideAsync();

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { ThemeApplier } from "@/components/theme-applier";
import { AppLockScreen } from "@/components/app-lock-screen";
import { AccentProvider } from "@/lib/appearance/use-accent";
import { BackgroundBlurProvider } from "@/lib/appearance/use-background-blur";
import { DensityProvider } from "@/lib/appearance/use-density";
import { TextScaleProvider } from "@/lib/appearance/use-text-scale";
import { I18nProvider } from "@/lib/i18n/use-i18n";
import { AppLockProvider, useAppLock } from "@/lib/security/use-app-lock";
import { expoDb } from "@/db";
import { appDb } from "@/db/app-db";
import { appSettingsCollection } from "@/db/collections";
import { useMigrations } from "@/db/use-migrations";
import { configureNotificationHandler, syncScheduledNotifications } from "@/lib/notifications";
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
  const { data: settings, isReady } = useLiveQuery(
    (q) =>
      q
        .from({ setting: appSettingsCollection })
        .where(({ setting }) => eq(setting.key, SMS_SETUP_COMPLETED_AT_KEY)),
    [],
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
      {/* Default to no native header: tab screens, the Settings sub-screens, and
          the screens moved out of the tab bar (accounts/categories/rules/…) all
          render their own headers/AppBar. The two modals re-enable it. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen
          name="transaction/[id]"
          // Renders its own AppBar; keep the modal presentation but hide the
          // native Stack header so they don't double up.
          options={{ title: "Transaction", presentation: "modal", headerShown: false }}
        />
      </Stack>
      <SmsOnboardingGate />
      <AppLockGate />
      <ThemeApplier />
    </>
  );
}

/**
 * Renders the full-screen lock overlay above everything when App-lock is
 * enabled and the session is locked. An overlay (not a route) so it covers the
 * tabs and every stack screen uniformly and can't be navigated around.
 */
function AppLockGate() {
  const { locked, biometric, unlock } = useAppLock();
  if (!locked) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <AppLockScreen biometricEnabled={biometric} onUnlock={unlock} />
    </View>
  );
}

export default function Layout() {
  // On-device Drizzle Studio dev tool (no-op in production builds).
  useDrizzleStudio(expoDb);

  // Load the design-system fonts (one file per weight — RN can't synthesise
  // weights, so each is registered under its own family name referenced by the
  // --font-* tokens in global.css).
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    HankenGrotesk_900Black,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  // Apply bundled migrations on startup before rendering the app.
  const { success, error } = useMigrations();

  const ready = success && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Notifications: configure foreground presentation + deep-link on tap.
  useEffect(() => {
    configureNotificationHandler();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string") router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  // Reconcile scheduled notifications (weekly review / subscription renewals)
  // once migrations have applied, so the queries have tables to read.
  useEffect(() => {
    if (success) void syncScheduledNotifications(appDb);
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "red" }}>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!ready) {
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
            <AccentProvider>
              <TextScaleProvider>
                <DensityProvider>
                  <BackgroundBlurProvider>
                    <I18nProvider>
                      <AppLockProvider>
                        <StackLayout />
                      </AppLockProvider>
                    </I18nProvider>
                  </BackgroundBlurProvider>
                </DensityProvider>
              </TextScaleProvider>
            </AccentProvider>
          </HeroUINativeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
