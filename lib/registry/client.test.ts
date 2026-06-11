import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyChecksum, type Sha256Hex } from "@/lib/registry/checksum";
import { fetchCatalog, fetchManifestBundle, REGISTRY_BASE_URL } from "@/lib/registry/client";
import {
  ChecksumMismatchError,
  RegistryHttpError,
  type RegistryCatalogEntry,
} from "@/lib/registry/types";

const nodeSha256: Sha256Hex = async (body) =>
  createHash("sha256").update(body, "utf8").digest("hex");

const BUNDLE_BODY = JSON.stringify({
  manifest: {
    schemaVersion: "1.0",
    pluginId: "in.test.bank",
    type: "sms-parser",
    name: "Test Bank",
    country: "IN",
    currency: "INR",
    version: "2",
    trust: "owner",
    dispatch: { senders: ["TESTBK"] },
    extract: { amount: [{ re: "Rs\\.(?<value>[0-9.]+)" }] },
  },
  fixtures: [
    {
      name: "spend",
      sender: "JD-TESTBK-S",
      body: "Rs.450.00 spent",
      receivedAt: "2026-06-09T10:00:00.000Z",
      expected: { confidence: "REVIEW" },
    },
  ],
});

async function bundleSha256(): Promise<string> {
  return nodeSha256(BUNDLE_BODY);
}

function makeEntry(overrides: Partial<RegistryCatalogEntry> = {}): RegistryCatalogEntry {
  return {
    pluginId: "in.test.bank",
    name: "Test Bank",
    country: "IN",
    currency: "INR",
    version: "2",
    file: "manifests/test-bank.json",
    sha256: "0".repeat(64),
    bytes: BUNDLE_BODY.length,
    ...overrides,
  };
}

const CATALOG_BODY = JSON.stringify({
  schemaVersion: "1",
  generatedAt: "2026-06-11T00:00:00.000Z",
  signature: null,
  entries: [makeEntry()],
});

/** A fetch stub serving fixed bodies by URL and recording requests. */
function makeFetch(routes: Record<string, string>): {
  fetchFn: typeof fetch;
  requested: string[];
} {
  const requested: string[] = [];
  const fetchFn = (async (url: string) => {
    requested.push(url);
    const body = routes[url];
    if (body === undefined) {
      return { ok: false, status: 404, text: async () => "Not found" };
    }
    return { ok: true, status: 200, text: async () => body };
  }) as unknown as typeof fetch;
  return { fetchFn, requested };
}

describe("fetchCatalog", () => {
  it("fetches and validates index.json from the jsDelivr base URL", async () => {
    const { fetchFn, requested } = makeFetch({
      [`${REGISTRY_BASE_URL}/index.json`]: CATALOG_BODY,
    });

    const catalog = await fetchCatalog({ fetchFn });

    expect(requested).toEqual([`${REGISTRY_BASE_URL}/index.json`]);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0].pluginId).toBe("in.test.bank");
  });

  it("throws a typed RegistryHttpError on non-2xx", async () => {
    const { fetchFn } = makeFetch({});

    await expect(fetchCatalog({ fetchFn })).rejects.toBeInstanceOf(RegistryHttpError);
    await expect(fetchCatalog({ fetchFn })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a catalog that fails schema validation", async () => {
    const { fetchFn } = makeFetch({
      [`${REGISTRY_BASE_URL}/index.json`]: JSON.stringify({ entries: [{ pluginId: "x" }] }),
    });

    await expect(fetchCatalog({ fetchFn })).rejects.toThrow();
  });

  it("honors a baseUrl override (commit pinning)", async () => {
    const pinned = "https://cdn.jsdelivr.net/gh/Vijayabaskar56/unmiser-extensions@abc1234";
    const { fetchFn, requested } = makeFetch({ [`${pinned}/index.json`]: CATALOG_BODY });

    await fetchCatalog({ fetchFn, baseUrl: pinned });
    expect(requested).toEqual([`${pinned}/index.json`]);
  });
});

describe("fetchManifestBundle", () => {
  it("downloads by entry.file, verifies the sha256, and returns the parsed bundle", async () => {
    const entry = makeEntry({ sha256: await bundleSha256() });
    const { fetchFn, requested } = makeFetch({
      [`${REGISTRY_BASE_URL}/${entry.file}`]: BUNDLE_BODY,
    });

    const verified = await fetchManifestBundle(entry, { fetchFn, sha256: nodeSha256 });

    expect(requested).toEqual([`${REGISTRY_BASE_URL}/manifests/test-bank.json`]);
    expect(verified.bundle.manifest.pluginId).toBe("in.test.bank");
    expect(verified.bundle.manifest.version).toBe("2");
    expect(verified.bundle.fixtures).toHaveLength(1);
    expect(verified.checksum).toBe(await bundleSha256());
  });

  it("accepts an uppercase catalog hash (case-insensitive compare)", async () => {
    const entry = makeEntry({ sha256: (await bundleSha256()).toUpperCase() });
    const { fetchFn } = makeFetch({ [`${REGISTRY_BASE_URL}/${entry.file}`]: BUNDLE_BODY });

    const verified = await fetchManifestBundle(entry, { fetchFn, sha256: nodeSha256 });
    expect(verified.checksum).toBe(await bundleSha256());
  });

  it("rejects with ChecksumMismatchError on a tampered body, before parsing", async () => {
    const entry = makeEntry(); // sha256 is all-zeros, never matches
    const { fetchFn } = makeFetch({ [`${REGISTRY_BASE_URL}/${entry.file}`]: BUNDLE_BODY });

    const promise = fetchManifestBundle(entry, { fetchFn, sha256: nodeSha256 });
    await expect(promise).rejects.toBeInstanceOf(ChecksumMismatchError);
    await expect(fetchManifestBundle(entry, { fetchFn, sha256: nodeSha256 })).rejects.toMatchObject(
      {
        pluginId: "in.test.bank",
        expected: "0".repeat(64),
        actual: await bundleSha256(),
      },
    );
  });

  it("rejects a checksum-valid body that is not a valid manifest bundle", async () => {
    const body = JSON.stringify({ manifest: { pluginId: "broken" }, fixtures: [] });
    const entry = makeEntry({ sha256: await nodeSha256(body) });
    const { fetchFn } = makeFetch({ [`${REGISTRY_BASE_URL}/${entry.file}`]: body });

    await expect(fetchManifestBundle(entry, { fetchFn, sha256: nodeSha256 })).rejects.toThrow();
  });

  it("throws RegistryHttpError when the manifest file is missing", async () => {
    const { fetchFn } = makeFetch({});

    await expect(
      fetchManifestBundle(makeEntry(), { fetchFn, sha256: nodeSha256 }),
    ).rejects.toBeInstanceOf(RegistryHttpError);
  });
});

describe("verifyChecksum", () => {
  it("returns the normalized lowercase hash on success", async () => {
    const hash = await nodeSha256("hello");
    await expect(verifyChecksum("p", "hello", hash.toUpperCase(), nodeSha256)).resolves.toBe(hash);
  });

  it("throws on mismatch", async () => {
    await expect(verifyChecksum("p", "hello", "0".repeat(64), nodeSha256)).rejects.toBeInstanceOf(
      ChecksumMismatchError,
    );
  });
});
