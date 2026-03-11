/**
 * PDF.js integration module.
 *
 * This module provides PDF.js-based rendering, text layer, and search
 * functionality for the @libpdf/core viewer.
 *
 * @example
 * ```ts
 * import {
 *   initializePDFJS,
 *   loadDocument,
 *   PDFJSRenderer,
 *   createPDFJSTextLayerBuilder,
 *   createPDFJSSearchEngine,
 * } from '@libpdf/core/viewer/pdfjs';
 *
 * // Initialize PDF.js
 * await initializePDFJS({ workerSrc: '/pdf.worker.js' });
 *
 * // Load a document
 * const document = await loadDocument(pdfBytes);
 *
 * // Create a renderer
 * const renderer = new PDFJSRenderer();
 * await renderer.initialize();
 * renderer.setDocument(document);
 *
 * // Render a page
 * const viewport = renderer.createViewport(612, 792, 0, 1.5);
 * const result = await renderer.render(0, viewport).promise;
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Initialization
  initializePDFJS,
  isPDFJSInitialized,
  getPDFJS,
  // Document loading
  loadDocument,
  loadDocumentFromUrl,
  getCurrentDocument,
  closeDocument,
  // Page operations
  getPage,
  getPageCount,
  createPageViewport,
  // Text content
  getTextContent,
  isTextItem,
  // Types
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type TextContent,
  type TextItem,
  type TextMarkedContent,
  type PDFJSWrapperOptions,
  type LoadDocumentOptions,
} from "./pdfjs-wrapper";

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Renderer
// ─────────────────────────────────────────────────────────────────────────────

export { PDFJSRenderer, createPDFJSRenderer, type PDFJSRendererOptions } from "./pdfjs-renderer";

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Text Layer
// ─────────────────────────────────────────────────────────────────────────────

export {
  buildPDFJSTextLayer,
  PDFJSTextLayerBuilder,
  createPDFJSTextLayerBuilder,
  type PDFJSTextLayerOptions,
  type PDFJSTextLayerResult,
} from "./pdfjs-text-layer";

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Search
// ─────────────────────────────────────────────────────────────────────────────

export {
  searchDocument,
  PDFJSSearchEngine,
  createPDFJSSearchEngine,
  type PDFJSSearchResult,
  type PDFJSSearchOptions,
  type PDFJSSearchState,
  type SearchResultBounds,
} from "./pdfjs-search";
