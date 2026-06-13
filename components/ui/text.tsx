import { cn } from "heroui-native";
import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tv } from "tailwind-variants";

export type TextVariant = "display" | "title" | "balance" | "heading" | "body" | "caption" | "tag";

export interface TextProps extends RNTextProps {
  /**
   * Typographic role from the unmiser type scale. Defaults to "body".
   */
  variant?: TextVariant;
}

/**
 * Type scale mirrors `unmiser Design System.html` (`.d-*` specimen classes).
 * Tracking is encoded here; tabular-nums for `balance` is applied via `style`
 * (RN has no className for fontVariant).
 */
const text = tv({
  base: "text-foreground",
  variants: {
    variant: {
      // .d-display — 46px / 900 / -.03em / line-height 1
      display: "text-[46px] font-black leading-none tracking-tighter",
      // .d-title — 30px / 800 / -.02em
      title: "text-[30px] font-extrabold tracking-tight",
      // .d-balance — 34px / 800 / -.02em / tabular
      balance: "text-[34px] font-extrabold tracking-tight",
      // .d-h — 18px / 800
      heading: "text-[18px] font-extrabold",
      // .d-body — 14px / 500 / secondary ink
      body: "text-[14px] font-medium text-foreground/70",
      // .d-cap — mono 11px / uppercase / wide tracking / muted
      caption: "font-mono text-[11px] uppercase tracking-wider text-muted",
      // .d-tag — 12px / 700
      tag: "text-[12px] font-bold",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", className, style, ...props },
  ref,
) {
  return (
    <RNText
      ref={ref}
      className={cn(text({ variant }), className)}
      style={variant === "balance" ? [{ fontVariant: ["tabular-nums"] }, style] : style}
      {...props}
    />
  );
});
