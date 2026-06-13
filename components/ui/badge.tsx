import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cn } from "heroui-native";
import { tv } from "tailwind-variants";

type BadgeVariant = "default" | "accent" | "gray";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const badge = tv({
  slots: {
    container: "rounded-[2px] border-[1.3px] px-[6px] py-[2px] self-start",
    label: "font-mono text-[9px] font-bold uppercase tracking-wide",
  },
  variants: {
    variant: {
      default: {
        container: "border-foreground",
        label: "text-foreground",
      },
      accent: {
        container: "bg-accent border-foreground",
        label: "text-accent-foreground",
      },
      gray: {
        container: "border-border",
        label: "text-muted",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({ variant = "default", children, className }: BadgeProps) {
  const { container, label } = badge({ variant });
  return (
    <View className={cn(container(), className)}>
      <Text className={label()}>{children}</Text>
    </View>
  );
}
