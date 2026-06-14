import type { ComponentProps } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "./text";

/** Muted placeholder ink shared by every form input (matches `text-muted`). */
export const FIELD_PLACEHOLDER_COLOR = "#9a988c";

/**
 * Labelled text input used across the create/edit bottom sheets: a caption
 * label above a bordered, surface-filled input. Pass-through `TextInput` props
 * (keyboardType, maxLength, autoCapitalize, …) flow straight to the input.
 */
export function Field({ label, ...input }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text variant="caption" className="mb-1">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={FIELD_PLACEHOLDER_COLOR}
        className="rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[15px] text-foreground"
        {...input}
      />
    </View>
  );
}

/**
 * Primary submit button for the form sheets. Kept as a bare Pressable (not the
 * `Button` primitive) so the disabled state can switch to the surface-secondary
 * fill + muted label the sheets use, rather than a simple opacity dim.
 */
export function SubmitButton({
  label,
  submitting,
  canSubmit,
  onPress,
}: {
  label: string;
  submitting: boolean;
  canSubmit: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!canSubmit}
      className={
        canSubmit
          ? "mt-1 items-center rounded-[3px] bg-foreground px-4 py-3 active:opacity-70"
          : "mt-1 items-center rounded-[3px] bg-surface-secondary px-4 py-3"
      }
    >
      <Text className={canSubmit ? "font-semibold text-background" : "font-semibold text-muted"}>
        {submitting ? "Saving…" : label}
      </Text>
    </Pressable>
  );
}
