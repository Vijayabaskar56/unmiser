import { z } from "zod";

/**
 * Owner-maintained extension registry (ROADMAP Phase 2, workstream A).
 *
 * The `unmiser-extensions` GitHub repo IS the registry; the app reads it over
 * the jsDelivr CDN. CI generates `index.json` (the catalog) on every push to
 * main — one entry per bank. The app fetches the catalog to populate the
 * browse list and fetches `manifests/<bank>.json` only on install.
 */
export const registryCatalogEntrySchema = z.object({
  pluginId: z.string().min(3),
  type: z.enum(["sms-parser", "rule"]).optional(),
  name: z.string().min(1),
  country: z.string().length(2),
  currency: z.string().length(3),
  version: z.string().min(1),
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i, "expected a hex-encoded SHA-256"),
  bytes: z.number().int().nonnegative(),
});

export const registryCatalogSchema = z.object({
  schemaVersion: z.string(),
  generatedAt: z.string(),
  // Reserved for future manifest signing (ROADMAP: "Signing deferred").
  signature: z.string().nullable().optional(),
  entries: z.array(registryCatalogEntrySchema),
});

export type RegistryCatalogEntry = z.infer<typeof registryCatalogEntrySchema>;
export type RegistryCatalog = z.infer<typeof registryCatalogSchema>;

/** A registry fetch that failed at the HTTP layer (non-2xx or network shape). */
export class RegistryHttpError extends Error {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number) {
    super(`Registry request failed with HTTP ${status}: ${url}`);
    this.name = "RegistryHttpError";
    this.url = url;
    this.status = status;
  }
}

/**
 * The downloaded manifest body did not hash to the catalog's `sha256`.
 * Installation must be aborted — nothing may be written to the DB.
 */
export class ChecksumMismatchError extends Error {
  readonly pluginId: string;
  readonly expected: string;
  readonly actual: string;

  constructor(pluginId: string, expected: string, actual: string) {
    super(
      `Checksum mismatch for extension "${pluginId}": expected sha256 ${expected}, got ${actual}`,
    );
    this.name = "ChecksumMismatchError";
    this.pluginId = pluginId;
    this.expected = expected;
    this.actual = actual;
  }
}
