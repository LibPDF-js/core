import { DIGIT_0, DIGIT_9, isDelimiter, isWhitespace } from "#src/helpers/chars";
import type { Scanner } from "#src/io/scanner";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import type { PdfStream } from "#src/objects/pdf-stream";

import { IndirectObjectParser } from "./indirect-object-parser";
import { ObjectParser } from "./object-parser";
import { ObjectStreamParser } from "./object-stream-parser";
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
 * Entry for an object extracted from an object stream.
 * These don't have file offsets since they're inside a compressed stream.
 */
export interface CompressedObjectEntry {
  objNum: number;
  genNum: 0; // Objects in object streams always have generation 0
  streamObjNum: number; // The object stream containing this object
  indexInStream: number; // Index within the object stream
  dict: PdfDict | null; // Pre-parsed dictionary (if it's a dict)
}

/**
 * Entry type in the recovered xref.
 */
export type RecoveredXRefEntry =
  | { type: "uncompressed"; offset: number }
  | { type: "compressed"; streamObjNum: number; indexInStream: number };

/**
 * Recovered cross-reference table built from scanning.
 */
export class RecoveredXRef {
  private objects = new Map<string, RecoveredXRefEntry>();

  private static key(objNum: number, genNum: number): string {
    return `${objNum} ${genNum}`;
  }

  set(objNum: number, genNum: number, offset: number): void {
    this.objects.set(RecoveredXRef.key(objNum, genNum), { type: "uncompressed", offset });
  }

  setCompressed(objNum: number, streamObjNum: number, indexInStream: number): void {
    // Objects in object streams always have generation 0
    this.objects.set(RecoveredXRef.key(objNum, 0), {
      type: "compressed",
      streamObjNum,
      indexInStream,
    });
  }

  getOffset(objNum: number, genNum: number): number | undefined {
    const entry = this.objects.get(RecoveredXRef.key(objNum, genNum));
    return entry?.type === "uncompressed" ? entry.offset : undefined;
  }

  getEntry(objNum: number, genNum: number): RecoveredXRefEntry | undefined {
    return this.objects.get(RecoveredXRef.key(objNum, genNum));
  }

  entries(): IterableIterator<[string, RecoveredXRefEntry]> {
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
  async recover(): Promise<RecoveredDocument | null> {
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

    // Extract objects from object streams (crucial for PDFs that store
    // Catalog/Pages inside compressed streams)
    const compressedEntries = await this.extractFromObjectStreams(entries);

    for (const entry of compressedEntries) {
      xref.setCompressed(entry.objNum, entry.streamObjNum, entry.indexInStream);
      maxObjNum = Math.max(maxObjNum, entry.objNum);
    }

    // Find the document root (Catalog or fallback to Pages)
    // Search in both regular objects and compressed objects
    const root = this.findRoot(entries, compressedEntries);

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
    if (startPos > 0 && !isWhitespace(this.data[startPos - 1])) {
      return null;
    }

    // Try to read: <number> <whitespace> <number> <whitespace> "obj"
    const objNum = this.tryReadInteger();
    if (objNum === null) {
      return null;
    }

    if (!this.skipWhitespace()) {
      return null;
    }

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
      if (!isWhitespace(next) && !isDelimiter(next)) {
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

      if (byte >= DIGIT_0 && byte <= DIGIT_9) {
        value = value * 10 + (byte - DIGIT_0);
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

    while (this.pos < this.data.length && isWhitespace(this.data[this.pos])) {
      this.pos++;
      skipped = true;
    }

    return skipped;
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
   * Searches both regular objects and objects inside object streams.
   */
  private findRoot(
    entries: ObjectEntry[],
    compressedEntries: CompressedObjectEntry[] = [],
  ): PdfRef | null {
    let catalogRef: PdfRef | null = null;
    let pagesRef: PdfRef | null = null;

    // First, search regular objects
    for (const entry of entries) {
      try {
        const dict = this.parseObjectAt(entry.offset, entry.objNum, entry.genNum);

        if (dict === null) {
          continue;
        }

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

    // If found Catalog in regular objects, return it
    if (catalogRef !== null) {
      return catalogRef;
    }

    // Search in compressed objects (from object streams)
    for (const entry of compressedEntries) {
      const dict = entry.dict;

      if (dict === null) {
        continue;
      }

      const type = dict.getName("Type");

      if (type?.value === "Catalog") {
        catalogRef = PdfRef.of(entry.objNum, entry.genNum);
        break; // Found Catalog
      }

      if (type?.value === "Pages" && pagesRef === null) {
        pagesRef = PdfRef.of(entry.objNum, entry.genNum);
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
    this.scanner.moveTo(offset);

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

  /**
   * Parse the full object (including streams) at the given byte offset.
   * Used for object stream parsing where we need the stream data.
   */
  private parseFullObjectAt(offset: number, objNum: number, genNum: number): PdfStream | null {
    try {
      const parser = new IndirectObjectParser(this.scanner);
      const result = parser.parseObjectAt(offset);

      if (result.value.type !== "stream") {
        return null;
      }

      return result.value as PdfStream;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.warnings.push(`Failed to parse object ${objNum} ${genNum} as stream: ${message}`);
      return null;
    }
  }

  /**
   * Find object streams among the scanned entries and extract their contents.
   * This is crucial for PDFs where Catalog/Pages are stored inside object streams.
   */
  private async extractFromObjectStreams(entries: ObjectEntry[]): Promise<CompressedObjectEntry[]> {
    const compressed: CompressedObjectEntry[] = [];

    for (const entry of entries) {
      try {
        // Parse the object fully to get stream data
        const stream = this.parseFullObjectAt(entry.offset, entry.objNum, entry.genNum);

        if (stream === null) {
          continue;
        }

        // Check if this is an object stream
        const type = stream.getName("Type");

        if (type?.value !== "ObjStm") {
          continue;
        }

        // Extract objects from the object stream
        const objectStreamParser = new ObjectStreamParser(stream);

        // Parse the stream (decompresses and builds index)
        await objectStreamParser.parse();

        const count = objectStreamParser.objectCount;

        for (let i = 0; i < count; i++) {
          try {
            const objNum = objectStreamParser.getObjectNumber(i);
            const obj = await objectStreamParser.getObject(i);

            if (objNum === null) {
              continue;
            }

            compressed.push({
              objNum,
              genNum: 0, // Always 0 for objects in object streams
              streamObjNum: entry.objNum,
              indexInStream: i,
              dict: obj instanceof PdfDict ? obj : null,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.warnings.push(
              `Failed to extract object at index ${i} from stream ${entry.objNum}: ${message}`,
            );
          }
        }
      } catch {
        // Silently skip objects that can't be parsed as object streams
      }
    }

    return compressed;
  }
}
