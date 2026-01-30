/**
 * Low-level drawing API - Shading and Pattern creation utilities.
 *
 * These are internal utilities used by the PDF class to create
 * shading, pattern, and extended graphics state resources.
 */

import type { Operator } from "#src/content/operators";
import type {
  PDFFormXObject,
  PDFExtGState,
  PDFPattern,
  PDFShading,
  PDFShadingPattern,
  PDFTilingPattern,
} from "#src/drawing/resources";
import { concatBytes } from "#src/helpers/buffer";
import type { Color } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Axial (linear) shading coordinates: start point (x0, y0) to end point (x1, y1).
 *
 * The gradient is drawn along the line from (x0, y0) to (x1, y1).
 */
export type AxialCoords = [x0: number, y0: number, x1: number, y1: number];

/**
 * Radial shading coordinates: two circles defined by center and radius.
 *
 * - First circle: center (x0, y0), radius r0
 * - Second circle: center (x1, y1), radius r1
 *
 * The gradient blends between the two circles.
 */
export type RadialCoords = [x0: number, y0: number, r0: number, x1: number, y1: number, r1: number];

/**
 * Bounding box in PDF coordinate space.
 *
 * Defines a rectangle as [x, y, width, height] where (x, y) is the lower-left corner.
 * Used for patterns, Form XObjects, and clipping regions.
 */
export type BBox = [x: number, y: number, width: number, height: number];

/**
 * A color stop in a gradient.
 *
 * @example
 * ```typescript
 * const stops: ColorStop[] = [
 *   { offset: 0, color: rgb(1, 0, 0) },    // Red at start
 *   { offset: 0.5, color: rgb(1, 1, 0) },  // Yellow at midpoint
 *   { offset: 1, color: rgb(0, 1, 0) },    // Green at end
 * ];
 * ```
 */
export interface ColorStop {
  /** Position along the gradient (0 = start, 1 = end) */
  offset: number;
  /** Color at this position */
  color: Color;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shading Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating an axial (linear) shading.
 *
 * @example
 * ```typescript
 * const gradient = pdf.createAxialShading({
 *   coords: [0, 0, 100, 0],  // Horizontal gradient, 100pt wide
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 * ```
 */
export interface AxialShadingOptions {
  /**
   * Line segment defining the gradient direction: [x0, y0, x1, y1].
   *
   * - (x0, y0): Start point where offset 0 colors appear
   * - (x1, y1): End point where offset 1 colors appear
   */
  coords: AxialCoords;
  /** Color stops defining the gradient colors and positions */
  stops: ColorStop[];
  /**
   * Whether to extend the gradient beyond its bounds.
   *
   * - [true, true] (default): Extend both ends with the endpoint colors
   * - [false, false]: No extension, transparent beyond bounds
   */
  extend?: [boolean, boolean];
}

/**
 * Options for creating a radial shading.
 *
 * @example
 * ```typescript
 * // Classic radial gradient: point to circle
 * const radial = pdf.createRadialShading({
 *   coords: [50, 50, 0, 50, 50, 50],  // From center point to 50pt radius
 *   stops: [
 *     { offset: 0, color: rgb(1, 1, 1) },  // White at center
 *     { offset: 1, color: rgb(0, 0, 0) },  // Black at edge
 *   ],
 * });
 * ```
 */
export interface RadialShadingOptions {
  /**
   * Two circles defining the gradient: [x0, y0, r0, x1, y1, r1].
   *
   * - First circle: center (x0, y0), radius r0
   * - Second circle: center (x1, y1), radius r1
   *
   * Common patterns:
   * - Point-to-circle: r0 = 0 for a classic radial gradient from center
   * - Circle-to-circle: Both radii > 0 for cone/spotlight effects
   */
  coords: RadialCoords;
  /** Color stops defining the gradient colors and positions */
  stops: ColorStop[];
  /**
   * Whether to extend the gradient beyond its bounds.
   *
   * - [true, true] (default): Extend both ends
   * - [false, false]: No extension
   */
  extend?: [boolean, boolean];
}

/**
 * Options for creating a linear gradient using CSS-style angle and length.
 *
 * This is a convenience wrapper around axial shading that uses familiar
 * CSS gradient conventions.
 *
 * @example
 * ```typescript
 * // Horizontal gradient (left to right)
 * const gradient = pdf.createLinearGradient({
 *   angle: 90,    // CSS: 0 = up, 90 = right, 180 = down, 270 = left
 *   length: 100,  // Gradient spans 100pt
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 * ```
 */
export interface LinearGradientOptions {
  /**
   * Angle in degrees using CSS convention:
   * - 0: Bottom to top
   * - 90: Left to right
   * - 180: Top to bottom
   * - 270: Right to left
   */
  angle: number;
  /** Length of the gradient in points */
  length: number;
  /** Color stops defining the gradient colors and positions */
  stops: ColorStop[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Options
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
 *   bbox: [0, 0, 10, 10],
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
   * Bounding box of the pattern cell: [x, y, width, height].
   *
   * Defines the coordinate space for the pattern's operators.
   * Usually starts at [0, 0, width, height].
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
 * PDF blend modes for compositing.
 *
 * These control how colors are combined when drawing over existing content.
 */
export type BlendMode =
  | "Normal"
  | "Multiply"
  | "Screen"
  | "Overlay"
  | "Darken"
  | "Lighten"
  | "ColorDodge"
  | "ColorBurn"
  | "HardLight"
  | "SoftLight"
  | "Difference"
  | "Exclusion"
  | "Hue"
  | "Saturation"
  | "Color"
  | "Luminosity";

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

/**
 * Create an axial (linear) shading dictionary.
 *
 * This creates a PDF shading object that can be registered on a page
 * and used with the paintShading operator.
 */
export function createAxialShadingDict(options: AxialShadingOptions): PdfDict {
  const [x0, y0, x1, y1] = options.coords;
  const extend = options.extend ?? [true, true];

  // Build the function for color interpolation
  const functionDict = createGradientFunction(options.stops);

  return PdfDict.of({
    ShadingType: PdfNumber.of(2), // Axial shading
    ColorSpace: PdfName.of("DeviceRGB"),
    Coords: new PdfArray([PdfNumber.of(x0), PdfNumber.of(y0), PdfNumber.of(x1), PdfNumber.of(y1)]),
    Function: functionDict,
    Extend: new PdfArray([PdfBool.of(extend[0]), PdfBool.of(extend[1])]),
  });
}

/**
 * Create a radial shading dictionary.
 */
export function createRadialShadingDict(options: RadialShadingOptions): PdfDict {
  const [x0, y0, r0, x1, y1, r1] = options.coords;
  const extend = options.extend ?? [true, true];

  // Build the function for color interpolation
  const functionDict = createGradientFunction(options.stops);

  return PdfDict.of({
    ShadingType: PdfNumber.of(3), // Radial shading
    ColorSpace: PdfName.of("DeviceRGB"),
    Coords: new PdfArray([
      PdfNumber.of(x0),
      PdfNumber.of(y0),
      PdfNumber.of(r0),
      PdfNumber.of(x1),
      PdfNumber.of(y1),
      PdfNumber.of(r1),
    ]),
    Function: functionDict,
    Extend: new PdfArray([PdfBool.of(extend[0]), PdfBool.of(extend[1])]),
  });
}

/**
 * Create a gradient function from color stops.
 *
 * For 2 stops, creates a simple exponential interpolation function.
 * For more stops, creates a stitching function that combines multiple
 * exponential interpolation functions.
 */
function createGradientFunction(stops: { offset: number; color: Color }[]): PdfDict {
  if (stops.length < 2) {
    throw new Error("Gradient requires at least 2 color stops");
  }

  // Sort stops by offset to ensure correct gradient rendering
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);

  if (sortedStops.length === 2) {
    // Simple case: two stops, use exponential interpolation
    return createExponentialFunction(sortedStops[0], sortedStops[1]);
  }

  // Multiple stops: create stitching function
  return createStitchingFunction(sortedStops);
}

/**
 * Extract RGB values from a Color object.
 */
function getRGB(color: Color): [number, number, number] {
  switch (color.type) {
    case "RGB":
      return [color.red, color.green, color.blue];
    case "Grayscale":
      return [color.gray, color.gray, color.gray];
    case "CMYK": {
      // CMYK to RGB: R = (1-C)(1-K), G = (1-M)(1-K), B = (1-Y)(1-K)
      const k = color.black;
      const r = (1 - color.cyan) * (1 - k);
      const g = (1 - color.magenta) * (1 - k);
      const b = (1 - color.yellow) * (1 - k);

      return [r, g, b];
    }
  }
}

/**
 * Create an exponential interpolation function between two stops.
 */
function createExponentialFunction(
  start: { offset: number; color: Color },
  end: { offset: number; color: Color },
): PdfDict {
  const [c0r, c0g, c0b] = getRGB(start.color);
  const [c1r, c1g, c1b] = getRGB(end.color);

  return PdfDict.of({
    FunctionType: PdfNumber.of(2), // Exponential interpolation
    Domain: new PdfArray([PdfNumber.of(0), PdfNumber.of(1)]),
    C0: new PdfArray([PdfNumber.of(c0r), PdfNumber.of(c0g), PdfNumber.of(c0b)]),
    C1: new PdfArray([PdfNumber.of(c1r), PdfNumber.of(c1g), PdfNumber.of(c1b)]),
    N: PdfNumber.of(1), // Linear interpolation
  });
}

/**
 * Create a stitching function for multiple color stops.
 */
function createStitchingFunction(stops: { offset: number; color: Color }[]): PdfDict {
  const functions: PdfDict[] = [];
  const bounds: PdfNumber[] = [];
  const encode: PdfNumber[] = [];

  // Create a function for each segment
  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i + 1];

    functions.push(createExponentialFunction(start, end));

    if (i < stops.length - 2) {
      bounds.push(PdfNumber.of(end.offset));
    }

    encode.push(PdfNumber.of(0));
    encode.push(PdfNumber.of(1));
  }

  return PdfDict.of({
    FunctionType: PdfNumber.of(3), // Stitching function
    Domain: new PdfArray([PdfNumber.of(0), PdfNumber.of(1)]),
    Functions: new PdfArray(functions),
    Bounds: new PdfArray(bounds),
    Encode: new PdfArray(encode),
  });
}

/**
 * Calculate axial gradient coordinates from angle and length.
 *
 * CSS angle convention: 0 = up, 90 = right, 180 = down, 270 = left
 */
export function calculateAxialCoords(
  angle: number,
  length: number,
): [number, number, number, number] {
  // Convert CSS angle to radians (0 = up, going clockwise)
  const rad = ((angle - 90) * Math.PI) / 180;

  // Start at origin
  const x0 = 0;
  const y0 = 0;

  // End point based on angle and length
  const x1 = Math.cos(rad) * length;
  const y1 = Math.sin(rad) * length;

  return [x0, y0, x1, y1];
}

/**
 * Serialize operators to bytes for content streams.
 *
 * Uses Operator.toBytes() directly to avoid UTF-8 round-trip corruption
 * of non-ASCII bytes in PdfString operands (e.g., WinAnsi-encoded text).
 */
export function serializeOperators(ops: Operator[]): Uint8Array {
  if (ops.length === 0) {
    return new Uint8Array(0);
  }

  const newline = new Uint8Array([0x0a]);
  const parts: Uint8Array[] = [];

  for (let i = 0; i < ops.length; i++) {
    if (i > 0) {
      parts.push(newline);
    }

    parts.push(ops[i].toBytes());
  }

  return concatBytes(parts);
}

/**
 * Create a tiling pattern stream.
 *
 * Tiling patterns are content streams (PdfStream), not plain dictionaries.
 */
export function createTilingPatternStream(
  options: TilingPatternOptions,
  contentBytes: Uint8Array,
): PdfStream {
  const [x, y, width, height] = options.bbox;

  const dict = PdfDict.of({
    Type: PdfName.of("Pattern"),
    PatternType: PdfNumber.of(1), // Tiling pattern
    PaintType: PdfNumber.of(1), // Colored tiling pattern
    TilingType: PdfNumber.of(1), // Constant spacing
    BBox: new PdfArray([
      PdfNumber.of(x),
      PdfNumber.of(y),
      PdfNumber.of(width),
      PdfNumber.of(height),
    ]),
    XStep: PdfNumber.of(options.xStep),
    YStep: PdfNumber.of(options.yStep),
  });

  return new PdfStream(dict, contentBytes);
}

/**
 * Create an extended graphics state dictionary.
 *
 * Opacity values are clamped to the range [0, 1].
 */
export function createExtGStateDict(options: ExtGStateOptions): PdfDict {
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

/**
 * Wrapper class for a shading resource.
 */
export class ShadingResource implements PDFShading {
  readonly type = "shading";
  readonly ref: PdfRef;
  readonly shadingType: "axial" | "radial";

  constructor(ref: PdfRef, shadingType: "axial" | "radial") {
    this.ref = ref;
    this.shadingType = shadingType;
  }
}

/**
 * Wrapper class for a tiling pattern resource.
 */
export class TilingPatternResource implements PDFTilingPattern {
  readonly type = "pattern";
  readonly ref: PdfRef;
  readonly patternType = "tiling";

  constructor(ref: PdfRef) {
    this.ref = ref;
  }
}

/**
 * Wrapper class for a shading pattern resource.
 */
export class ShadingPatternResource implements PDFShadingPattern {
  readonly type = "pattern";
  readonly ref: PdfRef;
  readonly patternType = "shading";
  readonly shading: PDFShading;

  constructor(ref: PdfRef, shading: PDFShading) {
    this.ref = ref;
    this.shading = shading;
  }
}

/**
 * Wrapper class for an extended graphics state resource.
 */
export class ExtGStateResource implements PDFExtGState {
  readonly type = "extgstate";
  readonly ref: PdfRef;

  constructor(ref: PdfRef) {
    this.ref = ref;
  }
}

/**
 * Wrapper class for a Form XObject resource.
 */
export class FormXObjectResource implements PDFFormXObject {
  readonly type = "formxobject";
  readonly ref: PdfRef;
  readonly bbox: BBox;

  constructor(ref: PdfRef, bbox: BBox) {
    this.ref = ref;
    this.bbox = bbox;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Form XObject Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a Form XObject (reusable content).
 *
 * Form XObjects are like "stamps" - define once, use many times.
 * They're perfect for watermarks, headers, footers, and repeated graphics.
 *
 * @example
 * ```typescript
 * // Create a "DRAFT" watermark stamp
 * const draftStamp = pdf.createFormXObject({
 *   bbox: [0, 0, 200, 50],
 *   operators: [
 *     ops.setNonStrokingRGB(0.9, 0.1, 0.1),
 *     ops.beginText(),
 *     ops.setFont(fontName, 36),
 *     ops.moveText(10, 10),
 *     ops.showText("DRAFT"),
 *     ops.endText(),
 *   ],
 * });
 *
 * // Use on every page
 * for (const page of pdf.getPages()) {
 *   const name = page.registerXObject(draftStamp);
 *   page.drawOperators([
 *     ops.pushGraphicsState(),
 *     ops.concatMatrix(1, 0, 0, 1, 200, 700),
 *     ops.paintXObject(name),
 *     ops.popGraphicsState(),
 *   ]);
 * }
 * ```
 */
export interface FormXObjectOptions {
  /**
   * Bounding box of the Form XObject: [x, y, width, height].
   *
   * Defines the coordinate space for the form's operators.
   * Usually starts at [0, 0, width, height].
   */
  bbox: BBox;
  /** Operators that draw the form content */
  operators: Operator[];
}

/**
 * Create a Form XObject stream.
 *
 * Form XObjects are content streams (PdfStream), not plain dictionaries.
 */
export function createFormXObjectStream(
  options: FormXObjectOptions,
  contentBytes: Uint8Array,
): PdfStream {
  const [x, y, width, height] = options.bbox;

  const dict = PdfDict.of({
    Type: PdfName.of("XObject"),
    Subtype: PdfName.of("Form"),
    FormType: PdfNumber.of(1),
    BBox: new PdfArray([
      PdfNumber.of(x),
      PdfNumber.of(y),
      PdfNumber.of(width),
      PdfNumber.of(height),
    ]),
  });

  return new PdfStream(dict, contentBytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shading Pattern Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matrix for transforming a shading pattern.
 *
 * Standard PDF transformation matrix [a, b, c, d, e, f] where:
 * - a, d: Scale factors
 * - b, c: Rotation/skew factors
 * - e, f: Translation
 */
export type PatternMatrix = [a: number, b: number, c: number, d: number, e: number, f: number];

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

/**
 * Create a shading pattern dictionary.
 *
 * Shading patterns (PatternType 2) wrap a shading object so it can be used
 * as a pattern color in fill/stroke operations.
 */
export function createShadingPatternDict(options: ShadingPatternOptions): PdfDict {
  const dict = PdfDict.of({
    Type: PdfName.of("Pattern"),
    PatternType: PdfNumber.of(2), // Shading pattern
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
