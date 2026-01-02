/**
 * Content stream operator factory functions.
 *
 * These create Operator instances for building PDF content streams.
 */

import { Op, Operator } from "#src/content/operators";
import type { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfString } from "#src/objects/pdf-string";

// ============= Graphics State =============

export const pushGraphicsState = (): Operator => Operator.of(Op.PushGraphicsState);

export const popGraphicsState = (): Operator => Operator.of(Op.PopGraphicsState);

export const concatMatrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): Operator => Operator.of(Op.ConcatMatrix, a, b, c, d, e, f);

export const setLineWidth = (width: number): Operator => Operator.of(Op.SetLineWidth, width);

export const setLineCap = (cap: 0 | 1 | 2): Operator => Operator.of(Op.SetLineCap, cap);

export const setLineJoin = (join: 0 | 1 | 2): Operator => Operator.of(Op.SetLineJoin, join);

export const setMiterLimit = (limit: number): Operator => Operator.of(Op.SetMiterLimit, limit);

export const setDashPattern = (array: PdfArray, phase: number): Operator =>
  Operator.of(Op.SetDashPattern, array, phase);

export const setGraphicsState = (name: string): Operator => Operator.of(Op.SetGraphicsState, name);

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
  Operator.of(Op.SetFont, name, size);

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

export const showText = (text: PdfString): Operator => Operator.of(Op.ShowText, text);

export const showTextArray = (array: PdfArray): Operator => Operator.of(Op.ShowTextArray, array);

export const moveAndShowText = (text: PdfString): Operator => Operator.of(Op.MoveAndShowText, text);

export const moveSetSpacingShowText = (
  wordSpacing: number,
  charSpacing: number,
  text: PdfString,
): Operator => Operator.of(Op.MoveSetSpacingShowText, wordSpacing, charSpacing, text);

// ============= Color =============

export const setStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetStrokingColorSpace, name);

export const setNonStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetNonStrokingColorSpace, name);

export const setStrokingColor = (...components: number[]): Operator =>
  Operator.of(Op.SetStrokingColor, ...components);

export const setStrokingColorN = (...components: (number | string)[]): Operator =>
  Operator.of(Op.SetStrokingColorN, ...components);

export const setNonStrokingColor = (...components: number[]): Operator =>
  Operator.of(Op.SetNonStrokingColor, ...components);

export const setNonStrokingColorN = (...components: (number | string)[]): Operator =>
  Operator.of(Op.SetNonStrokingColorN, ...components);

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

export const drawXObject = (name: string): Operator => Operator.of(Op.DrawXObject, name);

// ============= Shading =============

export const paintShading = (name: string): Operator => Operator.of(Op.PaintShading, name);

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
