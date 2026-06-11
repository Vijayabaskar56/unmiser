import { Stack } from "expo-router";

/**
 * SMS-setup onboarding group (ROADMAP Phase 2, workstream B). Reached via the
 * first-run gate in the root layout, or re-run any time via the deep link
 * `/sms-setup` (linked from the Store tab — there is no settings screen yet).
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
