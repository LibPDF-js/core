/**
 * PDFContext - Central context object for PDF document operations.
 *
 * Provides shared access to the registry, catalog, page tree, and other
 * document infrastructure. Passed to subsystems (forms, attachments, fonts)
 * instead of multiple separate arguments.
 *
 * @internal This is an internal class, not part of the public API.
 */

import type { ObjectRegistry } from "#src/document/object-registry";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfObject } from "#src/objects/pdf-object";
import type { PdfRef } from "#src/objects/pdf-ref";
import type { StandardSecurityHandler } from "#src/security/standard-handler";

import type { PDFCatalog } from "./pdf-catalog";
import type { PDFPageTree } from "./pdf-page-tree";

/**
 * Function type for resolving embedded font references.
 * Synchronous because refs are pre-allocated when fonts are embedded.
 */
export type FontRefResolver = (font: EmbeddedFont) => PdfRef;

/**
 * Document metadata stored in the context.
 */
export interface DocumentInfo {
  /** PDF version (e.g., "1.7", "2.0") */
  version: string;
  /** Whether the document is encrypted */
  isEncrypted: boolean;
  /** Whether authentication succeeded */
  isAuthenticated: boolean;
  /** Trailer dictionary */
  trailer: PdfDict;
  /** Security handler (if encrypted) */
  securityHandler: StandardSecurityHandler | null;
}

/**
 * Central context for PDF document operations.
 *
 * Encapsulates all the shared state and services that subsystems need:
 * - Object registry for tracking and resolving objects
 * - Catalog for document-level structures
 * - Page tree for page access
 * - Document info (version, encryption status, trailer)
 */
export class PDFContext {
  /** Object registry for tracking refs and objects */
  readonly registry: ObjectRegistry;

  /** Document catalog wrapper */
  readonly catalog: PDFCatalog;

  /** Page tree for page access and manipulation */
  readonly pages: PDFPageTree;

  /** Document metadata */
  readonly info: DocumentInfo;

  /** Font reference resolver (set by PDF class) */
  private fontRefResolver: FontRefResolver | null = null;

  constructor(
    registry: ObjectRegistry,
    catalog: PDFCatalog,
    pages: PDFPageTree,
    info: DocumentInfo,
  ) {
    this.registry = registry;
    this.catalog = catalog;
    this.pages = pages;
    this.info = info;
  }

  /**
   * Set the font reference resolver.
   * @internal Called by PDF class to wire up font resolution.
   */
  setFontRefResolver(resolver: FontRefResolver): void {
    this.fontRefResolver = resolver;
  }

  /**
   * Get a font reference for an embedded font.
   *
   * The reference is available immediately because refs are pre-allocated
   * when fonts are embedded. Actual font objects are created at save time.
   */
  getFontRef(font: EmbeddedFont): PdfRef {
    if (!this.fontRefResolver) {
      throw new Error("Font resolver not set. This is an internal error.");
    }

    return this.fontRefResolver(font);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Object Operations (delegated to registry)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a new object, assigning it a reference.
   */
  register(obj: PdfObject): PdfRef {
    return this.registry.register(obj);
  }

  /**
   * Resolve an object by reference (async, fetches if needed).
   */
  resolve(ref: PdfRef): Promise<PdfObject | null> {
    return this.registry.resolve(ref);
  }

  /**
   * Get an object by reference (sync, only if already loaded).
   */
  getObject(ref: PdfRef): PdfObject | null {
    return this.registry.getObject(ref);
  }

  /**
   * Get the reference for an object.
   */
  getRef(obj: PdfObject): PdfRef | null {
    return this.registry.getRef(obj);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Warnings
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a warning message.
   */
  addWarning(message: string): void {
    this.registry.addWarning(message);
  }

  /**
   * Get all warnings.
   */
  get warnings(): string[] {
    return this.registry.warnings;
  }
}
