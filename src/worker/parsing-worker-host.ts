/**
 * Main thread interface for parsing worker communication.
 *
 * ParsingWorkerHost manages the lifecycle of a parsing worker and provides
 * a Promise-based API for document parsing operations. It handles:
 * - Worker creation and initialization
 * - Message passing with request/response correlation
 * - Progress event handling with 500ms throttling
 * - Cancellation support
 * - Graceful shutdown and cleanup
 */

import { type MessageId, type TaskId, generateMessageId, generateTaskId } from "./messages";
import {
  type CancelParsingResponse,
  type ExtractTextResponse,
  type ExtractTextResponseData,
  type ParseDocumentResponse,
  type ParseDocumentResponseData,
  type ParsedDocumentInfo,
  type ParsingProgress,
  type ParsingProgressCallback,
  type ParsingProgressMessage,
  type ParsingWorkerError,
  type ParsingWorkerResponse,
  type WorkerParseOptions,
  isParsingProgress,
  isParsingResponse,
} from "./parsing-types";
import {
  calculateParsingTimeout,
  createDeferred,
  createWorkerInstance,
  type Deferred,
  extractTransferables,
  generateParsingTaskId,
  isWorkerSupported,
} from "./parsing-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State of the parsing worker host.
 */
export type ParsingWorkerState =
  | "idle"
  | "initializing"
  | "ready"
  | "busy"
  | "terminated"
  | "error";

/**
 * Options for creating a ParsingWorkerHost.
 */
export interface ParsingWorkerHostOptions {
  /**
   * URL or path to the parsing worker script.
   */
  workerUrl: string | URL;

  /**
   * Worker name for debugging purposes.
   */
  name?: string;

  /**
   * Enable verbose logging in the worker.
   * @default false
   */
  verbose?: boolean;

  /**
   * Timeout for worker initialization in milliseconds.
   * @default 10000
   */
  initTimeout?: number;

  /**
   * Default timeout for parsing operations in milliseconds.
   * @default 60000
   */
  defaultTimeout?: number;

  /**
   * Called when the worker reports parsing progress.
   */
  onProgress?: ParsingProgressCallback;

  /**
   * Called when the worker encounters an error.
   */
  onError?: (error: ParsingWorkerError) => void;

  /**
   * Called when the worker state changes.
   */
  onStateChange?: (state: ParsingWorkerState, previousState: ParsingWorkerState) => void;
}

/**
 * Pending request waiting for response.
 */
interface PendingRequest<T> {
  readonly messageId: MessageId;
  readonly taskId: TaskId;
  readonly deferred: Deferred<T>;
  readonly timeoutId?: ReturnType<typeof setTimeout>;
  readonly onProgress?: ParsingProgressCallback;
}

/**
 * Result of a parse operation.
 */
export interface ParseResult {
  /** Unique document identifier for subsequent operations */
  readonly documentId: string;

  /** Parsed document information */
  readonly info: ParsedDocumentInfo;

  /** Total parsing time in milliseconds */
  readonly parsingTime: number;
}

/**
 * Result of text extraction.
 */
export interface ExtractTextResult {
  /** Extracted text per page */
  readonly pages: readonly { pageIndex: number; text: string }[];

  /** Total extraction time in milliseconds */
  readonly extractionTime: number;
}

/**
 * Options for parsing a document.
 */
export interface ParseOptions extends WorkerParseOptions {
  /** Timeout in milliseconds (auto-calculated from file size if not provided) */
  timeout?: number;

  /** Progress callback for this operation */
  onProgress?: ParsingProgressCallback;
}

/**
 * Options for extracting text.
 */
export interface ExtractOptions {
  /** Page indices to extract (0-based), undefined means all pages */
  pages?: number[];

  /** Include position information for each text item */
  includePositions?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Progress callback for this operation */
  onProgress?: ParsingProgressCallback;
}

/**
 * Active operation that can be cancelled.
 */
export interface CancellableParseOperation<T> {
  /** Promise that resolves when the operation completes */
  readonly promise: Promise<T>;

  /** Cancel the operation */
  cancel(): Promise<boolean>;

  /** Task ID for the operation */
  readonly taskId: TaskId;
}

// ─────────────────────────────────────────────────────────────────────────────
// ParsingWorkerHost Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ParsingWorkerHost manages a Web Worker for PDF parsing operations.
 *
 * @example
 * ```typescript
 * const host = new ParsingWorkerHost({
 *   workerUrl: '/parsing-worker.js',
 *   onProgress: (progress) => console.log(`${progress.percent}%`),
 * });
 *
 * await host.initialize();
 *
 * const result = await host.parse(pdfBytes);
 * console.log(`Parsed ${result.info.pageCount} pages`);
 *
 * const text = await host.extractText(result.documentId);
 * console.log(text.pages[0].text);
 *
 * await host.terminate();
 * ```
 */
export class ParsingWorkerHost {
  private _worker: Worker | null = null;
  private _state: ParsingWorkerState = "idle";
  private _options: Required<
    Omit<ParsingWorkerHostOptions, "onProgress" | "onError" | "onStateChange">
  > & {
    onProgress?: ParsingProgressCallback;
    onError?: (error: ParsingWorkerError) => void;
    onStateChange?: (state: ParsingWorkerState, previousState: ParsingWorkerState) => void;
  };
  private _pendingRequests: Map<MessageId, PendingRequest<unknown>> = new Map();
  private _taskProgressHandlers: Map<TaskId, ParsingProgressCallback> = new Map();
  private _initPromise: Promise<void> | null = null;

  constructor(options: ParsingWorkerHostOptions) {
    this._options = {
      workerUrl: options.workerUrl,
      name: options.name ?? `parsing-worker-host-${Date.now()}`,
      verbose: options.verbose ?? false,
      initTimeout: options.initTimeout ?? 10_000,
      defaultTimeout: options.defaultTimeout ?? 60_000,
      onProgress: options.onProgress,
      onError: options.onError,
      onStateChange: options.onStateChange,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public Properties
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Current worker state.
   */
  get state(): ParsingWorkerState {
    return this._state;
  }

  /**
   * Whether the worker is ready to accept requests.
   */
  get isReady(): boolean {
    return this._state === "ready" || this._state === "busy";
  }

  /**
   * Whether the worker has been terminated.
   */
  get isTerminated(): boolean {
    return this._state === "terminated";
  }

  /**
   * Number of pending requests.
   */
  get pendingCount(): number {
    return this._pendingRequests.size;
  }

  /**
   * Worker name.
   */
  get name(): string {
    return this._options.name;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the worker.
   *
   * Creates the Web Worker instance and waits for it to be ready.
   * This method is idempotent — calling it multiple times returns the same promise.
   *
   * @throws Error if workers are not supported, creation fails, or initialization times out
   */
  async initialize(): Promise<void> {
    if (this._initPromise) {
      return this._initPromise;
    }

    if (this._state === "terminated") {
      throw new Error("Cannot initialize a terminated worker");
    }

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    this._setState("initializing");

    try {
      // Create the worker
      this._worker = createWorkerInstance({
        workerUrl: this._options.workerUrl,
        name: this._options.name,
        module: true,
      });

      // Set up message handling
      this._worker.onmessage = this._handleMessage.bind(this);
      this._worker.onerror = this._handleError.bind(this);

      // Send init request
      const initPromise = this._sendRequest<void>(
        "init",
        {
          verbose: this._options.verbose,
          name: this._options.name,
        },
        this._options.initTimeout,
      );

      await initPromise;
      this._setState("ready");
    } catch (error) {
      this._setState("error");
      this._cleanup();
      throw error;
    }
  }

  /**
   * Terminate the worker.
   *
   * @param graceful - If true, wait for pending operations to complete
   * @param timeout - Timeout for graceful shutdown in milliseconds
   */
  async terminate(graceful = true, timeout = 5000): Promise<void> {
    if (this._state === "terminated") {
      return;
    }

    if (graceful && this._worker && this.isReady) {
      try {
        await Promise.race([
          this._sendRequest("terminate", undefined, timeout),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Terminate timeout")), timeout),
          ),
        ]);
      } catch {
        // Ignore errors during graceful shutdown
      }
    }

    this._forceTerminate();
  }

  private _forceTerminate(): void {
    // Reject all pending requests
    for (const pending of this._pendingRequests.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.deferred.reject(new Error("Worker terminated"));
    }
    this._pendingRequests.clear();
    this._taskProgressHandlers.clear();

    // Terminate the worker
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }

    this._setState("terminated");
    this._initPromise = null;
  }

  private _cleanup(): void {
    for (const pending of this._pendingRequests.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this._pendingRequests.clear();
    this._taskProgressHandlers.clear();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Parsing Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Parse a PDF document.
   *
   * @param bytes - PDF file bytes
   * @param options - Parse options
   * @returns Parsed document information
   */
  async parse(bytes: Uint8Array, options?: ParseOptions): Promise<ParseResult> {
    await this._ensureInitialized();

    const taskId = generateParsingTaskId();
    const timeout = options?.timeout ?? calculateParsingTimeout(bytes.length);

    // Register progress handler for this task
    if (options?.onProgress) {
      this._taskProgressHandlers.set(taskId, options.onProgress);
    }

    try {
      const response = await this._sendRequest<ParseDocumentResponse>(
        "parseDocument",
        {
          bytes,
          taskId,
          options: {
            lenient: options?.lenient,
            password: options?.password,
            bruteForceRecovery: options?.bruteForceRecovery,
            progressInterval: options?.progressInterval,
          },
        },
        timeout,
        taskId,
        [bytes.buffer as ArrayBuffer],
      );

      if (response.status === "cancelled") {
        throw new Error("Operation cancelled");
      }

      if (response.status === "error" || !response.data) {
        throw new Error(response.error?.message ?? "Failed to parse document");
      }

      return response.data;
    } finally {
      this._taskProgressHandlers.delete(taskId);
    }
  }

  /**
   * Parse a PDF document with cancellation support.
   */
  parseCancellable(
    bytes: Uint8Array,
    options?: ParseOptions,
  ): CancellableParseOperation<ParseResult> {
    const taskId = generateParsingTaskId();

    const promise = this.parse(bytes, { ...options, taskId } as ParseOptions & { taskId: TaskId });

    return {
      promise,
      taskId,
      cancel: () => this.cancel(taskId),
    };
  }

  /**
   * Extract text from a parsed document.
   *
   * @param documentId - Document ID from parse result
   * @param options - Extraction options
   * @returns Extracted text per page
   */
  async extractText(documentId: string, options?: ExtractOptions): Promise<ExtractTextResult> {
    await this._ensureInitialized();

    const taskId = generateParsingTaskId();
    const timeout = options?.timeout ?? this._options.defaultTimeout;

    // Register progress handler
    if (options?.onProgress) {
      this._taskProgressHandlers.set(taskId, options.onProgress);
    }

    try {
      const response = await this._sendRequest<ExtractTextResponse>(
        "extractText",
        {
          documentId,
          taskId,
          pageIndices: options?.pages,
          includePositions: options?.includePositions,
        },
        timeout,
        taskId,
      );

      if (response.status === "cancelled") {
        throw new Error("Operation cancelled");
      }

      if (response.status === "error" || !response.data) {
        throw new Error(response.error?.message ?? "Failed to extract text");
      }

      return response.data;
    } finally {
      this._taskProgressHandlers.delete(taskId);
    }
  }

  /**
   * Cancel an active parsing operation.
   *
   * @param taskId - Task ID to cancel
   * @returns Whether the task was successfully cancelled
   */
  async cancel(taskId: TaskId): Promise<boolean> {
    if (!this.isReady) {
      return false;
    }

    try {
      const response = await this._sendRequest<CancelParsingResponse>(
        "cancelParsing",
        { taskId },
        5000,
      );

      return response.status === "success" && response.data?.wasCancelled === true;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  private async _ensureInitialized(): Promise<void> {
    if (this._state === "terminated") {
      throw new Error("Worker has been terminated");
    }

    if (!this.isReady) {
      await this.initialize();
    }
  }

  private _sendRequest<T>(
    requestType: string,
    data: unknown,
    timeout: number,
    taskId?: TaskId,
    transferables?: ArrayBuffer[],
  ): Promise<T> {
    if (this._state === "terminated") {
      return Promise.reject(new Error("Worker has been terminated"));
    }

    if (!this._worker) {
      return Promise.reject(new Error("Worker not initialized"));
    }

    const messageId = generateMessageId();
    const actualTaskId = taskId ?? generateTaskId();
    const deferred = createDeferred<T>();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      const pending = this._pendingRequests.get(messageId);
      if (pending) {
        this._pendingRequests.delete(messageId);
        this._updateBusyState();
        pending.deferred.reject(new Error(`Request timeout after ${timeout}ms: ${requestType}`));
      }
    }, timeout);

    // Track pending request
    const pending: PendingRequest<T> = {
      messageId,
      taskId: actualTaskId,
      deferred,
      timeoutId,
    };

    this._pendingRequests.set(messageId, pending as PendingRequest<unknown>);

    // Update state to busy
    if (this._state === "ready") {
      this._setState("busy");
    }

    // Send message
    const request = {
      type: "request",
      id: messageId,
      requestType,
      data,
    };

    try {
      if (transferables && transferables.length > 0) {
        this._worker.postMessage(request, transferables);
      } else {
        this._worker.postMessage(request);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      this._pendingRequests.delete(messageId);
      this._updateBusyState();
      return Promise.reject(error);
    }

    return deferred.promise;
  }

  private _handleMessage(event: MessageEvent): void {
    const message = event.data;

    if (isParsingProgress(message)) {
      this._handleProgress(message);
    } else if (isParsingResponse(message)) {
      this._handleResponse(message);
    } else if (typeof message === "object" && message !== null && "type" in message) {
      // Handle standard responses (init, terminate)
      if ((message as { type: string }).type === "response") {
        this._handleResponse(message as ParsingWorkerResponse);
      }
    }
  }

  private _handleResponse(response: ParsingWorkerResponse): void {
    const pending = this._pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this._pendingRequests.delete(response.id);
    this._updateBusyState();

    if (response.status === "error" && response.error) {
      pending.deferred.reject(new Error(response.error.message));
    } else {
      pending.deferred.resolve(response);
    }
  }

  private _handleProgress(progress: ParsingProgressMessage): void {
    // Call task-specific handler
    const taskHandler = this._taskProgressHandlers.get(progress.taskId);
    if (taskHandler) {
      taskHandler(progress.progress);
    }

    // Call global handler
    if (this._options.onProgress) {
      this._options.onProgress(progress.progress);
    }
  }

  private _handleError(event: ErrorEvent): void {
    const error: ParsingWorkerError = {
      code: "INTERNAL_ERROR",
      message: event.message ?? "Unknown worker error",
      recoverable: false,
    };

    if (this._options.onError) {
      this._options.onError(error);
    }

    // Reject all pending requests if not initializing
    if (this._state !== "initializing") {
      for (const pending of this._pendingRequests.values()) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.deferred.reject(new Error(error.message));
      }
      this._pendingRequests.clear();
      this._setState("error");
    }
  }

  private _updateBusyState(): void {
    if (this._state === "busy" && this._pendingRequests.size === 0) {
      this._setState("ready");
    }
  }

  private _setState(newState: ParsingWorkerState): void {
    const previousState = this._state;
    if (previousState === newState) {
      return;
    }

    this._state = newState;

    if (this._options.onStateChange) {
      this._options.onStateChange(newState, previousState);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new ParsingWorkerHost instance.
 */
export function createParsingWorkerHost(options: ParsingWorkerHostOptions): ParsingWorkerHost {
  return new ParsingWorkerHost(options);
}

/**
 * Check if parsing workers are supported in the current environment.
 */
export { isWorkerSupported };
