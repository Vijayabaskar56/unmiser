// Chunked RN-runtime executor: the sanctioned fallback when the dedicated
// worklet runtime is unavailable (ROADMAP Phase 2 workstream D spike risk).
// Parses on the RN JS thread in small chunks, yielding to the event loop
// between chunks so navigation/touch handling stays responsive. Same
// signature as the worklet executor so the scan task cannot tell them apart.

import { parsePreparedSmsWithManifests } from "@/lib/parser/engine";
import type { ParserResult, SmsInput, SmsParserManifest } from "@/lib/parser/types";

const CHUNK_SIZE = 25;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function parseBatchChunked(
  manifests: SmsParserManifest[],
  records: SmsInput[],
  signal?: AbortSignal,
  chunkSize: number = CHUNK_SIZE,
): Promise<ParserResult[]> {
  const results: ParserResult[] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    if (signal?.aborted) break;
    for (const record of records.slice(i, i + chunkSize)) {
      results.push(parsePreparedSmsWithManifests(manifests, record));
    }
    if (i + chunkSize < records.length) await yieldToEventLoop();
  }
  return results;
}
