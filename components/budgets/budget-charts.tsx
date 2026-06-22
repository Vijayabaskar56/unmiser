import { useMemo, useState } from "react";
import { View } from "react-native";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { useThemeColor } from "heroui-native";

import { Text } from "@/components/ui";
import type { CompositionSlice, HistoryMonth } from "@/lib/budgets/detail";
import * as money from "@/lib/money";

/**
 * Donut of "where the money went" (spend-by-merchant composition). Press a slice
 * to focus it — the centre label updates to that merchant + amount.
 */
export function SpendPie({
  slices,
  currency,
  size = 132,
}: {
  slices: CompositionSlice[];
  currency: string;
  size?: number;
}) {
  const [surface] = useThemeColor(["surface"]);
  const [focused, setFocused] = useState<number | null>(null);

  const data = useMemo(
    () =>
      slices.map((slice, i) => ({
        value: slice.value,
        color: slice.color,
        focused: focused === i,
      })),
    [slices, focused],
  );

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);
  const active = focused != null ? slices[focused] : null;

  if (slices.length === 0) {
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Text variant="caption">No spend yet</Text>
      </View>
    );
  }

  return (
    <PieChart
      data={data}
      donut
      radius={size / 2}
      innerRadius={size / 2 - 22}
      innerCircleColor={surface}
      focusOnPress
      onPress={(_: unknown, index: number) => setFocused((cur) => (cur === index ? null : index))}
      centerLabelComponent={() => (
        <View className="items-center px-2">
          <Text variant="caption" numberOfLines={1} className="text-center">
            {active ? active.label : "Total"}
          </Text>
          <Text variant="heading" numberOfLines={1} className="text-[15px]">
            {money.formatCompact(active ? active.amount : total.toFixed(2), currency)}
          </Text>
        </View>
      )}
    />
  );
}

/**
 * Last-N-months spend bars. Completed months render as outlined/hatched ink,
 * the in-progress current month is solid accent, over-budget months solid ink —
 * mirroring the wireframe's month-by-month read.
 */
export function HistoryBars({ months, width }: { months: HistoryMonth[]; width: number }) {
  const [ink, accent, muted, border] = useThemeColor(["foreground", "accent", "muted", "border"]);

  const maxValue = useMemo(() => {
    const peak = months.reduce((m, mo) => Math.max(m, Number(mo.spent), Number(mo.limit)), 0);
    return peak > 0 ? peak * 1.15 : 1;
  }, [months]);

  const count = Math.max(months.length, 1);
  const spacing = 14;
  const barWidth = Math.max(18, (width - spacing * (count + 1)) / count);

  const data = useMemo(
    () =>
      months.map((mo) => ({
        value: Number(mo.spent),
        label: mo.label,
        // current month = solid accent, over = solid ink, completed-under = outlined
        frontColor: mo.isCurrent ? accent : mo.over ? ink : "transparent",
        topLabelComponent:
          mo.isCurrent || mo.over
            ? () => (
                <View className="mb-0.5 items-center">
                  <Text variant="caption" className="text-[9px]">
                    {mo.percent}%
                  </Text>
                </View>
              )
            : undefined,
      })),
    [months, accent, ink],
  );

  return (
    <BarChart
      data={data}
      width={width}
      height={132}
      barWidth={barWidth}
      spacing={spacing}
      initialSpacing={spacing}
      barBorderWidth={1}
      barBorderColor={ink}
      maxValue={maxValue}
      hideRules
      hideYAxisText
      yAxisThickness={0}
      xAxisThickness={1}
      xAxisColor={border}
      xAxisLabelTextStyle={{ color: muted, fontSize: 11 }}
      disableScroll
      isAnimated
    />
  );
}
