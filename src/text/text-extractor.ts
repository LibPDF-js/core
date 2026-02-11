/**
 * TextExtractor - Extracts text content from PDF content streams.
 *
 * Processes PDF content stream operators to extract text with position
 * information, suitable for searching and text extraction.
 */

import { ContentStreamParser } from "#src/content/parsing/content-stream-parser";
import {
  isInlineImageOperation,
  type AnyOperation,
  type ContentToken,
} from "#src/content/parsing/types";
import type { PdfFont } from "#src/fonts/pdf-font";

import { TextState } from "./text-state";
import type { ExtractedChar } from "./types";

/**
 * Options for text extraction.
 */
export interface TextExtractorOptions {
  /**
   * Resolve a font name to a PdfFont object.
   * Font names are keys in the /Resources/Font dictionary (e.g., "F1", "TT0").
   */
  resolveFont: (name: string) => PdfFont | null;
}

/**
 * Extracts text from PDF content streams.
 */
export class TextExtractor {
  private readonly resolveFont: (name: string) => PdfFont | null;
  private readonly state: TextState;
  private readonly chars: ExtractedChar[] = [];

  constructor(options: TextExtractorOptions) {
    this.resolveFont = options.resolveFont;
    this.state = new TextState();
  }

  /**
   * Extract all text from a content stream.
   *
   * @param contentBytes - The raw content stream bytes
   * @returns Array of extracted characters with positions
   */
  extract(contentBytes: Uint8Array): ExtractedChar[] {
    const parser = new ContentStreamParser(contentBytes);
    const { operations } = parser.parse();

    for (const op of operations) {
      this.processOperation(op);
    }

    return this.chars;
  }

  /**
   * Process a single content stream operation.
   */
  private processOperation(op: AnyOperation): void {
    // Handle inline images separately
    if (isInlineImageOperation(op)) {
      return; // Skip inline images
    }

    const { operator, operands } = op;

    switch (operator) {
      // Graphics state operators
      case "q":
        this.state.saveGraphicsState();
        break;

      case "Q":
        this.state.restoreGraphicsState();
        break;

      case "cm":
        this.handleCm(operands);
        break;

      // Text object operators
      case "BT":
        this.state.beginText();
        break;

      case "ET":
        this.state.endText();
        break;

      // Text state operators
      case "Tc":
        this.state.charSpacing = this.getNumber(operands[0]);
        break;

      case "Tw":
        this.state.wordSpacing = this.getNumber(operands[0]);
        break;

      case "Tz":
        this.state.horizontalScale = this.getNumber(operands[0]);
        break;

      case "TL":
        this.state.leading = this.getNumber(operands[0]);
        break;

      case "Tf":
        this.handleTf(operands);
        break;

      case "Tr":
        this.state.renderMode = this.getNumber(operands[0]);
        break;

      case "Ts":
        this.state.rise = this.getNumber(operands[0]);
        break;

      // Text positioning operators
      case "Td":
        this.state.moveTextPosition(this.getNumber(operands[0]), this.getNumber(operands[1]));
        break;

      case "TD":
        this.state.moveTextPositionAndSetLeading(
          this.getNumber(operands[0]),
          this.getNumber(operands[1]),
        );
        break;

      case "Tm":
        this.state.setTextMatrix(
          this.getNumber(operands[0]),
          this.getNumber(operands[1]),
          this.getNumber(operands[2]),
          this.getNumber(operands[3]),
          this.getNumber(operands[4]),
          this.getNumber(operands[5]),
        );
        break;

      case "T*":
        this.state.moveToNextLine();
        break;

      // Text showing operators
      case "Tj":
        this.handleTj(operands);
        break;

      case "TJ":
        this.handleTJ(operands);
        break;

      case "'":
        // Move to next line and show text
        this.state.moveToNextLine();
        this.handleTj(operands);
        break;

      case '"':
        // Set word spacing, char spacing, move to next line, show text
        this.state.wordSpacing = this.getNumber(operands[0]);
        this.state.charSpacing = this.getNumber(operands[1]);
        this.state.moveToNextLine();
        this.handleTj([operands[2]]);
        break;
    }
  }

  /**
   * Handle cm (concat matrix) operator.
   */
  private handleCm(operands: ContentToken[]): void {
    this.state.concatMatrix(
      this.getNumber(operands[0]),
      this.getNumber(operands[1]),
      this.getNumber(operands[2]),
      this.getNumber(operands[3]),
      this.getNumber(operands[4]),
      this.getNumber(operands[5]),
    );
  }

  /**
   * Handle Tf (set font and size) operator.
   */
  private handleTf(operands: ContentToken[]): void {
    const fontName = this.getName(operands[0]);
    const fontSize = this.getNumber(operands[1]);

    if (fontName) {
      const font = this.resolveFont(fontName);
      this.state.font = font;
    }

    this.state.fontSize = fontSize;
  }

  /**
   * Handle Tj (show string) operator.
   */
  private handleTj(operands: ContentToken[]): void {
    const stringToken = operands[0];

    if (stringToken?.type !== "string") {
      return;
    }

    this.showString(stringToken.value);
  }

  /**
   * Handle TJ (show strings with positioning) operator.
   */
  private handleTJ(operands: ContentToken[]): void {
    const array = operands[0];

    if (array?.type !== "array") {
      return;
    }

    for (const item of array.items) {
      if (item.type === "string") {
        this.showString(item.value);
      } else if (item.type === "number") {
        // Position adjustment
        this.state.applyTjAdjustment(item.value);
      }
    }
  }

  /**
   * Show a string and extract characters.
   */
  private showString(bytes: Uint8Array): void {
    const font = this.state.font;

    if (!font) {
      // No font set - can't decode text
      return;
    }

    // Decode bytes to character codes based on font type
    const codes = this.decodeStringToCodes(bytes, font);

    for (const code of codes) {
      // Get Unicode character from font
      const char = font.toUnicode(code);

      // Skip if we can't decode to Unicode
      if (!char) {
        // Still advance position even if we can't decode
        const width = font.getWidth(code);
        this.state.advanceChar(width, false);
        continue;
      }

      // Get glyph width
      const width = font.getWidth(code);

      // Calculate bounding box
      const bbox = this.state.getCharBbox(width);

      // Create extracted character
      this.chars.push({
        char,
        bbox: {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        },
        fontSize: this.state.effectiveFontSize,
        fontName: font.baseFontName,
        baseline: bbox.baseline,
        sequenceIndex: this.chars.length,
      });

      // Advance text position
      const isSpace = char === " " || char === "\u00A0"; // Space or non-breaking space
      this.state.advanceChar(width, isSpace);
    }
  }

  /**
   * Decode string bytes to character codes.
   *
   * For simple fonts (TrueType, Type1), each byte is a character code.
   * For composite fonts (Type0/CID), bytes are decoded as 2-byte codes.
   */
  private decodeStringToCodes(bytes: Uint8Array, font: PdfFont): number[] {
    const codes: number[] = [];

    // Check if this is a composite font (Type0)
    // Composite fonts use 2-byte character codes
    if (font.subtype === "Type0") {
      // Read as big-endian 16-bit values
      for (let i = 0; i < bytes.length - 1; i += 2) {
        const code = (bytes[i] << 8) | bytes[i + 1];
        codes.push(code);
      }

      // Handle odd byte at end (shouldn't happen in valid PDFs)
      if (bytes.length % 2 === 1) {
        codes.push(bytes[bytes.length - 1]);
      }
    } else {
      // Simple font - each byte is a character code
      for (const byte of bytes) {
        codes.push(byte);
      }
    }

    return codes;
  }

  /**
   * Get a number from a content token.
   */
  private getNumber(token: ContentToken | undefined): number {
    if (token?.type === "number") {
      return token.value;
    }

    return 0;
  }

  /**
   * Get a name from a content token (strips leading /).
   */
  private getName(token: ContentToken | undefined): string | null {
    if (token?.type === "name") {
      return token.value;
    }

    return null;
  }
}
