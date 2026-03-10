/**
 * Worker entry point script.
 *
 * This script runs inside the Web Worker and handles incoming messages
 * from the main thread. It maintains document state and executes PDF
 * operations in the background.
 *
 * Usage:
 *   // Bundle this file separately and serve as pdf-worker.js
 *   // The main thread creates a worker pointing to this file
 */

import {
  type CancelRequest,
  type ExtractTextRequest,
  type FindTextRequest,
  type InitRequest,
  type LoadRequest,
  type MainToWorkerMessage,
  type ParseRequest,
  type SaveRequest,
  type TaskId,
  type TerminateRequest,
  type WorkerError,
  type WorkerRequest,
  type WorkerResponse,
  createErrorResponse,
  createProgress,
  createSuccessResponse,
  createWorkerError,
  generateTaskId,
  isRequest,
} from "./messages";

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

interface WorkerState {
  initialized: boolean;
  verbose: boolean;
  name: string;
  documents: Map<string, DocumentState>;
  activeTasks: Map<TaskId, AbortController>;
}

interface DocumentState {
  documentId: string;
  bytes: Uint8Array;
  // In a full implementation, this would hold the parsed PDF context
  // For now, we store metadata that would be extracted during parsing
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    isEncrypted: boolean;
    hasForms: boolean;
    hasSignatures: boolean;
  };
}

const state: WorkerState = {
  initialized: false,
  verbose: false,
  name: "pdf-worker",
  documents: new Map(),
  activeTasks: new Map(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function log(...args: unknown[]): void {
  if (state.verbose) {
    console.log(`[${state.name}]`, ...args);
  }
}

function logError(...args: unknown[]): void {
  console.error(`[${state.name}]`, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle incoming messages from the main thread.
 */
function handleMessage(event: MessageEvent<MainToWorkerMessage>): void {
  const message = event.data;

  if (!isRequest(message)) {
    logError("Received invalid message:", message);
    return;
  }

  log("Received request:", message.requestType, message.id);

  // Route to appropriate handler
  handleRequest(message)
    .then(response => {
      self.postMessage(response);
    })
    .catch(error => {
      const errorResponse = createErrorResponse(
        message.id,
        message.requestType,
        createWorkerError(error instanceof Error ? error : new Error(String(error))),
      );
      self.postMessage(errorResponse);
    });
}

/**
 * Route request to appropriate handler.
 */
async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  switch (request.requestType) {
    case "init":
      return handleInit(request);
    case "load":
      return handleLoad(request);
    case "save":
      return handleSave(request);
    case "parse":
      return handleParse(request);
    case "extractText":
      return handleExtractText(request);
    case "findText":
      return handleFindText(request);
    case "cancel":
      return handleCancel(request);
    case "terminate":
      return handleTerminate(request);
    default:
      throw new Error(`Unknown request type: ${(request as WorkerRequest).requestType}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle init request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleInit(request: InitRequest): Promise<WorkerResponse> {
  state.verbose = request.data.verbose ?? false;
  state.name = request.data.name ?? "pdf-worker";
  state.initialized = true;

  log("Worker initialized");

  return createSuccessResponse(request.id, "init", {
    ready: true,
    version: "1.0.0",
  });
}

/**
 * Handle load request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleLoad(request: LoadRequest): Promise<WorkerResponse> {
  if (!state.initialized) {
    throw new Error("Worker not initialized");
  }

  const { bytes, documentId, password } = request.data;
  const taskId = generateTaskId();

  // Create abort controller for this task
  const abortController = new AbortController();
  state.activeTasks.set(taskId, abortController);

  try {
    // Send initial progress
    self.postMessage(createProgress(taskId, "load", 0, { operation: "Loading PDF" }));

    // Basic PDF validation - check magic bytes
    if (!isPdfBytes(bytes)) {
      throw new Error("Invalid PDF: Missing %PDF header");
    }

    self.postMessage(createProgress(taskId, "load", 25, { operation: "Parsing structure" }));

    // Check for abort
    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    // In a full implementation, we would:
    // 1. Parse the PDF structure using DocumentParser
    // 2. Handle encryption/decryption if password provided
    // 3. Build the object graph
    // For now, we do basic extraction from the raw bytes

    const metadata = extractBasicMetadata(bytes);

    self.postMessage(createProgress(taskId, "load", 75, { operation: "Building document model" }));

    // Store document state
    const docState: DocumentState = {
      documentId,
      bytes,
      metadata,
    };
    state.documents.set(documentId, docState);

    self.postMessage(createProgress(taskId, "load", 100, { operation: "Complete" }));

    log(`Loaded document ${documentId}: ${metadata.pageCount} pages`);

    return createSuccessResponse(request.id, "load", {
      documentId,
      pageCount: metadata.pageCount,
      metadata: {
        title: metadata.title,
        author: metadata.author,
      },
      isEncrypted: metadata.isEncrypted,
      hasForms: metadata.hasForms,
      hasSignatures: metadata.hasSignatures,
    });
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle save request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleSave(request: SaveRequest): Promise<WorkerResponse> {
  if (!state.initialized) {
    throw new Error("Worker not initialized");
  }

  const { documentId, incremental, encrypt } = request.data;
  const doc = state.documents.get(documentId);

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const taskId = generateTaskId();
  const abortController = new AbortController();
  state.activeTasks.set(taskId, abortController);

  try {
    self.postMessage(createProgress(taskId, "save", 0, { operation: "Preparing save" }));

    // In a full implementation, we would:
    // 1. Serialize modified objects
    // 2. Apply encryption if requested
    // 3. Write incremental update or complete rewrite
    // For now, return the original bytes

    self.postMessage(createProgress(taskId, "save", 50, { operation: "Writing PDF" }));

    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    // Clone the bytes to transfer back
    const savedBytes = new Uint8Array(doc.bytes);

    self.postMessage(createProgress(taskId, "save", 100, { operation: "Complete" }));

    log(`Saved document ${documentId}: ${savedBytes.length} bytes`);

    return createSuccessResponse(request.id, "save", {
      bytes: savedBytes,
      size: savedBytes.length,
    });
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle parse request (parse without loading).
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleParse(request: ParseRequest): Promise<WorkerResponse> {
  if (!state.initialized) {
    throw new Error("Worker not initialized");
  }

  const { bytes, options } = request.data;
  const taskId = generateTaskId();

  const abortController = new AbortController();
  state.activeTasks.set(taskId, abortController);

  try {
    self.postMessage(createProgress(taskId, "parse", 0, { operation: "Parsing PDF" }));

    if (!isPdfBytes(bytes)) {
      throw new Error("Invalid PDF: Missing %PDF header");
    }

    // Extract version from header
    const version = extractPdfVersion(bytes);

    self.postMessage(createProgress(taskId, "parse", 50, { operation: "Building object graph" }));

    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    // In a full implementation, we would count actual objects
    const objectCount = countPdfObjects(bytes);

    self.postMessage(createProgress(taskId, "parse", 100, { operation: "Complete" }));

    return createSuccessResponse(request.id, "parse", {
      version,
      objectCount,
      usedBruteForce: false,
    });
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle extractText request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleExtractText(request: ExtractTextRequest): Promise<WorkerResponse> {
  if (!state.initialized) {
    throw new Error("Worker not initialized");
  }

  const { documentId, pageIndices } = request.data;
  const doc = state.documents.get(documentId);

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const taskId = generateTaskId();
  const abortController = new AbortController();
  state.activeTasks.set(taskId, abortController);

  try {
    const pages: Array<{ pageIndex: number; text: string }> = [];
    const totalPages = doc.metadata.pageCount;
    const targetPages = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

    for (let i = 0; i < targetPages.length; i++) {
      if (abortController.signal.aborted) {
        throw new Error("Operation cancelled");
      }

      const pageIndex = targetPages[i];
      const percent = Math.round(((i + 1) / targetPages.length) * 100);

      self.postMessage(
        createProgress(taskId, "extractText", percent, {
          operation: `Extracting page ${pageIndex + 1}`,
          processed: i + 1,
          total: targetPages.length,
        }),
      );

      // In a full implementation, we would:
      // 1. Get the page content stream
      // 2. Parse text operators
      // 3. Apply encoding/font mappings
      // For now, return placeholder
      pages.push({
        pageIndex,
        text: `[Text content of page ${pageIndex + 1}]`,
      });
    }

    log(`Extracted text from ${pages.length} pages of document ${documentId}`);

    return createSuccessResponse(request.id, "extractText", {
      pages,
    });
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle findText request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleFindText(request: FindTextRequest): Promise<WorkerResponse> {
  if (!state.initialized) {
    throw new Error("Worker not initialized");
  }

  const { documentId, pattern, isRegex, caseSensitive, pageIndices } = request.data;
  const doc = state.documents.get(documentId);

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const taskId = generateTaskId();
  const abortController = new AbortController();
  state.activeTasks.set(taskId, abortController);

  try {
    const matches: Array<{
      pageIndex: number;
      text: string;
      offset: number;
      bounds?: readonly [number, number, number, number];
    }> = [];

    const totalPages = doc.metadata.pageCount;
    const targetPages = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

    for (let i = 0; i < targetPages.length; i++) {
      if (abortController.signal.aborted) {
        throw new Error("Operation cancelled");
      }

      const pageIndex = targetPages[i];
      const percent = Math.round(((i + 1) / targetPages.length) * 100);

      self.postMessage(
        createProgress(taskId, "findText", percent, {
          operation: `Searching page ${pageIndex + 1}`,
          processed: i + 1,
          total: targetPages.length,
        }),
      );

      // In a full implementation, we would:
      // 1. Extract text from the page
      // 2. Search using pattern (regex or literal)
      // 3. Calculate bounding boxes for matches
    }

    log(`Found ${matches.length} matches for "${pattern}" in document ${documentId}`);

    return createSuccessResponse(request.id, "findText", {
      matches,
      totalCount: matches.length,
    });
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle cancel request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleCancel(request: CancelRequest): Promise<WorkerResponse> {
  const { taskId } = request.data;
  const abortController = state.activeTasks.get(taskId);

  if (abortController) {
    abortController.abort();
    state.activeTasks.delete(taskId);

    log(`Cancelled task ${taskId}`);

    return createSuccessResponse(request.id, "cancel", {
      taskId,
      wasCancelled: true,
    });
  }

  return createSuccessResponse(request.id, "cancel", {
    taskId,
    wasCancelled: false,
  });
}

/**
 * Handle terminate request.
 */
// oxlint-disable-next-line typescript/require-await -- async for interface consistency
async function handleTerminate(request: TerminateRequest): Promise<WorkerResponse> {
  log("Terminating worker");

  // Cancel all active tasks
  for (const [taskId, controller] of state.activeTasks) {
    controller.abort();
  }
  state.activeTasks.clear();

  // Clear documents
  state.documents.clear();

  // Mark as uninitialized
  state.initialized = false;

  return createSuccessResponse(request.id, "terminate", undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if bytes start with PDF magic number.
 */
function isPdfBytes(bytes: Uint8Array): boolean {
  // Check for %PDF-
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

/**
 * Extract PDF version from header.
 */
function extractPdfVersion(bytes: Uint8Array): string {
  // Find first newline
  let end = 5;
  while (end < bytes.length && end < 20 && bytes[end] !== 0x0a && bytes[end] !== 0x0d) {
    end++;
  }

  const header = new TextDecoder().decode(bytes.slice(0, end));
  const match = header.match(/%PDF-(\d+\.\d+)/);

  return match?.[1] ?? "1.4";
}

/**
 * Extract basic metadata from PDF bytes.
 * This is a simplified implementation - full parsing happens in DocumentParser.
 */
function extractBasicMetadata(bytes: Uint8Array): DocumentState["metadata"] {
  const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 50000)));

  // Count /Type /Page occurrences for rough page count
  // This is a heuristic - real counting requires parsing the page tree
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
  const pageCount = pageMatches?.length ?? 1;

  // Check for encryption
  const isEncrypted = text.includes("/Encrypt");

  // Check for forms
  const hasForms = text.includes("/AcroForm");

  // Check for signatures
  const hasSignatures = text.includes("/Sig") || text.includes("/ByteRange");

  // Try to extract title from /Title
  let title: string | undefined;
  const titleMatch = text.match(/\/Title\s*\(([^)]+)\)/);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Try to extract author from /Author
  let author: string | undefined;
  const authorMatch = text.match(/\/Author\s*\(([^)]+)\)/);
  if (authorMatch) {
    author = authorMatch[1];
  }

  return {
    pageCount,
    title,
    author,
    isEncrypted,
    hasForms,
    hasSignatures,
  };
}

/**
 * Count PDF objects (rough estimate).
 */
function countPdfObjects(bytes: Uint8Array): number {
  const text = new TextDecoder().decode(bytes);
  const matches = text.match(/\d+\s+\d+\s+obj/g);
  return matches?.length ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Setup
// ─────────────────────────────────────────────────────────────────────────────

// Set up message handler
self.onmessage = handleMessage;

// Handle errors
self.onerror = (event: ErrorEvent) => {
  logError("Worker error:", event.message);
};

// Signal ready
log("Worker script loaded");
