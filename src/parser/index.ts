/**
 * PDF Parsing Module
 *
 * Provides both synchronous and worker-based asynchronous parsing APIs.
 *
 * - Use `parseDocument()` for synchronous parsing on the main thread
 * - Use `ParsingWorkerHost` for async parsing in a Web Worker
 *
 * @example Synchronous parsing
 * ```typescript
 * import { parseDocument } from '@libpdf/core/parser';
 *
 * const bytes = await fetch('document.pdf').then(r => r.arrayBuffer());
 * const doc = parseDocument(new Uint8Array(bytes));
 * console.log(`PDF version: ${doc.version}`);
 * console.log(`Page count: ${doc.getPageCount()}`);
 * ```
 *
 * @example Worker-based parsing
 * ```typescript
 * import { createParsingWorkerHost } from '@libpdf/core/parser';
 *
 * const host = createParsingWorkerHost({
 *   workerUrl: '/parsing-worker.js',
 *   onProgress: (progress) => console.log(`${progress.percent}%`),
 * });
 *
 * await host.initialize();
 * const result = await host.parse(pdfBytes);
 * console.log(`Parsed ${result.info.pageCount} pages`);
 * ```
 */

// Re-export synchronous parsing API
export { DocumentParser, type ParsedDocument, type ParseOptions } from "./document-parser";

// Re-export xref types
export type { XRefEntry, XRefData } from "./xref-parser";

// Re-export errors
export {
  RecoverableParseError,
  UnrecoverableParseError,
  StructureError,
  XRefParseError,
  ObjectParseError,
  StreamDecodeError,
} from "./errors";

// Re-export worker-based parsing API
export {
  ParsingWorkerHost,
  createParsingWorkerHost,
  isWorkerSupported,
  type CancellableParseOperation,
  type ExtractOptions,
  type ExtractTextResult,
  type ParseResult,
  type ParseOptions as WorkerParseOptions,
  type ParsingWorkerHostOptions,
  type ParsingWorkerState,
} from "../worker/parsing-worker-host";

// Re-export progress tracking
export {
  ProgressTracker,
  createProgressTracker,
  DEFAULT_PROGRESS_INTERVAL,
  type ProgressTrackerOptions,
} from "../worker/progress-tracker";

// Re-export parsing types
export type {
  DocumentMetadata,
  ExtractedPageText,
  ParsedDocumentInfo,
  ParsingErrorCode,
  ParsingPhase,
  ParsingProgress,
  ParsingProgressCallback,
  ParsingWorkerError,
  TextItem,
  WorkerParseOptions as ParsingOptions,
} from "../worker/parsing-types";

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

import { Scanner } from "#src/io/scanner";

import { DocumentParser, type ParsedDocument, type ParseOptions } from "./document-parser";

/**
 * Parse a PDF document synchronously.
 *
 * This is a convenience wrapper around DocumentParser for simple use cases.
 * For large documents, consider using the worker-based API to avoid blocking
 * the main thread.
 *
 * @param bytes - PDF file bytes
 * @param options - Parse options
 * @returns Parsed document
 *
 * @example
 * ```typescript
 * const bytes = await loadPDF('document.pdf');
 * const doc = parseDocument(bytes);
 *
 * console.log(`Version: ${doc.version}`);
 * console.log(`Pages: ${doc.getPageCount()}`);
 * console.log(`Encrypted: ${doc.isEncrypted}`);
 *
 * // Access catalog
 * const catalog = doc.getCatalog();
 * ```
 */
export function parseDocument(bytes: Uint8Array, options?: ParseOptions): ParsedDocument {
  const scanner = new Scanner(bytes);
  const parser = new DocumentParser(scanner, options);
  return parser.parse();
}

/**
 * Parse a PDF document asynchronously using a Web Worker.
 *
 * This function provides a simple one-shot API for worker-based parsing.
 * For multiple documents or advanced control, use `createParsingWorkerHost()`.
 *
 * @param bytes - PDF file bytes
 * @param workerUrl - URL to the parsing worker script
 * @param options - Parse options including progress callback
 * @returns Parsed document information
 *
 * @example
 * ```typescript
 * const result = await parseDocumentAsync(bytes, '/parsing-worker.js', {
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.percent}%`);
 *   },
 * });
 *
 * console.log(`Parsed ${result.info.pageCount} pages in ${result.parsingTime}ms`);
 * ```
 */
export async function parseDocumentAsync(
  bytes: Uint8Array,
  workerUrl: string | URL,
  options?: {
    password?: string;
    lenient?: boolean;
    onProgress?: (progress: import("../worker/parsing-types").ParsingProgress) => void;
    timeout?: number;
  },
): Promise<import("../worker/parsing-worker-host").ParseResult> {
  const { createParsingWorkerHost } = await import("../worker/parsing-worker-host");

  const host = createParsingWorkerHost({
    workerUrl,
    onProgress: options?.onProgress,
  });

  try {
    await host.initialize();

    return await host.parse(bytes, {
      password: options?.password,
      lenient: options?.lenient,
      timeout: options?.timeout,
    });
  } finally {
    await host.terminate();
  }
}
