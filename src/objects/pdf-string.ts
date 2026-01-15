import { bytesToHex, hexToBytes } from "#src/helpers/buffer";
import { CHAR_PARENTHESIS_CLOSE, CHAR_PARENTHESIS_OPEN } from "#src/helpers/chars";
import { canEncodePdfDoc, decodeTextString, encodeTextString } from "#src/helpers/encoding";
import { escapeLiteralString } from "#src/helpers/strings";
import type { ByteWriter } from "#src/io/byte-writer.ts";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * PDF string object.
 *
 * In PDF: `(Hello World)` (literal) or `<48656C6C6F>` (hex)
 *
 * Stores raw bytes. Use `.asString()` to decode as PDF text string
 * (auto-detects PDFDocEncoding vs UTF-16BE).
 */
export class PdfString implements PdfPrimitive {
  get type(): "string" {
    return "string";
  }

  constructor(
    readonly bytes: Uint8Array,
    readonly format: "literal" | "hex" = "literal",
  ) {}

  /**
   * Decode as PDF text string (auto-detects encoding).
   *
   * PDF text strings use either PDFDocEncoding (single-byte, similar to Latin-1)
   * or UTF-16BE with BOM (0xFE 0xFF prefix). This method auto-detects and decodes.
   */
  asString(): string {
    return decodeTextString(this.bytes);
  }

  /**
   * Create a PdfString from text (auto-selects encoding).
   *
   * Uses PDFDocEncoding if all characters fit, otherwise UTF-16BE with BOM.
   * PDFDocEncoding supports ASCII, Latin-1 supplement, and some special chars
   * (€, •, —, ", ", etc.). For CJK, emoji, or other Unicode, uses UTF-16BE.
   */
  static fromString(text: string): PdfString {
    const bytes = encodeTextString(text);
    // Use hex format for UTF-16 (has BOM, cleaner output), literal for PDFDoc
    const format = canEncodePdfDoc(text) ? "literal" : "hex";
    return new PdfString(bytes, format);
  }

  /**
   * Create a PdfString from a hex string (e.g., "48656C6C6F").
   * Whitespace is ignored. Odd-length strings are padded with 0.
   */
  static fromHex(hex: string): PdfString {
    return new PdfString(hexToBytes(hex), "hex");
  }

  /**
   * Create a PdfString from raw bytes.
   * Uses hex format for cleaner output.
   */
  static fromBytes(bytes: Uint8Array): PdfString {
    return new PdfString(bytes, "hex");
  }

  toBytes(writer: ByteWriter): void {
    if (this.format === "hex") {
      writer.writeAscii(`<${bytesToHex(this.bytes)}>`);
    } else {
      // Literal format
      writer.writeByte(CHAR_PARENTHESIS_OPEN);
      writer.writeBytes(escapeLiteralString(this.bytes));
      writer.writeByte(CHAR_PARENTHESIS_CLOSE);
    }
  }
}
