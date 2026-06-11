import { ChecksumMismatchError } from "@/lib/registry/types";

/** Hex-encoded SHA-256 of a UTF-8 string body. */
export type Sha256Hex = (body: string) => Promise<string>;

/**
 * Default device hasher: expo-crypto (already a dependency). Imported lazily so
 * pure-logic unit tests (Node, no native modules) can inject a Node hasher
 * without ever touching the Expo module graph.
 */
export const expoSha256Hex: Sha256Hex = async (body) => {
  const Crypto = await import("expo-crypto");
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, body);
};

/**
 * Hash `body` and compare against the catalog's expected checksum
 * (case-insensitive hex). Returns the verified hash (normalized to lowercase)
 * for storage in `plugin_assets.checksum`; throws ChecksumMismatchError on any
 * difference.
 */
export async function verifyChecksum(
  pluginId: string,
  body: string,
  expectedSha256: string,
  sha256: Sha256Hex = expoSha256Hex,
): Promise<string> {
  const actual = (await sha256(body)).toLowerCase();
  const expected = expectedSha256.toLowerCase();
  if (actual !== expected) {
    throw new ChecksumMismatchError(pluginId, expected, actual);
  }
  return actual;
}
