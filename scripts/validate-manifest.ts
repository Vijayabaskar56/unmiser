// Standalone validator for a single parser-plugin bundle (.json), so a plugin
// can be verified before it is registered in lib/parser/manifests/index.ts —
// and so community authors can check their manifest locally:
//
//   bun scripts/validate-manifest.ts lib/parser/manifests/<name>.json
//
// Validates the file against the bundle schema (lib/parser/manifest-schema.ts,
// the source of lib/parser/manifest.schema.json), then runs every fixture
// through the real parser engine. Exits non-zero and prints each failure.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateManifestFixtures } from "../lib/parser/fixtures";
import { manifestBundleSchema } from "../lib/parser/manifest-schema";
import type { ManifestWithFixtures } from "../lib/parser/types";

const target = process.argv[2];
if (!target) {
  console.error("usage: bun scripts/validate-manifest.ts <path-to-manifest.json>");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(resolve(target), "utf8"));
const parsed = manifestBundleSchema.safeParse(raw);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`SCHEMA ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

const bundle = parsed.data as unknown as ManifestWithFixtures;
const failures = validateManifestFixtures(bundle);
if (failures.length === 0) {
  console.log(`OK ${bundle.manifest.pluginId}: ${bundle.fixtures.length} fixtures pass`);
  process.exit(0);
}
for (const failure of failures) {
  console.error(`FAIL ${bundle.manifest.pluginId} [${failure.fixture}]: ${failure.message}`);
}
process.exit(1);
