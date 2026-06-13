import { cn } from "heroui-native";
import type { ReactNode } from "react";
import { Pressable, Text, type PressableProps } from "react-native";
import { tv } from "tailwind-variants";

/**
 * Button — editorial black & white primitive.
 *
 * Implemented as a bare `Pressable` (not the heroui `Button`) on purpose: the
 * heroui variants/sizes carry their own radii, soft fills and scale feedback
 * that fight the Minna-Bank near-square ink look. A Pressable gives full
 * className control for the sharp 3px-corner, hairline-ink aesthetic.
 */

const button = tv({
  slots: {
    // 1.5px ink border on every variant (the HTML `.btn` base) so solid,
    // outline and accent are identical in height.
    base: "flex-row items-center justify-center rounded-[3px] border-[1.5px] border-foreground",
    label: "font-extrabold",
  },
  variants: {
    variant: {
      solid: {
        base: "bg-foreground",
        label: "text-background",
      },
      outline: {
        base: "bg-surface",
        label: "text-foreground",
      },
      accent: {
        base: "bg-accent",
        label: "text-accent-foreground",
      },
    },
    size: {
      md: { base: "px-[18px] py-3", label: "text-[13px]" },
      sm: { base: "px-[13px] py-2", label: "text-[12px]" },
    },
    disabled: {
      true: { base: "opacity-40" },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});

export interface ButtonProps extends Omit<PressableProps, "children" | "disabled" | "style"> {
  /** Visual emphasis. @default "solid" */
  variant?: "solid" | "outline" | "accent";
  /** Sizing / padding scale. @default "md" */
  size?: "md" | "sm";
  /** Label node (string or custom content). */
  children?: ReactNode;
  /** Additional classes merged onto the pressable container. */
  className?: string;
  /** Disables press + dims the button. */
  disabled?: boolean;
}

export function Button({
  variant = "solid",
  size = "md",
  children,
  className,
  disabled = false,
  ...props
}: ButtonProps) {
  const { base, label } = button({ variant, size, disabled });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      className={cn(base(), className)}
      {...props}
    >
      {typeof children === "string" ? <Text className={label()}>{children}</Text> : children}
    </Pressable>
  );
}
