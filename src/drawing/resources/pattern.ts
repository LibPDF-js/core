/**
 * Pattern resources (tiling and shading patterns).
 */

import type { Operator } from "#src/content/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import type { PDFShading } from "./shading";
import type { BBox, PatternMatrix } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a tiling pattern.
 *
 * Tiling patterns repeat a small graphic cell to fill an area. The cell is
 * defined by operators that draw into the bbox, and the pattern tiles with
 * the specified step sizes.
 *
 * @example
 * ```typescript
 * // Checkerboard pattern
 * const pattern = pdf.createTilingPattern({
 *   bbox: { x: 0, y: 0, width: 10, height: 10 },
 *   xStep: 10,
 *   yStep: 10,
 *   operators: [
 *     ops.setNonStrokingGray(0.8),
 *     ops.rectangle(0, 0, 5, 5),
 *     ops.fill(),
 *   ],
 * });
 * ```
 */
export interface TilingPatternOptions {
  /**
   * Bounding box of the pattern cell.
   *
   * Defines the coordinate space for the pattern's operators.
   * Usually starts at { x: 0, y: 0, width, height }.
   */
  bbox: BBox;
  /**
   * Horizontal distance between pattern cell origins.
   *
   * Set equal to bbox width for seamless tiling, or larger for gaps.
   */
  xStep: number;
  /**
   * Vertical distance between pattern cell origins.
   *
   * Set equal to bbox height for seamless tiling, or larger for gaps.
   */
  yStep: number;
  /** Operators that draw the pattern cell content */
  operators: Operator[];
}

/**
 * Options for creating an image pattern.
 *
 * Image patterns tile an embedded image to fill an area, similar to
 * CSS `background-image` with `background-repeat: repeat`.
 *
 * @example
 * ```typescript
 * const image = pdf.embedImage(textureBytes);
 * const pattern = pdf.createImagePattern({
 *   image,
 *   width: 50,   // Tile size in points
 *   height: 50,
 * });
 *
 * const patternName = page.registerPattern(pattern);
 * page.drawOperators([
 *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
 *   ops.setNonStrokingColorN(patternName),
 *   ops.rectangle(100, 100, 300, 200),
 *   ops.fill(),
 * ]);
 * ```
 */
export interface ImagePatternOptions {
  /**
   * The embedded image to use as the pattern tile.
   *
   * Created via `pdf.embedImage()`, `pdf.embedJpeg()`, or `pdf.embedPng()`.
   */
  image: { ref: PdfRef; width: number; height: number };

  /**
   * Width of each tile in points.
   *
   * If not specified, uses the image's natural width in points.
   */
  width?: number;

  /**
   * Height of each tile in points.
   *
   * If not specified, uses the image's natural height in points.
   */
  height?: number;
}

/**
 * Options for creating a shading pattern.
 *
 * Shading patterns wrap a gradient (shading) so it can be used as a fill or
 * stroke color, just like tiling patterns.
 *
 * @example
 * ```typescript
 * // Create a gradient
 * const gradient = pdf.createAxialShading({
 *   coords: [0, 0, 100, 0],
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 *
 * // Wrap in a pattern (optionally with transform)
 * const pattern = pdf.createShadingPattern({
 *   shading: gradient,
 *   matrix: [1, 0, 0, 1, 50, 100],  // Translate by (50, 100)
 * });
 * ```
 */
export interface ShadingPatternOptions {
  /**
   * The shading (gradient) to use.
   *
   * Created via pdf.createAxialShading() or pdf.createRadialShading().
   */
  shading: PDFShading;

  /**
   * Optional transformation matrix for the pattern.
   *
   * Transforms the shading's coordinate space. Useful for positioning
   * a gradient relative to shapes that will use it.
   *
   * Default: identity matrix (no transformation)
   */
  matrix?: PatternMatrix;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A tiling pattern resource (PatternType 1).
 *
 * Tiling patterns repeat a small graphic cell to fill an area.
 * Useful for textures, backgrounds, and decorative fills.
 *
 * @example
 * ```typescript
 * const dots = pdf.createTilingPattern({
 *   bbox: { x: 0, y: 0, width: 10, height: 10 },
 *   xStep: 10,
 *   yStep: 10,
 *   operators: [
 *     ops.setNonStrokingGray(0.5),
 *     ops.moveTo(7, 5),
 *     ops.curveTo(7, 6.1, 6.1, 7, 5, 7),
 *     ops.curveTo(3.9, 7, 3, 6.1, 3, 5),
 *     ops.curveTo(3, 3.9, 3.9, 3, 5, 3),
 *     ops.curveTo(6.1, 3, 7, 3.9, 7, 5),
 *     ops.fill(),
 *   ],
 * });
 *
 * const name = page.registerPattern(dots);
 * ```
 */
export class PDFTilingPattern {
  readonly type = "pattern";
  readonly ref: PdfRef;
  readonly patternType = "tiling";

  constructor(ref: PdfRef) {
    this.ref = ref;
  }

  /**
   * Create the PDF stream for a tiling pattern.
   */
  static createStream(options: TilingPatternOptions, contentBytes: Uint8Array): PdfStream {
    const { x, y, width, height } = options.bbox;

    const dict = PdfDict.of({
      Type: PdfName.of("Pattern"),
      PatternType: PdfNumber.of(1),
      PaintType: PdfNumber.of(1),
      TilingType: PdfNumber.of(1),
      // PDF spec: BBox is [llx, lly, urx, ury] (lower-left and upper-right corners)
      BBox: new PdfArray([
        PdfNumber.of(x),
        PdfNumber.of(y),
        PdfNumber.of(x + width),
        PdfNumber.of(y + height),
      ]),
      XStep: PdfNumber.of(options.xStep),
      YStep: PdfNumber.of(options.yStep),
    });

    return new PdfStream(dict, contentBytes);
  }

  /**
   * Create the PDF stream for an image pattern.
   */
  static createImageStream(options: ImagePatternOptions): PdfStream {
    const { image } = options;
    const tileWidth = options.width ?? image.width;
    const tileHeight = options.height ?? image.height;

    const contentStr = `q ${tileWidth} 0 0 ${tileHeight} 0 0 cm /Im0 Do Q`;
    const contentBytes = new TextEncoder().encode(contentStr);

    const dict = PdfDict.of({
      Type: PdfName.of("Pattern"),
      PatternType: PdfNumber.of(1),
      PaintType: PdfNumber.of(1),
      TilingType: PdfNumber.of(1),
      BBox: new PdfArray([
        PdfNumber.of(0),
        PdfNumber.of(0),
        PdfNumber.of(tileWidth),
        PdfNumber.of(tileHeight),
      ]),
      XStep: PdfNumber.of(tileWidth),
      YStep: PdfNumber.of(tileHeight),
      Resources: PdfDict.of({
        XObject: PdfDict.of({
          Im0: image.ref,
        }),
      }),
    });

    return new PdfStream(dict, contentBytes);
  }
}

/**
 * A shading pattern resource (PatternType 2).
 *
 * Shading patterns wrap a gradient (shading) so it can be used as a fill or
 * stroke color. Unlike direct shading fills via `paintShading()`, shading
 * patterns work with any path shape without explicit clipping.
 *
 * @example
 * ```typescript
 * const gradient = pdf.createAxialShading({
 *   coords: [0, 0, 100, 0],
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 *
 * const gradientPattern = pdf.createShadingPattern({ shading: gradient });
 * const name = page.registerPattern(gradientPattern);
 * ```
 */
export class PDFShadingPattern {
  readonly type = "pattern";
  readonly ref: PdfRef;
  readonly patternType = "shading";
  readonly shading: PDFShading;

  constructor(ref: PdfRef, shading: PDFShading) {
    this.ref = ref;
    this.shading = shading;
  }

  /**
   * Create the PDF dictionary for a shading pattern.
   */
  static createDict(options: ShadingPatternOptions): PdfDict {
    const dict = PdfDict.of({
      Type: PdfName.of("Pattern"),
      PatternType: PdfNumber.of(2),
      Shading: options.shading.ref,
    });

    if (options.matrix) {
      const [a, b, c, d, e, f] = options.matrix;
      dict.set(
        "Matrix",
        new PdfArray([
          PdfNumber.of(a),
          PdfNumber.of(b),
          PdfNumber.of(c),
          PdfNumber.of(d),
          PdfNumber.of(e),
          PdfNumber.of(f),
        ]),
      );
    }

    return dict;
  }
}

/**
 * Any pattern resource (tiling or shading).
 */
export type PDFPattern = PDFTilingPattern | PDFShadingPattern;
