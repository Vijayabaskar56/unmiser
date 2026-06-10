// Pure-JS helpers used by schema column defaults.
//
// IMPORTANT: keep this file free of native imports (expo-sqlite, expo-crypto, …).
// drizzle-kit loads the schema in Node when generating migrations, so anything
// the schema transitively imports must run in plain Node too.

/** ISO-8601 timestamp string — mirrors Room's LocalDateTime text storage. */
export const nowIso = (): string => new Date().toISOString();

/** RFC-4122 v4 UUID. Local row ids only, so Math.random is acceptable here. */
export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
