// Regenerates lib/parser/manifest.schema.json from the zod manifestBundleSchema
// (the single source of truth). Run after changing lib/parser/manifest-schema.ts:
//
//   bun scripts/generate-manifest-schema.ts
//
// Plugin authors reference the generated file from their manifest JSON via
// "$schema" to get editor autocomplete and validation.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { manifestBundleSchema } from "../lib/parser/manifest-schema";

const jsonSchema = z.toJSONSchema(manifestBundleSchema, { io: "input" });
const out = {
  ...jsonSchema,
  title: "Unmiser SMS parser plugin bundle",
  description:
    "A bank SMS parser plugin: the declarative manifest plus fixtures proving it. Validate with `bun scripts/validate-manifest.ts <file>`.",
};

const target = fileURLToPath(new URL("../lib/parser/manifest.schema.json", import.meta.url));
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${target}`);
