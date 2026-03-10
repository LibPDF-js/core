/**
 * PDFWorker manages Web Worker lifecycle and communication.
 *
 * This class provides a high-level interface for spawning, communicating with,
 * and terminating PDF processing workers. It handles:
 * - Worker creation and initialization
 * - Message passing with request/response correlation
 * - Progress event handling
 * - Graceful shutdown and cleanup
 */

import {
  type InitResponseData,
  type MainToWorkerMessage,
  type MessageId,
  type ProgressMessage,
  type TaskId,
  type WorkerError,
  type WorkerRequest,
  type WorkerRequestType,
  type WorkerResponse,
  type WorkerToMainMessage,
  createRequest,
  createWorkerError,
  generateTaskId,
  isProgress,
  isResponse,
} from "./messages";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Worker state.
 */
export type WorkerState = "idle" | "initializing" | "ready" | "busy" | "terminated" | "error";

/**
 * Options for creating a PDFWorker.
 */
export interface PDFWorkerOptions {
  /**
   * URL or path to the worker script.
   * If not provided, uses the default bundled worker.
   */
  workerUrl?: string | URL;

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
   * Default timeout for operations in milliseconds.
   * @default 60000
   */
  defaultTimeout?: number;

  /**
   * Called when the worker reports progress.
   */
  onProgress?: (progress: ProgressMessage) => void;

  /**
   * Called when the worker encounters an error.
   */
  onError?: (error: WorkerError) => void;

  /**
   * Called when the worker state changes.
   */
  onStateChange?: (state: WorkerState, previousState: WorkerState) => void;
}

/**
 * Pending request waiting for response.
 */
interface PendingRequest {
  readonly messageId: MessageId;
  readonly taskId: TaskId;
  readonly requestType: WorkerRequestType;
  readonly resolve: (response: WorkerResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Worker task information.
 */
export interface WorkerTask {
  readonly taskId: TaskId;
  readonly requestType: WorkerRequestType;
  readonly startTime: number;
  cancelled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDFWorker Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PDFWorker manages a Web Worker instance for PDF processing.
 *
 * @example
 * ```typescript
 * const worker = new PDFWorker({ workerUrl: '/pdf-worker.js' });
 * await worker.initialize();
 *
 * const response = await worker.send('load', {
 *   bytes: pdfBytes,
 *   documentId: 'doc-1',
 * });
 *
 * await worker.terminate();
 * ```
 */
export class PDFWorker {
  private _worker: Worker | null = null;
  private _state: WorkerState = "idle";
  private _options: Required<Omit<PDFWorkerOptions, "onProgress" | "onError" | "onStateChange">> & {
    onProgress?: (progress: ProgressMessage) => void;
    onError?: (error: WorkerError) => void;
    onStateChange?: (state: WorkerState, previousState: WorkerState) => void;
  };
  private _pendingRequests: Map<MessageId, PendingRequest> = new Map();
  private _activeTasks: Map<TaskId, WorkerTask> = new Map();
  private _initPromise: Promise<InitResponseData> | null = null;
  private _workerVersion: string | null = null;

  constructor(options?: PDFWorkerOptions) {
    this._options = {
      workerUrl: options?.workerUrl ?? "",
      name: options?.name ?? `pdf-worker-${Date.now()}`,
      verbose: options?.verbose ?? false,
      initTimeout: options?.initTimeout ?? 10_000,
      defaultTimeout: options?.defaultTimeout ?? 60_000,
      onProgress: options?.onProgress,
      onError: options?.onError,
      onStateChange: options?.onStateChange,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public Properties
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Current worker state.
   */
  get state(): WorkerState {
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
   * Number of active tasks.
   */
  get activeTaskCount(): number {
    return this._activeTasks.size;
  }

  /**
   * Worker name.
   */
  get name(): string {
    return this._options.name;
  }

  /**
   * Worker version (available after initialization).
   */
  get version(): string | null {
    return this._workerVersion;
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
   * @throws Error if worker creation fails or initialization times out
   */
  async initialize(): Promise<InitResponseData> {
    // Return existing promise if already initializing/initialized
    if (this._initPromise) {
      return this._initPromise;
    }

    if (this._state === "terminated") {
      throw new Error("Cannot initialize a terminated worker");
    }

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<InitResponseData> {
    this._setState("initializing");

    try {
      // Create the worker
      this._worker = this._createWorker();

      // Set up message handling
      this._worker.onmessage = this._handleMessage.bind(this);
      this._worker.onerror = this._handleError.bind(this);

      // Send init request and wait for response
      const response = await this._sendWithTimeout<"init">(
        "init",
        {
          verbose: this._options.verbose,
          name: this._options.name,
        },
        this._options.initTimeout,
      );

      if (response.status !== "success" || !response.data) {
        throw new Error(response.error?.message ?? "Worker initialization failed");
      }

      this._workerVersion = response.data.version;
      this._setState("ready");

      return response.data;
    } catch (error) {
      this._setState("error");
      this._cleanup();
      throw error;
    }
  }

  /**
   * Create the Web Worker instance.
   */
  private _createWorker(): Worker {
    const url = this._options.workerUrl;

    if (!url) {
      throw new Error(
        "Worker URL is required. Provide workerUrl in PDFWorkerOptions " +
          "pointing to the bundled pdf-worker.js script.",
      );
    }

    // Create worker with module type for ES modules support
    return new Worker(url, {
      type: "module",
      name: this._options.name,
    });
  }

  /**
   * Terminate the worker.
   *
   * Sends a terminate request and waits for acknowledgment before
   * forcibly terminating the worker. Pending requests are rejected.
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
        // Send terminate request with timeout
        await Promise.race([
          this._sendWithTimeout<"terminate">("terminate", undefined, timeout),
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

  /**
   * Force terminate the worker without waiting.
   */
  private _forceTerminate(): void {
    // Reject all pending requests
    for (const pending of this._pendingRequests.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error("Worker terminated"));
    }
    this._pendingRequests.clear();
    this._activeTasks.clear();

    // Terminate the worker
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }

    this._setState("terminated");
    this._initPromise = null;
  }

  /**
   * Clean up resources.
   */
  private _cleanup(): void {
    // Clear timeouts
    for (const pending of this._pendingRequests.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this._pendingRequests.clear();
    this._activeTasks.clear();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Communication Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Send a request to the worker and wait for response.
   *
   * @param requestType - Type of request to send
   * @param data - Request data
   * @param timeout - Timeout in milliseconds (default: defaultTimeout)
   * @param transferables - Arrays to transfer instead of copy
   * @returns Promise resolving to the response
   */
  async send<T extends WorkerRequestType>(
    requestType: T,
    data: Extract<WorkerRequest, { requestType: T }>["data"],
    timeout?: number,
    transferables?: Transferable[],
  ): Promise<Extract<WorkerResponse, { requestType: T }>> {
    return this._sendWithTimeout(
      requestType,
      data,
      timeout ?? this._options.defaultTimeout,
      transferables,
    );
  }

  /**
   * Send a request with timeout handling.
   */
  private async _sendWithTimeout<T extends WorkerRequestType>(
    requestType: T,
    data: Extract<WorkerRequest, { requestType: T }>["data"],
    timeout: number,
    transferables?: Transferable[],
  ): Promise<Extract<WorkerResponse, { requestType: T }>> {
    // Check terminated state first (worker becomes null after termination)
    if (this._state === "terminated") {
      throw new Error("Worker has been terminated");
    }

    if (!this._worker) {
      throw new Error("Worker not initialized");
    }

    // Create request message
    const request = createRequest(requestType, data);
    const taskId = generateTaskId();

    // Track the task
    this._activeTasks.set(taskId, {
      taskId,
      requestType,
      startTime: Date.now(),
      cancelled: false,
    });

    // Update state to busy
    if (this._state === "ready") {
      this._setState("busy");
    }

    return new Promise<Extract<WorkerResponse, { requestType: T }>>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        const pending = this._pendingRequests.get(request.id);
        if (pending) {
          this._pendingRequests.delete(request.id);
          this._activeTasks.delete(taskId);
          this._updateBusyState();
          reject(new Error(`Request timeout after ${timeout}ms: ${requestType}`));
        }
      }, timeout);

      // Track pending request
      const pending: PendingRequest = {
        messageId: request.id,
        taskId,
        requestType,
        resolve: (response: WorkerResponse) => {
          clearTimeout(timeoutId);
          this._pendingRequests.delete(request.id);
          this._activeTasks.delete(taskId);
          this._updateBusyState();
          resolve(response as Extract<WorkerResponse, { requestType: T }>);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this._pendingRequests.delete(request.id);
          this._activeTasks.delete(taskId);
          this._updateBusyState();
          reject(error);
        },
        timeoutId,
      };

      this._pendingRequests.set(request.id, pending);

      // Send message to worker
      try {
        if (transferables && transferables.length > 0) {
          this._worker!.postMessage(request as MainToWorkerMessage, transferables);
        } else {
          this._worker!.postMessage(request as MainToWorkerMessage);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        this._pendingRequests.delete(request.id);
        this._activeTasks.delete(taskId);
        this._updateBusyState();
        reject(error);
      }
    });
  }

  /**
   * Cancel an active task.
   *
   * @param taskId - ID of the task to cancel
   * @returns Whether the cancel request was sent
   */
  async cancel(taskId: TaskId): Promise<boolean> {
    const task = this._activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.cancelled = true;

    try {
      const response = await this.send("cancel", { taskId });
      return response.status === "success" && response.data?.wasCancelled === true;
    } catch {
      return false;
    }
  }

  /**
   * Cancel all active tasks.
   */
  async cancelAll(): Promise<void> {
    const taskIds = Array.from(this._activeTasks.keys());
    await Promise.all(taskIds.map(id => this.cancel(id)));
  }

  /**
   * Update busy state based on pending requests.
   */
  private _updateBusyState(): void {
    if (this._state === "busy" && this._pendingRequests.size === 0) {
      this._setState("ready");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Message Handling
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Handle messages from the worker.
   */
  private _handleMessage(event: MessageEvent<WorkerToMainMessage>): void {
    const message = event.data;

    if (isResponse(message)) {
      this._handleResponse(message);
    } else if (isProgress(message)) {
      this._handleProgress(message);
    }
  }

  /**
   * Handle response messages.
   */
  private _handleResponse(response: WorkerResponse): void {
    const pending = this._pendingRequests.get(response.id);
    if (!pending) {
      // Response for unknown request — might have timed out
      return;
    }

    if (response.status === "error" && response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Handle progress messages.
   */
  private _handleProgress(progress: ProgressMessage): void {
    const task = this._activeTasks.get(progress.taskId);
    if (!task) {
      return;
    }

    if (this._options.onProgress) {
      this._options.onProgress(progress);
    }
  }

  /**
   * Handle worker errors.
   */
  private _handleError(event: ErrorEvent): void {
    const error = createWorkerError(
      new Error(event.message ?? "Unknown worker error"),
      "WORKER_ERROR",
    );

    if (this._options.onError) {
      this._options.onError(error);
    }

    // If we're initializing, the init promise will be rejected
    // Otherwise, reject all pending requests
    if (this._state !== "initializing") {
      for (const pending of this._pendingRequests.values()) {
        pending.reject(new Error(error.message));
      }
      this._pendingRequests.clear();
      this._activeTasks.clear();
      this._setState("error");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // State Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Update worker state and notify listeners.
   */
  private _setState(newState: WorkerState): void {
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
 * Create a new PDFWorker instance.
 */
export function createPDFWorker(options?: PDFWorkerOptions): PDFWorker {
  return new PDFWorker(options);
}
