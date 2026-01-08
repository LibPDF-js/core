/**
 * High-level PDF document API.
 *
 * Provides a user-friendly interface for loading, modifying, and saving PDFs.
 * Wraps the low-level parsing and writing infrastructure.
 */

import { deflate } from "pako";
import type { AddAttachmentOptions, AttachmentInfo } from "#src/attachments/types";
import { hasChanges } from "#src/document/change-collector";
import { isLinearizationDict } from "#src/document/linearization";
import { ObjectCopier } from "#src/document/object-copier";
import { ObjectRegistry } from "#src/document/object-registry";
import type { EmbeddedFont, EmbedFontOptions } from "#src/fonts/embedded-font";
import { resolvePageSize } from "#src/helpers/page-size";
import { checkIncrementalSaveBlocker, type IncrementalSaveBlocker } from "#src/helpers/save-utils";
import { isJpeg, parseJpegHeader } from "#src/images/jpeg";
import { PDFImage } from "#src/images/pdf-image";
import { isPng, parsePng } from "#src/images/png";
import { Scanner } from "#src/io/scanner";
import * as LayerUtils from "#src/layers/index";
import type { FlattenLayersResult, LayerInfo } from "#src/layers/types";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { DocumentParser, type ParseOptions } from "#src/parser/document-parser";
import { XRefParser } from "#src/parser/xref-parser";
import type { SignOptions, SignResult } from "#src/signatures/types";
import { writeComplete, writeIncremental } from "#src/writer/pdf-writer";
import { PDFAttachments } from "./pdf-attachments";
import { PDFCatalog } from "./pdf-catalog";
import { type DocumentInfo, PDFContext } from "./pdf-context";
import { PDFEmbeddedPage } from "./pdf-embedded-page";
import { PDFFonts } from "./pdf-fonts";
import { PDFForm } from "./pdf-form";
import { PDFPage } from "./pdf-page";
import { PDFPageTree } from "./pdf-page-tree";
import { PDFSignature } from "./pdf-signature";

/**
 * Options for loading a PDF.
 */
export interface LoadOptions extends ParseOptions {
  // Inherits credentials, lenient from ParseOptions
}

/**
 * Options for saving a PDF.
 */
export interface SaveOptions {
  /** Save incrementally (append only). Default: false */
  incremental?: boolean;

  /** Use XRef stream instead of table. Default: matches original format */
  useXRefStream?: boolean;

  /**
   * Subset embedded fonts to include only used glyphs.
   *
   * Reduces file size but takes additional processing time.
   * Fonts used in form fields are never subsetted (users may type any character).
   *
   * @default false
   */
  subsetFonts?: boolean;
}

/**
 * Options for adding a new page.
 */
export interface AddPageOptions {
  /** Page width in points (default: 612 = US Letter) */
  width?: number;
  /** Page height in points (default: 792 = US Letter) */
  height?: number;
  /** Use a preset size */
  size?: "letter" | "a4" | "legal";
  /** Page orientation (default: "portrait") */
  orientation?: "portrait" | "landscape";
  /** Rotation in degrees (0, 90, 180, 270) */
  rotate?: number;
  /** Insert at index instead of appending */
  insertAt?: number;
}

/**
 * Options for copying pages from another document.
 */
export interface CopyPagesOptions {
  /** Insert copied pages at this index (default: append to end) */
  insertAt?: number;
  /** Include annotations (default: true) */
  includeAnnotations?: boolean;
  /** Include article thread beads (default: false) */
  includeBeads?: boolean;
  /** Include thumbnail images (default: false) */
  includeThumbnails?: boolean;
  /** Include structure tree references (default: false) */
  includeStructure?: boolean;
}

/**
 * Options for merging multiple PDFs.
 */
export interface MergeOptions extends LoadOptions {
  /** Include annotations from source documents (default: true) */
  includeAnnotations?: boolean;
}

/**
 * Options for extracting pages to a new document.
 */
export interface ExtractPagesOptions {
  /** Include annotations (default: true) */
  includeAnnotations?: boolean;
}

/**
 * High-level PDF document class.
 *
 * @example
 * ```typescript
 * // Load a PDF
 * const pdf = await PDF.load(bytes);
 *
 * // Modify it
 * const catalog = await pdf.getCatalog();
 * catalog.set("ModDate", PdfString.fromString("D:20240101"));
 *
 * // Save with incremental update (preserves signatures)
 * const saved = await pdf.save({ incremental: true });
 *
 * // Or save with full rewrite
 * const rewritten = await pdf.save();
 * ```
 */
export class PDF {
  /** Central context for document operations */
  private ctx: PDFContext;

  private originalBytes: Uint8Array;
  private originalXRefOffset: number;

  /** Font operations manager (created lazily) */
  private _fonts: PDFFonts | null = null;

  /** Attachment operations manager (created lazily) */
  private _attachments: PDFAttachments | null = null;

  /** Cached form (loaded lazily via getForm()) */
  private _form: PDFForm | null | undefined;

  /** Whether this document was recovered via brute-force parsing */
  readonly recoveredViaBruteForce: boolean;

  /** Whether this document is linearized */
  readonly isLinearized: boolean;

  /** Whether the original document uses XRef streams (PDF 1.5+) */
  readonly usesXRefStreams: boolean;

  /** Warnings from parsing and operations */
  get warnings(): string[] {
    return this.ctx.warnings;
  }

  /**
   * Access the internal PDF context.
   *
   * @internal Used by related API classes (PDFSignature, etc.)
   */
  get context(): PDFContext {
    return this.ctx;
  }

  private constructor(
    ctx: PDFContext,
    originalBytes: Uint8Array,
    originalXRefOffset: number,
    options: {
      recoveredViaBruteForce: boolean;
      isLinearized: boolean;
      usesXRefStreams: boolean;
    },
  ) {
    this.ctx = ctx;
    this.originalBytes = originalBytes;
    this.originalXRefOffset = originalXRefOffset;
    this.recoveredViaBruteForce = options.recoveredViaBruteForce;
    this.isLinearized = options.isLinearized;
    this.usesXRefStreams = options.usesXRefStreams;

    // Set up font resolver for the context
    // Refs are pre-allocated, so this is synchronous
    this.ctx.setFontRefResolver(font => {
      return this.fonts.getRef(font);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Load a PDF from bytes.
   *
   * @param bytes - The PDF file bytes
   * @param options - Load options (credentials, lenient mode)
   * @returns The loaded PDF document
   * @throws {Error} If the document has no catalog (missing /Root in trailer)
   * @throws {Error} If parsing fails and lenient mode is disabled
   */
  static async load(bytes: Uint8Array, options?: LoadOptions): Promise<PDF> {
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner, options);

    const parsed = await parser.parse();

    // Create registry from xref
    const registry = new ObjectRegistry(parsed.xref);

    // Detect linearization by checking first object
    let isLinearized = false;

    try {
      // Find the first object (lowest object number)
      const firstObjNum = Math.min(...parsed.xref.keys());

      if (firstObjNum > 0) {
        const firstObj = await parsed.getObject(PdfRef.of(firstObjNum, 0));

        if (firstObj instanceof PdfDict && isLinearizationDict(firstObj)) {
          isLinearized = true;
        }
      }
    } catch {
      // Ignore errors during linearization detection
    }

    // Find original xref offset and detect format
    const xrefParser = new XRefParser(scanner);
    let originalXRefOffset: number;
    let usesXRefStreams = false;

    try {
      originalXRefOffset = xrefParser.findStartXRef();
      // Detect if the original uses XRef streams
      const format = xrefParser.detectXRefFormat(originalXRefOffset);
      usesXRefStreams = format === true;
    } catch {
      originalXRefOffset = 0;
    }
    // Set up resolver on registry before loading anything
    registry.setResolver(ref => parsed.getObject(ref));

    // Load catalog through registry so it's tracked for changes
    const rootRef = parsed.trailer.getRef("Root");

    if (!rootRef) {
      throw new Error("Document has no catalog (missing /Root in trailer)");
    }

    const catalogDict = await registry.resolve(rootRef);

    if (!catalogDict || !(catalogDict instanceof PdfDict)) {
      throw new Error("Document has no catalog");
    }

    const pdfCatalog = new PDFCatalog(catalogDict, registry);
    const pagesRef = catalogDict.getRef("Pages");
    const pages = pagesRef
      ? await PDFPageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PDFPageTree.empty();

    // Extract document info from parsed document
    const info: DocumentInfo = {
      version: parsed.version,
      isEncrypted: parsed.isEncrypted,
      isAuthenticated: parsed.isAuthenticated,
      trailer: parsed.trailer,
    };

    const ctx = new PDFContext(registry, pdfCatalog, pages, info);

    return new PDF(ctx, bytes, originalXRefOffset, {
      recoveredViaBruteForce: parsed.recoveredViaBruteForce,
      isLinearized,
      usesXRefStreams,
    });
  }

  /**
   * Reload the PDF from new bytes.
   *
   * Updates internal state after an incremental save. This allows
   * continued use of the PDF instance after operations like signing.
   *
   * @param bytes - The new PDF bytes to reload from
   * @throws {Error} If the document has no catalog
   */
  async reload(bytes: Uint8Array): Promise<void> {
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);

    const parsed = await parser.parse();

    // Create new registry from xref
    const registry = new ObjectRegistry(parsed.xref);
    registry.setResolver(ref => parsed.getObject(ref));

    // Find xref offset
    const xrefParser = new XRefParser(scanner);
    let xrefOffset: number;

    try {
      xrefOffset = xrefParser.findStartXRef();
    } catch {
      xrefOffset = 0;
    }

    // Load catalog
    const rootRef = parsed.trailer.getRef("Root");

    if (!rootRef) {
      throw new Error("Document has no catalog");
    }

    const catalogDict = await registry.resolve(rootRef);

    if (!(catalogDict instanceof PdfDict)) {
      throw new Error("Document has no catalog");
    }

    const pdfCatalog = new PDFCatalog(catalogDict, registry);
    const pagesRef = catalogDict.getRef("Pages");
    const pages = pagesRef
      ? await PDFPageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PDFPageTree.empty();

    const info: DocumentInfo = {
      version: parsed.version,
      isEncrypted: parsed.isEncrypted,
      isAuthenticated: parsed.isAuthenticated,
      trailer: parsed.trailer,
    };

    // Update internal state
    this.ctx = new PDFContext(registry, pdfCatalog, pages, info);
    this.originalBytes = bytes;
    this.originalXRefOffset = xrefOffset;

    // Clear cached form so it gets reloaded
    this._form = undefined;
  }

  /**
   * Create a new empty PDF document.
   *
   * @returns A new PDF document with no pages
   *
   * @example
   * ```typescript
   * const pdf = PDF.create();
   * pdf.addPage({ size: "letter" });
   * const bytes = await pdf.save();
   * ```
   */
  static create(): PDF {
    // Create minimal PDF structure
    const registry = new ObjectRegistry(new Map());

    // Create empty pages tree
    const pagesDict = PdfDict.of({
      Type: PdfName.of("Pages"),
      Kids: new PdfArray([]),
      Count: PdfNumber.of(0),
    });
    const pagesRef = registry.register(pagesDict);

    // Create catalog
    const catalogDict = PdfDict.of({
      Type: PdfName.of("Catalog"),
      Pages: pagesRef,
    });
    const catalogRef = registry.register(catalogDict);

    // Create trailer pointing to catalog
    const trailer = PdfDict.of({
      Root: catalogRef,
    });

    // Set resolver (returns from registry)
    registry.setResolver(async (ref: PdfRef) => registry.getObject(ref));

    const pdfCatalog = new PDFCatalog(catalogDict, registry);
    const pages = PDFPageTree.fromRoot(
      pagesRef,
      pagesDict,
      ref => registry.getObject(ref) as PdfDict | null,
    );

    // Create document info for a new document
    const info: DocumentInfo = {
      version: "1.7",
      isEncrypted: false,
      isAuthenticated: true,
      trailer,
    };

    const ctx = new PDFContext(registry, pdfCatalog, pages, info);

    return new PDF(ctx, new Uint8Array(0), 0, {
      recoveredViaBruteForce: false,
      isLinearized: false,
      usesXRefStreams: false,
    });
  }

  /**
   * Merge multiple PDF documents into one.
   *
   * Creates a new document containing all pages from the source documents
   * in order. The resulting document is a fresh copy — original documents
   * are not modified.
   *
   * @param sources Array of PDF bytes to merge
   * @param options Load and merge options
   * @returns A new PDF containing all pages from the sources
   *
   * @example
   * ```typescript
   * const merged = await PDF.merge([pdfBytes1, pdfBytes2, pdfBytes3]);
   * const bytes = await merged.save();
   * ```
   */
  static async merge(sources: Uint8Array[], options: MergeOptions = {}): Promise<PDF> {
    if (sources.length === 0) {
      return PDF.create();
    }

    // Load first document as the base
    const result = await PDF.load(sources[0], options);

    // Copy pages from remaining documents
    for (let i = 1; i < sources.length; i++) {
      const source = await PDF.load(sources[i], options);
      const pageCount = source.getPageCount();

      if (pageCount > 0) {
        const indices = Array.from({ length: pageCount }, (_, j) => j);
        await result.copyPagesFrom(source, indices, {
          includeAnnotations: options.includeAnnotations ?? true,
        });
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document info
  // ─────────────────────────────────────────────────────────────────────────────

  /** PDF version string (e.g., "1.7", "2.0") */
  get version(): string {
    return this.ctx.info.version;
  }

  /** Whether the document is encrypted */
  get isEncrypted(): boolean {
    return this.ctx.info.isEncrypted;
  }

  /** Whether authentication succeeded (for encrypted docs) */
  get isAuthenticated(): boolean {
    return this.ctx.info.isAuthenticated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Object access
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get an object by reference.
   *
   * Objects are cached and tracked for modifications.
   */
  async getObject(ref: PdfRef): Promise<PdfObject | null> {
    return this.ctx.resolve(ref);
  }

  /**
   * Get the document catalog dictionary.
   *
   * Note: For internal use, prefer accessing the catalog via context which
   * provides higher-level methods for working with catalog structures.
   */
  async getCatalog(): Promise<PdfDict | null> {
    return this.ctx.catalog.getDict();
  }

  /**
   * Get all pages in document order.
   */
  async getPages(): Promise<PDFPage[]> {
    const refs = this.ctx.pages.getPages();
    const pages: PDFPage[] = [];

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const dict = await this.ctx.resolve(ref);

      if (!(dict instanceof PdfDict)) {
        throw new Error(`Page ${i} is not a dictionary`);
      }

      pages.push(new PDFPage(ref, dict, i, this.ctx));
    }

    return pages;
  }

  /**
   * Get page count.
   */
  getPageCount(): number {
    return this.ctx.pages.getPageCount();
  }

  /**
   * Get a single page by index (0-based).
   * Returns null if index out of bounds.
   */
  async getPage(index: number): Promise<PDFPage | null> {
    const ref = this.ctx.pages.getPage(index);

    if (!ref) {
      return null;
    }

    const dict = await this.ctx.resolve(ref);

    if (!(dict instanceof PdfDict)) {
      return null;
    }

    return new PDFPage(ref, dict, index, this.ctx);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Page manipulation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a new blank page.
   *
   * @param options - Page size, rotation, and insertion position
   * @returns The new page
   * @throws {RangeError} If insertAt index is out of bounds
   */
  addPage(options: AddPageOptions = {}): PDFPage {
    const { width, height } = resolvePageSize(options);
    const rotate = options.rotate ?? 0;

    // Create minimal page dict
    const pageDict = PdfDict.of({
      Type: PdfName.Page,
      MediaBox: new PdfArray([
        PdfNumber.of(0),
        PdfNumber.of(0),
        PdfNumber.of(width),
        PdfNumber.of(height),
      ]),
      Resources: new PdfDict(),
    });

    if (rotate !== 0) {
      pageDict.set("Rotate", PdfNumber.of(rotate));
    }

    // Register the page
    const pageRef = this.register(pageDict);

    // Insert at specified position or append
    const index = options.insertAt ?? this.getPageCount();
    this.ctx.pages.insertPage(index, pageRef, pageDict);

    return new PDFPage(pageRef, pageDict, index, this.ctx);
  }

  /**
   * Insert an existing page at the given index.
   *
   * @param index - Position to insert (0 = first, negative = append)
   * @param page - The page dict or ref to insert
   * @returns The page reference
   * @throws {Error} If page reference does not point to a dictionary
   * @throws {RangeError} If index is out of bounds
   */
  insertPage(index: number, page: PdfDict | PdfRef): PdfRef {
    let pageRef: PdfRef;
    let pageDict: PdfDict;

    if (page instanceof PdfRef) {
      pageRef = page;
      // Get the dict from registry or throw
      const obj = this.ctx.registry.getObject(page);

      if (!(obj instanceof PdfDict)) {
        throw new Error("Page reference does not point to a dictionary");
      }

      pageDict = obj;
    } else {
      // Register the dict and get a ref
      pageRef = this.register(page);
      pageDict = page;
    }

    this.ctx.pages.insertPage(index, pageRef, pageDict);

    return pageRef;
  }

  /**
   * Remove the page at the given index.
   *
   * @param index - The page index to remove
   * @returns The removed page reference
   * @throws {RangeError} If index is out of bounds
   */
  removePage(index: number): PdfRef {
    return this.ctx.pages.removePage(index);
  }

  /**
   * Move a page from one position to another.
   *
   * @param fromIndex - The current page index
   * @param toIndex - The target page index
   * @throws {RangeError} If either index is out of bounds
   */
  movePage(fromIndex: number, toIndex: number): void {
    this.ctx.pages.movePage(fromIndex, toIndex);
  }

  /**
   * Copy pages from another PDF document.
   *
   * This method deep-copies pages and all their resources (fonts, images, etc.)
   * from the source document into this document and inserts them at the
   * specified position (or appends to the end by default).
   *
   * Works with same-document copying for page duplication.
   *
   * @param source - The source PDF document
   * @param indices - Array of page indices to copy (0-based)
   * @param options - Copy options including insertion position
   * @returns Array of PDFPage objects for the copied pages
   * @throws {RangeError} If any source page index is out of bounds
   * @throws {Error} If source page not found or copied page is not a dictionary
   *
   * @example
   * ```typescript
   * // Copy pages 0 and 2 from source, append to end
   * const copiedPages = await dest.copyPagesFrom(source, [0, 2]);
   * console.log(copiedPages[0].width, copiedPages[0].height);
   *
   * // Copy page 0 and insert at the beginning
   * const [inserted] = await dest.copyPagesFrom(source, [0], { insertAt: 0 });
   *
   * // Duplicate page 0 in the same document, insert after it
   * const [duplicate] = await pdf.copyPagesFrom(pdf, [0], { insertAt: 1 });
   * ```
   */
  async copyPagesFrom(
    source: PDF,
    indices: number[],
    options: CopyPagesOptions = {},
  ): Promise<PDFPage[]> {
    const copier = new ObjectCopier(source, this, {
      includeAnnotations: options.includeAnnotations ?? true,
      includeBeads: options.includeBeads ?? false,
      includeThumbnails: options.includeThumbnails ?? false,
      includeStructure: options.includeStructure ?? false,
    });

    const copiedPages: PDFPage[] = [];

    // Fail-fast: validate all indices first
    for (const index of indices) {
      if (index < 0 || index >= source.getPageCount()) {
        throw new RangeError(`Page index ${index} out of bounds (0-${source.getPageCount() - 1})`);
      }
    }

    // Copy each page
    const copiedRefs: PdfRef[] = [];

    for (const index of indices) {
      const srcPage = await source.getPage(index);

      if (!srcPage) {
        throw new Error(`Source page ${index} not found`);
      }

      const copiedPageRef = await copier.copyPage(srcPage.ref);
      copiedRefs.push(copiedPageRef);
    }

    // Insert copied pages at specified position (or append)
    let insertIndex = options.insertAt ?? this.getPageCount();

    for (const copiedRef of copiedRefs) {
      const copiedDict = await this.getObject(copiedRef);

      if (!(copiedDict instanceof PdfDict)) {
        throw new Error("Copied page is not a dictionary");
      }

      this.ctx.pages.insertPage(insertIndex, copiedRef, copiedDict);

      // Create PDFPage wrapper and add to result
      const page = new PDFPage(copiedRef, copiedDict, insertIndex, this.ctx);
      copiedPages.push(page);

      insertIndex++;
    }

    return copiedPages;
  }

  /**
   * Extract pages into a new PDF document.
   *
   * Creates a new document containing only the specified pages, copied from
   * this document. The original document is not modified.
   *
   * @param indices - Array of page indices to extract (0-based)
   * @param options - Extraction options
   * @returns A new PDF containing only the extracted pages
   * @throws {RangeError} If any page index is out of bounds
   *
   * @example
   * ```typescript
   * const pdf = await PDF.load(bytes);
   *
   * // Extract first 3 pages
   * const first3 = await pdf.extractPages([0, 1, 2]);
   *
   * // Extract odd pages
   * const oddPages = await pdf.extractPages([0, 2, 4, 6]);
   *
   * // Save the extracted document
   * const bytes = await first3.save();
   * ```
   */
  async extractPages(indices: number[], options: ExtractPagesOptions = {}): Promise<PDF> {
    // Validate indices first
    for (const index of indices) {
      if (index < 0 || index >= this.getPageCount()) {
        throw new RangeError(`Page index ${index} out of bounds (0-${this.getPageCount() - 1})`);
      }
    }

    // Create new empty document
    const result = PDF.create();

    // Copy pages from this document to the new one
    if (indices.length > 0) {
      await result.copyPagesFrom(this, indices, {
        includeAnnotations: options.includeAnnotations ?? true,
      });
    }

    return result;
  }

  /**
   * Embed a page from another PDF as a reusable Form XObject.
   *
   * The embedded page can be drawn onto pages in this document using
   * `page.drawPage()`. This is useful for watermarks, letterheads,
   * backgrounds, and page overlays.
   *
   * @param source - The source PDF document
   * @param pageIndex - The page index to embed (0-based)
   * @returns A PDFEmbeddedPage that can be drawn with page.drawPage()
   * @throws {RangeError} If page index is out of bounds
   *
   * @example
   * ```typescript
   * const watermark = await PDF.load(watermarkBytes);
   * const embedded = await pdf.embedPage(watermark, 0);
   *
   * // Draw on all pages as a background
   * for (const page of await pdf.getPages()) {
   *   page.drawPage(embedded, { background: true });
   * }
   * ```
   */
  async embedPage(source: PDF, pageIndex: number): Promise<PDFEmbeddedPage> {
    const srcPage = await source.getPage(pageIndex);

    if (!srcPage) {
      throw new RangeError(`Page index ${pageIndex} out of bounds`);
    }

    // Get page content streams and concatenate
    const contentData = await this.getPageContentData(source, srcPage);

    // Copy resources from source to dest
    const copier = new ObjectCopier(source, this, { includeAnnotations: false });
    const srcResources = srcPage.dict.get("Resources");
    let resources: PdfDict;

    if (srcResources instanceof PdfDict) {
      resources = (await copier.copyObject(srcResources)) as PdfDict;
    } else if (srcResources instanceof PdfRef) {
      const resolved = await source.getObject(srcResources);

      if (resolved instanceof PdfDict) {
        resources = (await copier.copyObject(resolved)) as PdfDict;
      } else {
        resources = new PdfDict();
      }
    } else {
      resources = new PdfDict();
    }

    // Get the MediaBox
    const mediaBox = srcPage.getMediaBox();

    // Create Form XObject
    const formXObject = PdfStream.fromDict(
      {
        Type: PdfName.of("XObject"),
        Subtype: PdfName.of("Form"),
        FormType: PdfNumber.of(1),
        BBox: new PdfArray([
          PdfNumber.of(mediaBox.x1),
          PdfNumber.of(mediaBox.y1),
          PdfNumber.of(mediaBox.x2),
          PdfNumber.of(mediaBox.y2),
        ]),
        Resources: resources,
      },
      contentData,
    );

    const ref = this.register(formXObject);

    return new PDFEmbeddedPage(ref, mediaBox, srcPage.width, srcPage.height);
  }

  /**
   * Get the concatenated content stream data from a page.
   */
  private async getPageContentData(source: PDF, page: PDFPage): Promise<Uint8Array> {
    const contents = page.dict.get("Contents");

    if (!contents) {
      return new Uint8Array(0);
    }

    // Single stream
    if (contents instanceof PdfRef) {
      const stream = await source.getObject(contents);

      if (stream instanceof PdfStream) {
        return await stream.getDecodedData();
      }

      return new Uint8Array(0);
    }

    // Array of streams - concatenate with newlines
    if (contents instanceof PdfArray) {
      const chunks: Uint8Array[] = [];

      for (let i = 0; i < contents.length; i++) {
        const ref = contents.at(i);

        if (ref instanceof PdfRef) {
          const stream = await source.getObject(ref);

          if (stream instanceof PdfStream) {
            if (chunks.length > 0) {
              // Add newline separator
              chunks.push(new Uint8Array([0x0a]));
            }

            chunks.push(await stream.getDecodedData());
          }
        }
      }

      // Concatenate all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    }

    // Direct stream (unusual but possible)
    if (contents instanceof PdfStream) {
      return await contents.getDecodedData();
    }

    return new Uint8Array(0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Object creation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a new object, assigning it a reference.
   *
   * The object will be written on the next save.
   */
  register(obj: PdfObject): PdfRef {
    return this.ctx.registry.register(obj);
  }

  /**
   * Create and register a new dictionary.
   */
  createDict(entries?: Record<string, PdfObject> | [string, PdfObject][]): PdfRef {
    let dict: PdfDict;

    if (Array.isArray(entries)) {
      dict = new PdfDict(entries);
    } else if (entries) {
      dict = PdfDict.of(entries);
    } else {
      dict = new PdfDict();
    }

    return this.register(dict);
  }

  /**
   * Create and register a new array.
   */
  createArray(items?: PdfObject[]): PdfRef {
    const arr = items ? new PdfArray(items) : new PdfArray();

    return this.register(arr);
  }

  /**
   * Create and register a new stream.
   */
  createStream(
    dictEntries: Record<string, PdfObject> | [string, PdfObject][],
    data: Uint8Array,
  ): PdfRef {
    let stream: PdfStream;

    if (Array.isArray(dictEntries)) {
      stream = new PdfStream(dictEntries, data);
    } else {
      stream = PdfStream.fromDict(dictEntries, data);
    }

    return this.register(stream);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Font Embedding
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Access the fonts API for embedding and managing fonts.
   *
   * @example
   * ```typescript
   * // Embed a font
   * const font = pdf.fonts.embed(fontBytes);
   *
   * // Use the font
   * const codes = font.encodeText("Hello World");
   * const width = font.getTextWidth("Hello World", 12);
   *
   * // Get font reference (after prepare or save)
   * await pdf.fonts.prepare();
   * const fontRef = pdf.fonts.getRef(font);
   * ```
   */
  get fonts(): PDFFonts {
    if (!this._fonts) {
      this._fonts = new PDFFonts(this.ctx);
    }

    return this._fonts;
  }

  /**
   * Embed a font for use in the document.
   *
   * Convenience method that delegates to `pdf.fonts.embed()`.
   *
   * @param data - Font data (TTF, OTF, or Type1)
   * @param options - Embedding options
   * @returns EmbeddedFont instance for encoding text
   * @throws {Error} If font data is invalid or unsupported format
   */
  embedFont(data: Uint8Array, options?: EmbedFontOptions): EmbeddedFont {
    return this.fonts.embed(data, options);
  }

  /**
   * Get the reference for an embedded font.
   *
   * Convenience method that delegates to `pdf.fonts.getRef()`.
   *
   * Note: The reference is only available after `pdf.fonts.prepare()` is called
   * (which happens automatically during save). Before that, this returns null.
   */
  getFontRef(font: EmbeddedFont): PdfRef | null {
    return this.fonts.getRef(font);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Image Embedding
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Embed an image (JPEG or PNG) into the document.
   *
   * Automatically detects the image format and calls the appropriate
   * embedding method. The returned PDFImage can be drawn on pages
   * using `page.drawImage()`.
   *
   * @param bytes - Image file bytes (JPEG or PNG)
   * @returns PDFImage that can be drawn with page.drawImage()
   * @throws {Error} If image format is not recognized or invalid
   *
   * @example
   * ```typescript
   * const image = await pdf.embedImage(imageBytes);
   * const page = pdf.addPage();
   * page.drawImage(image, { x: 50, y: 500 });
   * ```
   */
  async embedImage(bytes: Uint8Array): Promise<PDFImage> {
    if (isJpeg(bytes)) {
      return this.embedJpeg(bytes);
    }

    if (isPng(bytes)) {
      return this.embedPng(bytes);
    }

    throw new Error("Unsupported image format. Only JPEG and PNG are supported.");
  }

  /**
   * Embed a JPEG image into the document.
   *
   * JPEG images are embedded directly using DCTDecode filter,
   * which means the JPEG data is stored as-is without re-encoding.
   *
   * @param bytes - JPEG file bytes
   * @returns PDFImage that can be drawn with page.drawImage()
   * @throws {Error} If not a valid JPEG image
   *
   * @example
   * ```typescript
   * const image = await pdf.embedJpeg(jpegBytes);
   * page.drawImage(image, {
   *   x: 50,
   *   y: 500,
   *   width: 200,  // Scale to specific width
   * });
   * ```
   */
  async embedJpeg(bytes: Uint8Array): Promise<PDFImage> {
    const info = parseJpegHeader(bytes);

    // Create XObject image stream with DCTDecode filter
    const stream = PdfStream.fromDict(
      {
        Type: PdfName.of("XObject"),
        Subtype: PdfName.of("Image"),
        Width: PdfNumber.of(info.width),
        Height: PdfNumber.of(info.height),
        ColorSpace: PdfName.of(info.colorSpace),
        BitsPerComponent: PdfNumber.of(8),
        Filter: PdfName.of("DCTDecode"),
      },
      bytes,
    );

    const ref = this.register(stream);

    return new PDFImage(ref, info.width, info.height);
  }

  /**
   * Embed a PNG image into the document.
   *
   * PNG images are decoded and re-encoded with FlateDecode filter.
   * Alpha channels are separated into a soft mask (SMask) for
   * proper transparency support.
   *
   * @param bytes - PNG file bytes
   * @returns PDFImage that can be drawn with page.drawImage()
   * @throws {Error} If not a valid PNG image or unsupported format
   *
   * @example
   * ```typescript
   * const logo = await pdf.embedPng(pngBytes);
   * // Draw with transparency preserved
   * page.drawImage(logo, { x: 100, y: 700, width: 150 });
   * ```
   */
  async embedPng(bytes: Uint8Array): Promise<PDFImage> {
    const data = parsePng(bytes);
    const { info, pixels, alpha } = data;

    // Compress pixel data with FlateDecode
    const compressedPixels = deflate(pixels);

    // Build XObject dictionary
    const dictEntries: Record<string, PdfObject> = {
      Type: PdfName.of("XObject"),
      Subtype: PdfName.of("Image"),
      Width: PdfNumber.of(info.width),
      Height: PdfNumber.of(info.height),
      ColorSpace: PdfName.of(info.colorSpace),
      BitsPerComponent: PdfNumber.of(info.bitDepth > 8 ? 8 : info.bitDepth),
      Filter: PdfName.of("FlateDecode"),
    };

    // If there's alpha, create a soft mask
    if (alpha) {
      const compressedAlpha = deflate(alpha);

      const smaskStream = PdfStream.fromDict(
        {
          Type: PdfName.of("XObject"),
          Subtype: PdfName.of("Image"),
          Width: PdfNumber.of(info.width),
          Height: PdfNumber.of(info.height),
          ColorSpace: PdfName.of("DeviceGray"),
          BitsPerComponent: PdfNumber.of(8),
          Filter: PdfName.of("FlateDecode"),
        },
        compressedAlpha,
      );

      const smaskRef = this.register(smaskStream);
      dictEntries.SMask = smaskRef;
    }

    const stream = PdfStream.fromDict(dictEntries, compressedPixels);
    const ref = this.register(stream);

    return new PDFImage(ref, info.width, info.height);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Attachments
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Access the attachments API for managing file attachments.
   *
   * @example
   * ```typescript
   * // List attachments
   * const attachments = await pdf.attachments.list();
   *
   * // Add an attachment
   * await pdf.attachments.add("report.pdf", pdfBytes, {
   *   description: "Annual report",
   * });
   *
   * // Get attachment data
   * const data = await pdf.attachments.get("report.pdf");
   *
   * // Remove an attachment
   * await pdf.attachments.remove("old-file.txt");
   * ```
   */
  get attachments(): PDFAttachments {
    if (!this._attachments) {
      this._attachments = new PDFAttachments(this.ctx);
    }

    return this._attachments;
  }

  /**
   * List all attachments in the document.
   *
   * Convenience method that delegates to `pdf.attachments.list()`.
   *
   * @returns Map of attachment name to attachment info
   */
  async getAttachments(): Promise<Map<string, AttachmentInfo>> {
    return this.attachments.list();
  }

  /**
   * Get the raw bytes of an attachment.
   *
   * Convenience method that delegates to `pdf.attachments.get()`.
   *
   * @param name The attachment name (key in the EmbeddedFiles tree)
   * @returns The attachment bytes, or null if not found
   */
  async getAttachment(name: string): Promise<Uint8Array | null> {
    return this.attachments.get(name);
  }

  /**
   * Check if an attachment exists.
   *
   * Convenience method that delegates to `pdf.attachments.has()`.
   *
   * @param name The attachment name
   * @returns True if the attachment exists
   */
  async hasAttachment(name: string): Promise<boolean> {
    return this.attachments.has(name);
  }

  /**
   * Add a file attachment to the document.
   *
   * Convenience method that delegates to `pdf.attachments.add()`.
   *
   * @param name - The attachment name (key in the EmbeddedFiles tree)
   * @param data - The file data
   * @param options - Attachment options (description, MIME type, dates)
   * @throws {Error} If name already exists and overwrite !== true
   */
  async addAttachment(
    name: string,
    data: Uint8Array,
    options: AddAttachmentOptions = {},
  ): Promise<void> {
    return this.attachments.add(name, data, options);
  }

  /**
   * Remove an attachment from the document.
   *
   * Convenience method that delegates to `pdf.attachments.remove()`.
   *
   * @param name The attachment name
   * @returns True if the attachment was removed, false if not found
   */
  async removeAttachment(name: string): Promise<boolean> {
    return this.attachments.remove(name);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Interactive Form
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the document has an interactive form (AcroForm).
   *
   * This is a synchronous check that examines the catalog for an AcroForm entry.
   * Use this for quick checks before calling `getForm()`.
   *
   * @returns true if the document has an AcroForm dictionary
   *
   * @example
   * ```typescript
   * if (pdf.hasForm()) {
   *   const form = await pdf.getForm();
   *   // Work with form...
   * }
   * ```
   */
  hasForm(): boolean {
    const catalog = this.ctx.catalog.getDict();
    return catalog.has("AcroForm");
  }

  /**
   * Get the document's interactive form.
   *
   * Returns null if no form exists. The form is loaded lazily on first call
   * and cached for subsequent calls.
   *
   * @returns The form, or null if no form exists
   *
   * @example
   * ```typescript
   * const form = await pdf.getForm();
   * if (!form) return;
   *
   * // Type-safe field access
   * const name = form.getTextField("name");
   * const agree = form.getCheckbox("terms");
   *
   * name?.setValue("John Doe");
   * agree?.check();
   *
   * // Or fill multiple (lenient - ignores missing)
   * form.fill({
   *   email: "john@example.com",
   *   country: "USA",
   * });
   *
   * await form.flatten();
   * await pdf.save({ incremental: true });
   * ```
   */
  async getForm(): Promise<PDFForm | null> {
    if (this._form === undefined) {
      this._form = await PDFForm.load(this.ctx);
    }

    return this._form;
  }

  /**
   * Get or create the document's interactive form.
   *
   * If the document has no AcroForm, one is created and added to the catalog
   * with proper default resources (Helvetica and ZapfDingbats fonts) and
   * default appearance settings.
   *
   * @returns The form (never null)
   *
   * @example
   * ```typescript
   * const form = await pdf.getOrCreateForm();
   * const nameField = form.createTextField("name", { fontSize: 12 });
   * ```
   */
  async getOrCreateForm(): Promise<PDFForm> {
    const existing = await this.getForm();

    if (existing) {
      return existing;
    }

    // Create standard Helvetica font dictionary
    const helveticaDict = PdfDict.of({
      Type: PdfName.of("Font"),
      Subtype: PdfName.of("Type1"),
      BaseFont: PdfName.of("Helvetica"),
    });

    // Create ZapfDingbats font dictionary (for checkboxes/radios)
    const zapfDingbatsDict = PdfDict.of({
      Type: PdfName.of("Font"),
      Subtype: PdfName.of("Type1"),
      BaseFont: PdfName.of("ZapfDingbats"),
    });

    // Create Font dictionary with standard fonts
    const fontsDict = PdfDict.of({
      Helv: helveticaDict,
      ZaDb: zapfDingbatsDict,
    });

    // Create Default Resources dictionary
    const drDict = PdfDict.of({
      Font: fontsDict,
    });

    // Create AcroForm dictionary with proper defaults
    const acroFormDict = PdfDict.of({
      Fields: new PdfArray([]),
      DR: drDict,
      DA: PdfString.fromString("/Helv 0 Tf 0 g"),
      NeedAppearances: PdfBool.of(false),
    });

    const acroFormRef = this.ctx.registry.register(acroFormDict);

    // Add to catalog
    const catalog = await this.getCatalog();

    if (catalog) {
      catalog.set("AcroForm", acroFormRef);
    }

    // Reload form cache
    this._form = await PDFForm.load(this.ctx);

    if (!this._form) {
      throw new Error("Failed to create form");
    }

    return this._form;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Digital Signatures
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sign the PDF document.
   *
   * Creates a digital signature using PAdES (PDF Advanced Electronic Signatures)
   * format. The signature is embedded as an incremental update, preserving any
   * existing signatures.
   *
   * After signing, this PDF instance is automatically reloaded with the signed
   * bytes. You can continue using it or call save() to get the final bytes.
   *
   * @param options - Signing options including signer, reason, location, etc.
   * @returns The signed PDF bytes and any warnings
   * @throws {Error} If signing fails (invalid certificate, signature creation error)
   *
   * @example
   * ```typescript
   * import { P12Signer } from "@libpdf/core";
   *
   * // Basic signing
   * const signer = await P12Signer.create(p12Bytes, "password");
   * const { bytes } = await pdf.sign({
   *   signer,
   *   reason: "I approve this document",
   *   location: "New York",
   * });
   *
   * // Multiple signatures (PDF instance is reloaded after each sign)
   * await pdf.sign({ signer: signer1 });
   * await pdf.sign({ signer: signer2 });
   * const bytes = await pdf.save();
   * ```
   */
  async sign(options: SignOptions): Promise<SignResult> {
    const signature = new PDFSignature(this);

    return signature.sign(options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Layers (Optional Content Groups)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the document contains Optional Content Groups (layers).
   *
   * Performs a thorough check that verifies OCProperties exists and
   * contains at least one valid OCG entry.
   *
   * @returns true if document has layers
   *
   * @example
   * ```typescript
   * if (await pdf.hasLayers()) {
   *   console.log("Document has layers");
   *   await pdf.removeLayers();
   * }
   * ```
   */
  async hasLayers(): Promise<boolean> {
    return LayerUtils.hasLayers(this.ctx);
  }

  /**
   * Get information about all layers in the document.
   *
   * Returns layer metadata including name, visibility state,
   * intent, and locked status based on the default configuration.
   *
   * @returns Array of layer information
   *
   * @example
   * ```typescript
   * const layers = await pdf.getLayers();
   * for (const layer of layers) {
   *   console.log(`${layer.name}: visible=${layer.visible}, locked=${layer.locked}`);
   * }
   * ```
   */
  async getLayers(): Promise<LayerInfo[]> {
    return LayerUtils.getLayers(this.ctx);
  }

  /**
   * Flatten all Optional Content Groups (layers) in the document.
   *
   * This removes the OCProperties dictionary from the catalog, which:
   * - Makes ALL layer content unconditionally visible (nothing is deleted)
   * - Removes the layer panel/toggle UI from PDF viewers
   * - Content that was in "OFF" layers becomes visible
   * - Content that was in "ON" layers remains visible
   *
   * Use this before signing to prevent "hidden content" attacks where
   * malicious content is placed in an OFF layer, signed, then revealed
   * by toggling the layer back on.
   *
   * Note: This does NOT modify page content streams - the BDC/EMC marked
   * content operators remain but are ignored since OCProperties is gone.
   * The visual result is identical to having all layers turned ON.
   *
   * @returns Statistics about the flattening operation
   *
   * @example
   * ```typescript
   * // Security workflow before signing
   * if (await pdf.hasLayers()) {
   *   const result = await pdf.flattenLayers();
   *   console.log(`Flattened ${result.layerCount} layers`);
   * }
   * await pdf.sign({ signer });
   * ```
   */
  async flattenLayers(): Promise<FlattenLayersResult> {
    return LayerUtils.flattenLayers(this.ctx);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Change tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the document has unsaved changes.
   */
  hasChanges(): boolean {
    return hasChanges(this.ctx.registry);
  }

  /**
   * Check if incremental save is possible.
   *
   * Returns null if possible, or the blocker reason if not.
   */
  canSaveIncrementally(): IncrementalSaveBlocker | null {
    return checkIncrementalSaveBlocker({
      isLinearized: this.isLinearized,
      recoveredViaBruteForce: this.recoveredViaBruteForce,
      encryptionChanged: false, // TODO: track encryption changes
      encryptionAdded: false,
      encryptionRemoved: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Saving
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Save the PDF.
   *
   * @param options - Save options
   * @returns The saved PDF bytes
   * @throws {Error} If document has no catalog (missing /Root in trailer)
   */
  async save(options: SaveOptions = {}): Promise<Uint8Array> {
    const result = await this.saveInternal(options);

    return result.bytes;
  }

  /**
   * Internal save that returns full result including xref offset.
   * Used by signing to chain incremental updates.
   */
  private async saveInternal(
    options: SaveOptions = {},
  ): Promise<{ bytes: Uint8Array; xrefOffset: number }> {
    // Finalize embedded fonts (creates PDF objects, optionally subsets)
    await this.fonts.finalize(options.subsetFonts ?? false);

    const wantsIncremental = options.incremental ?? false;
    const blocker = this.canSaveIncrementally();

    // Check if incremental is requested but not possible

    if (wantsIncremental && blocker !== null) {
      this.ctx.registry.addWarning(
        `Incremental save not possible (${blocker}), performing full save`,
      );
    }

    const useIncremental = wantsIncremental && blocker === null;

    // If no changes, return original bytes

    if (!this.hasChanges() && !this.fonts.hasEmbeddedFonts) {
      return {
        bytes: this.originalBytes,
        xrefOffset: this.originalXRefOffset,
      };
    }

    // Get root reference from trailer
    const root = this.ctx.info.trailer.getRef("Root");

    if (!root) {
      throw new Error("Document has no catalog (missing /Root in trailer)");
    }

    // Get optional info reference
    const infoRef = this.ctx.info.trailer.getRef("Info");

    // TODO: Handle encryption, ID arrays properly
    // For incremental saves, use the same XRef format as the original document
    // unless explicitly overridden by the caller
    const useXRefStream = options.useXRefStream ?? (useIncremental ? this.usesXRefStreams : false);

    if (useIncremental) {
      return writeIncremental(this.ctx.registry, {
        originalBytes: this.originalBytes,
        originalXRefOffset: this.originalXRefOffset,
        root,
        info: infoRef ?? undefined,
        useXRefStream,
      });
    }

    // For full save with changes, we need all referenced objects loaded
    // Walk from catalog to ensure we have everything
    await this.ensureObjectsLoaded();

    // Full save
    return writeComplete(this.ctx.registry, {
      version: this.ctx.info.version,
      root,
      info: infoRef ?? undefined,
      useXRefStream,
    });
  }

  /**
   * Ensure all reachable objects are loaded into the registry.
   *
   * Walks from the catalog to load all referenced objects.
   */
  private async ensureObjectsLoaded(): Promise<void> {
    const visited = new Set<string>();

    const walk = async (obj: PdfObject | null): Promise<void> => {
      if (obj === null) {
        return;
      }

      if (obj instanceof PdfRef) {
        const key = `${obj.objectNumber} ${obj.generation}`;

        if (visited.has(key)) {
          return;
        }

        visited.add(key);

        const resolved = await this.getObject(obj);

        await walk(resolved);
      } else if (obj instanceof PdfDict) {
        for (const [, value] of obj) {
          await walk(value);
        }
      } else if (obj instanceof PdfArray) {
        for (const item of obj) {
          await walk(item);
        }
      }
    };

    // Start from root
    const root = this.ctx.info.trailer.getRef("Root");

    if (root) {
      await walk(root);
    }

    // Also load Info if present
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (infoRef) {
      await walk(infoRef);
    }
  }
}
