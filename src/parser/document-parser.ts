import type { Scanner } from "#src/io/scanner";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { type CredentialInput, normalizeCredential } from "#src/security/credentials";
import {
  type EncryptionDict,
  isEncryptedTrailer,
  parseEncryptionDict,
} from "#src/security/encryption-dict";
import { EncryptionDictError } from "#src/security/errors";
import type { Permissions } from "#src/security/permissions";
import { StandardSecurityHandler, tryEmptyPassword } from "#src/security/standard-handler";

import { BruteForceParser } from "./brute-force-parser";
import { RecoverableParseError, StructureError, UnrecoverableParseError } from "./errors";
import { IndirectObjectParser, type LengthResolver } from "./indirect-object-parser";
import { ObjectStreamParser } from "./object-stream-parser";
import { type XRefEntry, XRefParser } from "./xref-parser";

/**
 * Options for document parsing.
 */
export interface ParseOptions {
  /** Enable lenient parsing for malformed PDFs (default: true) */
  lenient?: boolean;

  /**
   * Credentials for encrypted documents.
   *
   * Accepts:
   * - A plain string (shorthand for password credential)
   * - A PasswordCredential object: `{ type: "password", password: "..." }`
   * - A CertificateCredential object (future): `{ type: "certificate", ... }`
   *
   * If not provided, tries empty password for documents with owner-only encryption.
   */
  credentials?: CredentialInput;
}

/**
 * Parsed document result.
 */
export interface ParsedDocument {
  /** PDF version from header (e.g., "1.7", "2.0") */
  version: string;

  /** Combined trailer dictionary (merged from incremental updates) */
  trailer: PdfDict;

  /** Combined cross-reference entries */
  xref: Map<number, XRefEntry>;

  /** Warnings encountered during parsing */
  warnings: string[];

  /** Whether document was recovered via brute-force parsing */
  recoveredViaBruteForce: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Encryption
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether the document is encrypted */
  isEncrypted: boolean;

  /** Encryption dictionary (if encrypted) */
  encryption: EncryptionDict | null;

  /** Whether authentication succeeded */
  isAuthenticated: boolean;

  /** Document permissions (if encrypted and authenticated) */
  permissions: Permissions | null;

  /** Security handler (if encrypted) - for advanced operations */
  securityHandler: StandardSecurityHandler | null;

  /**
   * Authenticate with a password.
   * Call this if initial authentication failed or to try a different password.
   * @returns true if authentication succeeded
   */
  authenticate(password: string): boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Object access
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get an object by reference (with caching and decryption) */
  getObject(ref: PdfRef): PdfObject | null;

  /** Get the document catalog */
  getCatalog(): PdfDict | null;

  /**
   * Get the actual page count by walking the page tree.
   * This is more reliable than trusting /Count metadata for corrupted PDFs.
   */
  getPageCount(): number;

  /**
   * Get all page references by walking the page tree.
   * Returns an array of PdfRef for each reachable page, in document order.
   */
  getPages(): PdfRef[];
}

// PDF header signature: %PDF-
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

// Version pattern: X.Y where X is 1-9 and Y is 0-9
const VERSION_PATTERN = /^[1-9]\.\d$/;

// Default version when unparseable (PDFBox uses 1.7)
const DEFAULT_VERSION = "1.7";

// Maximum bytes to search for header
const HEADER_SEARCH_LIMIT = 1024;

/**
 * Top-level PDF document parser.
 *
 * Orchestrates header parsing, xref loading, trailer resolution, and object access.
 * Provides the main entry point for opening PDF files.
 *
 * @example
 * ```typescript
 * const parser = new DocumentParser(scanner);
 * const doc = await parser.parse();
 *
 * // Access catalog
 * const catalog = await doc.getCatalog();
 *
 * // Load an object by reference
 * const obj = await doc.getObject(PdfRef.of(1, 0));
 * ```
 */
export class DocumentParser {
  private readonly scanner: Scanner;
  private readonly options: ParseOptions;
  private readonly warnings: string[] = [];

  constructor(scanner: Scanner, options: ParseOptions = {}) {
    this.scanner = scanner;
    this.options = {
      lenient: options.lenient ?? true,
      credentials: options.credentials,
    };
  }

  /**
   * Parse the PDF document.
   */
  parse(): ParsedDocument {
    try {
      return this.parseNormal();
    } catch (error) {
      // Only attempt recovery for recoverable parsing errors
      if (this.options.lenient && error instanceof RecoverableParseError) {
        this.warnings.push(`Normal parsing failed: ${error.message}`);

        return this.parseWithRecovery();
      }

      // All other errors propagate (credentials, unsupported features, etc.)
      throw error;
    }
  }

  /**
   * Normal parsing path.
   */
  private parseNormal(): ParsedDocument {
    // Phase 1: Parse header
    const version = this.parseHeader();

    // Phase 2: Find startxref
    const xrefParser = new XRefParser(this.scanner);

    const startXRef = xrefParser.findStartXRef();

    // Phase 3: Parse XRef chain (follow /Prev)
    const { xref, trailer } = this.parseXRefChain(xrefParser, startXRef);

    // Phase 4: Build document with lazy object loading
    return this.buildDocument(version, xref, trailer, false);
  }

  /**
   * Recovery parsing using brute-force when normal parsing fails.
   */
  private parseWithRecovery(): ParsedDocument {
    // Try to get version even if header is malformed
    let version = DEFAULT_VERSION;

    try {
      version = this.parseHeader();
    } catch {
      this.warnings.push("Could not parse header, using default version");
    }

    // Use brute-force parser to find objects
    const bruteForce = new BruteForceParser(this.scanner);

    const result = bruteForce.recover();

    if (result === null) {
      throw new UnrecoverableParseError("Could not recover PDF structure: no objects found");
    }

    this.warnings.push(...result.warnings);

    // Build xref from recovered entries
    const xref = new Map<number, XRefEntry>();

    for (const [key, recoveredEntry] of result.xref.entries()) {
      // Key is "objNum genNum"
      const [objNumStr, genNumStr] = key.split(" ");

      const objNum = parseInt(objNumStr, 10);
      const generation = parseInt(genNumStr, 10);

      if (recoveredEntry.type === "uncompressed") {
        xref.set(objNum, { type: "uncompressed", offset: recoveredEntry.offset, generation });
      } else {
        // Compressed entry from object stream
        xref.set(objNum, {
          type: "compressed",
          streamObjNum: recoveredEntry.streamObjNum,
          indexInStream: recoveredEntry.indexInStream,
        });
      }
    }

    // Build trailer from recovered root
    const trailer = new PdfDict([
      ["Root", result.trailer.Root],
      ["Size", new PdfNumber(result.trailer.Size)],
    ]);

    return this.buildDocument(version, xref, trailer, true);
  }

  /**
   * Parse PDF header and extract version.
   *
   * Lenient handling (like pdf.js and PDFBox):
   * - Search first 1024 bytes for %PDF-
   * - Accept garbage before/after header
   * - Default to 1.4 if version unparseable
   */
  parseHeader(): string {
    const bytes = this.scanner.bytes;
    const searchLimit = Math.min(bytes.length, HEADER_SEARCH_LIMIT);

    // Search for %PDF- marker
    let headerPos = -1;
    for (let i = 0; i <= searchLimit - PDF_HEADER.length; i++) {
      if (this.matchesAt(i, PDF_HEADER)) {
        headerPos = i;
        break;
      }
    }

    if (headerPos === -1) {
      if (this.options.lenient) {
        this.warnings.push("PDF header not found, using default version");
        return DEFAULT_VERSION;
      }
      throw new StructureError("PDF header not found");
    }

    if (headerPos > 0) {
      this.warnings.push(`PDF header found at offset ${headerPos} (expected 0)`);
    }

    // Read version string after %PDF-
    const versionStart = headerPos + PDF_HEADER.length;
    let version = "";

    // Read characters until whitespace or non-version char (max 7 chars like pdf.js)
    for (let i = 0; i < 7 && versionStart + i < bytes.length; i++) {
      const byte = bytes[versionStart + i];

      // Stop at whitespace or control chars
      if (byte <= 0x20) {
        break;
      }

      version += String.fromCharCode(byte);
    }

    // Validate version format
    if (VERSION_PATTERN.test(version)) {
      return version;
    }

    // Try to extract just the version part (handle garbage after version)
    const match = version.match(/^(\d\.\d)/);
    if (match) {
      this.warnings.push(`Version string has garbage after it: ${version}`);
      return match[1];
    }

    if (this.options.lenient) {
      this.warnings.push(`Invalid PDF version: ${version}, using default`);
      return DEFAULT_VERSION;
    }

    throw new StructureError(`Invalid PDF version: ${version}`);
  }

  /**
   * Parse the XRef chain, following /Prev links for incremental updates.
   */
  private parseXRefChain(
    xrefParser: XRefParser,
    startOffset: number,
  ): { xref: Map<number, XRefEntry>; trailer: PdfDict } {
    const combinedXRef = new Map<number, XRefEntry>();
    let firstTrailer: PdfDict | null = null;

    // Track visited offsets to prevent infinite loops
    const visited = new Set<number>();
    const queue: number[] = [startOffset];

    while (queue.length > 0) {
      const offset = queue.shift();

      if (offset === undefined) {
        break;
      }

      // Circular reference check
      if (visited.has(offset)) {
        this.warnings.push(`Circular xref reference at offset ${offset}`);
        continue;
      }

      visited.add(offset);

      try {
        const xrefData = xrefParser.parseAt(offset);

        // Merge entries (first definition wins for each object number)
        for (const [objNum, entry] of xrefData.entries) {
          if (!combinedXRef.has(objNum)) {
            combinedXRef.set(objNum, entry);
          }
        }

        // Keep the first (most recent) trailer
        if (!firstTrailer) {
          firstTrailer = xrefData.trailer;
        }

        // Queue /Prev if present
        if (xrefData.prev !== undefined) {
          queue.push(xrefData.prev);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (this.options.lenient) {
          this.warnings.push(`Error parsing xref at ${offset}: ${message}`);
          continue;
        }

        throw error;
      }
    }

    if (!firstTrailer) {
      throw new StructureError("No valid trailer found");
    }

    return { xref: combinedXRef, trailer: firstTrailer };
  }

  /**
   * Build the final ParsedDocument with lazy object loading.
   */
  private buildDocument(
    version: string,
    xref: Map<number, XRefEntry>,
    trailer: PdfDict,
    recoveredViaBruteForce: boolean,
  ): ParsedDocument {
    // Object cache: "objNum genNum" -> PdfObject
    const cache = new Map<string, PdfObject>();

    // Object stream cache: streamObjNum -> ObjectStreamParser
    const objectStreamCache = new Map<number, ObjectStreamParser>();

    // ─────────────────────────────────────────────────────────────────────────────
    // Encryption setup
    // ─────────────────────────────────────────────────────────────────────────────

    let securityHandler: StandardSecurityHandler | null = null;
    let encryptionDict: EncryptionDict | null = null;

    const isEncrypted = isEncryptedTrailer(trailer);

    if (isEncrypted) {
      try {
        // Get /Encrypt dictionary
        const encryptRef = trailer.getRef("Encrypt");

        let encryptDictObj: PdfDict | null = null;

        if (encryptRef) {
          // Need to load the encrypt dict without decryption
          const entry = xref.get(encryptRef.objectNumber);

          if (entry?.type === "uncompressed") {
            const parser = new IndirectObjectParser(this.scanner);
            const result = parser.parseObjectAt(entry.offset);

            if (result.value instanceof PdfDict) {
              encryptDictObj = result.value;
            }
          }
        } else {
          // Direct dictionary (rare but valid)
          encryptDictObj = trailer.getDict("Encrypt") ?? null;
        }

        if (encryptDictObj) {
          encryptionDict = parseEncryptionDict(encryptDictObj);

          // Get file ID from trailer
          const fileId = this.getFileId(trailer);

          if (fileId) {
            securityHandler = new StandardSecurityHandler(encryptionDict, fileId);

            // Try to authenticate
            if (this.options.credentials !== undefined) {
              const credential = normalizeCredential(this.options.credentials);
              securityHandler.authenticateWithCredential(credential);
            } else {
              // Try empty password (common case for owner-only protection)
              tryEmptyPassword(securityHandler);
            }
          } else {
            this.warnings.push("Encrypted PDF missing /ID in trailer");
          }
        }
      } catch (error) {
        if (error instanceof EncryptionDictError) {
          this.warnings.push(`Encryption error: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Object loading
    // ─────────────────────────────────────────────────────────────────────────────

    // Create length resolver for stream objects with indirect /Length
    const lengthResolver: LengthResolver = (ref: PdfRef) => {
      // Check object cache first
      const cacheKey = `${ref.objectNumber} ${ref.generation}`;
      const cached = cache.get(cacheKey);

      if (cached instanceof PdfNumber) {
        return cached.value;
      }

      const entry = xref.get(ref.objectNumber);

      if (!entry || entry.type === "free") {
        return null;
      }

      // Save scanner position - we must restore it after parsing
      // because we're in the middle of parsing a stream
      const savedPosition = this.scanner.position;

      try {
        let lengthObj: PdfObject | null = null;

        if (entry.type === "uncompressed") {
          const parser = new IndirectObjectParser(this.scanner);
          lengthObj = parser.parseObjectAt(entry.offset).value;
        } else {
          // Compressed: load from object stream
          // Object streams themselves must be uncompressed (per PDF spec 7.5.7)
          const streamEntry = xref.get(entry.streamObjNum);

          if (streamEntry?.type === "uncompressed") {
            // Use cached object stream parser if available
            let objStreamParser = objectStreamCache.get(entry.streamObjNum);

            if (!objStreamParser) {
              const parser = new IndirectObjectParser(this.scanner);
              const streamResult = parser.parseObjectAt(streamEntry.offset);

              if (streamResult.value instanceof PdfStream) {
                objStreamParser = new ObjectStreamParser(streamResult.value);

                objectStreamCache.set(entry.streamObjNum, objStreamParser);
              }
            }

            if (objStreamParser) {
              lengthObj = objStreamParser.getObject(entry.indexInStream);
            }
          }
        }

        this.scanner.moveTo(savedPosition);

        if (lengthObj instanceof PdfNumber) {
          cache.set(cacheKey, lengthObj);

          return lengthObj.value;
        }
      } catch {
        this.scanner.moveTo(savedPosition);
      }

      return null;
    };

    /**
     * Decrypt an object's strings and stream data.
     */
    const decryptObject = (obj: PdfObject, objNum: number, genNum: number): PdfObject => {
      if (!securityHandler?.isAuthenticated) {
        return obj;
      }

      if (obj instanceof PdfString) {
        const decrypted = securityHandler.decryptString(obj.bytes, objNum, genNum);

        return new PdfString(decrypted, obj.format);
      }

      if (obj instanceof PdfArray) {
        const decryptedItems: PdfObject[] = [];

        for (const item of obj) {
          decryptedItems.push(decryptObject(item, objNum, genNum));
        }

        return new PdfArray(decryptedItems);
      }

      // Check PdfStream BEFORE PdfDict (PdfStream extends PdfDict)
      if (obj instanceof PdfStream) {
        // Check if this stream should be encrypted
        const streamType = obj.getName("Type")?.value;

        if (!securityHandler.shouldEncryptStream(streamType)) {
          return obj;
        }

        // Decrypt stream data
        const decryptedData = securityHandler.decryptStream(obj.data, objNum, genNum);

        // Create new stream with decrypted data
        // Copy dictionary entries (strings in dict will be decrypted when accessed)
        const newStream = new PdfStream(obj, decryptedData);

        // Decrypt strings in the dictionary entries
        for (const [key, value] of obj) {
          const decryptedValue = decryptObject(value, objNum, genNum);

          if (decryptedValue !== value) {
            newStream.set(key.value, decryptedValue);
          }
        }

        return newStream;
      }

      if (obj instanceof PdfDict) {
        const decryptedDict = new PdfDict();

        for (const [key, value] of obj) {
          decryptedDict.set(key.value, decryptObject(value, objNum, genNum));
        }

        return decryptedDict;
      }

      return obj;
    };

    const getObject = (ref: PdfRef): PdfObject | null => {
      const key = `${ref.objectNumber} ${ref.generation}`;

      // Check cache
      if (cache.has(key)) {
        // biome-ignore lint/style/noNonNullAssertion: checked with .has(...)
        return cache.get(key)!;
      }

      // Look up in xref
      const entry = xref.get(ref.objectNumber);

      if (!entry) {
        return null;
      }

      let obj: PdfObject | null = null;

      switch (entry.type) {
        case "free":
          return null;

        case "uncompressed": {
          const parser = new IndirectObjectParser(this.scanner, lengthResolver);

          const result = parser.parseObjectAt(entry.offset);

          // Verify generation matches
          if (result.genNum !== ref.generation) {
            this.warnings.push(
              `Generation mismatch for object ${ref.objectNumber}: expected ${ref.generation}, got ${result.genNum}`,
            );
          }

          obj = result.value;

          // Decrypt the object
          if (securityHandler?.isAuthenticated) {
            obj = decryptObject(obj, ref.objectNumber, ref.generation);
          }

          break;
        }

        case "compressed": {
          // Get or create object stream parser
          let streamParser = objectStreamCache.get(entry.streamObjNum);

          if (!streamParser) {
            // Load the object stream
            const streamRef = PdfRef.of(entry.streamObjNum, 0);
            const streamObj = getObject(streamRef);

            if (!streamObj || !(streamObj instanceof PdfStream)) {
              this.warnings.push(`Object stream ${entry.streamObjNum} not found or invalid`);

              return null;
            }

            streamParser = new ObjectStreamParser(streamObj);

            objectStreamCache.set(entry.streamObjNum, streamParser);
          }

          obj = streamParser.getObject(entry.indexInStream);

          // Objects in object streams don't need individual decryption
          // because the stream itself was decrypted

          break;
        }
      }

      // Cache the result
      if (obj !== null) {
        cache.set(key, obj);
      }

      return obj;
    };

    const getCatalog = (): PdfDict | null => {
      const rootRef = trailer.getRef("Root");

      if (!rootRef) {
        return null;
      }

      const root = getObject(rootRef);

      if (!root || (root.type !== "dict" && root.type !== "stream")) {
        return null;
      }

      return root as PdfDict;
    };

    /**
     * Walk the page tree and collect all page references.
     * Handles circular references and missing objects gracefully.
     */
    const getPages = (): PdfRef[] => {
      const pages: PdfRef[] = [];
      const visited = new Set<string>();

      const walkNode = (nodeOrRef: PdfObject | null, currentRef?: PdfRef): void => {
        // Handle references
        if (nodeOrRef instanceof PdfRef) {
          const key = `${nodeOrRef.objectNumber} ${nodeOrRef.generation}`;

          if (visited.has(key)) {
            this.warnings.push(`Circular reference in page tree: ${key}`);
            return;
          }

          visited.add(key);

          const resolved = getObject(nodeOrRef);

          walkNode(resolved, nodeOrRef);
          return;
        }

        // Must be a dictionary
        if (!(nodeOrRef instanceof PdfDict)) {
          return;
        }

        const type = nodeOrRef.getName("Type");

        if (type?.value === "Page") {
          // Leaf node - this is a page
          if (currentRef) {
            pages.push(currentRef);
          }
        } else if (type?.value === "Pages") {
          // Intermediate node - recurse into kids
          const kids = nodeOrRef.getArray("Kids", getObject);

          if (kids) {
            for (let i = 0; i < kids.length; i++) {
              const kid = kids.at(i);

              if (kid instanceof PdfRef) {
                walkNode(kid);
              } else if (kid instanceof PdfDict) {
                walkNode(kid);
              }
              // Skip null/invalid kids silently
            }
          }
        }
        // Ignore nodes without proper /Type
      };

      // Start from the catalog's Pages reference
      const catalog = getCatalog();

      if (!catalog) {
        return pages;
      }

      const pagesRef = catalog.getRef("Pages");

      if (pagesRef) {
        walkNode(pagesRef);
      }

      return pages;
    };

    const getPageCount = (): number => {
      const pages = getPages();

      return pages.length;
    };

    // Authentication function for re-authentication
    const authenticate = (password: string): boolean => {
      if (!securityHandler) {
        return false;
      }

      const result = securityHandler.authenticateWithString(password);

      return result.authenticated;
    };

    return {
      version,
      trailer,
      xref,
      warnings: this.warnings,
      recoveredViaBruteForce,

      // Encryption
      isEncrypted,
      encryption: encryptionDict,
      isAuthenticated: securityHandler?.isAuthenticated ?? !isEncrypted,
      permissions: securityHandler?.permissions ?? null,
      securityHandler,
      authenticate,

      // Object access
      getObject,
      getCatalog,
      getPageCount,
      getPages,
    };
  }

  /**
   * Extract the file ID from the trailer's /ID array.
   * Returns the first element of the array (the permanent file ID).
   */
  private getFileId(trailer: PdfDict): Uint8Array | null {
    const idArray = trailer.getArray("ID");

    if (!idArray || idArray.length < 1) {
      return null;
    }

    const firstId = idArray.at(0);

    if (firstId instanceof PdfString) {
      return firstId.bytes;
    }

    return null;
  }

  /**
   * Check if bytes at position match a pattern.
   */
  private matchesAt(pos: number, pattern: number[]): boolean {
    const bytes = this.scanner.bytes;

    for (let i = 0; i < pattern.length; i++) {
      if (pos + i >= bytes.length || bytes[pos + i] !== pattern[i]) {
        return false;
      }
    }

    return true;
  }
}
