import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { cn } from "heroui-native";
import { tv } from "tailwind-variants";

const chip = tv({
  slots: {
    base: "self-start rounded-[3px] border-[1.3px] px-[11px] py-[5px]",
    label: "text-[12px] font-semibold",
  },
  variants: {
    variant: {
      default: {
        base: "border-border bg-surface",
        label: "text-foreground/70",
      },
      on: {
        base: "border-foreground bg-foreground",
        label: "text-background",
      },
      accent: {
        base: "border-foreground bg-accent",
        label: "text-accent-foreground",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ChipProps {
  /** Visual state of the filter chip. */
  variant?: "default" | "on" | "accent";
  /** Chip label content. */
  children: ReactNode;
  /** Press handler. */
  onPress?: () => void;
  /** Merge extra classes onto the chip container. */
  className?: string;
}

export function Chip({ variant = "default", children, onPress, className }: ChipProps) {
  const { base, label } = chip({ variant });

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={cn(base(), className)}>
      <Text className={label()}>{children}</Text>
    </Pressable>
  );
}
