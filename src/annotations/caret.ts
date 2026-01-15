/**
 * PDFCaretAnnotation - Insertion point annotations.
 *
 * Caret annotations indicate a point in the text where text
 * should be inserted. They display a caret symbol.
 *
 * PDF Reference: Section 12.5.6.11 "Caret Annotations"
 */

import { PdfName } from "#src/objects/pdf-name";

import { PDFMarkupAnnotation } from "./markup";

/**
 * Caret symbol types.
 */
export type CaretSymbol = "P" | "None";

/**
 * Caret annotation - insertion point marker.
 */
export class PDFCaretAnnotation extends PDFMarkupAnnotation {
  /**
   * Symbol to display.
   * "P" = paragraph symbol, "None" = no symbol.
   */
  get symbol(): CaretSymbol {
    const sy = this.dict.getName("Sy");

    if (sy?.value === "P") {
      return "P";
    }

    return "None";
  }

  /**
   * Set the symbol.
   */
  setSymbol(symbol: CaretSymbol): void {
    this.dict.set("Sy", PdfName.of(symbol));
    this.markModified();
  }
}
