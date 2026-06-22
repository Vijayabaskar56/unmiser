import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { useThemeColor } from "heroui-native";

import type { BudgetProgress } from "@/lib/budgets/progress";

export interface ProgressBarProps {
  /** 0–100+ (values over 100 clamp the fill but flip to the "over" hatch). */
  percent: number;
  /**
   * Budget status drives the fill treatment:
   * - calm / watch → ink fill
   * - tight → accent (yellow) fill, salience as the limit nears
   * - over → diagonal hatch, the loss-aversion warning
   */
  status?: BudgetProgress["status"];
  /** Force the accent (yellow) fill — used for the in-progress current month. */
  highlight?: boolean;
  height?: number;
}

/**
 * Editorial budget progress bar (`react-native-svg`). A paper track with an ink
 * fill; the over-budget state swaps to a diagonal hatch `<Pattern>` to read as a
 * warning rather than "more of the same". No rounded candy — square 2px corners.
 */
export function ProgressBar({
  percent,
  status = "calm",
  highlight,
  height = 12,
}: ProgressBarProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ink, accent, surface, border] = useThemeColor([
    "foreground",
    "accent",
    "surface",
    "border",
  ]);

  const over = status === "over";
  const ratio = Math.max(0, Math.min(percent, 100)) / 100;
  const fill = over ? ink : highlight || status === "tight" ? accent : ink;

  return (
    <View style={{ height }}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern
            id={`hatch-${id}`}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <Rect width={6} height={6} fill={surface} />
            <Path d="M0,0 L0,6" stroke={ink} strokeWidth={2.5} />
          </Pattern>
        </Defs>
        {/* track */}
        <Rect x={0} y={0} width="100%" height={height} rx={2} fill={surface} stroke={border} />
        {/* fill */}
        {over ? (
          <Rect x={0} y={0} width="100%" height={height} rx={2} fill={`url(#hatch-${id})`} />
        ) : (
          <Rect x={0} y={0} width={`${ratio * 100}%`} height={height} rx={2} fill={fill} />
        )}
      </Svg>
    </View>
  );
}
