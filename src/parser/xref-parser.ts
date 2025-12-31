import type { Scanner } from "#src/io/scanner";
import type { PdfDict } from "#src/objects/pdf-dict";
import { ObjectParser } from "./object-parser";
import { TokenReader } from "./token-reader";

/**
 * Entry in the cross-reference table.
 */
export type XRefEntry =
  | { type: "free"; nextFree: number; generation: number }
  | { type: "uncompressed"; offset: number; generation: number }
  | { type: "compressed"; streamObjNum: number; indexInStream: number };

/**
 * Parsed cross-reference data.
 */
export interface XRefData {
  entries: Map<number, XRefEntry>;
  trailer: PdfDict;
  prev?: number;
}

// ASCII codes
const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;
const CHAR_0 = 0x30;
const CHAR_9 = 0x39;
const CHAR_f = 0x66;
const CHAR_n = 0x6e;

/**
 * Parser for PDF cross-reference tables and streams.
 *
 * Supports both traditional table format and stream format (PDF 1.5+).
 * Handles incremental updates via /Prev chain.
 */
export class XRefParser {
  constructor(private scanner: Scanner) {}

  /**
   * Find the startxref offset by scanning backwards from end of file.
   * Returns the byte offset where xref starts.
   */
  findStartXRef(): number {
    const bytes = this.scanner.bytes;
    const len = bytes.length;

    // Search backwards from end, looking for "startxref"
    // Usually within last 1024 bytes, but search more if needed
    const searchStart = Math.max(0, len - 1024);

    let startxrefPos = -1;

    for (let i = len - 9; i >= searchStart; i--) {
      if (this.matchesAt(i, "startxref")) {
        startxrefPos = i;
        break;
      }
    }

    if (startxrefPos === -1) {
      throw new Error("Could not find startxref marker");
    }

    // Skip "startxref" and whitespace to get the offset number
    let pos = startxrefPos + 9;
    pos = this.skipWhitespace(pos);

    // Read the offset number
    const offset = this.readIntegerAt(pos);

    if (offset === null) {
      throw new Error("Invalid startxref offset");
    }

    return offset;
  }

  /**
   * Parse xref at given byte offset.
   * Auto-detects table vs stream format.
   */
  parseAt(offset: number): XRefData {
    this.scanner.moveTo(offset);

    // Peek to detect format
    const firstByte = this.scanner.peek();

    // 'x' = 0x78 starts "xref"
    if (firstByte === 0x78) {
      return this.parseTable();
    }

    // Digit starts "N M obj" (stream format)
    if (firstByte >= CHAR_0 && firstByte <= CHAR_9) {
      return this.parseStream();
    }

    throw new Error(`Unknown xref format at offset ${offset}`);
  }

  /**
   * Parse traditional xref table format.
   * Scanner must be positioned at "xref" keyword.
   */
  parseTable(): XRefData {
    const entries = new Map<number, XRefEntry>();

    // Consume "xref" keyword
    this.expectKeyword("xref");
    this.skipWhitespaceFromCurrent();

    // Read subsections until we hit "trailer"
    while (!this.peekKeyword("trailer")) {
      this.parseSubsection(entries);
    }

    // Consume "trailer" keyword
    this.expectKeyword("trailer");
    this.skipWhitespaceFromCurrent();

    // Parse trailer dictionary
    const reader = new TokenReader(this.scanner);
    const parser = new ObjectParser(reader);
    const result = parser.parseObject();

    if (result === null || !(result.object.type === "dict")) {
      throw new Error("Invalid trailer dictionary");
    }

    const trailer = result.object as PdfDict;

    // Extract /Prev if present
    const prevNum = trailer.getNumber("Prev");
    const prev = prevNum?.value;

    return {
      entries,
      trailer,
      prev,
    };
  }

  /**
   * Parse xref stream format.
   * Scanner must be positioned at stream object start.
   */
  parseStream(): XRefData {
    // TODO: Implement xref stream parsing
    // For now, throw to indicate not yet supported
    throw new Error("XRef stream format not yet implemented");
  }

  /**
   * Parse a single subsection of the xref table.
   */
  private parseSubsection(entries: Map<number, XRefEntry>): void {
    // Read first object number and count
    const firstObjNum = this.readIntegerFromCurrent();

    if (firstObjNum === null) {
      throw new Error("Expected subsection start object number");
    }

    this.skipWhitespaceFromCurrent();

    const count = this.readIntegerFromCurrent();

    if (count === null) {
      throw new Error("Expected subsection entry count");
    }

    this.skipWhitespaceFromCurrent();

    // Read entries
    for (let i = 0; i < count; i++) {
      const objNum = firstObjNum + i;
      const entry = this.parseEntry();
      entries.set(objNum, entry);
    }
  }

  /**
   * Parse a single xref entry.
   * Format: OOOOOOOOOO GGGGG T (10-digit offset, 5-digit gen, type)
   */
  private parseEntry(): XRefEntry {
    // Read 10-digit offset
    const offset = this.readFixedDigits(10);
    this.skipSpaces();

    // Read 5-digit generation
    const generation = this.readFixedDigits(5);
    this.skipSpaces();

    // Read type: 'n' or 'f'
    const typeByte = this.scanner.advance();

    // Skip to end of entry (EOL)
    this.skipToEOL();
    this.skipEOL();

    if (typeByte === CHAR_n) {
      return {
        type: "uncompressed",
        offset,
        generation,
      };
    } else if (typeByte === CHAR_f) {
      return {
        type: "free",
        nextFree: offset, // For free entries, offset field is next free object
        generation,
      };
    } else {
      throw new Error(`Invalid xref entry type: ${String.fromCharCode(typeByte)}`);
    }
  }

  /**
   * Read a fixed number of digits as an integer.
   */
  private readFixedDigits(count: number): number {
    let value = 0;

    for (let i = 0; i < count; i++) {
      const byte = this.scanner.peek();

      if (byte < CHAR_0 || byte > CHAR_9) {
        throw new Error(`Expected digit, got ${String.fromCharCode(byte)}`);
      }

      value = value * 10 + (byte - CHAR_0);
      this.scanner.advance();
    }

    return value;
  }

  /**
   * Skip space characters (not newlines).
   */
  private skipSpaces(): void {
    while (this.scanner.peek() === SPACE) {
      this.scanner.advance();
    }
  }

  /**
   * Skip to the end of line (but don't consume EOL).
   */
  private skipToEOL(): void {
    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1 || byte === LF || byte === CR) {
        break;
      }

      this.scanner.advance();
    }
  }

  /**
   * Skip EOL characters (CR, LF, or CRLF).
   */
  private skipEOL(): void {
    const byte = this.scanner.peek();

    if (byte === CR) {
      this.scanner.advance();

      if (this.scanner.peek() === LF) {
        this.scanner.advance();
      }
    } else if (byte === LF) {
      this.scanner.advance();
    }
  }

  /**
   * Skip whitespace from current scanner position.
   */
  private skipWhitespaceFromCurrent(): void {
    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1) {
        break;
      }

      if (byte === SPACE || byte === LF || byte === CR || byte === 0x09) {
        this.scanner.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Check if bytes at position match a string.
   */
  private matchesAt(pos: number, str: string): boolean {
    const bytes = this.scanner.bytes;

    for (let i = 0; i < str.length; i++) {
      if (pos + i >= bytes.length || bytes[pos + i] !== str.charCodeAt(i)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Skip whitespace at given position, return new position.
   */
  private skipWhitespace(pos: number): number {
    const bytes = this.scanner.bytes;

    while (pos < bytes.length) {
      const byte = bytes[pos];

      if (byte === SPACE || byte === LF || byte === CR || byte === 0x09) {
        pos++;
      } else {
        break;
      }
    }

    return pos;
  }

  /**
   * Read an integer at given position.
   */
  private readIntegerAt(pos: number): number | null {
    const bytes = this.scanner.bytes;
    let value = 0;
    let hasDigits = false;

    while (pos < bytes.length) {
      const byte = bytes[pos];

      if (byte >= CHAR_0 && byte <= CHAR_9) {
        value = value * 10 + (byte - CHAR_0);
        hasDigits = true;
        pos++;
      } else {
        break;
      }
    }

    return hasDigits ? value : null;
  }

  /**
   * Read an integer from current scanner position.
   */
  private readIntegerFromCurrent(): number | null {
    let value = 0;
    let hasDigits = false;

    while (true) {
      const byte = this.scanner.peek();

      if (byte >= CHAR_0 && byte <= CHAR_9) {
        value = value * 10 + (byte - CHAR_0);
        hasDigits = true;
        this.scanner.advance();
      } else {
        break;
      }
    }

    return hasDigits ? value : null;
  }

  /**
   * Expect and consume a keyword at current position.
   */
  private expectKeyword(keyword: string): void {
    for (let i = 0; i < keyword.length; i++) {
      const byte = this.scanner.peek();

      if (byte !== keyword.charCodeAt(i)) {
        throw new Error(`Expected keyword "${keyword}"`);
      }

      this.scanner.advance();
    }
  }

  /**
   * Check if current position starts with a keyword (without consuming).
   */
  private peekKeyword(keyword: string): boolean {
    const startPos = this.scanner.position;

    for (let i = 0; i < keyword.length; i++) {
      if (this.scanner.peekAt(startPos + i) !== keyword.charCodeAt(i)) {
        return false;
      }
    }

    return true;
  }
}
