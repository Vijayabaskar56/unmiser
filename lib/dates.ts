import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isValid,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

const ISO_PATTERN = "yyyy-MM-dd'T'HH:mm:ss";

export type Period = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

// Weeks start on Monday, matching the source app's wall-clock period math.
const WEEK_OPTS = { weekStartsOn: 1 } as const;

/** The current local wall-clock moment as a frozen ISO string "yyyy-MM-ddTHH:mm:ss". */
export function nowIso(): string {
  return toIso(new Date());
}

/** Parse a frozen local wall-clock ISO string into a Date (no timezone interpretation). */
export function parseIso(s: string): Date {
  const wallClock = parse(s, ISO_PATTERN, new Date());
  if (isValid(wallClock)) return wallClock;

  return parseISO(s);
}

/** Format a Date back into a frozen local wall-clock ISO string "yyyy-MM-ddTHH:mm:ss". */
export function toIso(d: Date): string {
  return format(d, ISO_PATTERN);
}

const DEFAULT_DISPLAY_PATTERN = "MMM d, yyyy";

/** Render a stored wall-clock ISO string for display, defaulting to "MMM d, yyyy". */
export function formatDisplay(s: string, pattern: string = DEFAULT_DISPLAY_PATTERN): string {
  const parsed = parseIso(s);
  if (!isValid(parsed)) return "Invalid date";
  return format(parsed, pattern);
}

/** The first instant of the period containing `s` (e.g. month start at 00:00:00). */
export function startOfPeriod(s: string, period: Period): string {
  const d = parseIso(s);
  switch (period) {
    case "DAILY":
      return toIso(startOfDay(d));
    case "WEEKLY":
      return toIso(startOfWeek(d, WEEK_OPTS));
    case "MONTHLY":
      return toIso(startOfMonth(d));
    case "YEARLY":
      return toIso(startOfYear(d));
  }
}

/** The last whole-second instant of the period containing `s` (e.g. month end at 23:59:59). */
export function endOfPeriod(s: string, period: Period): string {
  const d = parseIso(s);
  switch (period) {
    case "DAILY":
      return toIso(endOfDay(d));
    case "WEEKLY":
      return toIso(endOfWeek(d, WEEK_OPTS));
    case "MONTHLY":
      return toIso(endOfMonth(d));
    case "YEARLY":
      return toIso(endOfYear(d));
  }
}

/** Shift `s` by `n` periods (n may be negative), preserving wall-clock time-of-day. */
export function addPeriod(s: string, period: Period, n: number): string {
  const d = parseIso(s);
  switch (period) {
    case "DAILY":
      return toIso(addDays(d, n));
    case "WEEKLY":
      return toIso(addWeeks(d, n));
    case "MONTHLY":
      return toIso(addMonths(d, n));
    case "YEARLY":
      return toIso(addYears(d, n));
  }
}

/**
 * Whether `s` falls within [startInclusive, endInclusive], bounds included.
 * Operates on the lexicographic ordering of the wall-clock ISO strings, which is
 * chronological for the fixed "yyyy-MM-ddTHH:mm:ss" shape.
 */
export function isWithin(s: string, startInclusive: string, endInclusive: string): boolean {
  return s >= startInclusive && s <= endInclusive;
}
