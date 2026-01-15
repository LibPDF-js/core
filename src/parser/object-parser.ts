import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfObject } from "#src/objects/pdf-object";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

import { ObjectParseError } from "./errors";
import type { Token } from "./token";
import type { TokenReader } from "./token-reader";

/**
 * Result of parsing an object.
 * hasStream indicates the 'stream' keyword follows (for dicts only).
 * streamKeywordPosition is the byte offset where "stream" keyword starts.
 */
export type ParseResult =
  | { object: PdfObject; hasStream: false }
  | { object: PdfDict; hasStream: true; streamKeywordPosition: number };

/**
 * Callback for warnings during parsing.
 */
export type WarningCallback = (message: string, position: number) => void;

/**
 * Recursive descent parser for PDF objects.
 *
 * Uses 2-token lookahead to distinguish references (1 0 R) from
 * consecutive numbers (1 0). Supports recovery mode for lenient
 * parsing of malformed input.
 */
export class ObjectParser {
  private static readonly MAX_DEPTH = 500;

  private buf1: Token | null = null;
  private buf2: Token | null = null;
  private depth = 0;

  /**
   * Enable recovery mode for lenient parsing.
   * When true, returns partial results instead of throwing.
   */
  recoveryMode = false;

  /**
   * Optional callback for warnings during parsing.
   */
  onWarning: WarningCallback | null = null;

  constructor(private reader: TokenReader) {}

  /**
   * Parse a single object at current position.
   * Returns null if at EOF.
   */
  parseObject(): ParseResult | null {
    if (++this.depth > ObjectParser.MAX_DEPTH) {
      this.depth--;
      throw new ObjectParseError("Maximum nesting depth exceeded");
    }

    try {
      this.ensureBufferFilled();

      if (this.buf1 === null || this.buf1.type === "eof") {
        return null;
      }

      return this.parseValue();
    } finally {
      this.depth--;
    }
  }

  private ensureBufferFilled(): void {
    if (this.buf1 === null) {
      this.refill();
    }
  }

  private refill(): void {
    this.buf1 = this.reader.nextToken();
    this.buf2 = this.reader.nextToken();
  }

  private shift(): void {
    this.buf1 = this.buf2;
    this.buf2 = this.reader.nextToken();
  }

  /**
   * Get current token with fresh type (avoids TypeScript narrowing issues).
   */
  private current(): Token | null {
    return this.buf1;
  }

  /**
   * Get lookahead token with fresh type (avoids TypeScript narrowing issues).
   */
  private lookahead(): Token | null {
    return this.buf2;
  }

  private warn(message: string): void {
    this.onWarning?.(message, this.reader.position);
  }

  private parseValue(): ParseResult {
    const token = this.buf1;

    if (token === null) {
      throw new ObjectParseError("Unexpected null token");
    }

    switch (token.type) {
      case "keyword":
        return this.parseKeyword(token.value);

      case "number":
        return this.parseNumberOrRef(token);

      case "name":
        this.shift();
        return { object: PdfName.of(token.value), hasStream: false };

      case "string":
        this.shift();
        return {
          object: new PdfString(token.value, token.format),
          hasStream: false,
        };

      case "delimiter":
        return this.parseDelimiter(token.value);

      default:
        throw new ObjectParseError(`Unexpected token type: ${token.type}`);
    }
  }

  private parseKeyword(value: string): ParseResult {
    this.shift();

    switch (value) {
      case "null":
        return { object: PdfNull.instance, hasStream: false };

      case "true":
        return { object: PdfBool.TRUE, hasStream: false };

      case "false":
        return { object: PdfBool.FALSE, hasStream: false };

      default:
        throw new ObjectParseError(`Unexpected keyword: ${value}`);
    }
  }

  private parseNumberOrRef(firstToken: Token & { type: "number" }): ParseResult {
    const firstNum = firstToken.value;

    // Check for indirect reference pattern: int int R
    // buf1 = first number (already read), buf2 = potential second number
    if (!firstToken.isInteger) {
      this.shift();
      return { object: PdfNumber.of(firstNum), hasStream: false };
    }

    // First number is integer, check if buf2 is also integer
    if (this.buf2 === null || this.buf2.type !== "number" || !this.buf2.isInteger) {
      this.shift();
      return { object: PdfNumber.of(firstNum), hasStream: false };
    }

    const secondNum = this.buf2.value;

    // Shift so buf1 = second number, buf2 = potential "R"
    this.shift();

    // Now check if buf2 is "R"
    const potentialR = this.lookahead();
    if (potentialR !== null && potentialR.type === "keyword" && potentialR.value === "R") {
      // It's a reference! Validate and consume.
      return this.parseReference(firstNum, secondNum);
    }

    // Not a reference - just the first number
    // But we've already shifted past it! We need to return it
    // and leave buf1 (second number) for next parse.
    return { object: PdfNumber.of(firstNum), hasStream: false };
  }

  private parseReference(objNum: number, genNum: number): ParseResult {
    // Validate reference values
    if (objNum < 0 || genNum < 0 || genNum > 65535) {
      if (this.recoveryMode) {
        this.warn(`Invalid reference values: ${objNum} ${genNum} R`);
      } else {
        throw new ObjectParseError(`Invalid reference values: ${objNum} ${genNum} R`);
      }
    }

    // buf1 = genNum, buf2 = R
    // Consume genNum and R
    this.shift(); // consume genNum, buf1 = R
    this.shift(); // consume R, buf1 = next token

    return { object: PdfRef.of(objNum, genNum), hasStream: false };
  }

  private parseDelimiter(value: string): ParseResult {
    switch (value) {
      case "[":
        return this.parseArray();

      case "<<":
        return this.parseDict();

      case "]":
      case ">>":
        throw new ObjectParseError(`Unexpected delimiter: ${value}`);

      default:
        throw new ObjectParseError(`Unknown delimiter: ${value}`);
    }
  }

  private parseArray(): ParseResult {
    this.shift(); // consume '['

    const items: PdfObject[] = [];

    while (true) {
      this.ensureBufferFilled();

      if (this.buf1 === null || this.buf1.type === "eof") {
        if (this.recoveryMode) {
          this.warn("Unterminated array at EOF");
          break;
        }

        throw new ObjectParseError("Unterminated array at EOF");
      }

      if (this.buf1.type === "delimiter" && this.buf1.value === "]") {
        this.shift(); // consume ']'
        break;
      }

      const result = this.parseObject();

      if (result === null) {
        if (this.recoveryMode) {
          this.warn("Unexpected null in array");
          break;
        }

        throw new ObjectParseError("Unexpected null in array");
      }

      items.push(result.object);
    }

    return { object: PdfArray.of(...items), hasStream: false };
  }

  private parseDict(): ParseResult {
    this.shift(); // consume '<<'

    // Collect entries in array to pass to constructor (avoids setting dirty flag)
    const entries: [PdfName, PdfObject][] = [];

    while (true) {
      this.ensureBufferFilled();

      if (this.buf1 === null || this.buf1.type === "eof") {
        if (this.recoveryMode) {
          this.warn("Unterminated dictionary at EOF");
          break;
        }

        throw new ObjectParseError("Unterminated dictionary at EOF");
      }

      if (this.buf1.type === "delimiter" && this.buf1.value === ">>") {
        // Partial shift: move buf2 to buf1, but DON'T fill buf2.
        // This prevents reading past a "stream" keyword into binary data.
        this.buf1 = this.buf2;
        this.buf2 = null;
        break;
      }

      // Key must be a name
      if (this.buf1.type !== "name") {
        if (this.recoveryMode) {
          this.warn(`Invalid dictionary key: expected name, got ${this.buf1.type}`);
          // Skip the invalid key AND its would-be value (pair recovery)
          this.skipInvalidPair();
          continue;
        }

        throw new ObjectParseError(`Invalid dictionary key: expected name, got ${this.buf1.type}`);
      }

      const key = PdfName.of(this.buf1.value);

      this.shift(); // consume key

      // Check if value is missing (>> immediately after key)
      this.ensureBufferFilled();
      const valueToken = this.current();
      if (valueToken !== null && valueToken.type === "delimiter" && valueToken.value === ">>") {
        if (this.recoveryMode) {
          this.warn(`Missing value for key ${key.value}`);
          // Don't consume >>, let the loop handle it
          continue;
        }

        throw new ObjectParseError(`Missing value for key ${key.value}`);
      }

      // Parse value
      const valueResult = this.parseObject();

      if (valueResult === null) {
        if (this.recoveryMode) {
          this.warn(`Missing value for key ${key.value}`);
          continue;
        }

        throw new ObjectParseError(`Missing value for key ${key.value}`);
      }

      entries.push([key, valueResult.object]);
    }

    // Create dict from entries (doesn't set dirty flag)
    const dict = new PdfDict(entries);

    // Check for stream keyword
    // buf1 already contains the token after '>>' (from the partial shift above)
    // We intentionally did NOT fill buf2 to avoid reading into stream binary data
    if (this.buf1 !== null && this.buf1.type === "keyword" && this.buf1.value === "stream") {
      const streamKeywordPosition = this.buf1.position;
      // Clear buf1 since the caller will handle raw bytes from here
      this.buf1 = null;
      return { object: dict, hasStream: true, streamKeywordPosition };
    }

    // Not a stream - fill buf2 normally for future parsing
    if (this.buf1 !== null && this.buf2 === null) {
      this.buf2 = this.reader.nextToken();
    }

    return { object: dict, hasStream: false };
  }

  /**
   * Skip an invalid key-value pair in recovery mode.
   * Consumes the current (invalid) token and the next token (its would-be value).
   */
  private skipInvalidPair(): void {
    // Skip the invalid key
    this.shift();

    this.ensureBufferFilled();

    // Check if we hit end or dict close
    if (this.buf1 === null || this.buf1.type === "eof") {
      return;
    }

    if (this.buf1.type === "delimiter" && this.buf1.value === ">>") {
      return;
    }

    // Skip the would-be value
    this.shift();
  }
}
