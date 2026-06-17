import { Stack } from "expo-router";

/**
 * Onboarding group (ROADMAP Phase 2, workstream B). Reached via the first-run
 * gate in the root layout, or re-run any time via the deep link `/sms-setup`.
 *
 * Five steps, "Minna Bank" style: Welcome → Archetype → Country → SMS → Done.
 * Provider install, account naming and the historical scan live on the
 * Extensions/Store tabs (post-onboarding), so this flow stays tight. Each step
 * pushes the next with a right-slide transition (faithful to the prototype's
 * step-enter/step-back), so screens render their own chrome.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationTypeForReplace: "push",
      }}
    />
  );
}
