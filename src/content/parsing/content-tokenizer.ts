/**
 * Content stream tokenizer.
 *
 * Wraps TokenReader and converts tokens to ContentToken types.
 * Post-processes keywords to distinguish operators from true/false/null.
 */

import { Scanner } from "#src/io/scanner";
import type { Token } from "#src/parser/token";
import { TokenReader } from "#src/parser/token-reader";

import type { ArrayToken, ContentToken, DictToken, OperatorToken } from "./types";

type ContentOrOperatorToken = ContentToken | OperatorToken;

/**
 * Tokenizer for PDF content streams.
 *
 * Wraps TokenReader to provide content-stream-specific token types.
 * Distinguishes operators from keywords (true, false, null).
 */
export class ContentTokenizer {
  private readonly scanner: Scanner;
  private readonly reader: TokenReader;

  private peeked: ContentOrOperatorToken | null = null;

  constructor(bytes: Uint8Array) {
    this.scanner = new Scanner(bytes);
    this.reader = new TokenReader(this.scanner);
  }

  /**
   * Current position in the byte stream.
   */
  get position(): number {
    return this.scanner.position;
  }

  /**
   * Access to underlying scanner for inline image handling.
   */
  getScanner(): Scanner {
    return this.scanner;
  }

  /**
   * Check if at end of stream.
   */
  eof(): boolean {
    if (this.peeked !== null) {
      return false;
    }

    return this.reader.peekToken().type === "eof";
  }

  /**
   * Peek at next token without consuming.
   */
  peek(): ContentOrOperatorToken | null {
    if (this.peeked !== null) {
      return this.peeked;
    }

    this.peeked = this.readNext();

    return this.peeked;
  }

  /**
   * Read and consume next token.
   */
  nextToken(): ContentOrOperatorToken | null {
    if (this.peeked !== null) {
      const token = this.peeked;
      this.peeked = null;

      return token;
    }

    return this.readNext();
  }

  /**
   * Clear any peeked token (used after inline image data consumption).
   */
  clearPeeked(): void {
    this.peeked = null;
  }

  private readNext(): ContentOrOperatorToken | null {
    while (true) {
      const token = this.reader.nextToken();

      if (token.type === "eof") {
        return null;
      }

      const result = this.convertToken(token);

      // If convertToken returns null (skipped token), try the next one
      if (result !== null) {
        return result;
      }
    }
  }

  private convertToken(token: Token): ContentOrOperatorToken | null {
    switch (token.type) {
      case "number":
        return { type: "number", value: token.value };

      case "name":
        return { type: "name", value: token.value };

      case "string":
        return {
          type: "string",
          value: token.value,
          hex: token.format === "hex",
        };

      case "keyword":
        return this.handleKeyword(token.value);

      case "delimiter":
        return this.handleDelimiter(token.value);

      default:
        throw new Error(`Unexpected token type: ${token.type}`);
    }
  }

  private handleKeyword(value: string): ContentOrOperatorToken {
    if (value === "true") {
      return { type: "bool", value: true };
    }

    if (value === "false") {
      return { type: "bool", value: false };
    }

    if (value === "null") {
      return { type: "null" };
    }

    // Everything else is an operator
    return { type: "operator", name: value };
  }

  private handleDelimiter(value: string): ContentToken | null {
    if (value === "[") {
      return this.readArray();
    }

    if (value === "<<") {
      return this.readDict();
    }

    // Unexpected delimiters (], >>) - shouldn't happen in valid content stream
    // Be lenient: warn and skip the token rather than throwing
    console.warn(
      `ContentTokenizer: Unexpected delimiter '${value}' at position ${this.scanner.position} - skipping`,
    );
    return null;
  }

  private readArray(): ArrayToken {
    const items: ContentToken[] = [];

    while (true) {
      const token = this.reader.peekToken();

      if (token.type === "eof") {
        break;
      }

      if (token.type === "delimiter" && token.value === "]") {
        this.reader.nextToken(); // consume ]
        break;
      }

      const item = this.nextToken();

      if (item === null) {
        break;
      }

      if (item.type === "operator") {
        // Operators shouldn't appear inside arrays - treat as error
        throw new Error(`Unexpected operator in array: ${item.name}`);
      }

      items.push(item);
    }

    return { type: "array", items };
  }

  private readDict(): DictToken {
    const entries = new Map<string, ContentToken>();

    while (true) {
      const keyToken = this.reader.peekToken();

      if (keyToken.type === "eof") {
        break;
      }

      if (keyToken.type === "delimiter" && keyToken.value === ">>") {
        this.reader.nextToken(); // consume >>
        break;
      }

      // Read key (must be a name)
      const key = this.nextToken();

      if (key === null) {
        break;
      }

      if (key.type !== "name") {
        throw new Error(`Expected name as dict key, got ${key.type}`);
      }

      // Read value
      const value = this.nextToken();

      if (value === null) {
        break;
      }

      if (value.type === "operator") {
        throw new Error(`Unexpected operator as dict value: ${value.name}`);
      }

      entries.set(key.value, value);
    }

    return { type: "dict", entries };
  }
}
