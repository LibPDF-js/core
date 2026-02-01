/**
 * Drawing operations - pure functions that return Operator arrays.
 *
 * These functions generate PDF content stream operators for drawing shapes,
 * text, and images. They are used internally by PDFPage drawing methods.
 */

import type { Operator } from "#src/content/operators";
import type { Color } from "#src/helpers/colors";
import { ColorSpace } from "#src/helpers/colorspace";
import { KAPPA } from "#src/helpers/constants";
import {
  closePath,
  concatMatrix,
  curveTo,
  fill,
  fillAndStroke,
  fillAndStrokeEvenOdd,
  fillEvenOdd,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setDashPattern,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setMiterLimit,
  setNonStrokingCMYK,
  setNonStrokingColorN,
  setNonStrokingColorSpace,
  setNonStrokingGray,
  setNonStrokingRGB,
  setStrokingCMYK,
  setStrokingColorN,
  setStrokingColorSpace,
  setStrokingGray,
  setStrokingRGB,
  stroke,
} from "#src/helpers/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfNumber } from "#src/objects/pdf-number";

import { type LineCap, type LineJoin, lineCapToNumber, lineJoinToNumber } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Color Operators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the non-stroking (fill) color.
 */
export function setFillColor(color: Color): Operator {
  switch (color.type) {
    case "RGB":
      return setNonStrokingRGB(color.red, color.green, color.blue);
    case "Grayscale":
      return setNonStrokingGray(color.gray);
    case "CMYK":
      return setNonStrokingCMYK(color.cyan, color.magenta, color.yellow, color.black);
  }
}

/**
 * Set the stroking (border) color.
 */
export function setStrokeColor(color: Color): Operator {
  switch (color.type) {
    case "RGB":
      return setStrokingRGB(color.red, color.green, color.blue);
    case "Grayscale":
      return setStrokingGray(color.gray);
    case "CMYK":
      return setStrokingCMYK(color.cyan, color.magenta, color.yellow, color.black);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dash Pattern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a dash pattern operator.
 */
export function setDash(dashArray: number[], dashPhase: number): Operator {
  const array = new PdfArray(dashArray.map(n => PdfNumber.of(n)));

  return setDashPattern(array, dashPhase);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for rectangle operations.
 */
export interface RectangleOpsOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: Color;
  /** Fill pattern name (already registered, e.g., "P0") */
  fillPatternName?: string;
  strokeColor?: Color;
  /** Stroke pattern name (already registered, e.g., "P0") */
  strokePatternName?: string;
  strokeWidth?: number;
  dashArray?: number[];
  dashPhase?: number;
  cornerRadius?: number;
  graphicsStateName?: string;
  rotate?: { angle: number; originX: number; originY: number };
}

/**
 * Generate operators for drawing a rectangle.
 */
export function drawRectangleOps(options: RectangleOpsOptions): Operator[] {
  const ops: Operator[] = [pushGraphicsState()];

  // Apply graphics state for opacity if provided
  if (options.graphicsStateName) {
    ops.push(setGraphicsState(options.graphicsStateName));
  }

  // Apply rotation if specified
  if (options.rotate) {
    const { angle, originX, originY } = options.rotate;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Translate to origin, rotate, translate back
    ops.push(concatMatrix(1, 0, 0, 1, originX, originY));
    ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));
    ops.push(concatMatrix(1, 0, 0, 1, -originX, -originY));
  }

  // Set stroke properties
  if (options.strokeColor) {
    ops.push(setStrokeColor(options.strokeColor));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  } else if (options.strokePatternName) {
    ops.push(setStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setStrokingColorN(options.strokePatternName));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  }

  if (options.dashArray && options.dashArray.length > 0) {
    ops.push(setDash(options.dashArray, options.dashPhase ?? 0));
  }

  // Set fill color or pattern
  if (options.fillColor) {
    ops.push(setFillColor(options.fillColor));
  } else if (options.fillPatternName) {
    ops.push(setNonStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setNonStrokingColorN(options.fillPatternName));
  }

  // Draw the path
  if (options.cornerRadius && options.cornerRadius > 0) {
    ops.push(
      ...roundedRectPathOps(
        options.x,
        options.y,
        options.width,
        options.height,
        options.cornerRadius,
      ),
    );
  } else {
    ops.push(...rectPathOps(options.x, options.y, options.width, options.height));
  }

  // Paint the path
  const hasFill = !!options.fillColor || !!options.fillPatternName;
  const hasStroke = !!options.strokeColor || !!options.strokePatternName;
  ops.push(getPaintOp(hasFill, hasStroke));

  ops.push(popGraphicsState());

  return ops;
}

/**
 * Generate path operators for a simple rectangle.
 */
function rectPathOps(x: number, y: number, w: number, h: number): Operator[] {
  return [moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h), closePath()];
}

/**
 * Generate path operators for a rounded rectangle.
 */
function roundedRectPathOps(x: number, y: number, w: number, h: number, r: number): Operator[] {
  // Clamp radius to half the smallest dimension
  r = Math.min(r, w / 2, h / 2);
  const k = r * KAPPA;

  return [
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r), // bottom-right corner
    lineTo(x + w, y + h - r),
    curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h), // top-right corner
    lineTo(x + r, y + h),
    curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r), // top-left corner
    lineTo(x, y + r),
    curveTo(x, y + r - k, x + r - k, y, x + r, y), // bottom-left corner
    closePath(),
  ];
}

/**
 * Options for line operations.
 */
export interface LineOpsOptions {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: Color;
  strokeWidth?: number;
  dashArray?: number[];
  dashPhase?: number;
  lineCap?: LineCap;
  graphicsStateName?: string;
}

/**
 * Generate operators for drawing a line.
 */
export function drawLineOps(options: LineOpsOptions): Operator[] {
  const ops: Operator[] = [pushGraphicsState()];

  // Apply graphics state for opacity if provided
  if (options.graphicsStateName) {
    ops.push(setGraphicsState(options.graphicsStateName));
  }

  // Set line properties
  if (options.color) {
    ops.push(setStrokeColor(options.color));
  }

  ops.push(setLineWidth(options.strokeWidth ?? 1));

  if (options.lineCap) {
    ops.push(setLineCap(lineCapToNumber(options.lineCap)));
  }

  if (options.dashArray && options.dashArray.length > 0) {
    ops.push(setDash(options.dashArray, options.dashPhase ?? 0));
  }

  // Draw the line
  ops.push(moveTo(options.startX, options.startY));
  ops.push(lineTo(options.endX, options.endY));
  ops.push(stroke());

  ops.push(popGraphicsState());

  return ops;
}

/**
 * Options for ellipse operations.
 */
export interface EllipseOpsOptions {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fillColor?: Color;
  /** Fill pattern name (already registered, e.g., "P0") */
  fillPatternName?: string;
  strokeColor?: Color;
  /** Stroke pattern name (already registered, e.g., "P0") */
  strokePatternName?: string;
  strokeWidth?: number;
  graphicsStateName?: string;
  rotate?: { angle: number; originX: number; originY: number };
}

/**
 * Generate operators for drawing an ellipse.
 */
export function drawEllipseOps(options: EllipseOpsOptions): Operator[] {
  const ops: Operator[] = [pushGraphicsState()];

  // Apply graphics state for opacity if provided
  if (options.graphicsStateName) {
    ops.push(setGraphicsState(options.graphicsStateName));
  }

  // Apply rotation if specified
  if (options.rotate) {
    const { angle, originX, originY } = options.rotate;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    ops.push(concatMatrix(1, 0, 0, 1, originX, originY));
    ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));
    ops.push(concatMatrix(1, 0, 0, 1, -originX, -originY));
  }

  // Set stroke properties
  if (options.strokeColor) {
    ops.push(setStrokeColor(options.strokeColor));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  } else if (options.strokePatternName) {
    ops.push(setStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setStrokingColorN(options.strokePatternName));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  }

  // Set fill color or pattern
  if (options.fillColor) {
    ops.push(setFillColor(options.fillColor));
  } else if (options.fillPatternName) {
    ops.push(setNonStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setNonStrokingColorN(options.fillPatternName));
  }

  // Draw the ellipse path using 4 Bezier curves
  ops.push(...ellipsePathOps(options.cx, options.cy, options.rx, options.ry));

  // Paint the path
  const hasFill = !!options.fillColor || !!options.fillPatternName;
  const hasStroke = !!options.strokeColor || !!options.strokePatternName;
  ops.push(getPaintOp(hasFill, hasStroke));

  ops.push(popGraphicsState());

  return ops;
}

/**
 * Generate path operators for an ellipse.
 */
function ellipsePathOps(cx: number, cy: number, rx: number, ry: number): Operator[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;

  return [
    moveTo(cx - rx, cy),
    curveTo(cx - rx, cy + ky, cx - kx, cy + ry, cx, cy + ry),
    curveTo(cx + kx, cy + ry, cx + rx, cy + ky, cx + rx, cy),
    curveTo(cx + rx, cy - ky, cx + kx, cy - ry, cx, cy - ry),
    curveTo(cx - kx, cy - ry, cx - rx, cy - ky, cx - rx, cy),
    closePath(),
  ];
}

/**
 * Generate operators for drawing a circle.
 */
export function drawCircleOps(
  options: Omit<EllipseOpsOptions, "rx" | "ry"> & { radius: number },
): Operator[] {
  return drawEllipseOps({
    ...options,
    rx: options.radius,
    ry: options.radius,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Path Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for custom path operations.
 */
export interface PathOpsOptions {
  fillColor?: Color;
  /** Fill pattern name (already registered, e.g., "P0") */
  fillPatternName?: string;
  strokeColor?: Color;
  /** Stroke pattern name (already registered, e.g., "P0") */
  strokePatternName?: string;
  strokeWidth?: number;
  lineCap?: LineCap;
  lineJoin?: LineJoin;
  miterLimit?: number;
  dashArray?: number[];
  dashPhase?: number;
  graphicsStateName?: string;
  windingRule?: "nonzero" | "evenodd";
}

/**
 * Generate operators that wrap path construction with styling.
 */
export function wrapPathOps(pathOps: Operator[], options: PathOpsOptions): Operator[] {
  const ops: Operator[] = [pushGraphicsState()];

  // Apply graphics state for opacity if provided
  if (options.graphicsStateName) {
    ops.push(setGraphicsState(options.graphicsStateName));
  }

  // Set stroke properties
  if (options.strokeColor) {
    ops.push(setStrokeColor(options.strokeColor));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  } else if (options.strokePatternName) {
    // Stroke with pattern
    ops.push(setStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setStrokingColorN(options.strokePatternName));
    ops.push(setLineWidth(options.strokeWidth ?? 1));
  }

  if (options.lineCap) {
    ops.push(setLineCap(lineCapToNumber(options.lineCap)));
  }

  if (options.lineJoin) {
    ops.push(setLineJoin(lineJoinToNumber(options.lineJoin)));
  }

  if (options.miterLimit !== undefined) {
    ops.push(setMiterLimit(options.miterLimit));
  }

  if (options.dashArray && options.dashArray.length > 0) {
    ops.push(setDash(options.dashArray, options.dashPhase ?? 0));
  }

  // Set fill color or pattern
  if (options.fillColor) {
    ops.push(setFillColor(options.fillColor));
  } else if (options.fillPatternName) {
    // Fill with pattern
    ops.push(setNonStrokingColorSpace(ColorSpace.Pattern));
    ops.push(setNonStrokingColorN(options.fillPatternName));
  }

  // Add path construction operators
  ops.push(...pathOps);

  // Paint the path
  const hasFill = !!options.fillColor || !!options.fillPatternName;
  const hasStroke = !!options.strokeColor || !!options.strokePatternName;
  const evenOdd = options.windingRule === "evenodd";
  ops.push(getPaintOpWithWinding(hasFill, hasStroke, evenOdd));

  ops.push(popGraphicsState());

  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the appropriate paint operator based on fill/stroke settings.
 */
function getPaintOp(hasFill: boolean, hasStroke: boolean): Operator {
  if (hasFill && hasStroke) {
    return fillAndStroke();
  }

  if (hasFill) {
    return fill();
  }

  return stroke();
}

/**
 * Get the appropriate paint operator with winding rule support.
 */
function getPaintOpWithWinding(hasFill: boolean, hasStroke: boolean, evenOdd: boolean): Operator {
  if (hasFill && hasStroke) {
    return evenOdd ? fillAndStrokeEvenOdd() : fillAndStroke();
  }

  if (hasFill) {
    return evenOdd ? fillEvenOdd() : fill();
  }

  return stroke();
}
