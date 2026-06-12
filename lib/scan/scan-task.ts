// Singleton observable scan-task store (ROADMAP Phase 2 workstream D).
// Plain TS, no React: the Extensions tab (and later the onboarding wizard's
// final step) subscribes via `subscribe`/`getState` (useSyncExternalStore
// compatible). All pipeline effects are injected so the loop is unit-testable
// without native modules or a DB.

import type { ScanCheckpoint, ScanCheckpointStore } from "@/lib/scan/checkpoint";
import type { ParserResult, SmsInput, SmsParserManifest } from "@/lib/parser/types";

export type ScanPhase = "idle" | "scanning" | "completed" | "cancelled" | "error";

export interface ScanTaskState {
  phase: ScanPhase;
  /** Raw inbox rows consumed (includes records dropped by the native pre-screen). */
  processed: number;
  /** Raw inbox total (0 until counted). */
  total: number;
  saved: number;
  mandates: number;
  review: number;
  /** Dropped/duplicate/noise records (native pre-screen drops count here). */
  rejected: number;
  running: boolean;
  error: string | null;
  /** An interrupted checkpoint exists; `start({ resume: true })` continues it. */
  resumeAvailable: boolean;
}

export type ScanPersistOutcome = "saved" | "mandate" | "review" | "rejected";

export interface ScanPage {
  records: SmsInput[];
  /** Raw rows the native side consumed for this page (>= records.length with pre-screen). */
  scanned: number;
}

export interface ScanTaskDeps {
  /** Total raw inbox rows (progress denominator). */
  getTotalCount(): Promise<number>;
  /** One native page, oldest-to-newest, optionally pre-screened natively. */
  fetchPage(offset: number, limit: number): Promise<ScanPage>;
  /** Enabled, already-validated manifests (loaded once per run). */
  loadManifests(): Promise<SmsParserManifest[]>;
  /** Parse a page batch off the RN runtime (worklet) or chunked fallback. */
  parseBatch(
    manifests: SmsParserManifest[],
    records: SmsInput[],
    signal: AbortSignal,
  ): Promise<ParserResult[]>;
  /** Triage + persist one record on the RN runtime (DB writes stay RN-side). */
  persist(record: SmsInput, result: ParserResult): Promise<ScanPersistOutcome>;
  checkpoint: ScanCheckpointStore;
  pageSize?: number;
  /** Called once when a run leaves the scanning phase (refresh collections). */
  onSettled?(state: ScanTaskState): void | Promise<void>;
}

const DEFAULT_PAGE_SIZE = 250;

const IDLE_STATE: ScanTaskState = {
  phase: "idle",
  processed: 0,
  total: 0,
  saved: 0,
  mandates: 0,
  review: 0,
  rejected: 0,
  running: false,
  error: null,
  resumeAvailable: false,
};

export class ScanTask {
  private state: ScanTaskState = IDLE_STATE;
  private listeners = new Set<() => void>();
  private abortController: AbortController | null = null;

  constructor(private readonly deps: ScanTaskDeps) {}

  getState = (): ScanTaskState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Re-read the persisted checkpoint to surface the resume prompt. */
  refreshResumeAvailable = async (): Promise<boolean> => {
    const checkpoint = await this.deps.checkpoint.load();
    const resumeAvailable = checkpoint !== null && !this.state.running;
    if (resumeAvailable && this.state.phase === "idle") {
      // Surface the interrupted run's totals so the prompt can say
      // "Resume scan 4,000/5,300".
      this.setState({
        resumeAvailable,
        processed: checkpoint.processed,
        total: checkpoint.total,
        saved: checkpoint.saved,
        mandates: checkpoint.mandates ?? 0,
        review: checkpoint.review,
        rejected: checkpoint.rejected,
      });
    } else {
      this.setState({ resumeAvailable });
    }
    return resumeAvailable;
  };

  cancel = (): void => {
    this.abortController?.abort();
  };

  start = async (options: { resume?: boolean } = {}): Promise<ScanTaskState> => {
    if (this.state.running) return this.state;
    const abortController = new AbortController();
    this.abortController = abortController;
    const { signal } = abortController;
    const pageSize = this.deps.pageSize ?? DEFAULT_PAGE_SIZE;

    let checkpoint: ScanCheckpoint | null = null;
    if (options.resume) checkpoint = await this.deps.checkpoint.load();
    if (!options.resume) await this.deps.checkpoint.clear();

    let offset = checkpoint?.offset ?? 0;
    let processed = checkpoint?.processed ?? 0;
    let saved = checkpoint?.saved ?? 0;
    let mandates = checkpoint?.mandates ?? 0;
    let review = checkpoint?.review ?? 0;
    let rejected = checkpoint?.rejected ?? 0;

    this.setState({
      phase: "scanning",
      running: true,
      error: null,
      resumeAvailable: false,
      processed,
      saved,
      mandates,
      review,
      rejected,
      total: checkpoint?.total ?? 0,
    });

    try {
      const [total, manifests] = await Promise.all([
        this.deps.getTotalCount(),
        this.deps.loadManifests(),
      ]);
      this.setState({ total });

      while (!signal.aborted) {
        const page = await this.deps.fetchPage(offset, pageSize);
        if (page.scanned === 0) break;

        const results = await this.deps.parseBatch(manifests, page.records, signal);
        // Records the native pre-screen dropped never crossed the bridge;
        // they are processed-and-rejected as far as the totals go.
        rejected += page.scanned - page.records.length;

        for (let i = 0; i < page.records.length; i += 1) {
          if (signal.aborted) break;
          const outcome = await this.deps.persist(page.records[i], results[i]);
          if (outcome === "saved") saved += 1;
          else if (outcome === "mandate") mandates += 1;
          else if (outcome === "review") review += 1;
          else rejected += 1;
        }

        if (signal.aborted) break;
        offset += page.scanned;
        processed += page.scanned;
        await this.deps.checkpoint.save({
          offset,
          processed,
          saved,
          mandates,
          review,
          rejected,
          total,
          updatedAt: new Date().toISOString(),
        });
        this.setState({ processed, saved, mandates, review, rejected });

        if (page.scanned < pageSize) break;
      }

      if (signal.aborted) {
        // Keep the checkpoint: cancellation is what resume exists for.
        this.setState({
          phase: "cancelled",
          running: false,
          processed,
          saved,
          mandates,
          review,
          rejected,
          resumeAvailable: processed > 0,
        });
      } else {
        await this.deps.checkpoint.clear();
        this.setState({
          phase: "completed",
          running: false,
          processed,
          saved,
          mandates,
          review,
          rejected,
          resumeAvailable: false,
        });
      }
    } catch (error) {
      // Surface the full failure in dev logs — the store only keeps the
      // message, which hides the stack ("undefined is not a function" alone
      // is undiagnosable on Hermes).
      console.error("[scan] historical scan failed", error);
      // Keep the checkpoint (last fully-persisted page) so an errored scan
      // also resumes instead of restarting.
      this.setState({
        phase: "error",
        running: false,
        error: error instanceof Error ? error.message : "Historical scan failed",
        resumeAvailable: processed > 0,
      });
    } finally {
      this.abortController = null;
      try {
        await this.deps.onSettled?.(this.state);
      } catch {
        // Collection refreshes must never mask the scan outcome.
      }
    }
    return this.state;
  };

  private setState(partial: Partial<ScanTaskState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
  }
}

export function createScanTask(deps: ScanTaskDeps): ScanTask {
  return new ScanTask(deps);
}
