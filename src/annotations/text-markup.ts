/**
 * Text Markup Annotations - Highlight, Underline, StrikeOut, Squiggly.
 *
 * These annotations use QuadPoints to define regions on text.
 * QuadPoints allow highlighting text at any angle.
 *
 * PDF Reference: Section 12.5.6.10 "Text Markup Annotations"
 */

import { colorToArray, rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { PDFMarkupAnnotation } from "./markup";
import type { Rect, TextMarkupAnnotationOptions } from "./types";

/**
 * Base class for text markup annotations (Highlight, Underline, StrikeOut, Squiggly).
 */
export abstract class PDFTextMarkupAnnotation extends PDFMarkupAnnotation {
  /**
   * Get the raw QuadPoints as an array of quads.
   * Each quad is an array of 8 numbers [x1,y1, x2,y2, x3,y3, x4,y4].
   *
   * PDF spec order is: top-left, top-right, bottom-left, bottom-right
   * (counterclockwise from top-left of text baseline)
   */
  get quadPoints(): number[][] {
    const qp = this.dict.getArray("QuadPoints");

    if (!qp) {
      return [];
    }

    const quads: number[][] = [];
    const values: number[] = [];

    for (let i = 0; i < qp.length; i++) {
      const val = qp.at(i);

      if (val instanceof PdfNumber) {
        values.push(val.value);
      }
    }

    // Each quad is 8 numbers (4 points, 2 coordinates each)
    for (let i = 0; i < values.length; i += 8) {
      if (i + 8 <= values.length) {
        quads.push(values.slice(i, i + 8));
      }
    }

    return quads;
  }

  /**
   * Set the QuadPoints.
   */
  setQuadPoints(quads: number[][]): void {
    const flat: PdfNumber[] = [];

    for (const quad of quads) {
      for (const val of quad) {
        flat.push(PdfNumber.of(val));
      }
    }

    this.dict.set("QuadPoints", new PdfArray(flat));

    // Also update the Rect to encompass all quads
    this.updateRectFromQuadPoints(quads);
    this.markModified();
  }

  /**
   * Get the bounding box that encompasses all QuadPoints.
   * This is a convenience method for simple use cases.
   */
  getBounds(): Rect {
    const quads = this.quadPoints;

    if (quads.length === 0) {
      return this.rect;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const quad of quads) {
      for (let i = 0; i < quad.length; i += 2) {
        const x = quad[i];
        const y = quad[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Update the Rect entry to encompass all QuadPoints.
   */
  private updateRectFromQuadPoints(quads: number[][]): void {
    if (quads.length === 0) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const quad of quads) {
      for (let i = 0; i < quad.length; i += 2) {
        const x = quad[i];
        const y = quad[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const arr = this.dict.getArray("Rect");

    if (arr && arr.length >= 4) {
      arr.set(0, PdfNumber.of(minX));
      arr.set(1, PdfNumber.of(minY));
      arr.set(2, PdfNumber.of(maxX));
      arr.set(3, PdfNumber.of(maxY));
    }
  }
}

/**
 * Highlight annotation - yellow highlighter effect on text.
 */
export class PDFHighlightAnnotation extends PDFTextMarkupAnnotation {
  /**
   * Create a new highlight annotation dictionary.
   */
  static create(options: TextMarkupAnnotationOptions): PdfDict {
    return createTextMarkupDict("Highlight", options);
  }
}

/**
 * Underline annotation - line under text.
 */
export class PDFUnderlineAnnotation extends PDFTextMarkupAnnotation {
  /**
   * Create a new underline annotation dictionary.
   */
  static create(options: TextMarkupAnnotationOptions): PdfDict {
    return createTextMarkupDict("Underline", options);
  }
}

/**
 * StrikeOut annotation - line through text.
 */
export class PDFStrikeOutAnnotation extends PDFTextMarkupAnnotation {
  /**
   * Create a new strikeout annotation dictionary.
   */
  static create(options: TextMarkupAnnotationOptions): PdfDict {
    return createTextMarkupDict("StrikeOut", options);
  }
}

/**
 * Squiggly annotation - wavy underline.
 */
export class PDFSquigglyAnnotation extends PDFTextMarkupAnnotation {
  /**
   * Create a new squiggly annotation dictionary.
   */
  static create(options: TextMarkupAnnotationOptions): PdfDict {
    return createTextMarkupDict("Squiggly", options);
  }
}

/**
 * Create a text markup annotation dictionary.
 */
function createTextMarkupDict(
  subtype: "Highlight" | "Underline" | "StrikeOut" | "Squiggly",
  options: TextMarkupAnnotationOptions,
): PdfDict {
  // Convert rect/rects to quadPoints
  let quadPoints: number[][];

  if (options.quadPoints) {
    quadPoints = options.quadPoints;
  } else if (options.rects) {
    quadPoints = rectsToQuadPoints(options.rects);
  } else if (options.rect) {
    quadPoints = [rectToQuadPoints(options.rect)];
  } else {
    throw new Error("Must specify rect, rects, or quadPoints for text markup annotation");
  }

  // Calculate bounding box from quadPoints
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const quad of quadPoints) {
    for (let i = 0; i < quad.length; i += 2) {
      minX = Math.min(minX, quad[i]);
      minY = Math.min(minY, quad[i + 1]);
      maxX = Math.max(maxX, quad[i]);
      maxY = Math.max(maxY, quad[i + 1]);
    }
  }

  // Flatten quadPoints for PDF array
  const flatQuadPoints: PdfNumber[] = [];

  for (const quad of quadPoints) {
    for (const val of quad) {
      flatQuadPoints.push(PdfNumber.of(val));
    }
  }

  // Build annotation dictionary
  const color = options.color ?? rgb(1, 1, 0); // Default yellow
  const colorComponents = colorToArray(color);

  const annotDict = PdfDict.of({
    Type: PdfName.of("Annot"),
    Subtype: PdfName.of(subtype),
    Rect: new PdfArray([
      PdfNumber.of(minX),
      PdfNumber.of(minY),
      PdfNumber.of(maxX),
      PdfNumber.of(maxY),
    ]),
    QuadPoints: new PdfArray(flatQuadPoints),
    C: new PdfArray(colorComponents.map(PdfNumber.of)),
    F: PdfNumber.of(4), // Print flag
  });

  if (options.opacity !== undefined) {
    annotDict.set("CA", PdfNumber.of(options.opacity));
  }

  if (options.contents) {
    annotDict.set("Contents", PdfString.fromString(options.contents));
  }

  if (options.title) {
    annotDict.set("T", PdfString.fromString(options.title));
  }

  return annotDict;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a single rect to QuadPoints format.
 * Assumes horizontal text.
 */
export function rectToQuadPoints(rect: Rect): number[] {
  const { x, y, width, height } = rect;

  // PDF spec order: top-left, top-right, bottom-left, bottom-right
  return [
    x,
    y + height, // top-left
    x + width,
    y + height, // top-right
    x,
    y, // bottom-left
    x + width,
    y, // bottom-right
  ];
}

/**
 * Convert multiple rects to QuadPoints format.
 */
export function rectsToQuadPoints(rects: Rect[]): number[][] {
  return rects.map(rectToQuadPoints);
}
