import type { Scanner } from "#src/io/scanner";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfRef } from "#src/objects/pdf-ref";
import { ObjectParser } from "./object-parser";
import { TokenReader } from "./token-reader";

/**
 * Entry for a discovered object in the file.
 */
export interface ObjectEntry {
  objNum: number;
  genNum: number;
  offset: number;
}

/**
 * Recovered cross-reference table built from scanning.
 */
export class RecoveredXRef {
  private objects = new Map<string, number>();

  private static key(objNum: number, genNum: number): string {
    return `${objNum} ${genNum}`;
  }

  set(objNum: number, genNum: number, offset: number): void {
    this.objects.set(RecoveredXRef.key(objNum, genNum), offset);
  }

  getOffset(objNum: number, genNum: number): number | undefined {
    return this.objects.get(RecoveredXRef.key(objNum, genNum));
  }

  entries(): IterableIterator<[string, number]> {
    return this.objects.entries();
  }

  get size(): number {
    return this.objects.size;
  }
}

/**
 * Minimal trailer reconstructed from discovered objects.
 */
export interface RecoveredTrailer {
  Root: PdfRef;
  Size: number;
}

/**
 * Result of brute-force recovery.
 */
export interface RecoveredDocument {
  xref: RecoveredXRef;
  trailer: RecoveredTrailer;
  warnings: string[];
}

// PDF whitespace characters
const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0d, 0x0c, 0x20]);

// Maximum reasonable object number
const MAX_OBJ_NUM = 10_000_000;

// Maximum generation number per PDF spec
const MAX_GEN_NUM = 65535;

/**
 * Recovery parser for corrupted PDFs.
 *
 * Scans the entire file for object markers (`N M obj`) and rebuilds
 * the xref table from scratch. Used when normal xref parsing fails.
 */
export class BruteForceParser {
  private readonly data: Uint8Array;
  private pos = 0;
  private warnings: string[] = [];

  constructor(private scanner: Scanner) {
    this.data = scanner.bytes;
  }

  /**
   * Scan file and build recovered xref.
   * Returns null if no objects found or no valid root.
   */
  recover(): RecoveredDocument | null {
    const entries = this.scanForObjects();

    if (entries.length === 0) {
      return null;
    }

    // Build xref from entries
    const xref = new RecoveredXRef();
    let maxObjNum = 0;

    for (const entry of entries) {
      xref.set(entry.objNum, entry.genNum, entry.offset);
      maxObjNum = Math.max(maxObjNum, entry.objNum);
    }

    // Find the document root (Catalog or fallback to Pages)
    const root = this.findRoot(entries);

    if (root === null) {
      return null;
    }

    const trailer: RecoveredTrailer = {
      Root: root,
      Size: maxObjNum + 1,
    };

    return {
      xref,
      trailer,
      warnings: this.warnings,
    };
  }

  /**
   * Scan the file for object markers.
   * Returns list of discovered objects with their offsets.
   */
  scanForObjects(): ObjectEntry[] {
    const found = new Map<string, ObjectEntry>();
    this.pos = 0;

    while (this.pos < this.data.length) {
      const entry = this.tryReadObjectMarker();

      if (entry !== null) {
        // Keep last occurrence for duplicates
        const key = `${entry.objNum} ${entry.genNum}`;
        found.set(key, entry);
      } else {
        this.pos++;
      }
    }

    return Array.from(found.values());
  }

  /**
   * Try to read an object marker at current position.
   * Returns the entry if successful, null otherwise.
   */
  private tryReadObjectMarker(): ObjectEntry | null {
    const startPos = this.pos;

    // Must be at start of file or preceded by whitespace
    if (startPos > 0 && !this.isWhitespace(this.data[startPos - 1])) {
      return null;
    }

    // Try to read: <number> <whitespace> <number> <whitespace> "obj"
    const objNum = this.tryReadInteger();
    if (objNum === null) return null;

    if (!this.skipWhitespace()) return null;

    const genNum = this.tryReadInteger();
    if (genNum === null) {
      this.pos = startPos;
      return null;
    }

    if (!this.skipWhitespace()) {
      this.pos = startPos;
      return null;
    }

    if (!this.matchKeyword("obj")) {
      this.pos = startPos;
      return null;
    }

    // Validate object number and generation
    if (objNum < 0 || objNum > MAX_OBJ_NUM) {
      this.pos = startPos;
      return null;
    }

    if (genNum < 0 || genNum > MAX_GEN_NUM) {
      this.pos = startPos;
      return null;
    }

    // Must be followed by whitespace or delimiter
    if (this.pos < this.data.length) {
      const next = this.data[this.pos];
      if (!this.isWhitespace(next) && !this.isDelimiter(next)) {
        this.pos = startPos;
        return null;
      }
    }

    return {
      objNum,
      genNum,
      offset: startPos,
    };
  }

  private tryReadInteger(): number | null {
    let value = 0;
    let hasDigits = false;
    const start = this.pos;

    while (this.pos < this.data.length) {
      const byte = this.data[this.pos];

      if (byte >= 0x30 && byte <= 0x39) {
        // '0'-'9'
        value = value * 10 + (byte - 0x30);
        hasDigits = true;
        this.pos++;
      } else {
        break;
      }
    }

    if (!hasDigits) {
      this.pos = start;
      return null;
    }

    return value;
  }

  private skipWhitespace(): boolean {
    let skipped = false;

    while (this.pos < this.data.length && this.isWhitespace(this.data[this.pos])) {
      this.pos++;
      skipped = true;
    }

    return skipped;
  }

  private isWhitespace(byte: number): boolean {
    return WHITESPACE.has(byte);
  }

  private isDelimiter(byte: number): boolean {
    // PDF delimiters: ( ) < > [ ] { } / %
    return (
      byte === 0x28 || // (
      byte === 0x29 || // )
      byte === 0x3c || // <
      byte === 0x3e || // >
      byte === 0x5b || // [
      byte === 0x5d || // ]
      byte === 0x7b || // {
      byte === 0x7d || // }
      byte === 0x2f || // /
      byte === 0x25 // %
    );
  }

  private matchKeyword(keyword: string): boolean {
    for (let i = 0; i < keyword.length; i++) {
      if (this.pos + i >= this.data.length) {
        return false;
      }

      if (this.data[this.pos + i] !== keyword.charCodeAt(i)) {
        return false;
      }
    }

    this.pos += keyword.length;
    return true;
  }

  /**
   * Find the document root by parsing discovered objects.
   * Looks for /Type /Catalog first, then falls back to /Type /Pages.
   */
  private findRoot(entries: ObjectEntry[]): PdfRef | null {
    let catalogRef: PdfRef | null = null;
    let pagesRef: PdfRef | null = null;

    for (const entry of entries) {
      try {
        const dict = this.parseObjectAt(entry.offset, entry.objNum, entry.genNum);

        if (dict === null) continue;

        const type = dict.getName("Type");

        if (type?.value === "Catalog") {
          catalogRef = PdfRef.of(entry.objNum, entry.genNum);
          break; // Found Catalog, no need to continue
        }

        if (type?.value === "Pages" && pagesRef === null) {
          pagesRef = PdfRef.of(entry.objNum, entry.genNum);
        }
      } catch {
        this.warnings.push(`Object ${entry.objNum} ${entry.genNum} appears corrupted or truncated`);
      }
    }

    if (catalogRef !== null) {
      return catalogRef;
    }

    if (pagesRef !== null) {
      this.warnings.push("No Catalog found, using Pages object as root");
      return pagesRef;
    }

    this.warnings.push("No Catalog or Pages object found");
    return null;
  }

  /**
   * Parse the object at the given byte offset.
   * Returns the dictionary if it's a dict, null otherwise.
   * Collects warnings from the parser.
   */
  private parseObjectAt(offset: number, objNum: number, genNum: number): PdfDict | null {
    this.scanner.position = offset;

    const reader = new TokenReader(this.scanner);

    // Skip "N M obj"
    reader.nextToken(); // objNum
    reader.nextToken(); // genNum
    reader.nextToken(); // "obj" keyword

    const parser = new ObjectParser(reader);
    parser.recoveryMode = true;
    parser.onWarning = msg => {
      this.warnings.push(`Object ${objNum} ${genNum}: ${msg}`);
    };

    const result = parser.parseObject();

    if (result === null) {
      return null;
    }

    if (result.object instanceof PdfDict) {
      return result.object;
    }

    return null;
  }
}
