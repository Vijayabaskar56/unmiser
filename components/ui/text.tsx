import { cn } from "heroui-native";
import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tv } from "tailwind-variants";

import { useTextScale } from "@/lib/appearance/use-text-scale";

export type TextVariant = "display" | "title" | "balance" | "heading" | "body" | "caption" | "tag";

export interface TextProps extends RNTextProps {
  /**
   * Typographic role from the unmiser type scale. Defaults to "body".
   */
  variant?: TextVariant;
}

/** Base px per variant — the source of truth the runtime scale multiplies. */
const VARIANT_SIZE: Record<TextVariant, number> = {
  display: 46,
  title: 30,
  balance: 34,
  heading: 18,
  body: 14,
  caption: 11,
  tag: 12,
};

/**
 * Type scale mirrors `unmiser Design System.html` (`.d-*` specimen classes).
 * Tracking is encoded here; tabular-nums for `balance` is applied via `style`
 * (RN has no className for fontVariant).
 *
 * Font SIZE is applied at runtime via `style.fontSize` (not the class) so the
 * Appearance text-size slider can scale every `Text` app-wide (see
 * `useTextScale`). The `text-[Npx]` classes stay for design reference but are
 * overridden by the resolved style; an explicit `text-[Npx]` in a call site's
 * className is honoured (and scaled) too.
 */
const text = tv({
  base: "text-foreground",
  variants: {
    variant: {
      display: "text-[46px] font-black leading-none tracking-tighter",
      title: "text-[30px] font-extrabold tracking-tight",
      balance: "text-[34px] font-extrabold tracking-tight",
      heading: "text-[18px] font-extrabold",
      body: "text-[14px] font-medium text-foreground/70",
      caption: "font-mono text-[11px] uppercase tracking-wider text-muted",
      tag: "text-[12px] font-bold",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

/** Effective base size: an explicit `text-[Npx]` override wins over the variant. */
function baseSize(variant: TextVariant, className?: string): number {
  const match =
    typeof className === "string" ? className.match(/text-\[(\d+(?:\.\d+)?)px\]/) : null;
  return match ? Number(match[1]) : VARIANT_SIZE[variant];
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", className, style, ...props },
  ref,
) {
  const scale = useTextScale();
  const fontSize = baseSize(variant, className) * scale;
  return (
    <RNText
      ref={ref}
      className={cn(text({ variant }), className)}
      style={[
        { fontSize },
        variant === "balance" ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
      {...props}
    />
  );
});
