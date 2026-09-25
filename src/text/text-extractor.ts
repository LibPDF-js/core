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
import type { PdfStream } from "#src/objects/pdf-stream";

import type { TextResources } from "./text-resources";
import { TextState } from "./text-state";
import type { ExtractedChar } from "./types";

/** Cycles are caught by identity; this guards the call stack against deep chains. */
const MAX_FORM_DEPTH = 32;

/**
 * Extracts text from PDF content streams.
 */
export class TextExtractor {
  private readonly state = new TextState();
  private readonly chars: ExtractedChar[] = [];
  private readonly activeForms = new Set<PdfStream>();

  constructor(private readonly resources: TextResources) {}

  /**
   * Extract all text from a content stream and the form XObjects it invokes.
   *
   * @param contentBytes - The raw content stream bytes
   * @returns Extracted characters with positions, in stream order
   */
  extract(contentBytes: Uint8Array): ExtractedChar[] {
    this.run(contentBytes, this.resources);

    return this.chars;
  }

  private run(contentBytes: Uint8Array, resources: TextResources): void {
    const { operations } = new ContentStreamParser(contentBytes).parse();

    for (const op of operations) {
      this.processOperation(op, resources);
    }
  }

  /**
   * Process a single content stream operation.
   */
  private processOperation(op: AnyOperation, resources: TextResources): void {
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
        this.handleTf(operands, resources);
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

      // XObjects
      case "Do":
        this.handleDo(operands, resources);
        break;
    }
  }

  /**
   * Interpret a form XObject as if wrapped in q/Q with its /Matrix applied
   * (8.10.1). The state stack is restored to its prior depth even if the
   * form's own q/Q are unbalanced.
   */
  private handleDo(operands: ContentToken[], resources: TextResources): void {
    const name = this.getName(operands[0]);
    const form = name ? resources.getForm(name) : null;

    if (!form || this.activeForms.has(form.stream) || this.activeForms.size >= MAX_FORM_DEPTH) {
      return;
    }

    const depth = this.state.stackDepth;

    this.activeForms.add(form.stream);
    this.state.saveGraphicsState();
    this.state.concatMatrix(...form.matrix.toArray());

    try {
      this.run(form.content, form.resources);
    } catch {
      // A broken form must not take the page's own text with it
    } finally {
      this.state.restoreGraphicsStateTo(depth);
      this.activeForms.delete(form.stream);
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
  private handleTf(operands: ContentToken[], resources: TextResources): void {
    const fontName = this.getName(operands[0]);
    const fontSize = this.getNumber(operands[1]);

    if (fontName) {
      this.state.font = resources.getFont(fontName);
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

    for (const { code, length } of font.decode(bytes)) {
      const width = font.getWidth(code);
      const char = font.toUnicode(code);

      // Single-byte code 32 only, never a byte 32 inside a multi-byte code (9.3.3)
      const applyWordSpacing = length === 1 && code === 32;

      if (char) {
        const bbox = this.state.getCharBbox(width);

        this.chars.push({
          char,
          bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
          fontSize: this.state.effectiveFontSize,
          fontName: font.baseFontName,
          baseline: bbox.baseline,
          sequenceIndex: this.chars.length,
        });
      }

      // Advance even for glyphs with no Unicode mapping
      this.state.advanceChar(width, applyWordSpacing);
    }
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
