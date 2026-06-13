import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { cn } from "heroui-native";

export interface TxnRowProps {
  /** Merchant / counterparty name (primary line). */
  merchant: string;
  /** Secondary line, e.g. "3 Jun · UPI · food". */
  sub: string;
  /** Pre-formatted amount string, e.g. "−₹480" or "+₹62,000". */
  amount: string;
  /** Money direction. "out" = spend (ink), "in" = credit (green). */
  direction?: "in" | "out";
  /** Optional glyph/node rendered inside the round dot (overrides the arrow). */
  icon?: ReactNode;
  /** Optional trailing node rendered after the amount (e.g. a "?" badge). */
  badge?: ReactNode;
  className?: string;
}

const TABULAR = { fontVariant: ["tabular-nums" as const] };

/**
 * TxnRow — the atom of the app: a single transaction row.
 *
 * Round 34px outline icon dot (arrow ↑ spend / ↓ credit, or a custom icon),
 * merchant over sub-line, tabular amount on the right. Credits render green
 * with a leading +; spends are ink. Bottom hairline separator.
 */
export function TxnRow({
  merchant,
  sub,
  amount,
  direction = "out",
  icon,
  badge,
  className,
}: TxnRowProps) {
  const isIn = direction === "in";

  return (
    <View className={cn("flex-row items-center gap-3 py-2.5 border-b border-separator", className)}>
      {/* Round outline icon dot */}
      <View
        className={cn(
          "w-[34px] h-[34px] rounded-full items-center justify-center border-[1.3px]",
          isIn ? "border-foreground" : "border-border",
        )}
      >
        {icon != null ? (
          typeof icon === "string" ? (
            <Text className={cn("text-[13px]", isIn ? "text-foreground" : "text-muted")}>
              {icon}
            </Text>
          ) : (
            icon
          )
        ) : (
          <Text className={cn("text-[13px]", isIn ? "text-foreground" : "text-muted")}>
            {isIn ? "↓" : "↑"}
          </Text>
        )}
      </View>

      {/* Middle: merchant over sub */}
      <View className="flex-1 min-w-0">
        <Text numberOfLines={1} className="text-[14px] font-bold text-foreground">
          {merchant}
        </Text>
        <Text numberOfLines={1} className="text-[11px] text-muted mt-px">
          {sub}
        </Text>
      </View>

      {/* Right: amount + optional badge */}
      <View className="flex-row items-center gap-2">
        <Text
          style={TABULAR}
          className={cn("text-[15px] font-extrabold", isIn ? "text-success" : "text-foreground")}
        >
          {amount}
        </Text>
        {badge != null ? badge : null}
      </View>
    </View>
  );
}
