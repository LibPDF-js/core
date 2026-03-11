/**
 * PDF.js integration wrapper.
 *
 * This module provides a unified interface for loading and managing PDF documents
 * using the PDF.js library. It handles initialization, document loading, and
 * provides access to PDF.js document and page objects.
 */

import type * as PDFJSLib from "pdfjs-dist";
import type {
  PDFDocumentProxy as _PDFDocumentProxy,
  PDFPageProxy as _PDFPageProxy,
  TextContent as _TextContent,
  TextItem as _TextItem,
  TextMarkedContent as _TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";

/**
 * PDF.js library type.
 */
type PDFJSType = typeof PDFJSLib;

/**
 * Re-export PDF.js types for external use.
 */
export type PDFDocumentProxy = _PDFDocumentProxy;
export type PDFPageProxy = _PDFPageProxy;
export type TextContent = _TextContent;
export type TextItem = _TextItem;
export type TextMarkedContent = _TextMarkedContent;

/**
 * Page viewport returned by PDF.js.
 */
export interface PageViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  transform: number[];
  convertToViewportPoint(x: number, y: number): [number, number];
  convertToViewportRectangle(rect: number[]): number[];
  convertToPdfPoint(x: number, y: number): number[];
}

/**
 * Options for initializing the PDF.js wrapper.
 */
export interface PDFJSWrapperOptions {
  /**
   * URL to the PDF.js worker script.
   * If not provided, the worker will run in the main thread.
   */
  workerSrc?: string;

  /**
   * URL to the cmaps directory for CJK text support.
   */
  cMapUrl?: string;

  /**
   * Whether to pack cmaps (compress them).
   * @default true
   */
  cMapPacked?: boolean;

  /**
   * Whether to enable range requests for PDF loading.
   * @default true
   */
  enableRangeRequests?: boolean;
}

/**
 * Options for loading a PDF document.
 */
export interface LoadDocumentOptions {
  /**
   * Password for encrypted PDFs.
   */
  password?: string;

  /**
   * Whether to disable automatic font loading.
   * @default false
   */
  disableFontFace?: boolean;

  /**
   * Maximum image size in pixels (width * height).
   * Images larger than this will be downscaled.
   */
  maxImageSize?: number;
}

/**
 * Wrapper state.
 */
interface WrapperState {
  initialized: boolean;
  pdfjs: PDFJSType | null;
  currentDocument: PDFDocumentProxy | null;
}

/**
 * Global wrapper state.
 */
const state: WrapperState = {
  initialized: false,
  pdfjs: null,
  currentDocument: null,
};

/**
 * Initialize the PDF.js wrapper.
 *
 * This must be called before any other PDF.js operations.
 * It dynamically imports the PDF.js library and configures it.
 *
 * @param options - Configuration options for PDF.js
 */
export async function initializePDFJS(options: PDFJSWrapperOptions = {}): Promise<void> {
  if (state.initialized) {
    return;
  }

  // Dynamically import PDF.js
  const pdfjs = await import("pdfjs-dist");
  state.pdfjs = pdfjs;

  // Configure worker
  if (options.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc;
  } else {
    // Use CDN fallback with the installed version
    // The version property may not be available in all builds
    const version = (pdfjs as { version?: string }).version || "4.10.38";
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  }

  state.initialized = true;
}

/**
 * Check if PDF.js has been initialized.
 */
export function isPDFJSInitialized(): boolean {
  return state.initialized;
}

/**
 * Get the PDF.js library instance.
 *
 * @throws Error if PDF.js has not been initialized
 */
export function getPDFJS(): PDFJSType {
  if (!state.pdfjs) {
    throw new Error("PDF.js has not been initialized. Call initializePDFJS first.");
  }
  return state.pdfjs;
}

/**
 * Load a PDF document from bytes.
 *
 * @param data - The PDF document as a Uint8Array
 * @param options - Loading options
 * @returns The loaded PDF document proxy
 */
export async function loadDocument(
  data: Uint8Array,
  options: LoadDocumentOptions = {},
): Promise<PDFDocumentProxy> {
  const pdfjs = getPDFJS();

  // Create a copy of the data to avoid ArrayBuffer detachment issues
  // when the worker transfers the buffer
  const dataCopy = new Uint8Array(data);

  const loadingTask = pdfjs.getDocument({
    data: dataCopy,
    password: options.password,
    disableFontFace: options.disableFontFace,
    maxImageSize: options.maxImageSize,
  });

  const document = await loadingTask.promise;
  state.currentDocument = document;
  return document;
}

/**
 * Load a PDF document from a URL.
 *
 * @param url - The URL of the PDF document
 * @param options - Loading options
 * @returns The loaded PDF document proxy
 */
export async function loadDocumentFromUrl(
  url: string,
  options: LoadDocumentOptions = {},
): Promise<PDFDocumentProxy> {
  const pdfjs = getPDFJS();

  const loadingTask = pdfjs.getDocument({
    url,
    password: options.password,
    disableFontFace: options.disableFontFace,
    maxImageSize: options.maxImageSize,
  });

  const document = await loadingTask.promise;
  state.currentDocument = document;
  return document;
}

/**
 * Get the currently loaded document.
 *
 * @returns The current document or null if none is loaded
 */
export function getCurrentDocument(): PDFDocumentProxy | null {
  return state.currentDocument;
}

/**
 * Close the currently loaded document and release resources.
 */
export async function closeDocument(): Promise<void> {
  if (state.currentDocument) {
    await state.currentDocument.destroy();
    state.currentDocument = null;
  }
}

/**
 * Get a page from the current document.
 *
 * @param pageIndex - 0-based page index
 * @returns The page proxy
 * @throws Error if no document is loaded or page index is invalid
 */
export async function getPage(pageIndex: number): Promise<PDFPageProxy> {
  if (!state.currentDocument) {
    throw new Error("No document is loaded. Call loadDocument first.");
  }

  // PDF.js uses 1-based page numbers
  return state.currentDocument.getPage(pageIndex + 1);
}

/**
 * Get the number of pages in the current document.
 *
 * @returns The number of pages
 * @throws Error if no document is loaded
 */
export function getPageCount(): number {
  if (!state.currentDocument) {
    throw new Error("No document is loaded. Call loadDocument first.");
  }
  return state.currentDocument.numPages;
}

/**
 * Create a viewport for a page.
 *
 * @param page - The PDF.js page proxy
 * @param scale - The scale factor (default: 1)
 * @param rotation - Additional rotation in degrees (default: 0)
 * @returns The viewport for rendering
 */
export function createPageViewport(page: PDFPageProxy, scale = 1, rotation = 0): PageViewport {
  return page.getViewport({ scale, rotation });
}

/**
 * Get text content from a page.
 *
 * @param page - The PDF.js page proxy
 * @returns The text content of the page
 */
export async function getTextContent(page: PDFPageProxy): Promise<TextContent> {
  return page.getTextContent();
}

/**
 * Check if a text content item is a TextItem (not marked content).
 */
export function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item;
}
