/**
 * High-level PDF document API.
 *
 * Provides a user-friendly interface for loading, modifying, and saving PDFs.
 * Wraps the low-level parsing and writing infrastructure.
 */

import { AnnotationFlattener } from "#src/annotations/flattener";
import type { FlattenAnnotationsOptions } from "#src/annotations/types";
import type { AddAttachmentOptions, AttachmentInfo } from "#src/attachments/types";
import { hasChanges } from "#src/document/change-collector";
import type { FlattenOptions } from "#src/document/forms/form-flattener";
import { isLinearizationDict } from "#src/document/linearization";
import { ObjectCopier } from "#src/document/object-copier";
import { ObjectRegistry } from "#src/document/object-registry";
import {
  PDFExtGState,
  PDFFormXObject,
  PDFShading,
  PDFShadingPattern,
  PDFTilingPattern,
  type AxialShadingOptions,
  type ExtGStateOptions,
  type FormXObjectOptions,
  type ImagePatternOptions,
  type LinearGradientOptions,
  type RadialShadingOptions,
  type ShadingPatternOptions,
  type TilingPatternOptions,
} from "#src/drawing/resources/index";
import { serializeOperators } from "#src/drawing/serialize";
import type { EmbeddedFont, EmbedFontOptions } from "#src/fonts/embedded-font";
import { formatPdfDate, parsePdfDate } from "#src/helpers/format";
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
import { generateEncryption, reconstructEncryptDict } from "#src/security/encryption-generator";
import { PermissionDeniedError } from "#src/security/errors";
import { DEFAULT_PERMISSIONS, type Permissions } from "#src/security/permissions";
import type { StandardSecurityHandler } from "#src/security/standard-handler.ts";
import type { SignOptions, SignResult } from "#src/signatures/types";
import type { FindTextOptions, PageText, TextMatch } from "#src/text/types";
import { writeComplete, writeIncremental } from "#src/writer/pdf-writer";
import { randomBytes } from "@noble/ciphers/utils.js";
import { deflate } from "pako";

import { PDFAttachments } from "./pdf-attachments";
import { PDFCatalog } from "./pdf-catalog";
import { PDFContext, type DocumentInfo } from "./pdf-context";
import { PDFEmbeddedPage } from "./pdf-embedded-page";
import { PDFFonts } from "./pdf-fonts";
import { PDFForm } from "./pdf-form";
import { PDFPage } from "./pdf-page";
import { PDFPageTree } from "./pdf-page-tree";
import type {
  AuthenticationResult,
  EncryptionAlgorithmOption,
  PendingSecurityState,
  ProtectionOptions,
  SecurityInfo,
} from "./pdf-security";
import { PDFSignature } from "./pdf-signature";

/**
 * Options for loading a PDF.
 */
export interface LoadOptions extends ParseOptions {
  // Inherits credentials, lenient from ParseOptions
}

/**
 * Options for flattening all interactive content.
 */
export interface FlattenAllOptions {
  /** Options for form field flattening */
  form?: FlattenOptions;
  /** Options for annotation flattening */
  annotations?: FlattenAnnotationsOptions;
}

/**
 * Result of flattening all interactive content.
 */
export interface FlattenAllResult {
  /** Number of layers (OCGs) flattened */
  layers: number;
  /** Number of form fields flattened */
  formFields: number;
  /** Number of annotations flattened */
  annotations: number;
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

  /**
   * Compress uncompressed streams with FlateDecode (default: true).
   *
   * When enabled, streams without a /Filter entry will be compressed
   * before writing. Streams that already have filters (including image
   * formats like DCTDecode/JPXDecode) are left unchanged.
   */
  compressStreams?: boolean;

  /**
   * Minimum stream size in bytes to attempt compression (default: 512).
   *
   * Streams smaller than this threshold are written uncompressed.
   * Deflate initialization has a fixed overhead that dominates for small
   * payloads, and tiny streams rarely achieve meaningful compression.
   *
   * Set to 0 to compress all streams regardless of size.
   */
  compressionThreshold?: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trapped status indicating whether trapping has been applied.
 * - "True": Document has been trapped
 * - "False": Document has not been trapped
 * - "Unknown": Unknown trapping status
 */
export type TrappedStatus = "True" | "False" | "Unknown";

/**
 * Options for setTitle().
 */
export interface SetTitleOptions {
  /**
   * If true, PDF viewers should display the title in the window's title bar
   * instead of the filename. Sets ViewerPreferences.DisplayDocTitle.
   */
  showInWindowTitleBar?: boolean;
}

/**
 * Document metadata that can be read or written in bulk.
 */
export interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Name of the person who created the document content */
  author?: string;
  /** Subject/description of the document */
  subject?: string;
  /** Keywords associated with the document */
  keywords?: string[];
  /** Application that created the original content */
  creator?: string;
  /** Application that produced the PDF */
  producer?: string;
  /** Date the document was created */
  creationDate?: Date;
  /** Date the document was last modified */
  modificationDate?: Date;
  /** Whether the document has been trapped for printing */
  trapped?: TrappedStatus;
  /** RFC 3066 language tag (e.g., "en-US", "de-DE") */
  language?: string;
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
  private _recoveredViaBruteForce: boolean;

  /** Whether this document was recovered via brute-force parsing */
  get recoveredViaBruteForce(): boolean {
    return this._recoveredViaBruteForce;
  }

  /** Whether this document is linearized */
  private _isLinearized: boolean;

  /** Whether this document is linearized */
  get isLinearized(): boolean {
    return this._isLinearized;
  }

  /** Whether the original document uses XRef streams (PDF 1.5+) */
  private _usesXRefStreams: boolean;

  /** Whether the document uses XRef streams (PDF 1.5+) */
  get usesXRefStreams(): boolean {
    return this._usesXRefStreams;
  }

  /**
   * Whether this document was newly created (not loaded from bytes).
   * Newly created documents cannot use incremental save.
   */
  private _isNewlyCreated!: boolean;

  /**
   * Pending security state for save.
   * Tracks whether encryption should be added, removed, or unchanged.
   */
  private _pendingSecurity: PendingSecurityState = { action: "none" };

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
      isNewlyCreated: boolean;
      recoveredViaBruteForce: boolean;
      isLinearized: boolean;
      usesXRefStreams: boolean;
    },
  ) {
    this.ctx = ctx;
    this.originalBytes = originalBytes;
    this.originalXRefOffset = originalXRefOffset;
    this._isNewlyCreated = options.isNewlyCreated;
    this._recoveredViaBruteForce = options.recoveredViaBruteForce;
    this._isLinearized = options.isLinearized;
    this._usesXRefStreams = options.usesXRefStreams;

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
  // oxlint-disable-next-line typescript/require-await
  static async load(bytes: Uint8Array, options?: LoadOptions): Promise<PDF> {
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner, options);

    const parsed = parser.parse();

    // Create registry from xref
    const registry = new ObjectRegistry(parsed.xref);

    // Detect linearization by checking first object
    let isLinearized = false;

    try {
      // Find the first object (lowest object number)
      const firstObjNum = Math.min(...parsed.xref.keys());

      if (firstObjNum > 0) {
        const firstObj = parsed.getObject(PdfRef.of(firstObjNum, 0));

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

    const catalogDict = registry.resolve(rootRef);

    if (!catalogDict || !(catalogDict instanceof PdfDict)) {
      throw new Error("Document has no catalog");
    }

    const pdfCatalog = new PDFCatalog(catalogDict, registry);
    const pagesRef = catalogDict.getRef("Pages");
    const pages = pagesRef
      ? PDFPageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PDFPageTree.empty();

    // Load Info dictionary if present (for metadata access)
    const infoRef = parsed.trailer.getRef("Info");

    if (infoRef) {
      registry.resolve(infoRef);
    }

    // Extract document info from parsed document
    const info: DocumentInfo = {
      version: parsed.version,
      securityHandler: parsed.securityHandler,
      isEncrypted: parsed.isEncrypted,
      isAuthenticated: parsed.isAuthenticated,
      trailer: parsed.trailer,
    };

    const ctx = new PDFContext(registry, pdfCatalog, pages, info);

    return new PDF(ctx, bytes, originalXRefOffset, {
      isNewlyCreated: false,
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
  // oxlint-disable-next-line typescript/require-await
  async reload(bytes: Uint8Array): Promise<void> {
    const scanner = new Scanner(bytes);
    const parser = new DocumentParser(scanner);

    const parsed = parser.parse();

    // Create new registry from xref
    const registry = new ObjectRegistry(parsed.xref);
    registry.setResolver(ref => parsed.getObject(ref));

    // Detect linearization by checking first object
    let isLinearized = false;

    try {
      const firstObjNum = Math.min(...parsed.xref.keys());

      if (firstObjNum > 0) {
        const firstObj = parsed.getObject(PdfRef.of(firstObjNum, 0));

        if (firstObj instanceof PdfDict && isLinearizationDict(firstObj)) {
          isLinearized = true;
        }
      }
    } catch {
      // Ignore errors during linearization detection
    }

    // Find xref offset and detect format
    const xrefParser = new XRefParser(scanner);
    let xrefOffset: number;
    let usesXRefStreams = false;

    try {
      xrefOffset = xrefParser.findStartXRef();
      // Detect if the document uses XRef streams
      const format = xrefParser.detectXRefFormat(xrefOffset);
      usesXRefStreams = format === true;
    } catch {
      xrefOffset = 0;
    }

    // Load catalog
    const rootRef = parsed.trailer.getRef("Root");

    if (!rootRef) {
      throw new Error("Document has no catalog");
    }

    const catalogDict = registry.resolve(rootRef);

    if (!(catalogDict instanceof PdfDict)) {
      throw new Error("Document has no catalog");
    }

    const pdfCatalog = new PDFCatalog(catalogDict, registry);
    const pagesRef = catalogDict.getRef("Pages");
    const pages = pagesRef
      ? PDFPageTree.load(pagesRef, parsed.getObject.bind(parsed))
      : PDFPageTree.empty();

    // Load Info dictionary if present (for metadata change tracking)
    const infoRef = parsed.trailer.getRef("Info");

    if (infoRef) {
      registry.resolve(infoRef);
    }

    const info: DocumentInfo = {
      version: parsed.version,
      securityHandler: parsed.securityHandler,
      isEncrypted: parsed.isEncrypted,
      isAuthenticated: parsed.isAuthenticated,
      trailer: parsed.trailer,
    };

    // Update internal state
    this.ctx = new PDFContext(registry, pdfCatalog, pages, info);
    this.originalBytes = bytes;
    this.originalXRefOffset = xrefOffset;

    // Reset flags - after reload, document is no longer "newly created"
    // and any pending security changes have been applied
    this._isNewlyCreated = false;
    this._recoveredViaBruteForce = parsed.recoveredViaBruteForce;
    this._isLinearized = isLinearized;
    this._usesXRefStreams = usesXRefStreams;
    this._pendingSecurity = { action: "none" };

    // Clear cached managers so they get recreated with the new context
    this._fonts = null;
    this._attachments = null;
    this._form = undefined;

    // Re-setup font resolver for the new context
    this.ctx.setFontRefResolver(font => {
      return this.fonts.getRef(font);
    });
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
    registry.setResolver((ref: PdfRef) => registry.getObject(ref));

    const pdfCatalog = new PDFCatalog(catalogDict, registry);

    const pages = PDFPageTree.fromRoot(pagesRef, pagesDict, ref => {
      const obj = registry.getObject(ref);

      if (obj instanceof PdfDict) {
        return obj;
      }

      return null;
    });

    // Create document info for a new document
    const info: DocumentInfo = {
      version: "1.7",
      securityHandler: null,
      isEncrypted: false,
      isAuthenticated: true,
      trailer,
    };

    const ctx = new PDFContext(registry, pdfCatalog, pages, info);

    const pdf = new PDF(ctx, new Uint8Array(0), 0, {
      isNewlyCreated: true,
      recoveredViaBruteForce: false,
      isLinearized: false,
      usesXRefStreams: false,
    });

    // Set default metadata for new documents
    pdf.setMetadata({
      title: "Untitled",
      author: "Unknown",
      creator: "@libpdf/core",
      producer: "@libpdf/core",
      creationDate: new Date(),
      modificationDate: new Date(),
    });

    return pdf;
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

  /**
   * Upgrade the PDF version.
   *
   * Sets the /Version entry in the catalog dictionary. This is the standard
   * way to upgrade PDF version in incremental updates since the header
   * cannot be modified.
   *
   * The version will only be upgraded if the new version is higher than
   * the current version.
   *
   * @param version - Target version (e.g., "1.7", "2.0")
   *
   * @example
   * ```typescript
   * pdf.upgradeVersion("1.7");
   * ```
   */
  upgradeVersion(version: string): void {
    // Parse versions for comparison
    const parseVersion = (v: string): number => {
      const [major, minor] = v.split(".").map(Number);
      return major * 10 + (minor || 0);
    };

    const currentVersion = parseVersion(this.ctx.info.version);
    const targetVersion = parseVersion(version);

    // Only upgrade, never downgrade
    if (targetVersion <= currentVersion) {
      return;
    }

    // Set the version in the catalog
    const catalog = this.ctx.catalog.getDict();
    catalog.set("Version", PdfName.of(version));

    // Update internal version tracking
    this.ctx.info.version = version;
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
  // Security
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get detailed security information about the document.
   *
   * @returns Security information including encryption details and permissions
   *
   * @example
   * ```typescript
   * const security = pdf.getSecurity();
   * console.log(`Algorithm: ${security.algorithm}`);
   * console.log(`Can copy: ${security.permissions.copy}`);
   * ```
   */
  getSecurity(): SecurityInfo {
    const handler = this.ctx.info.securityHandler;

    if (!this.isEncrypted || !handler) {
      return {
        isEncrypted: false,
        permissions: DEFAULT_PERMISSIONS,
      };
    }

    const encryption = handler.encryption;

    // Map internal algorithm to public API type
    let algorithm: EncryptionAlgorithmOption | undefined;

    switch (encryption.algorithm) {
      case "RC4":
        algorithm = encryption.keyLengthBits <= 40 ? "RC4-40" : "RC4-128";
        break;
      case "AES-128":
        algorithm = "AES-128";
        break;
      case "AES-256":
        algorithm = "AES-256";
        break;
    }

    // Determine how the document was authenticated
    let authenticatedAs: "user" | "owner" | null = null;

    if (handler.isAuthenticated) {
      authenticatedAs = handler.hasOwnerAccess ? "owner" : "user";
    }

    // For owner access, all permissions are granted regardless of flags
    const permissions = handler.hasOwnerAccess ? DEFAULT_PERMISSIONS : handler.permissions;

    return {
      isEncrypted: true,
      algorithm,
      keyLength: encryption.keyLengthBits,
      revision: encryption.revision,
      hasUserPassword: true, // We can't easily detect empty user password after the fact
      hasOwnerPassword: true,
      authenticatedAs,
      permissions,
      encryptMetadata: encryption.encryptMetadata,
    };
  }

  /**
   * Get the current permission flags.
   *
   * Returns all permissions as true for unencrypted documents.
   * For encrypted documents authenticated with owner password, all are true.
   *
   * @returns Current permission flags
   *
   * @example
   * ```typescript
   * const perms = pdf.getPermissions();
   * if (!perms.copy) {
   *   console.log("Copy/paste is restricted");
   * }
   * ```
   */
  getPermissions(): Permissions {
    const handler = this.ctx.info.securityHandler;

    if (!this.isEncrypted || !handler) {
      return DEFAULT_PERMISSIONS;
    }

    // Owner access grants all permissions
    if (handler.hasOwnerAccess) {
      return DEFAULT_PERMISSIONS;
    }

    return handler.permissions;
  }

  /**
   * Check if the document was authenticated with owner-level access.
   *
   * Owner access grants all permissions regardless of permission flags.
   * Returns true for unencrypted documents.
   *
   * @returns true if owner access is available
   */
  hasOwnerAccess(): boolean {
    if (!this.isEncrypted) {
      return true;
    }

    const handler = this.ctx.info.securityHandler;

    return handler?.hasOwnerAccess ?? false;
  }

  /**
   * Attempt to authenticate with a password.
   *
   * Use this to upgrade access (e.g., from user to owner) or to
   * try a different password without reloading the document.
   *
   * @param password - Password to try
   * @returns Authentication result
   *
   * @example
   * ```typescript
   * // Try to get owner access
   * const result = pdf.authenticate("ownerPassword");
   * if (result.isOwner) {
   *   pdf.removeProtection();
   * }
   * ```
   */
  authenticate(password: string): AuthenticationResult {
    const handler = this.ctx.info.securityHandler;

    if (!this.isEncrypted || !handler) {
      return {
        authenticated: true,
        isOwner: true,
        permissions: DEFAULT_PERMISSIONS,
      };
    }

    const result = handler.authenticateWithString(password);

    // For owner access, all permissions are granted
    const permissions = result.isOwner ? DEFAULT_PERMISSIONS : result.permissions;

    return {
      authenticated: result.authenticated,
      passwordType: result.passwordType,
      isOwner: result.isOwner,
      permissions,
    };
  }

  /**
   * Remove all encryption from the document.
   *
   * After calling this, the document will be saved without encryption.
   * Requires owner access, or user access with modify permission.
   *
   * @throws {PermissionDeniedError} If insufficient permissions to remove protection
   *
   * @example
   * ```typescript
   * // Remove encryption from a document
   * const pdf = await PDF.load(bytes, { credentials: "ownerPassword" });
   * pdf.removeProtection();
   * const unprotectedBytes = await pdf.save();
   * ```
   */
  removeProtection(): void {
    // For unencrypted documents, this is a no-op
    if (!this.isEncrypted) {
      return;
    }

    const handler = this.ctx.info.securityHandler;

    if (!handler) {
      return;
    }

    // Check permissions
    if (!handler.hasOwnerAccess && !handler.permissions.modify) {
      throw new PermissionDeniedError(
        "Cannot remove protection: requires owner access or modify permission",
        "modify",
      );
    }

    // Mark that encryption should be removed on save
    this._pendingSecurity = { action: "remove" };
  }

  /**
   * Add or change document encryption.
   *
   * If the document is already encrypted, requires owner access to change.
   * If unencrypted, can be called without restrictions.
   *
   * @param options - Protection options (passwords, permissions, algorithm)
   * @throws {PermissionDeniedError} If insufficient permissions to change protection
   *
   * @example
   * ```typescript
   * // Add protection to unencrypted document
   * pdf.setProtection({
   *   userPassword: "secret",
   *   ownerPassword: "admin",
   *   permissions: { copy: false, print: true },
   * });
   *
   * // Change to stronger algorithm
   * pdf.setProtection({
   *   algorithm: "AES-256",
   * });
   * ```
   */
  setProtection(options: ProtectionOptions): void {
    // If encrypted, need owner access to change
    if (this.isEncrypted) {
      const handler = this.ctx.info.securityHandler;

      if (handler && !handler.hasOwnerAccess) {
        throw new PermissionDeniedError("Cannot change protection: requires owner access");
      }
    }

    // Mark that encryption should be applied on save
    this._pendingSecurity = { action: "encrypt", options };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────────

  /** Cached Info dictionary */
  private _infoDict: PdfDict | null = null;

  /**
   * Get or create the Info dictionary.
   * Creates a new Info dictionary if one doesn't exist.
   */
  private getInfoDict(): PdfDict {
    if (this._infoDict) {
      return this._infoDict;
    }

    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (infoRef) {
      const existing = this.ctx.registry.getObject(infoRef);

      if (existing instanceof PdfDict) {
        this._infoDict = existing;

        return this._infoDict;
      }
    }

    // Create new Info dictionary
    const infoDict = new PdfDict([
      ["Title", PdfString.fromString("Untitled")],
      ["Author", PdfString.fromString("Unknown")],
      ["Creator", PdfString.fromString("@libpdf/core")],
      ["Producer", PdfString.fromString("@libpdf/core")],
      ["CreationDate", PdfString.fromString(formatPdfDate(new Date()))],
      ["ModDate", PdfString.fromString(formatPdfDate(new Date()))],
    ]);

    const newRef = this.ctx.registry.register(infoDict);
    this.ctx.info.trailer.set("Info", newRef);
    this._infoDict = infoDict;

    return this._infoDict;
  }

  /**
   * Get the document title.
   *
   * @returns The title, or undefined if not set
   *
   * @example
   * ```typescript
   * const title = pdf.getTitle();
   * if (title) {
   *   console.log(`Document: ${title}`);
   * }
   * ```
   */
  getTitle(): string | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    return info.getString("Title")?.asString();
  }

  /**
   * Set the document title.
   *
   * @param title - The document title
   * @param options - Additional options (e.g., showInWindowTitleBar)
   *
   * @example
   * ```typescript
   * pdf.setTitle("Quarterly Report Q4 2024");
   *
   * // Show title in viewer's title bar instead of filename
   * pdf.setTitle("My Document", { showInWindowTitleBar: true });
   * ```
   */
  setTitle(title: string, options?: SetTitleOptions): void {
    this.getInfoDict().set("Title", PdfString.fromString(title));

    if (options?.showInWindowTitleBar) {
      this.getOrCreateViewerPreferences().set("DisplayDocTitle", PdfBool.of(true));
    }
  }

  /**
   * Get the document author.
   *
   * @returns The author, or undefined if not set
   */
  getAuthor(): string | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    return info.getString("Author")?.asString();
  }

  /**
   * Set the document author.
   *
   * @param author - The person who created the document content
   *
   * @example
   * ```typescript
   * pdf.setAuthor("Jane Smith");
   * ```
   */
  setAuthor(author: string): void {
    this.getInfoDict().set("Author", PdfString.fromString(author));
  }

  /**
   * Get the document subject.
   *
   * @returns The subject, or undefined if not set
   */
  getSubject(): string | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    return info.getString("Subject")?.asString();
  }

  /**
   * Set the document subject.
   *
   * @param subject - The subject or description of the document
   *
   * @example
   * ```typescript
   * pdf.setSubject("Financial summary for Q4");
   * ```
   */
  setSubject(subject: string): void {
    this.getInfoDict().set("Subject", PdfString.fromString(subject));
  }

  /**
   * Get the document keywords.
   *
   * @returns Array of keywords, or undefined if not set
   */
  getKeywords(): string[] | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    const keywordsStr = info.getString("Keywords");

    if (!keywordsStr) {
      return undefined;
    }

    const keywords = keywordsStr.asString();

    // Split on whitespace, filter empty strings
    // Returns empty array for empty string (which is valid - explicitly set to no keywords)
    return keywords.split(/\s+/).filter(k => k.length > 0);
  }

  /**
   * Set the document keywords.
   *
   * @param keywords - Array of keywords associated with the document
   *
   * @example
   * ```typescript
   * pdf.setKeywords(["finance", "quarterly", "2024", "Q4"]);
   * ```
   */
  setKeywords(keywords: string[]): void {
    this.getInfoDict().set("Keywords", PdfString.fromString(keywords.join(" ")));
  }

  /**
   * Get the creator application.
   *
   * @returns The creator application, or undefined if not set
   */
  getCreator(): string | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    return info.getString("Creator")?.asString();
  }

  /**
   * Set the creator application.
   *
   * @param creator - The application that created the original content
   *
   * @example
   * ```typescript
   * pdf.setCreator("Report Generator v2.0");
   * ```
   */
  setCreator(creator: string): void {
    this.getInfoDict().set("Creator", PdfString.fromString(creator));
  }

  /**
   * Get the producer application.
   *
   * @returns The producer application, or undefined if not set
   */
  getProducer(): string | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    return info.getString("Producer")?.asString();
  }

  /**
   * Set the producer application.
   *
   * @param producer - The application that produced the PDF
   *
   * @example
   * ```typescript
   * pdf.setProducer("@libpdf/core");
   * ```
   */
  setProducer(producer: string): void {
    this.getInfoDict().set("Producer", PdfString.fromString(producer));
  }

  /**
   * Get the document creation date.
   *
   * @returns The creation date, or undefined if not set or invalid
   */
  getCreationDate(): Date | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    const dateStr = info.getString("CreationDate")?.asString();

    if (!dateStr) {
      return undefined;
    }

    return parsePdfDate(dateStr);
  }

  /**
   * Set the document creation date.
   *
   * @param date - The date the document was created
   *
   * @example
   * ```typescript
   * pdf.setCreationDate(new Date());
   * ```
   */
  setCreationDate(date: Date): void {
    this.getInfoDict().set("CreationDate", PdfString.fromString(formatPdfDate(date)));
  }

  /**
   * Get the document modification date.
   *
   * @returns The modification date, or undefined if not set or invalid
   */
  getModificationDate(): Date | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    const dateStr = info.getString("ModDate")?.asString();

    if (!dateStr) {
      return undefined;
    }

    return parsePdfDate(dateStr);
  }

  /**
   * Set the document modification date.
   *
   * @param date - The date the document was last modified
   *
   * @example
   * ```typescript
   * pdf.setModificationDate(new Date());
   * ```
   */
  setModificationDate(date: Date): void {
    this.getInfoDict().set("ModDate", PdfString.fromString(formatPdfDate(date)));
  }

  /**
   * Get the document trapped status.
   *
   * @returns The trapped status, or undefined if not set
   */
  getTrapped(): TrappedStatus | undefined {
    const infoRef = this.ctx.info.trailer.getRef("Info");

    if (!infoRef) {
      return undefined;
    }

    const info = this.ctx.registry.getObject(infoRef);

    if (!(info instanceof PdfDict)) {
      return undefined;
    }

    const trapped = info.getName("Trapped")?.value;

    if (trapped === "True" || trapped === "False" || trapped === "Unknown") {
      return trapped;
    }

    return undefined;
  }

  /**
   * Set the document trapped status.
   *
   * Trapping is a prepress technique to prevent gaps between colors.
   *
   * @param trapped - The trapped status
   *
   * @example
   * ```typescript
   * pdf.setTrapped("True");
   * ```
   */
  setTrapped(trapped: TrappedStatus): void {
    this.getInfoDict().set("Trapped", PdfName.of(trapped));
  }

  /**
   * Get the document language.
   *
   * Note: Unlike other metadata, language is stored in the Catalog, not Info.
   *
   * @returns RFC 3066 language tag, or undefined if not set
   */
  getLanguage(): string | undefined {
    const catalog = this.ctx.catalog.getDict();

    return catalog.getString("Lang")?.asString();
  }

  /**
   * Set the document language.
   *
   * Note: Unlike other metadata, language is stored in the Catalog, not Info.
   *
   * @param language - RFC 3066 language tag (e.g., "en-US", "de-DE")
   *
   * @example
   * ```typescript
   * pdf.setLanguage("en-US");
   * ```
   */
  setLanguage(language: string): void {
    this.ctx.catalog.getDict().set("Lang", PdfString.fromString(language));
  }

  /**
   * Get all document metadata.
   *
   * @returns Object containing all metadata fields
   *
   * @example
   * ```typescript
   * const metadata = pdf.getMetadata();
   * console.log(`Title: ${metadata.title}`);
   * console.log(`Author: ${metadata.author}`);
   * ```
   */
  getMetadata(): DocumentMetadata {
    return {
      title: this.getTitle(),
      author: this.getAuthor(),
      subject: this.getSubject(),
      keywords: this.getKeywords(),
      creator: this.getCreator(),
      producer: this.getProducer(),
      creationDate: this.getCreationDate(),
      modificationDate: this.getModificationDate(),
      trapped: this.getTrapped(),
      language: this.getLanguage(),
    };
  }

  /**
   * Set multiple metadata fields at once.
   *
   * @param metadata - Object containing metadata fields to set
   *
   * @example
   * ```typescript
   * pdf.setMetadata({
   *   title: "Quarterly Report",
   *   author: "Jane Smith",
   *   creationDate: new Date(),
   * });
   * ```
   */
  setMetadata(metadata: DocumentMetadata): void {
    if (metadata.title !== undefined) {
      this.setTitle(metadata.title);
    }

    if (metadata.author !== undefined) {
      this.setAuthor(metadata.author);
    }

    if (metadata.subject !== undefined) {
      this.setSubject(metadata.subject);
    }

    if (metadata.keywords !== undefined) {
      this.setKeywords(metadata.keywords);
    }

    if (metadata.creator !== undefined) {
      this.setCreator(metadata.creator);
    }

    if (metadata.producer !== undefined) {
      this.setProducer(metadata.producer);
    }

    if (metadata.creationDate !== undefined) {
      this.setCreationDate(metadata.creationDate);
    }

    if (metadata.modificationDate !== undefined) {
      this.setModificationDate(metadata.modificationDate);
    }

    if (metadata.trapped !== undefined) {
      this.setTrapped(metadata.trapped);
    }

    if (metadata.language !== undefined) {
      this.setLanguage(metadata.language);
    }
  }

  /**
   * Get or create the ViewerPreferences dictionary.
   */
  private getOrCreateViewerPreferences(): PdfDict {
    const catalog = this.ctx.catalog.getDict();
    const existing = catalog.getDict("ViewerPreferences", this.ctx.resolve.bind(this.ctx));

    if (existing) {
      return existing;
    }

    // Create new ViewerPreferences
    const prefs = new PdfDict();
    catalog.set("ViewerPreferences", prefs);

    return prefs;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Object access
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get an object by reference.
   *
   * Objects are cached and tracked for modifications.
   */
  getObject(ref: PdfRef): PdfObject | null {
    return this.ctx.resolve(ref);
  }

  /**
   * Get the document catalog dictionary.
   *
   * Note: For internal use, prefer accessing the catalog via context which
   * provides higher-level methods for working with catalog structures.
   */
  getCatalog(): PdfDict {
    return this.ctx.catalog.getDict();
  }

  /**
   * Get all pages in document order.
   */
  getPages(): PDFPage[] {
    const refs = this.ctx.pages.getPages();
    const pages: PDFPage[] = [];

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const dict = this.ctx.resolve(ref);

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
  getPage(index: number): PDFPage | null {
    const ref = this.ctx.pages.getPage(index);

    if (!ref) {
      return null;
    }

    const dict = this.ctx.resolve(ref);

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
  // oxlint-disable-next-line typescript/require-await -- Public async API kept for backward compat; ObjectCopier is sync.
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
      const srcPage = source.getPage(index);

      if (!srcPage) {
        throw new Error(`Source page ${index} not found`);
      }

      const copiedPageRef = copier.copyPage(srcPage.ref);
      copiedRefs.push(copiedPageRef);
    }

    // Insert copied pages at specified position (or append)
    let insertIndex = options.insertAt ?? this.getPageCount();

    for (const copiedRef of copiedRefs) {
      const copiedDict = this.getObject(copiedRef);

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
  // oxlint-disable-next-line typescript/require-await -- Public async API kept for backward compat; ObjectCopier is sync.
  async embedPage(source: PDF, pageIndex: number): Promise<PDFEmbeddedPage> {
    const srcPage = source.getPage(pageIndex);

    if (!srcPage) {
      throw new RangeError(`Page index ${pageIndex} out of bounds`);
    }

    // Get page content streams and concatenate
    const contentData = this.getPageContentData(source, srcPage);

    // Copy resources from source to dest
    const copier = new ObjectCopier(source, this, { includeAnnotations: false });

    const srcResources = srcPage.dict.getDict("Resources", source.getObject.bind(source));

    let resources: PdfDict;

    if (srcResources) {
      const copied = copier.copyObject(srcResources);

      // This is guaranteed by our checks above
      resources = copied instanceof PdfDict ? copied : new PdfDict();
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
          PdfNumber.of(mediaBox.x),
          PdfNumber.of(mediaBox.y),
          PdfNumber.of(mediaBox.x + mediaBox.width),
          PdfNumber.of(mediaBox.y + mediaBox.height),
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
  private getPageContentData(source: PDF, page: PDFPage): Uint8Array {
    const contents = page.dict.get("Contents", source.getObject.bind(source));

    if (!contents) {
      return new Uint8Array(0);
    }

    // Single stream (resolved from ref or direct)
    if (contents instanceof PdfStream) {
      return contents.getDecodedData();
    }

    // Array of streams - concatenate with newlines
    if (contents instanceof PdfArray) {
      const chunks: Uint8Array[] = [];

      for (let i = 0; i < contents.length; i++) {
        const ref = contents.at(i);

        if (ref instanceof PdfRef) {
          const stream = source.getObject(ref);

          if (stream instanceof PdfStream) {
            if (chunks.length > 0) {
              // Add newline separator
              chunks.push(new Uint8Array([0x0a]));
            }

            chunks.push(stream.getDecodedData());
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
  embedImage(bytes: Uint8Array): PDFImage {
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
  embedJpeg(bytes: Uint8Array): PDFImage {
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
  embedPng(bytes: Uint8Array): PDFImage {
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
  // Low-Level Drawing API - Shadings
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an axial (linear) shading with explicit coordinates.
   *
   * @param options - Shading options including coords and color stops
   * @returns PDFShading resource for use with page.registerShading()
   *
   * @example
   * ```typescript
   * const gradient = pdf.createAxialShading({
   *   coords: [0, 0, 100, 0], // x0, y0, x1, y1
   *   stops: [
   *     { offset: 0, color: rgb(1, 0, 0) },
   *     { offset: 0.5, color: rgb(0, 1, 0) },
   *     { offset: 1, color: rgb(0, 0, 1) },
   *   ],
   * });
   * const shadingName = page.registerShading(gradient);
   * ```
   */
  createAxialShading(options: AxialShadingOptions): PDFShading {
    const dict = PDFShading.createAxialDict(options);
    const ref = this.register(dict);

    return new PDFShading(ref, "axial");
  }

  /**
   * Create a radial shading with explicit coordinates.
   *
   * @param options - Shading options including coords and color stops
   * @returns PDFShading resource for use with page.registerShading()
   *
   * @example
   * ```typescript
   * const radial = pdf.createRadialShading({
   *   coords: [50, 50, 0, 50, 50, 50], // x0, y0, r0, x1, y1, r1
   *   stops: [
   *     { offset: 0, color: rgb(1, 1, 1) },
   *     { offset: 1, color: rgb(0, 0, 0) },
   *   ],
   * });
   * const shadingName = page.registerShading(radial);
   * ```
   */
  createRadialShading(options: RadialShadingOptions): PDFShading {
    const dict = PDFShading.createRadialDict(options);
    const ref = this.register(dict);

    return new PDFShading(ref, "radial");
  }

  /**
   * Create a linear gradient using angle and length (CSS-style).
   *
   * @param options - Gradient options including angle, length, and color stops
   * @returns PDFShading resource for use with page.registerShading()
   *
   * @example
   * ```typescript
   * const gradient = pdf.createLinearGradient({
   *   angle: 90, // CSS convention: 0 = up, 90 = right, 180 = down, 270 = left
   *   length: 100,
   *   stops: [
   *     { offset: 0, color: rgb(1, 0, 0) },
   *     { offset: 1, color: rgb(0, 0, 1) },
   *   ],
   * });
   * const shadingName = page.registerShading(gradient);
   * ```
   */
  createLinearGradient(options: LinearGradientOptions): PDFShading {
    const coords = PDFShading.calculateAxialCoords(options.angle, options.length);
    const dict = PDFShading.createAxialDict({ coords, stops: options.stops });
    const ref = this.register(dict);

    return new PDFShading(ref, "axial");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Low-Level Drawing API - Patterns
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a tiling pattern.
   *
   * @param options - Pattern options including bbox, step sizes, and operators
   * @returns PDFPattern resource for use with page.registerPattern()
   *
   * @example
   * ```typescript
   * const pattern = pdf.createTilingPattern({
   *   bbox: { x: 0, y: 0, width: 10, height: 10 },
   *   xStep: 10,
   *   yStep: 10,
   *   operators: [
   *     ops.setNonStrokingRGB(0.8, 0.8, 0.8),
   *     ops.rectangle(0, 0, 5, 5),
   *     ops.fill(),
   *   ],
   * });
   * const patternName = page.registerPattern(pattern);
   * ```
   */
  createTilingPattern(options: TilingPatternOptions): PDFTilingPattern {
    const contentBytes = serializeOperators(options.operators);
    const stream = PDFTilingPattern.createStream(options, contentBytes);
    const ref = this.register(stream);

    return new PDFTilingPattern(ref);
  }

  /**
   * Create an image pattern for filling shapes with a tiled image.
   *
   * This is a convenience method that creates a tiling pattern containing
   * an embedded image. Similar to CSS `background-image` with `background-repeat`.
   *
   * @param options - Image pattern options including the image and tile dimensions
   * @returns PDFTilingPattern resource for use with page.registerPattern()
   *
   * @example
   * ```typescript
   * // Create a repeating texture pattern
   * const texture = pdf.embedImage(textureBytes);
   * const pattern = pdf.createImagePattern({
   *   image: texture,
   *   width: 50,   // Each tile is 50x50 points
   *   height: 50,
   * });
   *
   * const patternName = page.registerPattern(pattern);
   * page.drawOperators([
   *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
   *   ops.setNonStrokingColorN(patternName),
   *   ops.rectangle(100, 100, 300, 200),
   *   ops.fill(),
   * ]);
   *
   * // Or use with PathBuilder
   * page.drawPath()
   *   .rectangle(100, 100, 300, 200)
   *   .fill({ pattern });
   * ```
   *
   * @example
   * ```typescript
   * // Horizontal stripes using repeat-x
   * const stripe = pdf.embedImage(stripeBytes);
   * const pattern = pdf.createImagePattern({
   *   image: stripe,
   *   width: 100,
   *   height: 20,
   *   repeat: "repeat-x",
   * });
   * ```
   */
  createImagePattern(options: ImagePatternOptions): PDFTilingPattern {
    const stream = PDFTilingPattern.createImageStream(options);
    const ref = this.register(stream);

    return new PDFTilingPattern(ref);
  }

  /**
   * Create a shading pattern from a shading (gradient).
   *
   * Shading patterns wrap a gradient so it can be used as a fill or stroke color,
   * just like tiling patterns. This is the recommended way to use gradients with
   * PathBuilder and high-level drawing methods.
   *
   * @param options - Shading pattern options (shading and optional matrix)
   * @returns PDFShadingPattern resource for use with page.registerPattern()
   *
   * @example
   * ```typescript
   * // Create a gradient
   * const gradient = pdf.createAxialShading({
   *   coords: [0, 0, 100, 0],
   *   stops: [
   *     { offset: 0, color: rgb(1, 0, 0) },
   *     { offset: 1, color: rgb(0, 0, 1) },
   *   ],
   * });
   *
   * // Wrap in a pattern
   * const gradientPattern = pdf.createShadingPattern({ shading: gradient });
   *
   * // Use with PathBuilder
   * page.drawPath()
   *   .circle(200, 200, 50)
   *   .fill({ pattern: gradientPattern });
   *
   * // Or register and use directly
   * const patternName = page.registerPattern(gradientPattern);
   * page.drawOperators([
   *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
   *   ops.setNonStrokingColorN(patternName),
   *   ops.rectangle(100, 100, 200, 200),
   *   ops.fill(),
   * ]);
   * ```
   */
  createShadingPattern(options: ShadingPatternOptions): PDFShadingPattern {
    const dict = PDFShadingPattern.createDict(options);
    const ref = this.register(dict);

    return new PDFShadingPattern(ref, options.shading);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Low-Level Drawing API - Extended Graphics State
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an extended graphics state (ExtGState) for advanced graphics options.
   *
   * @param options - ExtGState options including opacity and blend mode
   * @returns PDFExtGState resource for use with page.registerExtGState()
   *
   * @example
   * ```typescript
   * const gs = pdf.createExtGState({
   *   fillOpacity: 0.5,
   *   strokeOpacity: 0.8,
   *   blendMode: "Multiply",
   * });
   * const gsName = page.registerExtGState(gs);
   * ```
   */
  createExtGState(options: ExtGStateOptions): PDFExtGState {
    const dict = PDFExtGState.createDict(options);
    const ref = this.register(dict);

    return new PDFExtGState(ref);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Low-Level Drawing API - Form XObjects
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a Form XObject (reusable content).
   *
   * @param options - Form XObject options including bbox and operators
   * @returns PDFFormXObject resource for use with page.registerXObject()
   *
   * @example
   * ```typescript
   * const stamp = pdf.createFormXObject({
   *   bbox: { x: 0, y: 0, width: 100, height: 50 },
   *   operators: [
   *     ops.setNonStrokingRGB(1, 0, 0),
   *     ops.rectangle(0, 0, 100, 50),
   *     ops.fill(),
   *   ],
   * });
   * const xobjectName = page.registerXObject(stamp);
   *
   * // Use on multiple pages
   * for (const page of pdf.getPages()) {
   *   page.drawOperators([
   *     ops.pushGraphicsState(),
   *     ops.concatMatrix(1, 0, 0, 1, 200, 700),
   *     ops.paintXObject(xobjectName),
   *     ops.popGraphicsState(),
   *   ]);
   * }
   * ```
   */
  createFormXObject(options: FormXObjectOptions): PDFFormXObject {
    const contentBytes = serializeOperators(options.operators);
    const stream = PDFFormXObject.createStream(options, contentBytes);

    const ref = this.register(stream);

    return new PDFFormXObject(ref, options.bbox);
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
  getAttachments(): Map<string, AttachmentInfo> {
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
  getAttachment(name: string): Uint8Array | null {
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
  hasAttachment(name: string): boolean {
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
  addAttachment(name: string, data: Uint8Array, options: AddAttachmentOptions = {}): void {
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
  removeAttachment(name: string): boolean {
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
  getForm(): PDFForm | null {
    if (this._form === undefined) {
      this._form = PDFForm.load(this.ctx);
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
  getOrCreateForm(): PDFForm {
    const existing = this.getForm();

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
    const catalog = this.getCatalog();
    catalog.set("AcroForm", acroFormRef);

    // Reload form cache
    this._form = PDFForm.load(this.ctx);

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
  hasLayers(): boolean {
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
  getLayers(): LayerInfo[] {
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
  flattenLayers(): FlattenLayersResult {
    return LayerUtils.flattenLayers(this.ctx);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Annotation Flattening
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Flatten all annotations in the document into static page content.
   *
   * Annotations are converted to static graphics drawn on each page's content.
   * After flattening, annotations are removed from the document.
   *
   * Annotations without appearances that cannot be generated are removed.
   * Widget annotations (form fields) and Link annotations are not affected.
   *
   * @param options - Flattening options
   * @returns Total number of annotations flattened across all pages
   *
   * @example
   * ```typescript
   * // Flatten all annotations in the document
   * const count = pdf.flattenAnnotations();
   * console.log(`Flattened ${count} annotations`);
   *
   * // Flatten but keep link annotations interactive
   * pdf.flattenAnnotations({ exclude: ["Link"] });
   * ```
   */
  flattenAnnotations(options?: FlattenAnnotationsOptions): number {
    const flattener = new AnnotationFlattener(this.ctx.registry);

    let totalFlattened = 0;
    const pageRefs = this.ctx.pages.getPages();

    for (const pageRef of pageRefs) {
      const pageDict = this.ctx.resolve(pageRef);

      if (!(pageDict instanceof PdfDict)) {
        continue;
      }

      totalFlattened += flattener.flattenPage(pageDict, options);
    }

    return totalFlattened;
  }

  /**
   * Flatten all interactive content in the document.
   *
   * This is a convenience method that flattens:
   * - Layers (OCGs) - prevents hidden content attacks
   * - Form fields - converts to static text/graphics
   * - Annotations - bakes appearances into page content
   *
   * Use this before signing to ensure all content is visible and static,
   * preventing attacks where content could be hidden or changed after signing.
   *
   * @param options - Options for flattening
   * @returns Statistics about what was flattened
   *
   * @example
   * ```typescript
   * // Security workflow before signing
   * const result = pdf.flattenAll();
   * console.log(`Flattened: ${result.layers} layers, ${result.formFields} fields, ${result.annotations} annotations`);
   * await pdf.sign({ signer });
   * ```
   */
  flattenAll(options?: FlattenAllOptions): FlattenAllResult {
    // Flatten layers first (affects visibility of everything)
    const layerResult = this.flattenLayers();

    // Flatten form fields
    const form = this.getForm();
    let formFields = 0;

    if (form) {
      formFields = form.getFields().length;
      form.flatten(options?.form);
    }

    // Flatten annotations last (may reference form widgets which are now gone)
    // By default, remove Link annotations since they contain actions that
    // Adobe considers "hidden behavior" which can cause signature validation warnings.
    const annotationOptions = {
      removeLinks: true,
      ...options?.annotations,
    };

    const annotations = this.flattenAnnotations(annotationOptions);

    return {
      layers: layerResult.layerCount,
      formFields,
      annotations,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Extraction
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extract text from all pages in the document.
   *
   * Returns an array of PageText objects, one per page, containing
   * structured text content with position information.
   *
   * @returns Array of PageText for each page
   *
   * @example
   * ```typescript
   * const allText = await pdf.extractText();
   * for (const pageText of allText) {
   *   console.log(`Page ${pageText.pageIndex}: ${pageText.text}`);
   * }
   * ```
   */
  extractText(): PageText[] {
    const pages = this.getPages();
    const results: PageText[] = [];

    for (const page of pages) {
      results.push(page.extractText());
    }

    return results;
  }

  /**
   * Search for text across all pages in the document.
   *
   * @param query - String or RegExp to search for
   * @param options - Search options (pages, case sensitivity, whole word)
   * @returns Array of matches with positions
   *
   * @example
   * ```typescript
   * // Search across all pages
   * const matches = await pdf.findText("invoice");
   *
   * // Search specific pages
   * const matches2 = await pdf.findText("total", { pages: [0, 1] });
   *
   * // Case-insensitive search
   * const matches3 = await pdf.findText("NAME", { caseSensitive: false });
   *
   * // Regex search for template placeholders
   * const placeholders = await pdf.findText(/\{\{\s*\w+\s*\}\}/g);
   * ```
   */
  findText(query: string | RegExp, options: FindTextOptions = {}): TextMatch[] {
    const pages = this.getPages();
    const pagesToSearch = options.pages ?? Array.from({ length: pages.length }, (_, i) => i);

    const results: TextMatch[] = [];

    for (const pageIndex of pagesToSearch) {
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const matches = pages[pageIndex].findText(query, options);

        results.push(...matches);
      }
    }

    return results;
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
    const pendingAction = this._pendingSecurity.action;

    return checkIncrementalSaveBlocker({
      isNewlyCreated: this._isNewlyCreated,
      isLinearized: this.isLinearized,
      recoveredViaBruteForce: this.recoveredViaBruteForce,
      encryptionChanged: pendingAction !== "none",
      encryptionAdded: pendingAction === "encrypt" && !this.isEncrypted,
      encryptionRemoved: pendingAction === "remove",
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
  // oxlint-disable-next-line typescript/require-await
  async save(options: SaveOptions = {}): Promise<Uint8Array> {
    const result = this.saveInternal(options);

    return result.bytes;
  }

  /**
   * Internal save that returns full result including xref offset.
   * Used by signing to chain incremental updates.
   */
  private saveInternal(options: SaveOptions = {}): { bytes: Uint8Array; xrefOffset: number } {
    // Finalize embedded fonts (creates PDF objects, optionally subsets)
    this.fonts.finalize(options.subsetFonts ?? false);

    const wantsIncremental = options.incremental ?? false;
    const blocker = this.canSaveIncrementally();

    // Check if incremental is requested but not possible
    if (wantsIncremental && blocker !== null) {
      this.ctx.registry.addWarning(
        `Incremental save not possible (${blocker}), performing full save`,
      );
    }

    const useIncremental = wantsIncremental && blocker === null;

    // If no changes and no security changes, return original bytes
    const hasSecurityChanges = this._pendingSecurity.action !== "none";

    if (!this.hasChanges() && !this.fonts.hasEmbeddedFonts && !hasSecurityChanges) {
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

    // Handle encryption based on pending security state
    let encryptRef: PdfRef | undefined;
    let fileId: [Uint8Array, Uint8Array] | undefined;
    let securityHandler: StandardSecurityHandler | undefined;

    if (this._pendingSecurity.action === "encrypt" && this._pendingSecurity.options) {
      // Generate new encryption
      const encryption = generateEncryption(this._pendingSecurity.options);

      // Register the encrypt dictionary
      encryptRef = this.ctx.registry.register(encryption.encryptDict);
      fileId = encryption.fileId;
      securityHandler = encryption.securityHandler;
    } else if (this._pendingSecurity.action === "none" && this.isEncrypted) {
      // Re-encrypt with original security - preserve encryption when saving encrypted documents
      const handler = this.ctx.info.securityHandler;

      if (handler) {
        // Reconstruct the encrypt dict from the parsed encryption parameters
        // We can't resolve the original encrypt ref because it would try to decrypt it
        // (the encrypt dict is never encrypted in the PDF)
        const reconstructedDict = reconstructEncryptDict(handler.encryption);

        // Register the reconstructed dict to get a reference
        encryptRef = this.ctx.registry.register(reconstructedDict);

        // Get file ID from trailer
        const idArray = this.ctx.info.trailer.getArray("ID");

        if (idArray && idArray.length >= 2) {
          const id1 = idArray.at(0);
          const id2 = idArray.at(1);

          if (id1 instanceof PdfString && id2 instanceof PdfString) {
            fileId = [id1.bytes, id2.bytes];
          }
        }

        securityHandler = handler;
      }
    }
    // Note: action === "remove" means no encrypt dict (decrypted on load, written without encryption)

    // Ensure document has an /ID (required for signatures, recommended for all PDFs)
    if (!fileId) {
      const idArray = this.ctx.info.trailer.getArray("ID");

      if (idArray && idArray.length >= 2) {
        // Preserve existing ID
        const id1 = idArray.at(0);
        const id2 = idArray.at(1);

        if (id1 instanceof PdfString && id2 instanceof PdfString) {
          fileId = [id1.bytes, id2.bytes];
        }
      }

      // Generate new ID if document doesn't have one
      if (!fileId) {
        const newId = randomBytes(16);

        fileId = [newId, newId];
      }
    }

    // For incremental saves, use the same XRef format as the original document
    // unless explicitly overridden by the caller
    const useXRefStream = options.useXRefStream ?? (useIncremental ? this.usesXRefStreams : false);

    if (useIncremental) {
      const result = writeIncremental(this.ctx.registry, {
        originalBytes: this.originalBytes,
        originalXRefOffset: this.originalXRefOffset,
        root,
        info: infoRef ?? undefined,
        encrypt: encryptRef,
        id: fileId,
        useXRefStream,
        securityHandler,
        compressStreams: options.compressStreams,
        compressionThreshold: options.compressionThreshold,
      });

      // Reset pending security state after successful save
      this._pendingSecurity = { action: "none" };

      return result;
    }

    // Full save (collectReachableRefs in writeComplete will load all reachable objects)
    const result = writeComplete(this.ctx.registry, {
      version: this.ctx.info.version,
      root,
      info: infoRef ?? undefined,
      encrypt: encryptRef,
      id: fileId,
      useXRefStream,
      securityHandler,
      compressStreams: options.compressStreams,
      compressionThreshold: options.compressionThreshold,
    });

    // Reset pending security state after successful save
    this._pendingSecurity = { action: "none" };

    return result;
  }
}
