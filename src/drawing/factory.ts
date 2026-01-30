/**
 * Low-level drawing API - Shading and Pattern creation utilities.
 *
 * These are internal utilities used by the PDF class to create
 * shading, pattern, and extended graphics state resources.
 */

import type { PDFFormXObject, PDFExtGState, PDFPattern, PDFShading } from "#src/drawing/resources";
import type { Color } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

/**
 * Options for creating an axial (linear) shading.
 */
export interface AxialShadingOptions {
  /** Coordinates [x0, y0, x1, y1] defining the start and end points */
  coords: [number, number, number, number];
  /** Color stops defining the gradient */
  stops: { offset: number; color: Color }[];
  /** Whether to extend the gradient beyond the start (index 0) and end (index 1) */
  extend?: [boolean, boolean];
}

/**
 * Options for creating a radial shading.
 */
export interface RadialShadingOptions {
  /** Coordinates [x0, y0, r0, x1, y1, r1] defining the two circles */
  coords: [number, number, number, number, number, number];
  /** Color stops defining the gradient */
  stops: { offset: number; color: Color }[];
  /** Whether to extend the gradient beyond the start (index 0) and end (index 1) circles */
  extend?: [boolean, boolean];
}

/**
 * Options for creating a linear gradient using angle and length.
 */
export interface LinearGradientOptions {
  /** Angle in degrees (CSS convention: 0 = up, 90 = right, 180 = down, 270 = left) */
  angle: number;
  /** Length of the gradient in points */
  length: number;
  /** Color stops defining the gradient */
  stops: { offset: number; color: Color }[];
}

/**
 * Options for creating a tiling pattern.
 */
export interface TilingPatternOptions {
  /** Bounding box [x, y, width, height] */
  bbox: [number, number, number, number];
  /** Horizontal spacing between pattern cells */
  xStep: number;
  /** Vertical spacing between pattern cells */
  yStep: number;
  /** Paint callback that draws the pattern content */
  paint: (ctx: PatternContext) => void;
}

/**
 * Context passed to pattern paint callbacks.
 */
export interface PatternContext {
  /** Draw operators into the pattern content stream */
  drawOperators: (operators: unknown[]) => void;
}

/**
 * Options for creating extended graphics state.
 */
export interface ExtGStateOptions {
  /** Fill (non-stroking) opacity (0-1) */
  fillOpacity?: number;
  /** Stroke opacity (0-1) */
  strokeOpacity?: number;
  /** Blend mode (e.g., "Multiply", "Screen", "Overlay") */
  blendMode?: string;
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

  if (stops.length === 2) {
    // Simple case: two stops, use exponential interpolation
    return createExponentialFunction(stops[0], stops[1]);
  }

  // Multiple stops: create stitching function
  return createStitchingFunction(stops);
}

/**
 * Extract RGB values from a Color object.
 */
function getRGB(color: Color): [number, number, number] {
  if (color.type === "RGB") {
    return [color.red, color.green, color.blue];
  }

  if (color.type === "Grayscale") {
    return [color.gray, color.gray, color.gray];
  }

  // CMYK - convert to RGB
  const r = 1 - Math.min(1, color.cyan + color.black);
  const g = 1 - Math.min(1, color.magenta + color.black);
  const b = 1 - Math.min(1, color.yellow + color.black);
  return [r, g, b];
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
 * Create a tiling pattern dictionary.
 */
export function createTilingPatternDict(
  options: TilingPatternOptions,
  contentBytes: Uint8Array,
): PdfDict {
  const [x, y, width, height] = options.bbox;

  return PdfDict.of({
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
}

/**
 * Create an extended graphics state dictionary.
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
 * Wrapper class for a pattern resource.
 */
export class PatternResource implements PDFPattern {
  readonly type = "pattern";
  readonly ref: PdfRef;
  readonly patternType = "tiling";

  constructor(ref: PdfRef) {
    this.ref = ref;
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
  readonly bbox: [number, number, number, number];

  constructor(ref: PdfRef, bbox: [number, number, number, number]) {
    this.ref = ref;
    this.bbox = bbox;
  }
}

/**
 * Options for creating a Form XObject.
 */
export interface FormXObjectOptions {
  /** Bounding box [x, y, width, height] */
  bbox: [number, number, number, number];
  /** Paint callback that draws the form content */
  paint: (ctx: FormXObjectContext) => void;
}

/**
 * Context passed to Form XObject paint callbacks.
 */
export interface FormXObjectContext {
  /** Draw operators into the form content stream */
  drawOperators: (operators: unknown[]) => void;
}

/**
 * Create a Form XObject dictionary.
 */
export function createFormXObjectDict(
  options: FormXObjectOptions,
  contentBytes: Uint8Array,
): PdfDict {
  const [x, y, width, height] = options.bbox;

  return PdfDict.of({
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
}
