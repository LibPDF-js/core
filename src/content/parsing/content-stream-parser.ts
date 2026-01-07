/**
 * Content stream parser.
 *
 * Parses PDF content streams into structured operations.
 */

import { ContentTokenizer } from "./content-tokenizer";
import { extractInlineImageData } from "./inline-image";
import type { AnyOperation, ContentToken, InlineImageOperation, ParseResult } from "./types";

/**
 * Parser for PDF content streams.
 *
 * Converts a byte stream into an array of parsed operations,
 * each bundling an operator with its preceding operands.
 */
export class ContentStreamParser {
  private readonly tokenizer: ContentTokenizer;
  private readonly warnings: string[] = [];

  constructor(bytes: Uint8Array) {
    this.tokenizer = new ContentTokenizer(bytes);
  }

  /**
   * Parse all operations from the content stream.
   */
  parse(): ParseResult {
    const operations: AnyOperation[] = [];
    const operands: ContentToken[] = [];

    while (!this.tokenizer.eof()) {
      const token = this.tokenizer.nextToken();

      if (token === null) {
        break;
      }

      if (token.type === "operator") {
        if (token.name === "BI") {
          // Special handling for inline images
          const inlineImage = this.parseInlineImage();

          operations.push(inlineImage);
        } else {
          operations.push({
            operator: token.name,
            operands: [...operands],
          });
        }

        operands.length = 0;
      } else {
        operands.push(token);
      }
    }

    // Trailing operands without operator
    if (operands.length > 0) {
      this.warnings.push(
        `Content stream has ${operands.length} trailing operand(s) without operator`,
      );
    }

    return {
      operations,
      warnings: this.warnings,
    };
  }

  /**
   * Iterate operations lazily.
   */
  *[Symbol.iterator](): Iterator<AnyOperation> {
    const operands: ContentToken[] = [];

    while (!this.tokenizer.eof()) {
      const token = this.tokenizer.nextToken();

      if (token === null) {
        break;
      }

      if (token.type === "operator") {
        if (token.name === "BI") {
          yield this.parseInlineImage();
        } else {
          yield {
            operator: token.name,
            operands: [...operands],
          };
        }

        operands.length = 0;
      } else {
        operands.push(token);
      }
    }
  }

  private parseInlineImage(): InlineImageOperation {
    const params = new Map<string, ContentToken>();

    // Parse key-value pairs until ID operator
    while (!this.tokenizer.eof()) {
      const token = this.tokenizer.nextToken();

      if (token === null) {
        this.warnings.push("Unexpected EOF in inline image parameters");
        break;
      }

      if (token.type === "operator") {
        if (token.name === "ID") {
          break;
        }

        this.warnings.push(`Unexpected operator in inline image params: ${token.name}`);
        continue;
      }

      if (token.type !== "name") {
        this.warnings.push(`Expected name as inline image param key, got ${token.type}`);
        continue;
      }

      const key = token.value;
      const value = this.tokenizer.nextToken();

      if (value === null) {
        this.warnings.push("Unexpected EOF reading inline image param value");
        break;
      }

      if (value.type === "operator") {
        // ID encountered while reading value
        if (value.name === "ID") {
          this.warnings.push(`Missing value for inline image param: ${key}`);
          break;
        }

        this.warnings.push(`Unexpected operator as param value: ${value.name}`);
        continue;
      }

      params.set(key, value);
    }

    // Extract image data
    const scanner = this.tokenizer.getScanner();
    const { data, warnings } = extractInlineImageData(scanner, params);

    this.warnings.push(...warnings);

    // Clear any peeked token since we've consumed raw bytes
    this.tokenizer.clearPeeked();

    return {
      operator: "BI",
      params,
      data,
    };
  }
}
