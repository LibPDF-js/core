/**
 * Parsing worker entry point.
 *
 * This script runs inside a Web Worker to handle LibPDF document parsing
 * and text extraction operations off the main thread. It communicates with
 * the main thread via message passing and provides progress updates every
 * 500ms during parsing operations.
 *
 * Usage:
 *   // Bundle this file separately and serve as parsing-worker.js
 *   // The main thread creates a worker pointing to this file
 */

/// <reference lib="webworker" />

import { Scanner } from "#src/io/scanner";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { DocumentParser, type ParsedDocument } from "#src/parser/document-parser";

import { type MessageId, type TaskId, isRequest } from "./messages";
import {
  type CancelParsingRequest,
  type DocumentMetadata,
  type ExtractTextRequest,
  type ParseDocumentRequest,
  type ParsedDocumentInfo,
  type ParsingMainToWorkerMessage,
  type ParsingWorkerError,
  type ParsingWorkerResponse,
  createParsingError,
} from "./parsing-types";
import { createProgressTracker, type ProgressTracker } from "./progress-tracker";

// Worker global scope
declare const self: DedicatedWorkerGlobalScope;

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

interface WorkerState {
  initialized: boolean;
  verbose: boolean;
  name: string;
  documents: Map<string, DocumentState>;
  activeTasks: Map<TaskId, TaskState>;
}

interface DocumentState {
  documentId: string;
  bytes: Uint8Array;
  parsed: ParsedDocument;
  info: ParsedDocumentInfo;
}

interface TaskState {
  taskId: TaskId;
  abortController: AbortController;
  progressTracker: ProgressTracker | null;
  startTime: number;
}

const state: WorkerState = {
  initialized: false,
  verbose: false,
  name: "parsing-worker",
  documents: new Map(),
  activeTasks: new Map(),
};

// Document ID counter
let documentCounter = 0;

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
function handleMessage(event: MessageEvent<ParsingMainToWorkerMessage>): void {
  const message = event.data;

  // Handle standard worker messages (init, terminate)
  if (isRequest(message)) {
    handleStandardRequest(message)
      .then(response => {
        if (response) {
          self.postMessage(response);
        }
      })
      .catch(error => {
        const errorResponse: ParsingWorkerResponse = {
          type: "response",
          id: (message as { id: string }).id,
          requestType: (message as { requestType: string }).requestType as "parseDocument",
          status: "error",
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            recoverable: false,
          },
        };
        self.postMessage(errorResponse);
      });
    return;
  }

  // Handle parsing-specific messages
  if (isParsingRequest(message)) {
    handleParsingRequest(message)
      .then(response => {
        self.postMessage(response);
      })
      .catch(error => {
        const errorResponse = createParsingErrorResponse(
          (message as { id: string }).id,
          (message as { requestType: string }).requestType as
            | "parseDocument"
            | "extractText"
            | "cancelParsing",
          error,
        );
        self.postMessage(errorResponse);
      });
  }
}

/**
 * Check if message is a parsing-specific request.
 */
function isParsingRequest(
  message: unknown,
): message is ParseDocumentRequest | ExtractTextRequest | CancelParsingRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const msg = message as { type?: string; requestType?: string };
  return (
    msg.type === "request" &&
    (msg.requestType === "parseDocument" ||
      msg.requestType === "extractText" ||
      msg.requestType === "cancelParsing")
  );
}

/**
 * Handle standard worker requests (init, terminate).
 */
async function handleStandardRequest(request: {
  type: string;
  id: MessageId;
  requestType: string;
  data?: unknown;
}): Promise<ParsingWorkerResponse | null> {
  switch (request.requestType) {
    case "init":
      return handleInit(
        request.id,
        request.data as { verbose?: boolean; name?: string } | undefined,
      );
    case "terminate":
      return handleTerminate(request.id);
    default:
      return null;
  }
}

/**
 * Route parsing requests to appropriate handlers.
 */
async function handleParsingRequest(
  request: ParseDocumentRequest | ExtractTextRequest | CancelParsingRequest,
): Promise<ParsingWorkerResponse> {
  switch (request.requestType) {
    case "parseDocument":
      return handleParseDocument(request);
    case "extractText":
      return handleExtractText(request);
    case "cancelParsing":
      return handleCancelParsing(request);
    default:
      throw new Error(
        `Unknown parsing request type: ${(request as { requestType: string }).requestType}`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Request Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle init request.
 */
function handleInit(
  id: MessageId,
  data?: { verbose?: boolean; name?: string },
): ParsingWorkerResponse {
  state.verbose = data?.verbose ?? false;
  state.name = data?.name ?? "parsing-worker";
  state.initialized = true;

  log("Parsing worker initialized");

  return {
    type: "response",
    id,
    requestType: "parseDocument",
    status: "success",
    data: {
      documentId: "",
      info: {
        version: "1.0.0",
        pageCount: 0,
        isEncrypted: false,
        isAuthenticated: true,
        recoveredViaBruteForce: false,
        metadata: {},
        warnings: [],
        objectCount: 0,
        hasForms: false,
        hasSignatures: false,
        hasLayers: false,
      },
      parsingTime: 0,
    },
  };
}

/**
 * Handle terminate request.
 */
function handleTerminate(id: MessageId): ParsingWorkerResponse {
  log("Terminating parsing worker");

  // Cancel all active tasks
  for (const [taskId, taskState] of state.activeTasks) {
    taskState.abortController.abort();
    taskState.progressTracker?.cancel();
  }
  state.activeTasks.clear();

  // Clear documents
  state.documents.clear();

  // Mark as uninitialized
  state.initialized = false;

  return {
    type: "response",
    id,
    requestType: "cancelParsing",
    status: "success",
    data: {
      taskId: "",
      wasCancelled: true,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Request Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle parseDocument request.
 */
async function handleParseDocument(request: ParseDocumentRequest): Promise<ParsingWorkerResponse> {
  const startTime = Date.now();
  const { bytes, taskId, options } = request.data;

  // Create abort controller and progress tracker
  const abortController = new AbortController();
  const progressTracker = createProgressTracker({
    taskId,
    interval: options?.progressInterval ?? 500,
    onProgress: msg => self.postMessage(msg),
    totalBytes: bytes.length,
  });

  // Register task
  const taskState: TaskState = {
    taskId,
    abortController,
    progressTracker,
    startTime,
  };
  state.activeTasks.set(taskId, taskState);

  try {
    // Check for abort
    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    // Start parsing phases
    progressTracker.startPhase("header", "Reading PDF header");

    // Validate PDF bytes
    if (!isPdfBytes(bytes)) {
      throw createParsingError(new Error("Invalid PDF: Missing %PDF header"), "INVALID_PDF", false);
    }

    progressTracker.update(100, "PDF header valid");

    // Check for abort
    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    progressTracker.startPhase("xref", "Parsing cross-reference table");

    // Create scanner and parser
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner, {
      lenient: options?.lenient ?? true,
      credentials: options?.password,
    });

    progressTracker.update(25, "Scanner initialized");

    // Check for abort
    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    progressTracker.update(50, "Starting document parse");

    // Parse the document
    const parsed = parser.parse();

    progressTracker.startPhase("trailer", "Processing trailer");
    progressTracker.update(100, "Trailer processed");

    // Check for abort
    if (abortController.signal.aborted) {
      throw new Error("Operation cancelled");
    }

    progressTracker.startPhase("objects", "Loading objects");

    // Extract document info
    const objectCount = parsed.xref.size;
    progressTracker.updateItems(objectCount, objectCount, `Loaded ${objectCount} objects`);

    progressTracker.startPhase("catalog", "Reading document catalog");

    const catalog = parsed.getCatalog();
    progressTracker.update(100, "Catalog loaded");

    progressTracker.startPhase("pages", "Building page tree");

    const pages = parsed.getPages();
    const pageCount = pages.length;
    progressTracker.updateItems(pageCount, pageCount, `Found ${pageCount} pages`);

    // Extract metadata
    const metadata = extractMetadata(parsed, catalog);

    // Check for various features
    const hasForms = hasAcroForm(catalog);
    const hasSignatures = hasSignatureField(parsed, catalog);
    const hasLayers = hasOptionalContent(catalog);

    // Generate document ID
    const documentId = `parsed-doc-${++documentCounter}-${Date.now()}`;

    // Build document info
    const info: ParsedDocumentInfo = {
      version: parsed.version,
      pageCount,
      isEncrypted: parsed.isEncrypted,
      isAuthenticated: parsed.isAuthenticated,
      recoveredViaBruteForce: parsed.recoveredViaBruteForce,
      metadata,
      warnings: parsed.warnings,
      objectCount,
      hasForms,
      hasSignatures,
      hasLayers,
    };

    // Store document state
    const docState: DocumentState = {
      documentId,
      bytes,
      parsed,
      info,
    };
    state.documents.set(documentId, docState);

    progressTracker.complete();

    const parsingTime = Date.now() - startTime;
    log(`Parsed document ${documentId}: ${pageCount} pages in ${parsingTime}ms`);

    return {
      type: "response",
      id: request.id,
      requestType: "parseDocument",
      status: "success",
      data: {
        documentId,
        info,
        parsingTime,
      },
    };
  } catch (error) {
    progressTracker.cancel();

    if (abortController.signal.aborted) {
      return {
        type: "response",
        id: request.id,
        requestType: "parseDocument",
        status: "cancelled",
      };
    }

    throw error;
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle extractText request.
 */
async function handleExtractText(request: ExtractTextRequest): Promise<ParsingWorkerResponse> {
  const startTime = Date.now();
  const { documentId, taskId, pageIndices } = request.data;

  // Get document
  const doc = state.documents.get(documentId);
  if (!doc) {
    throw createParsingError(
      new Error(`Document not found: ${documentId}`),
      "INTERNAL_ERROR",
      false,
    );
  }

  // Create abort controller and progress tracker
  const abortController = new AbortController();
  const progressTracker = createProgressTracker({
    taskId,
    interval: 500,
    onProgress: msg => self.postMessage(msg),
  });

  // Register task
  const taskState: TaskState = {
    taskId,
    abortController,
    progressTracker,
    startTime,
  };
  state.activeTasks.set(taskId, taskState);

  try {
    progressTracker.startPhase("text", "Extracting text");

    const allPages = doc.parsed.getPages();
    const targetIndices = pageIndices ?? allPages.map((_, i) => i);
    const pages: Array<{ pageIndex: number; text: string }> = [];

    for (let i = 0; i < targetIndices.length; i++) {
      if (abortController.signal.aborted) {
        throw new Error("Operation cancelled");
      }

      const pageIndex = targetIndices[i];
      progressTracker.updateItems(i + 1, targetIndices.length, `Extracting page ${pageIndex + 1}`);

      // Get page reference
      const pageRef = allPages[pageIndex];
      if (!pageRef) {
        pages.push({ pageIndex, text: "" });
        continue;
      }

      // Get page object
      const pageObj = doc.parsed.getObject(pageRef);
      if (!(pageObj instanceof PdfDict)) {
        pages.push({ pageIndex, text: "" });
        continue;
      }

      // Extract text from page (simplified - full implementation would use TextExtractor)
      const text = extractPageText(doc.parsed, pageObj);
      pages.push({ pageIndex, text });
    }

    progressTracker.complete();

    const extractionTime = Date.now() - startTime;
    log(`Extracted text from ${pages.length} pages in ${extractionTime}ms`);

    return {
      type: "response",
      id: request.id,
      requestType: "extractText",
      status: "success",
      data: {
        pages,
        extractionTime,
      },
    };
  } catch (error) {
    progressTracker.cancel();

    if (abortController.signal.aborted) {
      return {
        type: "response",
        id: request.id,
        requestType: "extractText",
        status: "cancelled",
      };
    }

    throw error;
  } finally {
    state.activeTasks.delete(taskId);
  }
}

/**
 * Handle cancelParsing request.
 */
function handleCancelParsing(request: CancelParsingRequest): ParsingWorkerResponse {
  const { taskId } = request.data;
  const taskState = state.activeTasks.get(taskId);

  if (taskState) {
    taskState.abortController.abort();
    taskState.progressTracker?.cancel();
    state.activeTasks.delete(taskId);

    log(`Cancelled task ${taskId}`);

    return {
      type: "response",
      id: request.id,
      requestType: "cancelParsing",
      status: "success",
      data: {
        taskId,
        wasCancelled: true,
      },
    };
  }

  return {
    type: "response",
    id: request.id,
    requestType: "cancelParsing",
    status: "success",
    data: {
      taskId,
      wasCancelled: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if bytes start with PDF magic number.
 */
function isPdfBytes(bytes: Uint8Array): boolean {
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
 * Extract metadata from parsed document.
 */
function extractMetadata(parsed: ParsedDocument, catalog: PdfDict | null): DocumentMetadata {
  // Build metadata object directly with values
  const result: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  } = {};

  // Try to get Info dictionary from trailer
  const infoRef = parsed.trailer.getRef("Info");
  if (infoRef) {
    const info = parsed.getObject(infoRef);
    if (info instanceof PdfDict) {
      const title = info.getString("Title");
      if (title) {
        result.title = title.toString();
      }

      const author = info.getString("Author");
      if (author) {
        result.author = author.toString();
      }

      const subject = info.getString("Subject");
      if (subject) {
        result.subject = subject.toString();
      }

      const keywords = info.getString("Keywords");
      if (keywords) {
        result.keywords = keywords.toString();
      }

      const creator = info.getString("Creator");
      if (creator) {
        result.creator = creator.toString();
      }

      const producer = info.getString("Producer");
      if (producer) {
        result.producer = producer.toString();
      }

      const creationDate = info.getString("CreationDate");
      if (creationDate) {
        result.creationDate = creationDate.toString();
      }

      const modDate = info.getString("ModDate");
      if (modDate) {
        result.modificationDate = modDate.toString();
      }
    }
  }

  return result;
}

/**
 * Check if document has AcroForm.
 */
function hasAcroForm(catalog: PdfDict | null): boolean {
  if (!catalog) {
    return false;
  }
  return catalog.has("AcroForm");
}

/**
 * Check if document has signature fields.
 */
function hasSignatureField(parsed: ParsedDocument, catalog: PdfDict | null): boolean {
  if (!catalog) {
    return false;
  }

  const acroFormRef = catalog.getRef("AcroForm");
  if (!acroFormRef) {
    return false;
  }

  const acroForm = parsed.getObject(acroFormRef);
  if (!(acroForm instanceof PdfDict)) {
    return false;
  }

  // Check SigFlags using getNumber
  const sigFlagsNum = acroForm.getNumber("SigFlags");
  if (sigFlagsNum && sigFlagsNum.value > 0) {
    return true;
  }

  return false;
}

/**
 * Check if document has optional content (layers).
 */
function hasOptionalContent(catalog: PdfDict | null): boolean {
  if (!catalog) {
    return false;
  }
  return catalog.has("OCProperties");
}

/**
 * Extract text from a page (simplified implementation).
 */
function extractPageText(parsed: ParsedDocument, pageDict: PdfDict): string {
  // Get content stream(s)
  const contentsRef = pageDict.get("Contents");
  if (!contentsRef) {
    return "";
  }

  // This is a simplified implementation
  // Full text extraction would use the TextExtractor class
  // which handles fonts, encodings, and text positioning

  let contentData: Uint8Array | null = null;

  if (contentsRef instanceof PdfRef) {
    const content = parsed.getObject(contentsRef);
    if (content instanceof PdfStream) {
      contentData = content.getDecodedData();
    }
  } else if (contentsRef instanceof PdfStream) {
    contentData = contentsRef.getDecodedData();
  }

  if (!contentData) {
    return "";
  }

  // Simple text extraction: look for text between parentheses or angle brackets
  const text = new TextDecoder().decode(contentData);
  const textParts: string[] = [];

  // Match text in parentheses (literal strings)
  const literalRegex = /\(([^)]*)\)/g;
  let match;
  while ((match = literalRegex.exec(text)) !== null) {
    const content = match[1];
    // Basic escape handling
    const unescaped = content
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (unescaped.trim()) {
      textParts.push(unescaped);
    }
  }

  // Match hex strings
  const hexRegex = /<([0-9A-Fa-f]+)>/g;
  while ((match = hexRegex.exec(text)) !== null) {
    const hex = match[1];
    if (hex.length % 2 === 0) {
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code >= 32 && code < 127) {
          decoded += String.fromCharCode(code);
        }
      }
      if (decoded.trim()) {
        textParts.push(decoded);
      }
    }
  }

  return textParts.join(" ");
}

/**
 * Create an error response for parsing operations.
 */
function createParsingErrorResponse(
  id: MessageId,
  requestType: "parseDocument" | "extractText" | "cancelParsing",
  error: unknown,
): ParsingWorkerResponse {
  const workerError: ParsingWorkerError =
    error instanceof Error
      ? createParsingError(error, "INTERNAL_ERROR", false)
      : {
          code: "INTERNAL_ERROR",
          message: String(error),
          recoverable: false,
        };

  return {
    type: "response",
    id,
    requestType,
    status: "error",
    error: workerError,
  } as ParsingWorkerResponse;
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
log("Parsing worker script loaded");
