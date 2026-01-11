import { CR, DIGIT_0, DIGIT_9, LF, SPACE, TAB } from "#src/helpers/chars";
import type { Scanner } from "#src/io/scanner";
import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";
import { XRefParseError } from "./errors";
import { IndirectObjectParser } from "./indirect-object-parser";
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

// ASCII codes for xref-specific parsing
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
      throw new XRefParseError("Could not find startxref marker");
    }

    // Skip "startxref" and whitespace to get the offset number
    let pos = startxrefPos + 9;
    pos = this.skipWhitespace(pos);

    // Read the offset number
    const offset = this.readIntegerAt(pos);

    if (offset === null) {
      throw new XRefParseError("Invalid startxref offset");
    }

    return offset;
  }

  /**
   * Parse xref at given byte offset.
   * Auto-detects table vs stream format.
   */
  async parseAt(offset: number): Promise<XRefData> {
    this.scanner.moveTo(offset);

    // Peek to detect format
    const firstByte = this.scanner.peek();

    // 'x' = 0x78 starts "xref"
    if (firstByte === 0x78) {
      return this.parseTable();
    }

    // Digit starts "N M obj" (stream format)
    if (firstByte >= DIGIT_0 && firstByte <= DIGIT_9) {
      return this.parseStream();
    }

    throw new XRefParseError(`Unknown xref format at offset ${offset}`);
  }

  /**
   * Detect the XRef format at a given offset without fully parsing.
   *
   * @returns true if XRef stream, false if table, null if cannot detect
   */
  detectXRefFormat(offset: number): boolean | null {
    this.scanner.moveTo(offset);

    const firstByte = this.scanner.peek();

    // 'x' = 0x78 starts "xref" (table format)
    if (firstByte === 0x78) {
      return false;
    }

    // Digit starts "N M obj" (stream format)
    if (firstByte >= DIGIT_0 && firstByte <= DIGIT_9) {
      return true;
    }

    return null;
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

    if (result === null || result.object.type !== "dict") {
      throw new XRefParseError("Invalid trailer dictionary");
    }

    const trailer = result.object;

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
   * Parse xref stream format (PDF 1.5+).
   * Scanner must be positioned at stream object start ("N M obj").
   *
   * XRef streams encode cross-reference data as binary in a stream object.
   * The stream dictionary contains:
   * - /Type /XRef
   * - /Size - total number of objects
   * - /W [w1 w2 w3] - byte widths for type, offset, generation fields
   * - /Index [first count ...] - object number ranges (optional, defaults to [0 Size])
   */
  async parseStream(): Promise<XRefData> {
    // Parse the indirect object containing the xref stream
    const parser = new IndirectObjectParser(this.scanner);
    const indirectObj = parser.parseObject();

    if (!(indirectObj.value instanceof PdfStream)) {
      throw new XRefParseError("Expected XRef stream object");
    }

    const stream = indirectObj.value;

    // Validate /Type is /XRef (optional per spec, but good to check)
    const type = stream.getName("Type");
    if (type !== undefined && type.value !== "XRef") {
      throw new XRefParseError(`Expected /Type /XRef, got /Type /${type.value}`);
    }

    // Get required /W array (field widths)
    const wArray = stream.getArray("W");
    if (wArray === undefined || wArray.length < 3) {
      throw new XRefParseError("XRef stream missing or invalid /W array");
    }

    const w0 = wArray.at(0);
    const w1Val = wArray.at(1);
    const w2Val = wArray.at(2);

    const w1 = w0 instanceof PdfNumber ? w0.value : 0; // Type field width
    const w2 = w1Val instanceof PdfNumber ? w1Val.value : 0; // Offset field width
    const w3 = w2Val instanceof PdfNumber ? w2Val.value : 0; // Generation field width

    // Validate field widths to prevent integer overflow during parsing.
    // JavaScript safely handles integers up to 2^53-1, but bitwise operations
    // are limited to 32 bits. Fields wider than 6 bytes (48 bits) could cause
    // issues with shift operations. Most PDFs use 1-4 byte widths.
    const MAX_FIELD_WIDTH = 6;

    if (w1 < 0 || w1 > MAX_FIELD_WIDTH) {
      throw new XRefParseError(`Invalid XRef stream field width w1=${w1} (max ${MAX_FIELD_WIDTH})`);
    }

    if (w2 < 0 || w2 > MAX_FIELD_WIDTH) {
      throw new XRefParseError(`Invalid XRef stream field width w2=${w2} (max ${MAX_FIELD_WIDTH})`);
    }

    if (w3 < 0 || w3 > MAX_FIELD_WIDTH) {
      throw new XRefParseError(`Invalid XRef stream field width w3=${w3} (max ${MAX_FIELD_WIDTH})`);
    }

    const entrySize = w1 + w2 + w3;

    // Get /Size (total object count)
    const size = stream.getNumber("Size")?.value;
    if (size === undefined) {
      throw new XRefParseError("XRef stream missing /Size");
    }

    // Get /Index array or default to [0 Size]
    const indexArray = stream.getArray("Index");
    const ranges: Array<{ first: number; count: number }> = [];

    if (indexArray !== undefined) {
      for (let i = 0; i < indexArray.length; i += 2) {
        const firstObj = indexArray.at(i);
        const countObj = indexArray.at(i + 1);

        if (!(firstObj instanceof PdfNumber) || !(countObj instanceof PdfNumber)) {
          throw new XRefParseError("Invalid /Index array in XRef stream");
        }

        ranges.push({ first: firstObj.value, count: countObj.value });
      }
    } else {
      // Default: single range [0, Size]
      ranges.push({ first: 0, count: size });
    }

    // Decode the stream data
    const decodedData = await stream.getDecodedData();

    // Parse entries from binary data
    const entries = new Map<number, XRefEntry>();
    let dataOffset = 0;

    for (const range of ranges) {
      for (let i = 0; i < range.count; i++) {
        const objNum = range.first + i;

        if (dataOffset + entrySize > decodedData.length) {
          throw new XRefParseError("XRef stream data truncated");
        }

        // Read type field (default to 1 if width is 0)
        // Use multiplication instead of bitwise shift to avoid 32-bit overflow
        let entryType = w1 === 0 ? 1 : 0;
        for (let j = 0; j < w1; j++) {
          entryType = entryType * 256 + decodedData[dataOffset++];
        }

        // Read field 2 (offset or object stream number)
        let field2 = 0;
        for (let j = 0; j < w2; j++) {
          field2 = field2 * 256 + decodedData[dataOffset++];
        }

        // Read field 3 (generation or index in object stream)
        let field3 = 0;
        for (let j = 0; j < w3; j++) {
          field3 = field3 * 256 + decodedData[dataOffset++];
        }

        // Create entry based on type
        let entry: XRefEntry;
        switch (entryType) {
          case 0:
            // Free entry
            entry = { type: "free", nextFree: field2, generation: field3 };
            break;
          case 1:
            // Uncompressed object
            entry = { type: "uncompressed", offset: field2, generation: field3 };
            break;
          case 2:
            // Compressed object in object stream
            entry = { type: "compressed", streamObjNum: field2, indexInStream: field3 };
            break;
          default:
            throw new XRefParseError(`Invalid XRef entry type: ${entryType}`);
        }

        // Only store if not already present (first definition wins)
        if (!entries.has(objNum)) {
          entries.set(objNum, entry);
        }
      }
    }

    // The stream dictionary serves as the trailer
    const prev = stream.getNumber("Prev")?.value;

    return {
      entries,
      trailer: stream,
      prev,
    };
  }

  /**
   * Parse a single subsection of the xref table.
   */
  private parseSubsection(entries: Map<number, XRefEntry>): void {
    // Read first object number and count
    const firstObjNum = this.readIntegerFromCurrent();

    if (firstObjNum === null) {
      throw new XRefParseError("Expected subsection start object number");
    }

    this.skipWhitespaceFromCurrent();

    const count = this.readIntegerFromCurrent();

    if (count === null) {
      throw new XRefParseError("Expected subsection entry count");
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
      throw new XRefParseError(`Invalid xref entry type: ${String.fromCharCode(typeByte)}`);
    }
  }

  /**
   * Read a fixed number of digits as an integer.
   */
  private readFixedDigits(count: number): number {
    let value = 0;

    for (let i = 0; i < count; i++) {
      const byte = this.scanner.peek();

      if (byte < DIGIT_0 || byte > DIGIT_9) {
        throw new XRefParseError(`Expected digit, got ${String.fromCharCode(byte)}`);
      }

      value = value * 10 + (byte - DIGIT_0);
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

      if (byte === SPACE || byte === LF || byte === CR || byte === TAB) {
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

      if (byte === SPACE || byte === LF || byte === CR || byte === TAB) {
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

      if (byte >= DIGIT_0 && byte <= DIGIT_9) {
        value = value * 10 + (byte - DIGIT_0);
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

      if (byte >= DIGIT_0 && byte <= DIGIT_9) {
        value = value * 10 + (byte - DIGIT_0);
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
        throw new XRefParseError(`Expected keyword "${keyword}"`);
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
