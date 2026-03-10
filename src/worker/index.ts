/**
 * Web Worker module for background PDF processing.
 *
 * This module provides the infrastructure for running PDF operations
 * in Web Workers to keep the main thread responsive.
 *
 * @example
 * ```typescript
 * import { WorkerProxy, createWorkerProxy } from '@libpdf/core/worker';
 *
 * // Create a worker proxy
 * const proxy = createWorkerProxy({
 *   workerUrl: '/pdf-worker.js',
 * });
 *
 * // Load a document
 * const doc = await proxy.load(pdfBytes);
 * console.log(`Loaded ${doc.pageCount} pages`);
 *
 * // Extract text
 * const pages = await proxy.extractText(doc.documentId);
 *
 * // Clean up
 * await proxy.destroy();
 * ```
 *
 * ## Architecture
 *
 * The worker module consists of three main components:
 *
 * 1. **Messages** (`messages.ts`): Protocol definitions for communication
 *    between main thread and worker. Includes request/response types,
 *    progress messages, and factory functions.
 *
 * 2. **PDFWorker** (`pdf-worker.ts`): Low-level worker lifecycle manager.
 *    Handles worker creation, message passing with correlation IDs,
 *    timeouts, and graceful shutdown.
 *
 * 3. **WorkerProxy** (`worker-proxy.ts`): High-level API for document
 *    operations. Provides convenient methods like load(), save(),
 *    extractText(), and findText().
 *
 * ## Worker Entry Point
 *
 * The `worker-entry.ts` file is meant to be bundled separately and
 * served as the worker script. It handles incoming messages and
 * executes PDF operations.
 *
 * ## Transferables
 *
 * Large binary data (PDF bytes) is transferred using Transferable
 * objects for zero-copy efficiency. The original Uint8Array becomes
 * detached after transfer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Message Protocol
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // IDs
  MessageId,
  TaskId,
  // Request types
  WorkerRequestType,
  WorkerRequest,
  InitRequest,
  InitRequestData,
  LoadRequest,
  LoadRequestData,
  SaveRequest,
  SaveRequestData,
  ParseRequest,
  ParseRequestData,
  ExtractTextRequest,
  ExtractTextRequestData,
  FindTextRequest,
  FindTextRequestData,
  CancelRequest,
  CancelRequestData,
  TerminateRequest,
  // Response types
  ResponseStatus,
  WorkerResponse,
  WorkerError,
  InitResponse,
  InitResponseData,
  LoadResponse,
  LoadResponseData,
  SaveResponse,
  SaveResponseData,
  ParseResponse,
  ParseResponseData,
  ExtractTextResponse,
  ExtractTextResponseData,
  PageText,
  FindTextResponse,
  FindTextResponseData,
  TextMatch,
  CancelResponse,
  CancelResponseData,
  TerminateResponse,
  // Progress
  ProgressMessage,
  // Unions
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./messages";

export {
  // ID generators
  generateMessageId,
  generateTaskId,
  // Type guards
  isRequest,
  isResponse,
  isProgress,
  // Factories
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  createCancelledResponse,
  createProgress,
  createWorkerError,
} from "./messages";

// ─────────────────────────────────────────────────────────────────────────────
// PDFWorker (Low-Level)
// ─────────────────────────────────────────────────────────────────────────────

export type { WorkerState, PDFWorkerOptions, WorkerTask } from "./pdf-worker";

export { PDFWorker, createPDFWorker } from "./pdf-worker";

// ─────────────────────────────────────────────────────────────────────────────
// WorkerProxy (High-Level)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ProxyLoadOptions,
  ProxySaveOptions,
  ExtractTextOptions,
  FindTextOptions,
  LoadedDocument,
  WorkerProxyOptions,
  CancellableOperation,
} from "./worker-proxy";

export { WorkerProxy, createWorkerProxy } from "./worker-proxy";
