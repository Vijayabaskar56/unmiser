import { manifestBundleSchema } from "@/lib/parser/manifest-schema";
import type { ManifestWithFixtures } from "@/lib/parser/types";
import { expoSha256Hex, verifyChecksum, type Sha256Hex } from "@/lib/registry/checksum";
import {
  registryCatalogSchema,
  RegistryHttpError,
  type RegistryCatalog,
  type RegistryCatalogEntry,
} from "@/lib/registry/types";

/**
 * jsDelivr CDN view of the unmiser-extensions repo (NOT GitHub raw: CDN
 * caching, no rate limits, and `@<commit>` pinning if we ever need it).
 */
export const REGISTRY_BASE_URL =
  "https://cdn.jsdelivr.net/gh/Vijayabaskar56/unmiser-extensions@main";

export const REGISTRY_CATALOG_URL = `${REGISTRY_BASE_URL}/index.json`;

export interface RegistryClientOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
  /** Override the CDN root (tests, commit pinning). No trailing slash. */
  baseUrl?: string;
  /** Injectable hasher; defaults to expo-crypto on device. */
  sha256?: Sha256Hex;
}

/** A registry download whose body hashed to the catalog's sha256. */
export interface VerifiedRegistryBundle {
  entry: RegistryCatalogEntry;
  bundle: ManifestWithFixtures;
  /** The verified (lowercase hex) hash — store into plugin_assets.checksum. */
  checksum: string;
}

async function fetchText(url: string, fetchFn: typeof fetch): Promise<string> {
  const response = await fetchFn(url);
  if (!response.ok) throw new RegistryHttpError(url, response.status);
  return response.text();
}

/** Fetch + validate the registry catalog (`index.json`). */
export async function fetchCatalog(options: RegistryClientOptions = {}): Promise<RegistryCatalog> {
  const { fetchFn = fetch, baseUrl = REGISTRY_BASE_URL } = options;
  const body = await fetchText(`${baseUrl}/index.json`, fetchFn);
  return registryCatalogSchema.parse(JSON.parse(body));
}

/**
 * Fetch one manifest bundle by its catalog entry, verify its SHA-256 against
 * the catalog before parsing, and validate the authorable bundle shape
 * (manifest + fixtures). Rejects with ChecksumMismatchError on hash mismatch —
 * callers must not install anything from a rejected download.
 */
export async function fetchManifestBundle(
  entry: RegistryCatalogEntry,
  options: RegistryClientOptions = {},
): Promise<VerifiedRegistryBundle> {
  const { fetchFn = fetch, baseUrl = REGISTRY_BASE_URL, sha256 = expoSha256Hex } = options;
  const body = await fetchText(`${baseUrl}/${entry.file}`, fetchFn);
  const checksum = await verifyChecksum(entry.pluginId, body, entry.sha256, sha256);
  const parsed = manifestBundleSchema.parse(JSON.parse(body));
  return {
    entry,
    bundle: { manifest: parsed.manifest, fixtures: parsed.fixtures },
    checksum,
  };
}
