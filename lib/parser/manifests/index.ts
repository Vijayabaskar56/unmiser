import type { ManifestWithFixtures } from "@/lib/parser/types";

import hdfcBankBundle from "@/lib/parser/manifests/hdfc-bank.json";
import iobBankBundle from "@/lib/parser/manifests/iob-bank.json";
import jiopayBundle from "@/lib/parser/manifests/jiopay.json";
import sbiBankBundle from "@/lib/parser/manifests/sbi-bank.json";
import sliceBundle from "@/lib/parser/manifests/slice.json";

// Default bundled parser plugins. The full community store (99+ banks) lives
// in the separate unmiser-extensions repo; each .json here is the same
// authorable bundle shape (see lib/parser/manifest.schema.json). JSON imports
// type fields as plain strings, so bundles are asserted to the
// runtime-validated ManifestWithFixtures shape (the engine zod-parses every
// manifest before use); fixtures are validated by lib/parser/engine.test.ts.
const jsonBundles = [hdfcBankBundle, iobBankBundle, jiopayBundle, sbiBankBundle, sliceBundle];

export const bundledParserBundles = jsonBundles.map(
  ({ manifest, fixtures }) => ({ manifest, fixtures }) as unknown as ManifestWithFixtures,
);
export const bundledParserManifests = bundledParserBundles.map((bundle) => bundle.manifest);
