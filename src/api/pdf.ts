/**
 * High-level PDF document API.
 *
 * Provides a user-friendly interface for loading, modifying, and saving PDFs.
 * Wraps the low-level parsing and writing infrastructure.
 */

import type { AddAttachmentOptions, AttachmentInfo } from "#src/attachments/types";

import { hasChanges } from "#src/document/change-collector";
import {
  checkIncrementalSaveBlocker,
  type IncrementalSaveBlocker,
  isLinearizationDict,
} from "#src/document/linearization";
import { ObjectCopier } from "#src/document/object-copier";
import { ObjectRegistry } from "#src/document/object-registry";
import { PageTree } from "#src/document/page-tree";
import { PDFCatalog } from "#src/document/pdf-catalog";
import type { EmbeddedFont, EmbedFontOptions } from "#src/fonts/embedded-font";
import { resolvePageSize } from "#src/helpers/page-size";
import { Scanner } from "#src/io/scanner";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import {
  DocumentParser,
  type ParsedDocument,
  type ParseOptions,
} from "#src/parser/document-parser";
import { XRefParser } from "#src/parser/xref-parser";
import { writeComplete, writeIncremental } from "#src/writer/pdf-writer";
import { PDFAttachments } from "./pdf-attachments";
import { PDFFonts } from "./pdf-fonts";
import { PDFForm } from "./pdf-form";

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
  private readonly parsed: ParsedDocument;
  private readonly registry: ObjectRegistry;
  private readonly originalBytes: Uint8Array;
  private readonly originalXRefOffset: number;

  /** Page tree, loaded eagerly during PDF.load() */
  private readonly _pages: PageTree;

  /** Document catalog wrapper */
  private readonly _catalog: PDFCatalog;

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
    return this.registry.warnings;
  }

  private constructor(
    parsed: ParsedDocument,
    registry: ObjectRegistry,
    originalBytes: Uint8Array,
    originalXRefOffset: number,
    pages: PageTree,
    catalog: PDFCatalog,
    options: {
      recoveredViaBruteForce: boolean;
      isLinearized: boolean;
      usesXRefStreams: boolean;
    },
  ) {
    this.parsed = parsed;
    this.registry = registry;
    this.originalBytes = originalBytes;
    this.originalXRefOffset = originalXRefOffset;
    this._pages = pages;
    this._catalog = catalog;
    this.recoveredViaBruteForce = options.recoveredViaBruteForce;
    this.isLinearized = options.isLinearized;
    this.usesXRefStreams = options.usesXRefStreams;

    // Set up resolver so registry can fetch objects on demand
    this.registry.setResolver(ref => this.parsed.getObject(ref));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Load a PDF from bytes.
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
      ? await PageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PageTree.empty();

    return new PDF(parsed, registry, bytes, originalXRefOffset, pages, pdfCatalog, {
      recoveredViaBruteForce: parsed.recoveredViaBruteForce,
      isLinearized,
      usesXRefStreams,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document info
  // ─────────────────────────────────────────────────────────────────────────────

  /** PDF version string (e.g., "1.7", "2.0") */
  get version(): string {
    return this.parsed.version;
  }

  /** Whether the document is encrypted */
  get isEncrypted(): boolean {
    return this.parsed.isEncrypted;
  }

  /** Whether authentication succeeded (for encrypted docs) */
  get isAuthenticated(): boolean {
    return this.parsed.isAuthenticated;
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
    return this.registry.resolve(ref);
  }

  /**
   * Get the document catalog dictionary.
   *
   * Note: For internal use, prefer accessing `this._catalog` which provides
   * higher-level methods for working with catalog structures.
   */
  async getCatalog(): Promise<PdfDict | null> {
    return this._catalog.getDict();
  }

  /**
   * Get all page references in document order.
   */
  getPages(): PdfRef[] {
    return this._pages.getPages();
  }

  /**
   * Get page count.
   */
  getPageCount(): number {
    return this._pages.getPageCount();
  }

  /**
   * Get a single page by index (0-based).
   * Returns null if index out of bounds.
   */
  getPage(index: number): PdfRef | null {
    return this._pages.getPage(index);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Page manipulation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a new blank page.
   *
   * @param options Page size, rotation, and insertion position
   * @returns The reference to the new page
   */
  addPage(options: AddPageOptions = {}): PdfRef {
    const { width, height } = resolvePageSize(options);
    const rotate = options.rotate ?? 0;

    // Create minimal page dict
    const page = PdfDict.of({
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
      page.set("Rotate", PdfNumber.of(rotate));
    }

    // Register the page
    const pageRef = this.register(page);

    // Insert at specified position or append
    const index = options.insertAt ?? this.getPageCount();
    this._pages.insertPage(index, pageRef, page);

    return pageRef;
  }

  /**
   * Insert an existing page at the given index.
   *
   * @param index Position to insert (0 = first, negative = append)
   * @param page The page dict or ref to insert
   * @returns The page reference
   */
  insertPage(index: number, page: PdfDict | PdfRef): PdfRef {
    let pageRef: PdfRef;
    let pageDict: PdfDict;

    if (page instanceof PdfRef) {
      pageRef = page;
      // Get the dict from registry or throw
      const obj = this.registry.getObject(page);

      if (!(obj instanceof PdfDict)) {
        throw new Error("Page reference does not point to a dictionary");
      }

      pageDict = obj;
    } else {
      // Register the dict and get a ref
      pageRef = this.register(page);
      pageDict = page;
    }

    this._pages.insertPage(index, pageRef, pageDict);

    return pageRef;
  }

  /**
   * Remove the page at the given index.
   *
   * @param index The page index to remove
   * @returns The removed page reference
   * @throws RangeError if index is out of bounds
   */
  removePage(index: number): PdfRef {
    return this._pages.removePage(index);
  }

  /**
   * Move a page from one position to another.
   *
   * @param fromIndex The current page index
   * @param toIndex The target page index
   * @throws RangeError if either index is out of bounds
   */
  movePage(fromIndex: number, toIndex: number): void {
    this._pages.movePage(fromIndex, toIndex);
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
   * @param source The source PDF document
   * @param indices Array of page indices to copy (0-based)
   * @param options Copy options including insertion position
   * @returns Array of references to the copied pages in this document
   * @throws RangeError if any source page index is out of bounds
   *
   * @example
   * ```typescript
   * // Copy pages 0 and 2 from source, append to end
   * const copiedRefs = await dest.copyPagesFrom(source, [0, 2]);
   *
   * // Copy page 0 and insert at the beginning
   * await dest.copyPagesFrom(source, [0], { insertAt: 0 });
   *
   * // Duplicate page 0 in the same document, insert after it
   * await pdf.copyPagesFrom(pdf, [0], { insertAt: 1 });
   * ```
   */
  async copyPagesFrom(
    source: PDF,
    indices: number[],
    options: CopyPagesOptions = {},
  ): Promise<PdfRef[]> {
    const copier = new ObjectCopier(source, this, {
      includeAnnotations: options.includeAnnotations ?? true,
      includeBeads: options.includeBeads ?? false,
      includeThumbnails: options.includeThumbnails ?? false,
      includeStructure: options.includeStructure ?? false,
    });

    const copiedRefs: PdfRef[] = [];

    // Fail-fast: validate all indices first
    for (const index of indices) {
      if (index < 0 || index >= source.getPageCount()) {
        throw new RangeError(`Page index ${index} out of bounds (0-${source.getPageCount() - 1})`);
      }
    }

    // Copy each page
    for (const index of indices) {
      const srcPageRef = source.getPage(index);

      if (!srcPageRef) {
        throw new Error(`Source page ${index} not found`);
      }

      const copiedPageRef = await copier.copyPage(srcPageRef);
      copiedRefs.push(copiedPageRef);
    }

    // Insert copied pages at specified position (or append)
    let insertIndex = options.insertAt ?? this.getPageCount();

    for (const copiedRef of copiedRefs) {
      const copiedPage = await this.getObject(copiedRef);

      if (!(copiedPage instanceof PdfDict)) {
        throw new Error("Copied page is not a dictionary");
      }

      this._pages.insertPage(insertIndex, copiedRef, copiedPage);
      insertIndex++;
    }

    return copiedRefs;
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
    return this.registry.register(obj);
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
      this._fonts = new PDFFonts(this.registry);
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
      this._attachments = new PDFAttachments(this.registry, this._catalog);
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
   * @param name The attachment name (key in the EmbeddedFiles tree)
   * @param data The file data
   * @param options Attachment options (description, MIME type, dates)
   * @throws Error if name already exists and overwrite !== true
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
   * Get the document's interactive form.
   *
   * Returns null if no form exists. The form is loaded lazily on first call
   * and cached for subsequent calls.
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
      this._form = await PDFForm.load(this.registry, this._catalog, this._pages);
    }

    return this._form;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Change tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the document has unsaved changes.
   */
  hasChanges(): boolean {
    return hasChanges(this.registry);
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
   */
  async save(options: SaveOptions = {}): Promise<Uint8Array> {
    // Prepare embedded fonts (creates PDF objects, subsets fonts)
    await this.fonts.prepare();

    const wantsIncremental = options.incremental ?? false;
    const blocker = this.canSaveIncrementally();

    // Check if incremental is requested but not possible

    if (wantsIncremental && blocker !== null) {
      this.registry.addWarning(`Incremental save not possible (${blocker}), performing full save`);
    }

    const useIncremental = wantsIncremental && blocker === null;

    // If no changes, return original bytes

    if (!this.hasChanges() && !this.fonts.hasEmbeddedFonts) {
      return this.originalBytes;
    }

    // Get root reference from trailer
    const root = this.parsed.trailer.getRef("Root");

    if (!root) {
      throw new Error("Document has no catalog (missing /Root in trailer)");
    }

    // Get optional info reference
    const info = this.parsed.trailer.getRef("Info");

    // TODO: Handle encryption, ID arrays properly
    // For incremental saves, use the same XRef format as the original document
    // unless explicitly overridden by the caller
    const useXRefStream = options.useXRefStream ?? (useIncremental ? this.usesXRefStreams : false);

    if (useIncremental) {
      const result = await writeIncremental(this.registry, {
        originalBytes: this.originalBytes,
        originalXRefOffset: this.originalXRefOffset,
        root,
        info: info ?? undefined,
        useXRefStream,
      });

      return result.bytes;
    }

    // For full save with changes, we need all referenced objects loaded
    // Walk from catalog to ensure we have everything
    await this.ensureObjectsLoaded();

    // Full save
    const result = await writeComplete(this.registry, {
      version: this.parsed.version,
      root,
      info: info ?? undefined,
      useXRefStream,
    });

    return result.bytes;
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
    const root = this.parsed.trailer.getRef("Root");

    if (root) {
      await walk(root);
    }

    // Also load Info if present
    const info = this.parsed.trailer.getRef("Info");

    if (info) {
      await walk(info);
    }
  }
}
