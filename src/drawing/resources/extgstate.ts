/**
 * Extended graphics state resources.
 */

import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";

import type { BlendMode } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating extended graphics state.
 */
export interface ExtGStateOptions {
  /** Fill (non-stroking) opacity (0-1) */
  fillOpacity?: number;
  /** Stroke opacity (0-1) */
  strokeOpacity?: number;
  /** Blend mode for compositing */
  blendMode?: BlendMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An extended graphics state resource.
 *
 * Extended graphics state (ExtGState) provides advanced rendering options
 * not available in the basic graphics state:
 * - **Opacity**: Separate fill and stroke transparency
 * - **Blend modes**: Photoshop-style compositing (Multiply, Screen, etc.)
 *
 * @example
 * ```typescript
 * const semiTransparent = pdf.createExtGState({
 *   fillOpacity: 0.5,
 *   blendMode: "Multiply",
 * });
 *
 * const name = page.registerExtGState(semiTransparent);
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.setGraphicsState(name),
 *   ops.setNonStrokingRGB(1, 0, 0),
 *   ops.rectangle(100, 100, 50, 50),
 *   ops.fill(),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export class PDFExtGState {
  readonly type = "extgstate";
  readonly ref: PdfRef;

  constructor(ref: PdfRef) {
    this.ref = ref;
  }

  /**
   * Create the PDF dictionary for an extended graphics state.
   *
   * Opacity values are clamped to the range [0, 1].
   */
  static createDict(options: ExtGStateOptions): PdfDict {
    const dict = new PdfDict();

    if (options.fillOpacity !== undefined) {
      dict.set("ca", PdfNumber.of(Math.max(0, Math.min(1, options.fillOpacity))));
    }

    if (options.strokeOpacity !== undefined) {
      dict.set("CA", PdfNumber.of(Math.max(0, Math.min(1, options.strokeOpacity))));
    }

    if (options.blendMode !== undefined) {
      dict.set("BM", PdfName.of(options.blendMode));
    }

    return dict;
  }
}
