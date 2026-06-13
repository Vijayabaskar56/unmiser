import { View, type ViewProps } from "react-native";
import { cn } from "heroui-native";
import { tv } from "tailwind-variants";

/**
 * Card — editorial container with 3 weights (Minna Bank-inspired).
 *
 * - ink: structural / hero-number card — 1.5px ink border on a surface fill.
 * - soft: grouped-list card — 1px hairline border on a surface fill.
 * - inverted: feature-moment card — solid ink fill (children should render
 *   `text-background`).
 *
 * Near-square 3px corners, 14px padding, no shadow.
 */
const card = tv({
  base: "rounded-[3px] p-[14px] gap-2",
  variants: {
    variant: {
      ink: "bg-surface border-[1.5px] border-foreground",
      soft: "bg-surface border border-border",
      inverted: "bg-foreground",
    },
  },
  defaultVariants: {
    variant: "soft",
  },
});

export interface CardProps extends ViewProps {
  /**
   * Visual weight of the card.
   * @default "soft"
   */
  variant?: "ink" | "soft" | "inverted";
}

export function Card({ variant = "soft", className, ...props }: CardProps) {
  return <View className={cn(card({ variant }), className)} {...props} />;
}
