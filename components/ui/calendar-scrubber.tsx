import { Ionicons } from "@expo/vector-icons";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { cn } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { useAccent } from "@/lib/appearance/use-accent";
import { Text } from "./text";

const StyledIonicons = withUniwind(Ionicons);

const WEEK_OPTS = { weekStartsOn: 1 } as const;
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const ROW_H = 50; // height of one week row
const SPRING = { damping: 22, stiffness: 200, mass: 0.7 } as const;

/** The Mon-anchored weeks that fully cover `d`'s month (each a row of 7 days). */
function monthWeeks(d: Date): Date[][] {
  const all = eachDayOfInterval({
    start: startOfWeek(startOfMonth(d), WEEK_OPTS),
    end: endOfWeek(endOfMonth(d), WEEK_OPTS),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
  return weeks;
}

/** One month page. Always renders the full month; `progress` slides it so the
 *  pinned week sits at the top when collapsed and the whole month shows when open. */
function MonthPage({
  anchor,
  selected,
  activeDays,
  accent,
  progress,
  onPick,
}: {
  anchor: Date;
  selected: Date;
  activeDays: Set<string>;
  accent: string;
  progress: SharedValue<number>;
  onPick: (d: Date) => void;
}) {
  const weeks = useMemo(() => monthWeeks(anchor), [anchor]);
  const pinIdx = useMemo(
    () =>
      Math.max(
        0,
        weeks.findIndex((w) => w.some((d) => isSameDay(d, anchor))),
      ),
    [weeks, anchor],
  );
  const style = useAnimatedStyle(
    () => ({
      transform: [{ translateY: interpolate(progress.value, [0, 1], [-pinIdx * ROW_H, 0]) }],
    }),
    [pinIdx],
  );

  return (
    <Animated.View style={style}>
      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row" style={{ height: ROW_H }}>
          {week.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const isSel = isSameDay(d, selected);
            const dim = !isSameMonth(d, anchor);
            const today = isToday(d);
            const dot = activeDays.has(key) && !isSel;
            return (
              <Pressable
                key={key}
                onPress={() => onPick(d)}
                accessibilityRole="button"
                accessibilityLabel={format(d, "EEEE, d MMMM")}
                className="flex-1 items-center pt-1"
              >
                <View
                  className={cn(
                    "h-9 w-9 items-center justify-center rounded-[8px] border-[1.5px]",
                    isSel || today
                      ? "border-foreground"
                      : dim
                        ? "border-separator"
                        : "border-border",
                  )}
                  style={isSel ? { backgroundColor: accent } : undefined}
                >
                  <Text
                    className={cn(
                      "text-[15px]",
                      isSel
                        ? "font-extrabold text-accent-foreground"
                        : dim
                          ? "font-semibold text-muted"
                          : "font-bold text-foreground",
                    )}
                    style={!isSel && today ? { color: accent } : undefined}
                  >
                    {format(d, "d")}
                  </Text>
                </View>
                <View
                  className="mt-1 h-1 w-1 rounded-full"
                  style={{ backgroundColor: dot ? accent : "transparent" }}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

export interface CalendarScrubberProps {
  /** The currently selected day; the strip is anchored on its week/month. */
  selected: Date;
  onSelect: (date: Date) => void;
  /** "yyyy-MM-dd" keys that have activity — rendered as a dot under the day. */
  activeDays: Set<string>;
  /** The transactions region; shifts down smoothly as the month grid opens. */
  children: React.ReactNode;
}

/**
 * Boxy week-strip calendar that expands to a full month grid, rebuilt as a 3-page
 * carousel (prev/current/next) so dragging horizontally reveals the neighbouring
 * period as it slides in — the reference app's feel. The knob (tap or drag)
 * expands/collapses via a Reanimated height + per-page week-pin. `expanded` React
 * state is the single source of truth; the animation derives from it. Built from
 * plain Views — react-native-calendars' ExpandableCalendar renders blank on the
 * new architecture (RN 0.85 / Expo 56).
 */
export function CalendarScrubber({
  selected,
  onSelect,
  activeDays,
  children,
}: CalendarScrubberProps) {
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  const progress = useSharedValue(0); // 0 collapsed, 1 expanded
  const pageX = useSharedValue(0); // horizontal carousel offset (0 = current centered)

  // Drive the height/translate animation from the `expanded` state.
  const rows = monthWeeks(selected).length;
  const extra = (rows - 1) * ROW_H;

  const applyExpanded = (open: boolean) => {
    setExpanded(open);
    progress.value = withSpring(open ? 1 : 0, SPRING);
  };
  const toggle = () => {
    void Haptics.selectionAsync();
    applyExpanded(!expanded);
  };

  // Anchors for the three carousel pages. Step is a week (collapsed) or month (open).
  const prevAnchor = expanded ? addMonths(selected, -1) : addWeeks(selected, -1);
  const nextAnchor = expanded ? addMonths(selected, 1) : addWeeks(selected, 1);

  const commitShift = (step: number) => {
    void Haptics.selectionAsync();
    onSelect(expanded ? addMonths(selected, step) : addWeeks(selected, step));
    // The neighbour we slid to becomes the new centre — re-centre instantly.
    pageX.value = 0;
  };

  const containerStyle = useAnimatedStyle(
    () => ({ height: ROW_H + progress.value * extra }),
    [extra],
  );
  const rowStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: -width + pageX.value }] }),
    [width],
  );

  const knobDrag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-12, 12])
        .onChange((e) => {
          "worklet";
          progress.value = Math.min(
            1,
            Math.max(0, progress.value + e.changeY / Math.max(extra, 1)),
          );
        })
        .onEnd(() => {
          "worklet";
          const open = progress.value >= 0.5;
          progress.value = withSpring(open ? 1 : 0, SPRING);
          runOnJS(setExpanded)(open);
        }),
    [extra, progress],
  );

  const pageSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-14, 14])
        .onChange((e) => {
          "worklet";
          pageX.value = e.translationX;
        })
        .onEnd((e) => {
          "worklet";
          const go = Math.abs(e.translationX) > width * 0.22 || Math.abs(e.velocityX) > 550;
          if (go) {
            const step = e.translationX < 0 ? 1 : -1; // swipe left → next
            // Slide the chosen neighbour fully into view, then commit + re-centre.
            pageX.value = withTiming(step > 0 ? -width : width, { duration: 150 }, (done) => {
              if (done) runOnJS(commitShift)(step);
            });
          } else {
            pageX.value = withSpring(0, SPRING);
          }
        }),
    [width, pageX, commitShift],
  );

  const shift = (dir: number) => {
    void Haptics.selectionAsync();
    onSelect(expanded ? addMonths(selected, dir) : addWeeks(selected, dir));
  };
  const pick = (d: Date) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(d);
  };
  const goToday = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(new Date());
  };

  const selectedIsToday = isToday(selected);

  return (
    <View className="flex-1">
      {/* Header: [Today] · Mon, Jun 15 · ‹ › */}
      <View className="h-12 flex-row items-center justify-between px-4">
        <Pressable
          onPress={goToday}
          disabled={selectedIsToday}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          className={cn(
            "rounded-[6px] border-[1.5px] px-2.5 py-1",
            selectedIsToday ? "border-border" : "border-foreground active:opacity-70",
          )}
        >
          <Text
            className={cn(
              "text-[12px] font-bold",
              selectedIsToday ? "text-muted" : "text-foreground",
            )}
          >
            Today
          </Text>
        </Pressable>

        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel="Expand or collapse calendar"
          className="px-2 py-1"
        >
          <Text className="text-[15px] font-extrabold tracking-tight text-foreground">
            {format(selected, "EEE, MMM d")}
          </Text>
        </Pressable>

        <View className="flex-row">
          <Pressable
            onPress={() => shift(-1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Previous"
            className="h-8 w-7 items-center justify-center active:opacity-60"
          >
            <StyledIonicons name="chevron-back" size={18} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={() => shift(1)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Next"
            className="h-8 w-7 items-center justify-center active:opacity-60"
          >
            <StyledIonicons name="chevron-forward" size={18} className="text-foreground" />
          </Pressable>
        </View>
      </View>

      {/* Weekday header */}
      <View className="flex-row px-2">
        {WEEKDAYS.map((w) => (
          <Text
            key={w}
            className="flex-1 text-center text-[10px] font-bold uppercase tracking-[1px] text-muted"
          >
            {w}
          </Text>
        ))}
      </View>

      {/* Clipped, animated 3-page carousel — drag to reveal the neighbouring period. */}
      <GestureDetector gesture={pageSwipe}>
        <Animated.View className="overflow-hidden" style={containerStyle}>
          <Animated.View className="flex-row" style={[rowStyle, { width: width * 3 }]}>
            {[prevAnchor, selected, nextAnchor].map((anchor, i) => (
              <View key={i} style={{ width }} className="px-2">
                <MonthPage
                  anchor={anchor}
                  selected={selected}
                  activeDays={activeDays}
                  accent={accent}
                  progress={progress}
                  onPick={pick}
                />
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Drag knob — tap or drag to expand/collapse. */}
      <GestureDetector gesture={knobDrag}>
        <Pressable
          onPress={toggle}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Expand or collapse calendar"
          className="items-center border-b border-separator pb-2 pt-1.5"
        >
          <View className="h-1 w-9 rounded-full bg-border" />
        </Pressable>
      </GestureDetector>

      <View className="flex-1">{children}</View>
    </View>
  );
}
