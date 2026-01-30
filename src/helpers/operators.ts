/**
 * Content stream operator factory functions.
 *
 * These create Operator instances for building PDF content streams.
 */

import { Op, Operator } from "#src/content/operators";
import type { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfString } from "#src/objects/pdf-string";

import { Matrix } from "./matrix";

/**
 * Normalize a resource name to ensure it has a leading slash.
 * Both "/F1" and "F1" are accepted, normalized to "/F1".
 */
function normalizeName(name: string): string {
  if (name.startsWith("/")) {
    return name;
  }

  return `/${name}`;
}

// ============= Graphics State =============

export const pushGraphicsState = (): Operator => Operator.of(Op.PushGraphicsState);

export const popGraphicsState = (): Operator => Operator.of(Op.PopGraphicsState);

/**
 * Concatenate a transformation matrix to the current transformation matrix.
 *
 * Accepts either a Matrix instance or 6 individual matrix components [a, b, c, d, e, f].
 *
 * @example
 * ```typescript
 * // Using Matrix instance
 * const matrix = Matrix.identity().translate(100, 200).scale(2, 2);
 * concatMatrix(matrix)
 *
 * // Using individual components
 * concatMatrix(1, 0, 0, 1, 100, 200)  // translate
 * ```
 */
export function concatMatrix(matrix: Matrix): Operator;
export function concatMatrix(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): Operator;
export function concatMatrix(
  aOrMatrix: number | Matrix,
  b?: number,
  c?: number,
  d?: number,
  e?: number,
  f?: number,
): Operator {
  if (aOrMatrix instanceof Matrix) {
    const matrix = aOrMatrix;

    return Operator.of(Op.ConcatMatrix, matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }

  // Individual components
  return Operator.of(Op.ConcatMatrix, aOrMatrix, b!, c!, d!, e!, f!);
}

export const setLineWidth = (width: number): Operator => Operator.of(Op.SetLineWidth, width);

export const setLineCap = (cap: 0 | 1 | 2): Operator => Operator.of(Op.SetLineCap, cap);

export const setLineJoin = (join: 0 | 1 | 2): Operator => Operator.of(Op.SetLineJoin, join);

export const setMiterLimit = (limit: number): Operator => Operator.of(Op.SetMiterLimit, limit);

export const setDashPattern = (array: PdfArray, phase: number): Operator =>
  Operator.of(Op.SetDashPattern, array, phase);

export const setGraphicsState = (name: string): Operator =>
  Operator.of(Op.SetGraphicsState, normalizeName(name));

// ============= Path Construction =============

export const moveTo = (x: number, y: number): Operator => Operator.of(Op.MoveTo, x, y);

export const lineTo = (x: number, y: number): Operator => Operator.of(Op.LineTo, x, y);

export const curveTo = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): Operator => Operator.of(Op.CurveTo, x1, y1, x2, y2, x3, y3);

export const curveToInitial = (x2: number, y2: number, x3: number, y3: number): Operator =>
  Operator.of(Op.CurveToInitial, x2, y2, x3, y3);

export const curveToFinal = (x1: number, y1: number, x3: number, y3: number): Operator =>
  Operator.of(Op.CurveToFinal, x1, y1, x3, y3);

export const closePath = (): Operator => Operator.of(Op.ClosePath);

export const rectangle = (x: number, y: number, width: number, height: number): Operator =>
  Operator.of(Op.Rectangle, x, y, width, height);

// ============= Path Painting =============

export const stroke = (): Operator => Operator.of(Op.Stroke);
export const closeAndStroke = (): Operator => Operator.of(Op.CloseAndStroke);
export const fill = (): Operator => Operator.of(Op.Fill);
export const fillCompat = (): Operator => Operator.of(Op.FillCompat);
export const fillEvenOdd = (): Operator => Operator.of(Op.FillEvenOdd);
export const fillAndStroke = (): Operator => Operator.of(Op.FillAndStroke);
export const fillAndStrokeEvenOdd = (): Operator => Operator.of(Op.FillAndStrokeEvenOdd);
export const closeFillAndStroke = (): Operator => Operator.of(Op.CloseFillAndStroke);
export const closeFillAndStrokeEvenOdd = (): Operator => Operator.of(Op.CloseFillAndStrokeEvenOdd);
export const endPath = (): Operator => Operator.of(Op.EndPath);

// ============= Clipping =============

export const clip = (): Operator => Operator.of(Op.Clip);
export const clipEvenOdd = (): Operator => Operator.of(Op.ClipEvenOdd);

// ============= Text State =============

export const setCharSpacing = (spacing: number): Operator =>
  Operator.of(Op.SetCharSpacing, spacing);

export const setWordSpacing = (spacing: number): Operator =>
  Operator.of(Op.SetWordSpacing, spacing);

export const setHorizontalScale = (scale: number): Operator =>
  Operator.of(Op.SetHorizontalScale, scale);

export const setLeading = (leading: number): Operator => Operator.of(Op.SetLeading, leading);

export const setFont = (name: string, size: number): Operator =>
  Operator.of(Op.SetFont, normalizeName(name), size);

export const setTextRenderMode = (mode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7): Operator =>
  Operator.of(Op.SetTextRenderMode, mode);

export const setTextRise = (rise: number): Operator => Operator.of(Op.SetTextRise, rise);

// ============= Text Positioning =============

export const beginText = (): Operator => Operator.of(Op.BeginText);
export const endText = (): Operator => Operator.of(Op.EndText);

export const moveText = (tx: number, ty: number): Operator => Operator.of(Op.MoveText, tx, ty);

export const moveTextSetLeading = (tx: number, ty: number): Operator =>
  Operator.of(Op.MoveTextSetLeading, tx, ty);

export const setTextMatrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): Operator => Operator.of(Op.SetTextMatrix, a, b, c, d, e, f);

export const nextLine = (): Operator => Operator.of(Op.NextLine);

// ============= Text Showing =============

/**
 * Show a text string.
 *
 * Accepts either a plain string (auto-encoded) or a PdfString instance.
 * Plain strings are encoded using PdfString.fromString() which picks
 * the optimal encoding.
 */
export const showText = (text: string | PdfString): Operator => {
  const pdfString = typeof text === "string" ? PdfString.fromString(text) : text;

  return Operator.of(Op.ShowText, pdfString);
};

export const showTextArray = (array: PdfArray): Operator => Operator.of(Op.ShowTextArray, array);

/**
 * Move to next line and show text.
 *
 * Accepts either a plain string (auto-encoded) or a PdfString instance.
 */
export const moveAndShowText = (text: string | PdfString): Operator => {
  const pdfString = typeof text === "string" ? PdfString.fromString(text) : text;

  return Operator.of(Op.MoveAndShowText, pdfString);
};

/**
 * Move to next line, set word and character spacing, and show text.
 *
 * Accepts either a plain string (auto-encoded) or a PdfString instance.
 */
export const moveSetSpacingShowText = (
  wordSpacing: number,
  charSpacing: number,
  text: string | PdfString,
): Operator => {
  const pdfString = typeof text === "string" ? PdfString.fromString(text) : text;

  return Operator.of(Op.MoveSetSpacingShowText, wordSpacing, charSpacing, pdfString);
};

// ============= Color =============

export const setStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetStrokingColorSpace, normalizeName(name));

export const setNonStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetNonStrokingColorSpace, normalizeName(name));

export const setStrokingColor = (...components: number[]): Operator =>
  Operator.of(Op.SetStrokingColor, ...components);

/**
 * Set stroking color with extended color space.
 *
 * String components (like pattern names) are normalized to have leading slashes.
 */
export const setStrokingColorN = (...components: (number | string)[]): Operator => {
  const normalized = components.map(c => (typeof c === "string" ? normalizeName(c) : c));

  return Operator.of(Op.SetStrokingColorN, ...normalized);
};

export const setNonStrokingColor = (...components: number[]): Operator =>
  Operator.of(Op.SetNonStrokingColor, ...components);

/**
 * Set non-stroking (fill) color with extended color space.
 *
 * String components (like pattern names) are normalized to have leading slashes.
 */
export const setNonStrokingColorN = (...components: (number | string)[]): Operator => {
  const normalized = components.map(c => (typeof c === "string" ? normalizeName(c) : c));

  return Operator.of(Op.SetNonStrokingColorN, ...normalized);
};

export const setStrokingGray = (gray: number): Operator => Operator.of(Op.SetStrokingGray, gray);

export const setNonStrokingGray = (gray: number): Operator =>
  Operator.of(Op.SetNonStrokingGray, gray);

export const setStrokingRGB = (r: number, g: number, b: number): Operator =>
  Operator.of(Op.SetStrokingRGB, r, g, b);

export const setNonStrokingRGB = (r: number, g: number, b: number): Operator =>
  Operator.of(Op.SetNonStrokingRGB, r, g, b);

export const setStrokingCMYK = (c: number, m: number, y: number, k: number): Operator =>
  Operator.of(Op.SetStrokingCMYK, c, m, y, k);

export const setNonStrokingCMYK = (c: number, m: number, y: number, k: number): Operator =>
  Operator.of(Op.SetNonStrokingCMYK, c, m, y, k);

// ============= XObjects =============

/** Alias for paintXObject - use paintXObject for new code */
export const drawXObject = (name: string): Operator => paintXObject(name);

/**
 * Paint an XObject (image or form).
 *
 * Name is normalized to have a leading slash if not present.
 */
export const paintXObject = (name: string): Operator =>
  Operator.of(Op.DrawXObject, normalizeName(name));

// ============= Shading =============

export const paintShading = (name: string): Operator =>
  Operator.of(Op.PaintShading, normalizeName(name));

// ============= Marked Content =============

export const designateMarkedContentPoint = (tag: string): Operator =>
  Operator.of(Op.DesignateMarkedContentPoint, tag);

export const designateMarkedContentPointProps = (tag: string, props: PdfDict | string): Operator =>
  Operator.of(Op.DesignateMarkedContentPointProps, tag, props);

export const beginMarkedContent = (tag: string): Operator =>
  Operator.of(Op.BeginMarkedContent, tag);

export const beginMarkedContentProps = (tag: string, props: PdfDict | string): Operator =>
  Operator.of(Op.BeginMarkedContentProps, tag, props);

export const endMarkedContent = (): Operator => Operator.of(Op.EndMarkedContent);
