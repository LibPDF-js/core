/**
 * Content stream serializer.
 *
 * Serializes parsed operations back to bytes.
 * Accepts both ParsedOperation and Operator for mixed workflows.
 */

import { Operator } from "#src/content/operators";
import { concatBytes } from "#src/helpers/buffer";
import { formatPdfNumber } from "#src/helpers/format";

import {
  type AnyOperation,
  type ContentToken,
  type InlineImageOperation,
  isInlineImageOperation,
  type ParsedOperation,
} from "./types";

const encoder = new TextEncoder();
const SPACE = new Uint8Array([0x20]);
const NEWLINE = new Uint8Array([0x0a]);

/**
 * Serializes content stream operations to bytes.
 */

// biome-ignore lint/complexity/noStaticOnlyClass: utility class
export class ContentStreamSerializer {
  /**
   * Serialize an array of operations to bytes.
   *
   * Accepts both ParsedOperation (from parsing) and Operator (from builder API).
   */
  static serialize(operations: (AnyOperation | Operator)[]): Uint8Array {
    const parts: Uint8Array[] = [];

    for (const op of operations) {
      parts.push(ContentStreamSerializer.serializeOperation(op));
      parts.push(NEWLINE);
    }

    return concatBytes(parts);
  }

  /**
   * Serialize a single operation to bytes.
   */
  static serializeOperation(op: AnyOperation | Operator): Uint8Array {
    // Handle existing Operator class from builder API
    if (op instanceof Operator) {
      return op.toBytes();
    }

    // Handle inline image
    if (isInlineImageOperation(op)) {
      return ContentStreamSerializer.serializeInlineImage(op);
    }

    // Handle regular ParsedOperation
    return ContentStreamSerializer.serializeParsedOperation(op);
  }

  private static serializeParsedOperation(op: ParsedOperation): Uint8Array {
    const parts: Uint8Array[] = [];

    for (const operand of op.operands) {
      parts.push(ContentStreamSerializer.serializeToken(operand));
      parts.push(SPACE);
    }

    parts.push(encoder.encode(op.operator));

    return concatBytes(parts);
  }

  private static serializeInlineImage(op: InlineImageOperation): Uint8Array {
    const parts: Uint8Array[] = [];

    // BI
    parts.push(encoder.encode("BI"));
    parts.push(NEWLINE);

    // Parameters
    for (const [key, value] of op.params) {
      parts.push(encoder.encode(`/${key} `));
      parts.push(ContentStreamSerializer.serializeToken(value));
      parts.push(NEWLINE);
    }

    // ID + single space + data + newline + EI
    parts.push(encoder.encode("ID "));
    parts.push(op.data);
    parts.push(NEWLINE);
    parts.push(encoder.encode("EI"));

    return concatBytes(parts);
  }

  private static serializeToken(token: ContentToken): Uint8Array {
    switch (token.type) {
      case "number":
        return encoder.encode(formatPdfNumber(token.value));

      case "name":
        return encoder.encode(`/${escapeName(token.value)}`);

      case "string":
        return token.hex
          ? ContentStreamSerializer.serializeHexString(token.value)
          : ContentStreamSerializer.serializeLiteralString(token.value);

      case "array":
        return ContentStreamSerializer.serializeArray(token.items);

      case "dict":
        return ContentStreamSerializer.serializeDict(token.entries);

      case "bool":
        return encoder.encode(token.value ? "true" : "false");

      case "null":
        return encoder.encode("null");

      default:
        throw new Error(`Cannot serialize token type: ${(token as ContentToken).type}`);
    }
  }

  private static serializeArray(items: ContentToken[]): Uint8Array {
    const parts: Uint8Array[] = [encoder.encode("[")];

    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        parts.push(SPACE);
      }

      parts.push(ContentStreamSerializer.serializeToken(items[i]));
    }

    parts.push(encoder.encode("]"));

    return concatBytes(parts);
  }

  private static serializeDict(entries: Map<string, ContentToken>): Uint8Array {
    const parts: Uint8Array[] = [encoder.encode("<<")];

    for (const [key, value] of entries) {
      parts.push(encoder.encode(`/${escapeName(key)} `));
      parts.push(ContentStreamSerializer.serializeToken(value));
    }

    parts.push(encoder.encode(">>"));

    return concatBytes(parts);
  }

  private static serializeHexString(value: Uint8Array): Uint8Array {
    const hex = Array.from(value)
      .map(b => b.toString(16).padStart(2, "0").toUpperCase())
      .join("");

    return encoder.encode(`<${hex}>`);
  }

  private static serializeLiteralString(value: Uint8Array): Uint8Array {
    // Escape special characters in literal strings
    const escaped: number[] = [0x28]; // (

    for (const byte of value) {
      if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
        // ( ) \ need escaping
        escaped.push(0x5c); // \
      }

      escaped.push(byte);
    }

    escaped.push(0x29); // )

    return new Uint8Array(escaped);
  }
}

/**
 * Escape special characters in PDF names.
 */
function escapeName(name: string): string {
  let result = "";

  for (let i = 0; i < name.length; i++) {
    const ch = name.charCodeAt(i);

    // Characters that need #XX escaping
    if (
      ch < 0x21 ||
      ch > 0x7e ||
      ch === 0x23 ||
      ch === 0x25 ||
      ch === 0x28 ||
      ch === 0x29 ||
      ch === 0x2f ||
      ch === 0x3c ||
      ch === 0x3e ||
      ch === 0x5b ||
      ch === 0x5d ||
      ch === 0x7b ||
      ch === 0x7d
    ) {
      result += `#${ch.toString(16).padStart(2, "0")}`;
    } else {
      result += name.charAt(i);
    }
  }

  return result;
}
