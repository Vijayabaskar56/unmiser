/**
 * Pure derivations for the Accounts list header + detail chips. Plain inputs,
 * no DB/React, so they unit-test without a device.
 */

/** Compact "Nm/Nh/Nd ago" for the most recent activity; "never"/"just now" edges. */
export function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return "never";
  const deltaMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Most recent non-null ISO timestamp, or null when there are none. */
export function lastParsedAt(timestamps: (string | null)[]): string | null {
  let latest: string | null = null;
  for (const ts of timestamps) {
    if (ts && (latest === null || ts > latest)) latest = ts;
  }
  return latest;
}

/** Parse-health pill: "ALL OK" when the SMS review queue is empty, else the count. */
export function reviewStatus(pendingCount: number): { label: string; ok: boolean } {
  return pendingCount === 0
    ? { label: "ALL OK", ok: true }
    : { label: `${pendingCount} TO REVIEW`, ok: false };
}
