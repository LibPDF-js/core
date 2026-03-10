/**
 * Progress tracking system with 500ms throttling for parsing operations.
 *
 * Reports progress updates at configurable intervals to avoid overwhelming
 * the main thread with messages while still providing responsive feedback.
 */

import type { TaskId } from "./messages";
import {
  type ParsingPhase,
  type ParsingProgress,
  type ParsingProgressMessage,
  createParsingProgress,
} from "./parsing-types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default progress reporting interval in milliseconds */
export const DEFAULT_PROGRESS_INTERVAL = 500;

/** Minimum progress change (%) to trigger an immediate update */
const MIN_PROGRESS_CHANGE = 10;

/** Phases and their contribution to overall progress */
const PHASE_WEIGHTS: Record<ParsingPhase, { start: number; end: number }> = {
  initializing: { start: 0, end: 2 },
  header: { start: 2, end: 5 },
  xref: { start: 5, end: 15 },
  trailer: { start: 15, end: 20 },
  objects: { start: 20, end: 60 },
  encryption: { start: 60, end: 65 },
  catalog: { start: 65, end: 70 },
  pages: { start: 70, end: 90 },
  text: { start: 90, end: 98 },
  complete: { start: 98, end: 100 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Progress Tracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a progress tracker.
 */
export interface ProgressTrackerOptions {
  /** Task ID for this tracking session */
  taskId: TaskId;

  /** Progress reporting interval in milliseconds (default: 500) */
  interval?: number;

  /** Callback to send progress messages */
  onProgress: (message: ParsingProgressMessage) => void;

  /** Total bytes being processed (for byte-based progress) */
  totalBytes?: number;
}

/**
 * Tracks and throttles progress updates for parsing operations.
 *
 * Ensures progress updates are sent at most every 500ms (configurable),
 * while still allowing immediate updates for significant progress changes
 * or phase transitions.
 *
 * @example
 * ```typescript
 * const tracker = new ProgressTracker({
 *   taskId: 'task-123',
 *   onProgress: (msg) => self.postMessage(msg),
 *   totalBytes: pdfBytes.length,
 * });
 *
 * tracker.startPhase('header');
 * // ... do work ...
 * tracker.update(50, 'Parsing PDF header');
 * // ... do work ...
 * tracker.startPhase('xref');
 * tracker.updateItems(100, 500, 'Parsing cross-reference');
 * // ... do work ...
 * tracker.complete();
 * ```
 */
export class ProgressTracker {
  private readonly taskId: TaskId;
  private readonly interval: number;
  private readonly onProgress: (message: ParsingProgressMessage) => void;
  private readonly totalBytes: number | undefined;
  private readonly startTime: number;

  private currentPhase: ParsingPhase = "initializing";
  private lastReportTime = 0;
  private lastReportedPercent = 0;
  private pendingUpdate: ParsingProgress | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private bytesProcessed = 0;
  private isCancelled = false;

  constructor(options: ProgressTrackerOptions) {
    this.taskId = options.taskId;
    this.interval = options.interval ?? DEFAULT_PROGRESS_INTERVAL;
    this.onProgress = options.onProgress;
    this.totalBytes = options.totalBytes;
    this.startTime = Date.now();

    // Send initial progress
    this.reportImmediate({
      phase: "initializing",
      percent: 0,
      operation: "Starting parsing",
      totalBytes: this.totalBytes,
    });
  }

  /**
   * Start a new parsing phase.
   * Always sends an immediate progress update.
   */
  startPhase(phase: ParsingPhase, operation?: string): void {
    if (this.isCancelled) {
      return;
    }

    this.currentPhase = phase;
    const weights = PHASE_WEIGHTS[phase];

    this.reportImmediate({
      phase,
      percent: weights.start,
      operation: operation ?? this.getDefaultPhaseOperation(phase),
      bytesProcessed: this.bytesProcessed,
      totalBytes: this.totalBytes,
    });
  }

  /**
   * Update progress within the current phase.
   *
   * @param phasePercent - Progress within the current phase (0-100)
   * @param operation - Human-readable description
   */
  update(phasePercent: number, operation?: string): void {
    if (this.isCancelled) {
      return;
    }

    const overallPercent = this.calculateOverallPercent(phasePercent);

    this.throttledReport({
      phase: this.currentPhase,
      percent: overallPercent,
      operation: operation ?? this.getDefaultPhaseOperation(this.currentPhase),
      bytesProcessed: this.bytesProcessed,
      totalBytes: this.totalBytes,
      estimatedRemaining: this.estimateRemaining(overallPercent),
    });
  }

  /**
   * Update progress based on items processed.
   *
   * @param processed - Number of items processed
   * @param total - Total number of items
   * @param operation - Human-readable description
   */
  updateItems(processed: number, total: number, operation?: string): void {
    if (this.isCancelled) {
      return;
    }

    const phasePercent = total > 0 ? (processed / total) * 100 : 0;
    const overallPercent = this.calculateOverallPercent(phasePercent);

    this.throttledReport({
      phase: this.currentPhase,
      percent: overallPercent,
      operation: operation ?? this.getDefaultPhaseOperation(this.currentPhase),
      processed,
      total,
      bytesProcessed: this.bytesProcessed,
      totalBytes: this.totalBytes,
      estimatedRemaining: this.estimateRemaining(overallPercent),
    });
  }

  /**
   * Update bytes processed for byte-based progress.
   */
  updateBytes(bytesProcessed: number, operation?: string): void {
    if (this.isCancelled) {
      return;
    }

    this.bytesProcessed = bytesProcessed;

    if (this.totalBytes && this.totalBytes > 0) {
      const phasePercent = (bytesProcessed / this.totalBytes) * 100;
      this.update(phasePercent, operation);
    }
  }

  /**
   * Mark parsing as complete.
   * Always sends an immediate progress update.
   */
  complete(): void {
    if (this.isCancelled) {
      return;
    }

    this.clearFlushTimer();
    this.currentPhase = "complete";

    this.reportImmediate({
      phase: "complete",
      percent: 100,
      operation: "Parsing complete",
      bytesProcessed: this.totalBytes,
      totalBytes: this.totalBytes,
    });
  }

  /**
   * Cancel progress tracking.
   * Clears any pending updates.
   */
  cancel(): void {
    this.isCancelled = true;
    this.clearFlushTimer();
    this.pendingUpdate = null;
  }

  /**
   * Flush any pending progress update immediately.
   */
  flush(): void {
    if (this.pendingUpdate && !this.isCancelled) {
      this.reportImmediate(this.pendingUpdate);
      this.pendingUpdate = null;
    }
    this.clearFlushTimer();
  }

  /**
   * Check if tracking has been cancelled.
   */
  get cancelled(): boolean {
    return this.isCancelled;
  }

  /**
   * Get the current phase.
   */
  get phase(): ParsingPhase {
    return this.currentPhase;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculate overall progress from phase progress.
   */
  private calculateOverallPercent(phasePercent: number): number {
    const weights = PHASE_WEIGHTS[this.currentPhase];
    const range = weights.end - weights.start;
    return Math.round(weights.start + (range * Math.min(100, Math.max(0, phasePercent))) / 100);
  }

  /**
   * Report progress with throttling.
   */
  private throttledReport(progress: ParsingProgress): void {
    const now = Date.now();
    const timeSinceLastReport = now - this.lastReportTime;
    const percentChange = Math.abs(progress.percent - this.lastReportedPercent);

    // Report immediately if:
    // 1. Enough time has passed
    // 2. Progress changed significantly
    if (timeSinceLastReport >= this.interval || percentChange >= MIN_PROGRESS_CHANGE) {
      this.reportImmediate(progress);
      return;
    }

    // Otherwise, schedule a delayed report
    this.pendingUpdate = progress;

    if (!this.flushTimer) {
      const delay = this.interval - timeSinceLastReport;
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, delay);
    }
  }

  /**
   * Send a progress update immediately.
   */
  private reportImmediate(progress: ParsingProgress): void {
    this.lastReportTime = Date.now();
    this.lastReportedPercent = progress.percent;
    this.pendingUpdate = null;

    const message = createParsingProgress(this.taskId, progress);
    this.onProgress(message);
  }

  /**
   * Estimate remaining time based on current progress.
   */
  private estimateRemaining(percent: number): number | undefined {
    if (percent <= 0) {
      return undefined;
    }

    const elapsed = Date.now() - this.startTime;
    const estimated = (elapsed / percent) * (100 - percent);

    // Only return estimate if it seems reasonable
    if (estimated > 0 && estimated < 3600000) {
      // Max 1 hour
      return Math.round(estimated);
    }

    return undefined;
  }

  /**
   * Get default operation description for a phase.
   */
  private getDefaultPhaseOperation(phase: ParsingPhase): string {
    switch (phase) {
      case "initializing":
        return "Initializing parser";
      case "header":
        return "Reading PDF header";
      case "xref":
        return "Parsing cross-reference table";
      case "trailer":
        return "Reading trailer dictionary";
      case "objects":
        return "Loading PDF objects";
      case "encryption":
        return "Processing encryption";
      case "catalog":
        return "Reading document catalog";
      case "pages":
        return "Building page tree";
      case "text":
        return "Extracting text";
      case "complete":
        return "Complete";
    }
  }

  /**
   * Clear the flush timer if active.
   */
  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new progress tracker.
 */
export function createProgressTracker(options: ProgressTrackerOptions): ProgressTracker {
  return new ProgressTracker(options);
}
