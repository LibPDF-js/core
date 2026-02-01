/**
 * Shading (gradient) resources.
 */

import type { Color } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";

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
// Options
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
// Resource Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A shading (gradient) resource.
 *
 * Shadings define smooth color transitions (gradients) that can fill
 * arbitrary shapes. Two types are supported:
 * - **axial**: Linear gradient along a line segment
 * - **radial**: Circular gradient between two circles
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
 * const name = page.registerShading(gradient);
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.rectangle(50, 50, 100, 100),
 *   ops.clip(),
 *   ops.endPath(),
 *   ops.paintShading(name),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export class PDFShading {
  readonly type = "shading";
  readonly ref: PdfRef;
  readonly shadingType: "axial" | "radial";

  constructor(ref: PdfRef, shadingType: "axial" | "radial") {
    this.ref = ref;
    this.shadingType = shadingType;
  }

  /**
   * Create the PDF dictionary for an axial shading.
   */
  static createAxialDict(options: AxialShadingOptions): PdfDict {
    const [x0, y0, x1, y1] = options.coords;
    const extend = options.extend ?? [true, true];

    const functionDict = createGradientFunction(options.stops);

    return PdfDict.of({
      ShadingType: PdfNumber.of(2), // Axial shading
      ColorSpace: PdfName.of("DeviceRGB"),
      Coords: new PdfArray([
        PdfNumber.of(x0),
        PdfNumber.of(y0),
        PdfNumber.of(x1),
        PdfNumber.of(y1),
      ]),
      Function: functionDict,
      Extend: new PdfArray([PdfBool.of(extend[0]), PdfBool.of(extend[1])]),
    });
  }

  /**
   * Create the PDF dictionary for a radial shading.
   */
  static createRadialDict(options: RadialShadingOptions): PdfDict {
    const [x0, y0, r0, x1, y1, r1] = options.coords;
    const extend = options.extend ?? [true, true];

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
   * Calculate axial gradient coordinates from angle and length.
   *
   * CSS angle convention: 0 = up, 90 = right, 180 = down, 270 = left
   */
  static calculateAxialCoords(angle: number, length: number): AxialCoords {
    // Convert CSS angle to radians (0 = up, going clockwise)
    const rad = ((angle - 90) * Math.PI) / 180;

    const x0 = 0;
    const y0 = 0;
    const x1 = Math.cos(rad) * length;
    const y1 = Math.sin(rad) * length;

    return [x0, y0, x1, y1];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a gradient function from color stops.
 */
function createGradientFunction(stops: ColorStop[]): PdfDict {
  if (stops.length < 2) {
    throw new Error("Gradient requires at least 2 color stops");
  }

  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);

  if (sortedStops.length === 2) {
    return createExponentialFunction(sortedStops[0], sortedStops[1]);
  }

  return createStitchingFunction(sortedStops);
}

function getRGB(color: Color): [number, number, number] {
  switch (color.type) {
    case "RGB":
      return [color.red, color.green, color.blue];
    case "Grayscale":
      return [color.gray, color.gray, color.gray];
    case "CMYK": {
      const k = color.black;
      const r = (1 - color.cyan) * (1 - k);
      const g = (1 - color.magenta) * (1 - k);
      const b = (1 - color.yellow) * (1 - k);

      return [r, g, b];
    }
  }
}

function createExponentialFunction(start: ColorStop, end: ColorStop): PdfDict {
  const [c0r, c0g, c0b] = getRGB(start.color);
  const [c1r, c1g, c1b] = getRGB(end.color);

  return PdfDict.of({
    FunctionType: PdfNumber.of(2),
    Domain: new PdfArray([PdfNumber.of(0), PdfNumber.of(1)]),
    C0: new PdfArray([PdfNumber.of(c0r), PdfNumber.of(c0g), PdfNumber.of(c0b)]),
    C1: new PdfArray([PdfNumber.of(c1r), PdfNumber.of(c1g), PdfNumber.of(c1b)]),
    N: PdfNumber.of(1),
  });
}

function createStitchingFunction(stops: ColorStop[]): PdfDict {
  const functions: PdfDict[] = [];
  const bounds: PdfNumber[] = [];
  const encode: PdfNumber[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    functions.push(createExponentialFunction(stops[i], stops[i + 1]));

    if (i < stops.length - 2) {
      bounds.push(PdfNumber.of(stops[i + 1].offset));
    }

    encode.push(PdfNumber.of(0));
    encode.push(PdfNumber.of(1));
  }

  return PdfDict.of({
    FunctionType: PdfNumber.of(3),
    Domain: new PdfArray([PdfNumber.of(0), PdfNumber.of(1)]),
    Functions: new PdfArray(functions),
    Bounds: new PdfArray(bounds),
    Encode: new PdfArray(encode),
  });
}
