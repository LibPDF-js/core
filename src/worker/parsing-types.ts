/**
 * TypeScript interfaces for parsing worker message protocols.
 *
 * These types define the contract between the main thread and the parsing worker,
 * supporting progress reporting with 500ms throttling and cancellation.
 */

import type { MessageId, TaskId, WorkerRequestType } from "./messages";

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Operation Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Types of parsing operations supported by the worker.
 */
export type ParsingOperationType =
  | "parseDocument"
  | "parseXRef"
  | "parseObjects"
  | "extractText"
  | "validateStructure";

/**
 * Phase of parsing for progress reporting.
 */
export type ParsingPhase =
  | "initializing"
  | "header"
  | "xref"
  | "trailer"
  | "objects"
  | "encryption"
  | "catalog"
  | "pages"
  | "text"
  | "complete";

// ─────────────────────────────────────────────────────────────────────────────
// Progress Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progress event data for parsing operations.
 */
export interface ParsingProgress {
  /** Current parsing phase */
  readonly phase: ParsingPhase;

  /** Progress percentage (0-100) */
  readonly percent: number;

  /** Human-readable description of current operation */
  readonly operation: string;

  /** Number of items processed (e.g., objects parsed) */
  readonly processed?: number;

  /** Total number of items to process */
  readonly total?: number;

  /** Estimated time remaining in milliseconds */
  readonly estimatedRemaining?: number;

  /** Bytes processed so far */
  readonly bytesProcessed?: number;

  /** Total bytes to process */
  readonly totalBytes?: number;
}

/**
 * Progress callback function signature.
 */
export type ParsingProgressCallback = (progress: ParsingProgress) => void;

/**
 * Progress message from worker to main thread.
 */
export interface ParsingProgressMessage {
  readonly type: "parsingProgress";
  readonly taskId: TaskId;
  readonly progress: ParsingProgress;
  readonly timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for document parsing in the worker.
 */
export interface WorkerParseOptions {
  /** Enable lenient parsing for malformed PDFs (default: true) */
  readonly lenient?: boolean;

  /** Password for encrypted documents */
  readonly password?: string;

  /** Enable brute-force recovery if normal parsing fails */
  readonly bruteForceRecovery?: boolean;

  /** Progress reporting interval in milliseconds (default: 500) */
  readonly progressInterval?: number;
}

/**
 * Request to parse a PDF document.
 */
export interface ParseDocumentRequest {
  readonly type: "request";
  readonly id: MessageId;
  readonly requestType: "parseDocument";
  readonly data: ParseDocumentRequestData;
}

export interface ParseDocumentRequestData {
  /** PDF bytes to parse (transferred, not copied) */
  readonly bytes: Uint8Array;

  /** Unique task identifier for progress/cancellation */
  readonly taskId: TaskId;

  /** Parse options */
  readonly options?: WorkerParseOptions;
}

/**
 * Request to extract text from a parsed document.
 */
export interface ExtractTextRequest {
  readonly type: "request";
  readonly id: MessageId;
  readonly requestType: "extractText";
  readonly data: ExtractTextRequestData;
}

export interface ExtractTextRequestData {
  /** Document ID (from previous parse) */
  readonly documentId: string;

  /** Task identifier */
  readonly taskId: TaskId;

  /** Page indices to extract (0-based), undefined means all pages */
  readonly pageIndices?: readonly number[];

  /** Include position information for each text item */
  readonly includePositions?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsed document metadata.
 */
export interface ParsedDocumentInfo {
  /** PDF version from header (e.g., "1.7", "2.0") */
  readonly version: string;

  /** Number of pages in the document */
  readonly pageCount: number;

  /** Whether document is encrypted */
  readonly isEncrypted: boolean;

  /** Whether authentication succeeded (for encrypted docs) */
  readonly isAuthenticated: boolean;

  /** Whether document was recovered via brute-force parsing */
  readonly recoveredViaBruteForce: boolean;

  /** Document metadata from Info dictionary */
  readonly metadata: DocumentMetadata;

  /** Parsing warnings */
  readonly warnings: readonly string[];

  /** Total number of objects in the document */
  readonly objectCount: number;

  /** Whether document has forms */
  readonly hasForms: boolean;

  /** Whether document has signatures */
  readonly hasSignatures: boolean;

  /** Whether document has layers (Optional Content Groups) */
  readonly hasLayers: boolean;
}

/**
 * Document metadata from Info dictionary.
 */
export interface DocumentMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly keywords?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly creationDate?: string;
  readonly modificationDate?: string;
}

/**
 * Response from parseDocument request.
 */
export interface ParseDocumentResponse {
  readonly type: "response";
  readonly id: MessageId;
  readonly requestType: "parseDocument";
  readonly status: "success" | "error" | "cancelled";
  readonly data?: ParseDocumentResponseData;
  readonly error?: ParsingWorkerError;
}

export interface ParseDocumentResponseData {
  /** Unique document identifier for subsequent operations */
  readonly documentId: string;

  /** Parsed document information */
  readonly info: ParsedDocumentInfo;

  /** Total parsing time in milliseconds */
  readonly parsingTime: number;
}

/**
 * Extracted text from a page.
 */
export interface ExtractedPageText {
  /** Page index (0-based) */
  readonly pageIndex: number;

  /** Extracted text content */
  readonly text: string;

  /** Text items with positions (if requested) */
  readonly items?: readonly TextItem[];
}

/**
 * Individual text item with position.
 */
export interface TextItem {
  /** Text content */
  readonly text: string;

  /** X position in PDF coordinates */
  readonly x: number;

  /** Y position in PDF coordinates */
  readonly y: number;

  /** Width of the text item */
  readonly width: number;

  /** Height of the text item */
  readonly height: number;

  /** Font size */
  readonly fontSize: number;

  /** Font name (if available) */
  readonly fontName?: string;
}

/**
 * Response from extractText request.
 */
export interface ExtractTextResponse {
  readonly type: "response";
  readonly id: MessageId;
  readonly requestType: "extractText";
  readonly status: "success" | "error" | "cancelled";
  readonly data?: ExtractTextResponseData;
  readonly error?: ParsingWorkerError;
}

export interface ExtractTextResponseData {
  /** Extracted text per page */
  readonly pages: readonly ExtractedPageText[];

  /** Total extraction time in milliseconds */
  readonly extractionTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error codes for parsing operations.
 */
export type ParsingErrorCode =
  | "PARSE_ERROR"
  | "INVALID_PDF"
  | "ENCRYPTED"
  | "AUTH_FAILED"
  | "CANCELLED"
  | "TIMEOUT"
  | "OUT_OF_MEMORY"
  | "UNSUPPORTED_FEATURE"
  | "INTERNAL_ERROR";

/**
 * Error information from the parsing worker.
 */
export interface ParsingWorkerError {
  readonly code: ParsingErrorCode;
  readonly message: string;
  readonly stack?: string;
  readonly details?: Record<string, unknown>;
  /** Whether the error is recoverable */
  readonly recoverable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request to cancel a parsing operation.
 */
export interface CancelParsingRequest {
  readonly type: "request";
  readonly id: MessageId;
  readonly requestType: "cancelParsing";
  readonly data: CancelParsingRequestData;
}

export interface CancelParsingRequestData {
  /** Task ID to cancel */
  readonly taskId: TaskId;
}

/**
 * Response to cancel request.
 */
export interface CancelParsingResponse {
  readonly type: "response";
  readonly id: MessageId;
  readonly requestType: "cancelParsing";
  readonly status: "success";
  readonly data: CancelParsingResponseData;
}

export interface CancelParsingResponseData {
  /** Task ID that was cancelled */
  readonly taskId: TaskId;
  /** Whether the task was successfully cancelled */
  readonly wasCancelled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Union Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All parsing worker request types.
 */
export type ParsingWorkerRequest = ParseDocumentRequest | ExtractTextRequest | CancelParsingRequest;

/**
 * All parsing worker response types.
 */
export type ParsingWorkerResponse =
  | ParseDocumentResponse
  | ExtractTextResponse
  | CancelParsingResponse;

/**
 * Messages from main thread to parsing worker.
 */
export type ParsingMainToWorkerMessage = ParsingWorkerRequest;

/**
 * Messages from parsing worker to main thread.
 */
export type ParsingWorkerToMainMessage = ParsingWorkerResponse | ParsingProgressMessage;

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a message is a parsing progress message.
 */
export function isParsingProgress(message: unknown): message is ParsingProgressMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "parsingProgress"
  );
}

/**
 * Check if a message is a parsing worker response.
 */
export function isParsingResponse(message: unknown): message is ParsingWorkerResponse {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type: unknown }).type === "response" &&
    "requestType" in message &&
    ["parseDocument", "extractText", "cancelParsing"].includes(
      (message as { requestType: unknown }).requestType as string,
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a parsing progress message.
 */
export function createParsingProgress(
  taskId: TaskId,
  progress: ParsingProgress,
): ParsingProgressMessage {
  return {
    type: "parsingProgress",
    taskId,
    progress,
    timestamp: Date.now(),
  };
}

/**
 * Create a parsing worker error.
 */
export function createParsingError(
  error: Error,
  code?: ParsingErrorCode,
  recoverable = false,
): ParsingWorkerError {
  return {
    code: code ?? "INTERNAL_ERROR",
    message: error.message,
    stack: error.stack,
    recoverable,
  };
}
