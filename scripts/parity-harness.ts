// One-off: run the real parser engine over the corpus Cashiro booked and
// classify each message the way processSms would. Run: bun scripts/parity-harness.ts <jsonl>
import fs from "node:fs";
import { parseSmsWithManifests, smsParserManifestSchema } from "@/lib/parser";
import { bundledParserManifests } from "@/lib/parser/manifests";
import type { SmsParserManifest } from "@/lib/parser/types";

const path = process.argv[2] ?? "/tmp/cwin.jsonl";
const manifests: SmsParserManifest[] = bundledParserManifests.map((m) =>
  smsParserManifestSchema.parse(m),
);

const lines = fs.readFileSync(path, "utf8").split("\n").filter(Boolean);
const tally: Record<string, number> = {};
const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
const samples: Record<string, string[]> = {};
const keep = (k: string, s: string) => {
  const bucket = (samples[k] ??= []);
  if (bucket.length < 6) bucket.push(s);
};

let total = 0;
for (const ln of lines) {
  let o: { s: string; b: string };
  try {
    o = JSON.parse(ln);
  } catch {
    continue;
  }
  total++;
  const r = parseSmsWithManifests(manifests, {
    sender: o.s,
    body: o.b,
    receivedAt: new Date(0).toISOString(),
  });
  const short = `${o.s} :: ${(o.b || "").replace(/\n/g, " ").slice(0, 80)}`;
  if (!r.matchedManifest) {
    bump("NO_PARSER");
    keep("NO_PARSER", short);
  } else if (r.confidence === "REJECTED" || !r.fields) {
    bump("FILTER_REJECTED/fieldless");
    keep("FILTER_REJECTED/fieldless", short);
  } else if (r.mandate) {
    bump("MANDATE");
  } else if (!r.fields.amount || !r.fields.transactionType) {
    bump("MISSING_AMOUNT_OR_TYPE");
    keep("MISSING_AMOUNT_OR_TYPE", short);
  } else if (!r.fields.accountLast4) {
    bump("UNKNOWN_ACCOUNT_LAST4");
    keep("UNKNOWN_ACCOUNT_LAST4", short);
  } else if (r.confidence !== "HIGH") {
    bump(`LOW_CONFIDENCE(${r.reasons.join(",")})`);
    keep("LOW_CONFIDENCE", short);
  } else {
    bump("SAVEABLE");
  }
}

const saveable = tally["SAVEABLE"] ?? 0;
console.log(`\nTOTAL (Cashiro-booked corpus): ${total}`);
console.log(`SAVEABLE by our engine: ${saveable} (${((100 * saveable) / total).toFixed(1)}%)\n`);
console.log("Outcome breakdown:");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}
console.log("\nSamples per failure bucket:");
for (const [k, arr] of Object.entries(samples)) {
  if (k === "SAVEABLE") continue;
  console.log(`\n[${k}]`);
  for (const s of arr) console.log("  " + s);
}
