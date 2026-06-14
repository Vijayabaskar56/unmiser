import { Ionicons } from "@expo/vector-icons";
import { Dialog } from "heroui-native";
import { View } from "react-native";
import { withUniwind } from "uniwind";

import { Button } from "./button";
import { Text } from "./text";

const StyledIonicons = withUniwind(Ionicons);

export interface ConfirmDialogProps {
  /** Controlled open state. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ionicons glyph shown in the circular badge. @default "trash-outline" */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  /** Confirm button label. @default "Delete" */
  confirmLabel?: string;
  /** Cancel button label. @default "Cancel" */
  cancelLabel?: string;
  /** Disables both buttons and shows a spinner-ish label while the action runs. */
  busy?: boolean;
  /** Runs on confirm; the caller closes the dialog (usually via onOpenChange). */
  onConfirm: () => void | Promise<void>;
}

/**
 * Editorial centered confirmation for destructive actions (ADR design system):
 * dimmed overlay → white card with a circular ink icon, bold title, muted body,
 * and a Cancel / Delete button pair. Wraps heroui `Dialog` for the portal,
 * overlay and centering; the content is rendered with our own primitives so it
 * matches the black-and-white look instead of the heroui defaults.
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  icon = "trash-outline",
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="items-center rounded-[14px] bg-background px-6 py-7">
          <View className="h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-foreground">
            <StyledIonicons name={icon} size={26} className="text-foreground" />
          </View>

          <Dialog.Title>
            <Text className="mt-4 text-center text-[20px] font-extrabold text-foreground">
              {title}
            </Text>
          </Dialog.Title>

          {description ? (
            <Dialog.Description>
              <Text variant="body" className="mt-2 text-center text-[14px] leading-5">
                {description}
              </Text>
            </Dialog.Description>
          ) : null}

          <View className="mt-6 flex-row gap-3 self-stretch">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onPress={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="solid"
              className="flex-1"
              disabled={busy}
              onPress={() => void onConfirm()}
            >
              {busy ? "…" : confirmLabel}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
