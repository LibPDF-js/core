/**
 * PdfFont - Abstract base class for all PDF font types.
 *
 * PDF supports several font types:
 * - SimpleFont: TrueType, Type1, Type3, MMType1 (single-byte encoding)
 * - CompositeFont: Type0 (multi-byte CID encoding, used for CJK/Unicode)
 *
 * All fonts share a common interface for:
 * - Width measurement
 * - Text encoding/decoding
 * - Unicode conversion (for text extraction)
 */

import type { FontDescriptor } from "./font-descriptor";

/** A character code and the number of bytes it occupied in the string. */
export interface CharCode {
  code: number;
  length: number;
}

/**
 * Abstract base class for PDF fonts.
 */
export abstract class PdfFont {
  /**
   * Font subtype (e.g., "TrueType", "Type1", "Type0").
   */
  abstract readonly subtype: string;

  /**
   * Base font name (e.g., "Helvetica", "Arial-BoldMT").
   */
  abstract readonly baseFontName: string;

  /**
   * Font descriptor containing metrics and flags.
   * May be null for standard 14 fonts or malformed PDFs.
   */
  abstract get descriptor(): FontDescriptor | null;

  /**
   * Get width of a character code in glyph units (1000 units = 1 em).
   *
   * @param code - Character code (interpretation depends on font type)
   * @returns Width in glyph units
   */
  abstract getWidth(code: number): number;

  /**
   * Encode text to character codes for this font.
   *
   * @param text - Unicode text to encode
   * @returns Array of character codes
   * @throws {Error} if text contains unencodable characters
   */
  abstract encodeText(text: string): number[];

  /**
   * Decode character code to Unicode string (for text extraction).
   *
   * @param code - Character code to decode
   * @returns Unicode string (may be empty if no mapping)
   */
  abstract toUnicode(code: number): string;

  /**
   * Split string operand bytes into character codes. One byte per code
   * unless overridden.
   */
  decode(bytes: Uint8Array): CharCode[] {
    return Array.from(bytes, code => ({ code, length: 1 }));
  }

  /**
   * Check if this font can encode the given text.
   *
   * @param text - Unicode text to check
   * @returns true if all characters can be encoded
   */
  abstract canEncode(text: string): boolean;

  /**
   * Get width of text in points at a given font size.
   *
   * @param text - Unicode text to measure
   * @param fontSize - Font size in points
   * @returns Width in points
   */
  getTextWidth(text: string, fontSize: number): number {
    let totalWidth = 0;
    const codes = this.encodeText(text);

    for (const code of codes) {
      totalWidth += this.getWidth(code);
    }

    return (totalWidth * fontSize) / 1000;
  }
}
