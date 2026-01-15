import { CR, LF, SPACE, TAB } from "#src/helpers/chars";
import type { Scanner } from "#src/io/scanner";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfObject } from "#src/objects/pdf-object";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import { ObjectParseError } from "./errors";
import { ObjectParser } from "./object-parser";
import { TokenReader } from "./token-reader";

/**
 * Parsed indirect object.
 */
export interface IndirectObject {
  objNum: number;
  genNum: number;
  value: PdfObject;
}

/**
 * Callback to resolve indirect /Length references.
 * Returns the length value, or null if not resolvable.
 */
export type LengthResolver = (ref: PdfRef) => number | null;

/**
 * Parser for indirect object definitions.
 *
 * Handles the `N M obj ... endobj` syntax and stream binary data.
 * Uses ObjectParser for the actual object content.
 */
export class IndirectObjectParser {
  constructor(
    private scanner: Scanner,
    private lengthResolver?: LengthResolver,
  ) {}

  /**
   * Parse indirect object at current scanner position.
   */
  parseObject(): IndirectObject {
    const reader = new TokenReader(this.scanner);

    // Read object number
    const objNumToken = reader.nextToken();

    if (objNumToken.type !== "number" || !objNumToken.isInteger) {
      throw new ObjectParseError("Expected integer object number");
    }

    const objNum = objNumToken.value;

    // Read generation number
    const genNumToken = reader.nextToken();

    if (genNumToken.type !== "number" || !genNumToken.isInteger) {
      throw new ObjectParseError("Expected integer generation number");
    }

    const genNum = genNumToken.value;

    // Read "obj" keyword
    const objKeyword = reader.nextToken();

    if (objKeyword.type !== "keyword" || objKeyword.value !== "obj") {
      throw new ObjectParseError(`Expected 'obj' keyword, got ${objKeyword.type}`);
    }

    // Parse the object value
    const objectParser = new ObjectParser(reader);
    const result = objectParser.parseObject();

    if (result === null) {
      throw new ObjectParseError("Expected object value");
    }

    let value: PdfObject;

    if (result.hasStream) {
      // It's a stream object - read the stream data
      // Position scanner right after "stream" keyword
      this.scanner.moveTo(result.streamKeywordPosition + 6); // 6 = length of "stream"

      // After this, scanner position is right after "endstream"
      value = this.readStream(result.object);

      // Consume "endobj" directly from scanner (reader state is out of sync)
      try {
        this.expectKeyword("endobj");
      } catch {
        // Be lenient - some PDFs have issues with endobj
      }
    } else {
      value = result.object;

      // Consume "endobj" keyword via reader
      const endObjToken = reader.nextToken();
      if (endObjToken.type !== "keyword" || endObjToken.value !== "endobj") {
        // Be lenient - some PDFs omit endobj
      }
    }

    return {
      objNum,
      genNum,
      value,
    };
  }

  /**
   * Parse indirect object at given byte offset.
   */
  parseObjectAt(offset: number): IndirectObject {
    this.scanner.moveTo(offset);

    return this.parseObject();
  }

  /**
   * Read stream data after the dict has been parsed.
   * The "stream" keyword has been detected by ObjectParser's lookahead,
   * and the scanner is positioned right after "stream".
   */
  private readStream(dict: PdfDict): PdfStream {
    // The scanner is positioned right after "stream" keyword
    // (ObjectParser consumed it during lookahead but didn't use it)

    // Skip EOL after "stream" (required: LF or CRLF)
    this.skipStreamEOL();

    // Get the stream length
    const length = this.resolveLength(dict);

    // Read exactly `length` bytes
    const startPos = this.scanner.position;
    const data = this.scanner.bytes.slice(startPos, startPos + length);
    this.scanner.moveTo(startPos + length);

    // Skip optional EOL before "endstream"
    this.skipOptionalEOL();

    // Consume "endstream" keyword directly from scanner
    this.expectKeyword("endstream");

    return new PdfStream(dict, data);
  }

  /**
   * Expect and consume a keyword at current scanner position.
   */
  private expectKeyword(keyword: string): void {
    // Skip any whitespace first
    this.skipWhitespace();

    for (let i = 0; i < keyword.length; i++) {
      const byte = this.scanner.peek();

      if (byte !== keyword.charCodeAt(i)) {
        throw new ObjectParseError(`Expected keyword "${keyword}"`);
      }

      this.scanner.advance();
    }
  }

  /**
   * Skip whitespace characters.
   */
  private skipWhitespace(): void {
    while (true) {
      const byte = this.scanner.peek();

      if (byte === -1) {
        break;
      }
      if (byte === SPACE || byte === TAB || byte === LF || byte === CR) {
        this.scanner.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Skip the EOL after "stream" keyword.
   * Per PDF spec: single EOL (LF or CRLF) after "stream"
   */
  private skipStreamEOL(): void {
    const byte = this.scanner.peek();

    if (byte === CR) {
      this.scanner.advance();
      // CRLF
      if (this.scanner.peek() === LF) {
        this.scanner.advance();
      }
    } else if (byte === LF) {
      this.scanner.advance();
    }
    // If no EOL, be lenient and continue anyway
  }

  /**
   * Skip optional EOL before "endstream".
   */
  private skipOptionalEOL(): void {
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
   * Resolve the /Length value from the stream dict.
   * Handles both direct values and indirect references.
   */
  private resolveLength(dict: PdfDict): number {
    const lengthObj = dict.get("Length");

    if (lengthObj === undefined) {
      throw new ObjectParseError("Stream missing required /Length entry");
    }

    // Direct number
    if (lengthObj.type === "number") {
      return lengthObj.value;
    }

    // Indirect reference
    if (lengthObj.type === "ref") {
      const ref = lengthObj;

      if (!this.lengthResolver) {
        throw new ObjectParseError(
          `Cannot resolve indirect /Length reference ${ref.objectNumber} ${ref.generation} R: no resolver provided`,
        );
      }

      const length = this.lengthResolver(ref);

      if (length === null) {
        throw new ObjectParseError(
          `Could not resolve /Length reference ${ref.objectNumber} ${ref.generation} R`,
        );
      }

      return length;
    }

    throw new ObjectParseError(`Invalid /Length type: ${lengthObj.type}`);
  }
}
