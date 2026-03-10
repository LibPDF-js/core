/**
 * Utility functions for parsing worker initialization and environment detection.
 *
 * Provides cross-platform support for Node.js, Bun, and browsers.
 */

// Declare browser globals for type checking
declare const window: typeof globalThis | undefined;
declare const document: unknown | undefined;
declare const self: (typeof globalThis & { importScripts?: unknown }) | undefined;
declare const Worker: new (url: string | URL, options?: WorkerOptions) => Worker;
declare const MessagePort: new () => MessagePort;

// ─────────────────────────────────────────────────────────────────────────────
// Environment Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runtime environment types.
 */
export type RuntimeEnvironment = "browser" | "node" | "bun" | "deno" | "unknown";

/**
 * Detect the current runtime environment.
 */
export function detectEnvironment(): RuntimeEnvironment {
  // Check for Bun first (it also has process.versions.node)
  if (typeof globalThis !== "undefined" && "Bun" in globalThis) {
    return "bun";
  }

  // Check for Deno
  if (typeof globalThis !== "undefined" && "Deno" in globalThis) {
    return "deno";
  }

  // Check for Node.js
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
      ?.node === "string"
  ) {
    return "node";
  }

  // Check for browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }

  // Web Worker context (no document but has self)
  if (typeof self !== "undefined" && typeof self.importScripts === "function") {
    return "browser";
  }

  return "unknown";
}

/**
 * Check if Web Workers are supported in the current environment.
 */
export function isWorkerSupported(): boolean {
  const env = detectEnvironment();

  switch (env) {
    case "browser":
      return typeof Worker !== "undefined";

    case "node":
      // Node.js has worker_threads, but Web Worker API needs polyfill
      return false;

    case "bun":
      // Bun supports Web Workers natively
      return typeof Worker !== "undefined";

    case "deno":
      // Deno supports Web Workers
      return typeof Worker !== "undefined";

    default:
      return false;
  }
}

/**
 * Check if we're currently running inside a Web Worker.
 */
export function isWorkerContext(): boolean {
  // In a worker, 'self' exists but 'window' doesn't
  return (
    typeof self !== "undefined" &&
    typeof self.importScripts === "function" &&
    typeof window === "undefined"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Creation Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a parsing worker.
 */
export interface ParsingWorkerCreationOptions {
  /** URL or path to the worker script */
  workerUrl?: string | URL;

  /** Worker name for debugging */
  name?: string;

  /** Whether to use module workers (ES modules) */
  module?: boolean;
}

/**
 * Create a Worker instance with proper error handling.
 *
 * @throws Error if workers are not supported or creation fails
 */
export function createWorkerInstance(options: ParsingWorkerCreationOptions): Worker {
  if (!isWorkerSupported()) {
    throw new Error(
      `Web Workers are not supported in ${detectEnvironment()} environment. ` +
        "Use the synchronous parsing API instead.",
    );
  }

  const { workerUrl, name, module = true } = options;

  if (!workerUrl) {
    throw new Error(
      "Worker URL is required. Provide workerUrl pointing to the bundled parsing worker script.",
    );
  }

  try {
    return new Worker(workerUrl, {
      type: module ? "module" : "classic",
      name: name ?? `parsing-worker-${Date.now()}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create parsing worker: ${message}`, { cause: error });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transferable Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract transferable objects from data for efficient worker communication.
 *
 * Identifies ArrayBuffer instances that can be transferred (zero-copy)
 * instead of copied between threads.
 */
export function extractTransferables(data: unknown): ArrayBuffer[] {
  const transferables: ArrayBuffer[] = [];
  const seen = new WeakSet<object>();

  function collect(value: unknown): void {
    if (value === null || typeof value !== "object") {
      return;
    }

    // Prevent cycles
    if (seen.has(value)) {
      return;
    }
    seen.add(value);

    // Direct ArrayBuffer
    if (value instanceof ArrayBuffer) {
      transferables.push(value);
      return;
    }

    // TypedArray (Uint8Array, etc.)
    if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
      // Only transfer if the view covers the whole buffer
      if (value.byteOffset === 0 && value.byteLength === value.buffer.byteLength) {
        transferables.push(value.buffer);
      }
      return;
    }

    // MessagePort - skip for now as it requires DOM types
    // Users can pass these explicitly in transfer arrays

    // Recurse into arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        collect(item);
      }
      return;
    }

    // Recurse into plain objects
    for (const key of Object.keys(value)) {
      collect((value as Record<string, unknown>)[key]);
    }
  }

  collect(data);
  return transferables;
}

/**
 * Clone data for cases where we can't or shouldn't transfer.
 *
 * Creates a structured clone of the data, which works across worker boundaries.
 */
export function cloneForTransfer<T>(data: T): T {
  // Use structuredClone if available (modern browsers/Node 17+)
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  // Fallback: JSON round-trip (loses some types like Uint8Array)
  // This should rarely be hit in practice
  return JSON.parse(JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a unique ID for messages.
 */
export function generateParsingMessageId(): string {
  return `parse-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique task ID for parsing operations.
 */
export function generateParsingTaskId(): string {
  return `parsing-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default timeouts for parsing operations (in milliseconds).
 */
export const DEFAULT_PARSING_TIMEOUTS = {
  /** Initialization timeout */
  init: 10_000,

  /** Small document parsing (<1MB) */
  small: 30_000,

  /** Medium document parsing (1-10MB) */
  medium: 60_000,

  /** Large document parsing (>10MB) */
  large: 300_000,

  /** Text extraction per page */
  textPerPage: 5_000,
} as const;

/**
 * Calculate appropriate timeout based on document size.
 */
export function calculateParsingTimeout(sizeBytes: number): number {
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB < 1) {
    return DEFAULT_PARSING_TIMEOUTS.small;
  }

  if (sizeMB < 10) {
    return DEFAULT_PARSING_TIMEOUTS.medium;
  }

  return DEFAULT_PARSING_TIMEOUTS.large;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deferred Promise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A promise that can be resolved or rejected externally.
 */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
  readonly isPending: boolean;
}

/**
 * Create a deferred promise for async coordination.
 */
export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  let isPending = true;

  const promise = new Promise<T>((res, rej) => {
    resolve = (value: T) => {
      isPending = false;
      res(value);
    };
    reject = (reason: unknown) => {
      isPending = false;
      rej(reason);
    };
  });

  return {
    promise,
    resolve,
    reject,
    get isPending() {
      return isPending;
    },
  };
}
