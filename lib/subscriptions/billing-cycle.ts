import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";

export const BILLING_CYCLE_PRESETS = [
  "weekly",
  "monthly",
  "quarterly",
  "half-yearly",
  "yearly",
] as const;
export type BillingCyclePreset = (typeof BILLING_CYCLE_PRESETS)[number];
export type BillingCycleUnit = "day" | "week" | "month" | "year";

export interface BillingCycle {
  count: number;
  unit: BillingCycleUnit;
  endDate?: string;
}

export function parseBillingCycle(value: string | null | undefined): BillingCycle | null {
  if (!value) return null;
  if (value === "weekly") return { count: 1, unit: "week" };
  if (value === "monthly") return { count: 1, unit: "month" };
  if (value === "quarterly") return { count: 3, unit: "month" };
  if (value === "half-yearly") return { count: 6, unit: "month" };
  if (value === "yearly") return { count: 1, unit: "year" };

  const match = /^custom_(\d+)_(day|week|month|year)(?:_(\d{4}-\d{2}-\d{2}))?$/.exec(value);
  if (!match) return null;
  return { count: Number(match[1]), unit: match[2] as BillingCycleUnit, endDate: match[3] };
}

export function formatBillingCycle(cycle: BillingCycle): string {
  for (const preset of BILLING_CYCLE_PRESETS) {
    const parsed = parseBillingCycle(preset);
    if (parsed?.count === cycle.count && parsed.unit === cycle.unit && !cycle.endDate) {
      return preset;
    }
  }
  return `custom_${cycle.count}_${cycle.unit}${cycle.endDate ? `_${cycle.endDate}` : ""}`;
}

export function advanceDate(date: string, cycle: BillingCycle): string {
  const base = new Date(`${date}T00:00:00`);
  const advanced =
    cycle.unit === "day"
      ? addDays(base, cycle.count)
      : cycle.unit === "week"
        ? addWeeks(base, cycle.count)
        : cycle.unit === "month"
          ? addMonths(base, cycle.count)
          : addYears(base, cycle.count);
  return format(advanced, "yyyy-MM-dd");
}

export function cyclesPerMonth(cycle: BillingCycle | null): number {
  if (!cycle) return 1;
  if (cycle.unit === "day") return 30.4375 / cycle.count;
  if (cycle.unit === "week") return 4.348125 / cycle.count;
  if (cycle.unit === "month") return 1 / cycle.count;
  return 1 / (cycle.count * 12);
}
