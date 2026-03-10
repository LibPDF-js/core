/**
 * Web Worker message protocol definitions.
 *
 * Defines the message types and data structures used for communication
 * between the main thread and PDF worker threads.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Message IDs and Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unique message identifier for request/response correlation.
 */
export type MessageId = string;

/**
 * Task identifier for tracking ongoing operations.
 */
export type TaskId = string;

/**
 * Generate a unique message ID.
 */
export function generateMessageId(): MessageId {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique task ID.
 */
export function generateTaskId(): TaskId {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Message Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request types that can be sent to the worker.
 */
export type WorkerRequestType =
  | "init"
  | "load"
  | "save"
  | "parse"
  | "extractText"
  | "findText"
  | "cancel"
  | "terminate";

/**
 * Base request message structure.
 */
export interface BaseRequest<T extends WorkerRequestType, D = unknown> {
  readonly type: "request";
  readonly id: MessageId;
  readonly requestType: T;
  readonly data: D;
}

/**
 * Initialize the worker with configuration.
 */
export interface InitRequest extends BaseRequest<"init", InitRequestData> {
  readonly requestType: "init";
}

export interface InitRequestData {
  /** Worker configuration options */
  readonly verbose?: boolean;
  /** Optional worker name for debugging */
  readonly name?: string;
}

/**
 * Load a PDF document.
 */
export interface LoadRequest extends BaseRequest<"load", LoadRequestData> {
  readonly requestType: "load";
}

export interface LoadRequestData {
  /** PDF bytes to load (transferred, not copied) */
  readonly bytes: Uint8Array;
  /** Optional password for encrypted PDFs */
  readonly password?: string;
  /** Document identifier for tracking */
  readonly documentId: string;
}

/**
 * Save a PDF document.
 */
export interface SaveRequest extends BaseRequest<"save", SaveRequestData> {
  readonly requestType: "save";
}

export interface SaveRequestData {
  /** Document identifier */
  readonly documentId: string;
  /** Whether to use incremental save */
  readonly incremental?: boolean;
  /** Encryption options */
  readonly encrypt?: {
    readonly userPassword?: string;
    readonly ownerPassword?: string;
    readonly permissions?: number;
  };
}

/**
 * Parse PDF structure (xref, objects, etc.).
 */
export interface ParseRequest extends BaseRequest<"parse", ParseRequestData> {
  readonly requestType: "parse";
}

export interface ParseRequestData {
  /** PDF bytes to parse */
  readonly bytes: Uint8Array;
  /** Parse options */
  readonly options?: {
    /** Whether to perform brute-force recovery if normal parsing fails */
    readonly bruteForceRecovery?: boolean;
  };
}

/**
 * Extract text from pages.
 */
export interface ExtractTextRequest extends BaseRequest<"extractText", ExtractTextRequestData> {
  readonly requestType: "extractText";
}

export interface ExtractTextRequestData {
  /** Document identifier */
  readonly documentId: string;
  /** Page indices to extract (0-based), undefined means all pages */
  readonly pageIndices?: readonly number[];
}

/**
 * Find text in document.
 */
export interface FindTextRequest extends BaseRequest<"findText", FindTextRequestData> {
  readonly requestType: "findText";
}

export interface FindTextRequestData {
  /** Document identifier */
  readonly documentId: string;
  /** Text or regex pattern to find */
  readonly pattern: string;
  /** Whether pattern is a regex */
  readonly isRegex?: boolean;
  /** Case-sensitive search */
  readonly caseSensitive?: boolean;
  /** Page indices to search (0-based), undefined means all pages */
  readonly pageIndices?: readonly number[];
}

/**
 * Cancel an ongoing operation.
 */
export interface CancelRequest extends BaseRequest<"cancel", CancelRequestData> {
  readonly requestType: "cancel";
}

export interface CancelRequestData {
  /** Task ID to cancel */
  readonly taskId: TaskId;
}

/**
 * Terminate the worker.
 */
export interface TerminateRequest extends BaseRequest<"terminate", undefined> {
  readonly requestType: "terminate";
  readonly data: undefined;
}

/**
 * Union of all request types.
 */
export type WorkerRequest =
  | InitRequest
  | LoadRequest
  | SaveRequest
  | ParseRequest
  | ExtractTextRequest
  | FindTextRequest
  | CancelRequest
  | TerminateRequest;

// ─────────────────────────────────────────────────────────────────────────────
// Response Message Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response status indicating success or failure.
 */
export type ResponseStatus = "success" | "error" | "cancelled";

/**
 * Base response message structure.
 */
export interface BaseResponse<T extends WorkerRequestType, D = unknown> {
  readonly type: "response";
  readonly id: MessageId;
  readonly requestType: T;
  readonly status: ResponseStatus;
  readonly data?: D;
  readonly error?: WorkerError;
}

/**
 * Error information from the worker.
 */
export interface WorkerError {
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Init response.
 */
export interface InitResponse extends BaseResponse<"init", InitResponseData> {
  readonly requestType: "init";
}

export interface InitResponseData {
  /** Worker is ready */
  readonly ready: boolean;
  /** Worker version/capabilities */
  readonly version: string;
}

/**
 * Load response.
 */
export interface LoadResponse extends BaseResponse<"load", LoadResponseData> {
  readonly requestType: "load";
}

export interface LoadResponseData {
  /** Document identifier */
  readonly documentId: string;
  /** Number of pages */
  readonly pageCount: number;
  /** Document metadata */
  readonly metadata?: {
    readonly title?: string;
    readonly author?: string;
    readonly subject?: string;
    readonly keywords?: string;
    readonly creator?: string;
    readonly producer?: string;
    readonly creationDate?: string;
    readonly modificationDate?: string;
  };
  /** Whether document is encrypted */
  readonly isEncrypted: boolean;
  /** Whether document has forms */
  readonly hasForms: boolean;
  /** Whether document has signatures */
  readonly hasSignatures: boolean;
}

/**
 * Save response.
 */
export interface SaveResponse extends BaseResponse<"save", SaveResponseData> {
  readonly requestType: "save";
}

export interface SaveResponseData {
  /** Saved PDF bytes (transferred, not copied) */
  readonly bytes: Uint8Array;
  /** Size in bytes */
  readonly size: number;
}

/**
 * Parse response.
 */
export interface ParseResponse extends BaseResponse<"parse", ParseResponseData> {
  readonly requestType: "parse";
}

export interface ParseResponseData {
  /** PDF version string */
  readonly version: string;
  /** Number of objects */
  readonly objectCount: number;
  /** Whether brute-force recovery was used */
  readonly usedBruteForce: boolean;
}

/**
 * Extract text response.
 */
export interface ExtractTextResponse extends BaseResponse<"extractText", ExtractTextResponseData> {
  readonly requestType: "extractText";
}

export interface ExtractTextResponseData {
  /** Extracted text per page */
  readonly pages: readonly PageText[];
}

export interface PageText {
  /** Page index (0-based) */
  readonly pageIndex: number;
  /** Extracted text content */
  readonly text: string;
}

/**
 * Find text response.
 */
export interface FindTextResponse extends BaseResponse<"findText", FindTextResponseData> {
  readonly requestType: "findText";
}

export interface FindTextResponseData {
  /** Search results */
  readonly matches: readonly TextMatch[];
  /** Total match count */
  readonly totalCount: number;
}

export interface TextMatch {
  /** Page index (0-based) */
  readonly pageIndex: number;
  /** Matched text */
  readonly text: string;
  /** Character offset in page text */
  readonly offset: number;
  /** Bounding box [x, y, width, height] in PDF coordinates */
  readonly bounds?: readonly [number, number, number, number];
}

/**
 * Cancel response.
 */
export interface CancelResponse extends BaseResponse<"cancel", CancelResponseData> {
  readonly requestType: "cancel";
}

export interface CancelResponseData {
  /** Task ID that was cancelled */
  readonly taskId: TaskId;
  /** Whether the task was successfully cancelled */
  readonly wasCancelled: boolean;
}

/**
 * Terminate response.
 */
export interface TerminateResponse extends BaseResponse<"terminate", undefined> {
  readonly requestType: "terminate";
}

/**
 * Union of all response types.
 */
export type WorkerResponse =
  | InitResponse
  | LoadResponse
  | SaveResponse
  | ParseResponse
  | ExtractTextResponse
  | FindTextResponse
  | CancelResponse
  | TerminateResponse;

// ─────────────────────────────────────────────────────────────────────────────
// Progress Message Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progress update from the worker.
 */
export interface ProgressMessage {
  readonly type: "progress";
  readonly taskId: TaskId;
  readonly requestType: WorkerRequestType;
  /** Progress percentage (0-100) */
  readonly percent: number;
  /** Current operation description */
  readonly operation?: string;
  /** Items processed / total items */
  readonly processed?: number;
  readonly total?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Union Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Any message from the main thread to the worker.
 */
export type MainToWorkerMessage = WorkerRequest;

/**
 * Any message from the worker to the main thread.
 */
export type WorkerToMainMessage = WorkerResponse | ProgressMessage;

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a message is a request.
 */
export function isRequest(message: unknown): message is WorkerRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "request"
  );
}

/**
 * Check if a message is a response.
 */
export function isResponse(message: unknown): message is WorkerResponse {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "response"
  );
}

/**
 * Check if a message is a progress update.
 */
export function isProgress(message: unknown): message is ProgressMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "progress"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a request message.
 */
export function createRequest<T extends WorkerRequestType>(
  requestType: T,
  data: Extract<WorkerRequest, { requestType: T }>["data"],
): Extract<WorkerRequest, { requestType: T }> {
  return {
    type: "request",
    id: generateMessageId(),
    requestType,
    data,
  } as Extract<WorkerRequest, { requestType: T }>;
}

/**
 * Create a success response.
 */
export function createSuccessResponse<T extends WorkerRequestType>(
  id: MessageId,
  requestType: T,
  data: Extract<WorkerResponse, { requestType: T }>["data"],
): Extract<WorkerResponse, { requestType: T }> {
  return {
    type: "response",
    id,
    requestType,
    status: "success",
    data,
  } as Extract<WorkerResponse, { requestType: T }>;
}

/**
 * Create an error response.
 */
export function createErrorResponse<T extends WorkerRequestType>(
  id: MessageId,
  requestType: T,
  error: WorkerError,
): Extract<WorkerResponse, { requestType: T }> {
  return {
    type: "response",
    id,
    requestType,
    status: "error",
    error,
  } as Extract<WorkerResponse, { requestType: T }>;
}

/**
 * Create a cancelled response.
 */
export function createCancelledResponse<T extends WorkerRequestType>(
  id: MessageId,
  requestType: T,
): Extract<WorkerResponse, { requestType: T }> {
  return {
    type: "response",
    id,
    requestType,
    status: "cancelled",
  } as Extract<WorkerResponse, { requestType: T }>;
}

/**
 * Create a progress message.
 */
export function createProgress(
  taskId: TaskId,
  requestType: WorkerRequestType,
  percent: number,
  options?: {
    operation?: string;
    processed?: number;
    total?: number;
  },
): ProgressMessage {
  return {
    type: "progress",
    taskId,
    requestType,
    percent,
    ...options,
  };
}

/**
 * Create a WorkerError from an Error.
 */
export function createWorkerError(error: Error, code?: string): WorkerError {
  return {
    code: code ?? error.name,
    message: error.message,
    stack: error.stack,
  };
}
