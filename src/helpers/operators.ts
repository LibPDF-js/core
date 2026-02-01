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

/**
 * Save the current graphics state on the stack (q operator).
 *
 * The graphics state includes:
 * - Current transformation matrix (CTM)
 * - Clipping path
 * - Color and color space (stroke and fill)
 * - Line width, cap, join, dash pattern
 * - Text state parameters
 * - Extended graphics state (opacity, blend mode)
 *
 * **Best Practice:** Always pair with popGraphicsState(). Use push/pop to:
 * - Isolate transformations (rotation, scaling, translation)
 * - Limit clipping regions to specific content
 * - Apply temporary opacity or blend modes
 *
 * @example
 * ```typescript
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.concatMatrix(1, 0, 0, 1, 100, 200), // This transform...
 *   ops.setNonStrokingRGB(1, 0, 0),          // ...and this color...
 *   ops.rectangle(0, 0, 50, 50),
 *   ops.fill(),
 *   ops.popGraphicsState(),                  // ...are now restored
 *   // Back to original state
 * ]);
 * ```
 */
export const pushGraphicsState = (): Operator => Operator.of(Op.PushGraphicsState);

/**
 * Restore the graphics state from the stack (Q operator).
 *
 * Restores all graphics parameters to the values they had when
 * pushGraphicsState() was last called. This includes CTM, colors,
 * clipping path, and extended graphics state.
 *
 * @see pushGraphicsState
 */
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
 * ops.concatMatrix(matrix)
 *
 * // Using individual components
 * ops.concatMatrix(1, 0, 0, 1, 100, 200)  // translate
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

/**
 * Set the line width for stroking operations.
 *
 * @param width - Line width in user space units (points)
 */
export const setLineWidth = (width: number): Operator => Operator.of(Op.SetLineWidth, width);

/**
 * Set the line cap style for stroking operations.
 *
 * @param cap - Line cap style:
 *   - 0: Butt cap (stroke ends at the endpoint)
 *   - 1: Round cap (semicircle at endpoint)
 *   - 2: Projecting square cap (extends half line width past endpoint)
 */
export const setLineCap = (cap: 0 | 1 | 2): Operator => Operator.of(Op.SetLineCap, cap);

/**
 * Set the line join style for stroking operations.
 *
 * @param join - Line join style:
 *   - 0: Miter join (extended outer edges meet at an angle)
 *   - 1: Round join (circular arc at join)
 *   - 2: Bevel join (triangle fills the gap)
 */
export const setLineJoin = (join: 0 | 1 | 2): Operator => Operator.of(Op.SetLineJoin, join);

/**
 * Set the miter limit for line joins.
 *
 * When two line segments meet at a sharp angle and miter joins are specified,
 * the miter may extend far beyond the join point. The miter limit imposes a
 * maximum ratio of miter length to line width.
 *
 * @param limit - Miter limit ratio (minimum 1.0)
 */
export const setMiterLimit = (limit: number): Operator => Operator.of(Op.SetMiterLimit, limit);

/**
 * Set the dash pattern for stroking operations.
 *
 * @param array - Array of dash and gap lengths (empty for solid line)
 * @param phase - Offset into the dash pattern to start from
 *
 * @example
 * ```typescript
 * // Dashed line: 8pt dash, 4pt gap
 * ops.setDashPattern(new PdfArray([PdfNumber.of(8), PdfNumber.of(4)]), 0)
 *
 * // Solid line (reset)
 * ops.setDashPattern(new PdfArray([]), 0)
 * ```
 */
export const setDashPattern = (array: PdfArray, phase: number): Operator =>
  Operator.of(Op.SetDashPattern, array, phase);

/**
 * Set the extended graphics state from a named resource.
 *
 * Extended graphics state includes parameters like opacity, blend mode,
 * and other advanced graphics settings not in the basic graphics state.
 *
 * @param name - Resource name (e.g., "GS0"); normalized to have leading slash
 */
export const setGraphicsState = (name: string): Operator =>
  Operator.of(Op.SetGraphicsState, normalizeName(name));

// ============= Path Construction =============

/**
 * Begin a new subpath at the given point.
 *
 * Moves the current point without drawing. Subsequent lineTo/curveTo
 * operations will start from this point.
 *
 * @param x - X coordinate in user space
 * @param y - Y coordinate in user space
 */
export const moveTo = (x: number, y: number): Operator => Operator.of(Op.MoveTo, x, y);

/**
 * Append a straight line segment to the current path.
 *
 * Draws a line from the current point to (x, y) and makes (x, y)
 * the new current point.
 *
 * @param x - X coordinate of endpoint
 * @param y - Y coordinate of endpoint
 */
export const lineTo = (x: number, y: number): Operator => Operator.of(Op.LineTo, x, y);

/**
 * Append a cubic Bezier curve to the current path.
 *
 * The curve extends from the current point to (x3, y3), using
 * (x1, y1) and (x2, y2) as control points.
 *
 * @param x1 - X coordinate of first control point
 * @param y1 - Y coordinate of first control point
 * @param x2 - X coordinate of second control point
 * @param y2 - Y coordinate of second control point
 * @param x3 - X coordinate of endpoint
 * @param y3 - Y coordinate of endpoint
 */
export const curveTo = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): Operator => Operator.of(Op.CurveTo, x1, y1, x2, y2, x3, y3);

/**
 * Append a cubic Bezier curve using current point as first control point.
 *
 * The curve extends from the current point to (x3, y3). The first control
 * point is the current point; (x2, y2) is the second control point.
 *
 * @param x2 - X coordinate of second control point
 * @param y2 - Y coordinate of second control point
 * @param x3 - X coordinate of endpoint
 * @param y3 - Y coordinate of endpoint
 */
export const curveToInitial = (x2: number, y2: number, x3: number, y3: number): Operator =>
  Operator.of(Op.CurveToInitial, x2, y2, x3, y3);

/**
 * Append a cubic Bezier curve using endpoint as second control point.
 *
 * The curve extends from the current point to (x3, y3). Uses (x1, y1)
 * as first control point; the second control point coincides with (x3, y3).
 *
 * @param x1 - X coordinate of first control point
 * @param y1 - Y coordinate of first control point
 * @param x3 - X coordinate of endpoint
 * @param y3 - Y coordinate of endpoint
 */
export const curveToFinal = (x1: number, y1: number, x3: number, y3: number): Operator =>
  Operator.of(Op.CurveToFinal, x1, y1, x3, y3);

/**
 * Close the current subpath by appending a straight line to the start point.
 *
 * Draws a line from the current point to the starting point of the current
 * subpath (the point of the most recent moveTo).
 */
export const closePath = (): Operator => Operator.of(Op.ClosePath);

/**
 * Append a rectangle to the current path.
 *
 * Equivalent to: moveTo(x, y), lineTo(x+width, y), lineTo(x+width, y+height),
 * lineTo(x, y+height), closePath().
 *
 * @param x - X coordinate of lower-left corner
 * @param y - Y coordinate of lower-left corner
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 */
export const rectangle = (x: number, y: number, width: number, height: number): Operator =>
  Operator.of(Op.Rectangle, x, y, width, height);

// ============= Path Painting =============

/** Stroke the current path using the current stroking color and line settings. */
export const stroke = (): Operator => Operator.of(Op.Stroke);

/** Close the current subpath and then stroke the path. */
export const closeAndStroke = (): Operator => Operator.of(Op.CloseAndStroke);

/**
 * Fill the current path using the non-zero winding number rule.
 *
 * Areas enclosed by the path are filled with the current non-stroking color.
 */
export const fill = (): Operator => Operator.of(Op.Fill);

/**
 * Fill the current path using the non-zero winding number rule.
 *
 * @deprecated Use fill() instead. This is the legacy 'F' operator which is
 * equivalent to the 'f' operator.
 */
export const fillCompat = (): Operator => Operator.of(Op.FillCompat);

/**
 * Fill the current path using the even-odd rule.
 *
 * The even-odd rule determines whether a point is inside the path by
 * counting path crossings. Points with an odd count are inside.
 */
export const fillEvenOdd = (): Operator => Operator.of(Op.FillEvenOdd);

/** Fill and then stroke the current path (non-zero winding fill rule). */
export const fillAndStroke = (): Operator => Operator.of(Op.FillAndStroke);

/** Fill (even-odd rule) and then stroke the current path. */
export const fillAndStrokeEvenOdd = (): Operator => Operator.of(Op.FillAndStrokeEvenOdd);

/** Close, fill (non-zero winding), and stroke the current path. */
export const closeFillAndStroke = (): Operator => Operator.of(Op.CloseFillAndStroke);

/** Close, fill (even-odd), and stroke the current path. */
export const closeFillAndStrokeEvenOdd = (): Operator => Operator.of(Op.CloseFillAndStrokeEvenOdd);

/**
 * End the path without filling or stroking.
 *
 * Use this after clipping to discard the path used for the clipping region.
 */
export const endPath = (): Operator => Operator.of(Op.EndPath);

// ============= Clipping =============

/**
 * Intersect the current clipping path with the current path (non-zero winding rule).
 *
 * **Important:** The clip operator modifies the clipping path but does NOT consume
 * the current path. You MUST follow clip() with a path-painting operator:
 * - `endPath()` - Discard the path (most common for clipping)
 * - `fill()` - Fill the path AND use it for clipping
 * - `stroke()` - Stroke the path AND use it for clipping
 *
 * The clipping region persists until popGraphicsState() is called.
 * Always wrap clipping operations in pushGraphicsState()/popGraphicsState().
 *
 * @example
 * ```typescript
 * // Clip subsequent drawing to a rectangle
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.rectangle(50, 50, 100, 100),
 *   ops.clip(),
 *   ops.endPath(),  // REQUIRED - consumes the path
 *   // Now draw content that will be clipped
 *   ops.paintShading(gradientName),
 *   ops.popGraphicsState(),  // Clipping region is restored
 * ]);
 * ```
 *
 * @see clipEvenOdd for the even-odd winding rule variant
 * @see endPath to consume the path after clipping
 */
export const clip = (): Operator => Operator.of(Op.Clip);

/**
 * Intersect the current clipping path with the current path (even-odd rule).
 *
 * Like clip(), but uses the even-odd rule to determine what's inside the path.
 * The even-odd rule counts path crossings - points with an odd count are inside.
 *
 * **Important:** Must be followed by a path-painting operator (fill, stroke, or endPath).
 *
 * @example
 * ```typescript
 * // Create a donut-shaped clipping region
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   // Outer circle
 *   ops.moveTo(150, 100), // ... circle path ops
 *   // Inner circle (drawn in same direction)
 *   ops.moveTo(120, 100), // ... circle path ops
 *   ops.clipEvenOdd(),
 *   ops.endPath(),
 *   // Content here is clipped to the donut shape
 *   ops.popGraphicsState(),
 * ]);
 * ```
 *
 * @see clip for the non-zero winding rule variant
 */
export const clipEvenOdd = (): Operator => Operator.of(Op.ClipEvenOdd);

// ============= Text State =============

/**
 * Set the character spacing (extra space between characters).
 *
 * @param spacing - Additional space in text space units (default 0)
 */
export const setCharSpacing = (spacing: number): Operator =>
  Operator.of(Op.SetCharSpacing, spacing);

/**
 * Set the word spacing (extra space between words).
 *
 * Word spacing is added to each ASCII space character (0x20).
 *
 * @param spacing - Additional space in text space units (default 0)
 */
export const setWordSpacing = (spacing: number): Operator =>
  Operator.of(Op.SetWordSpacing, spacing);

/**
 * Set the horizontal scaling factor for text.
 *
 * @param scale - Percentage of normal width (100 = normal)
 */
export const setHorizontalScale = (scale: number): Operator =>
  Operator.of(Op.SetHorizontalScale, scale);

/**
 * Set the text leading (line spacing).
 *
 * Used by nextLine() and moveTextSetLeading() to move to the next line.
 *
 * @param leading - Vertical distance between baselines (in text space units)
 */
export const setLeading = (leading: number): Operator => Operator.of(Op.SetLeading, leading);

/**
 * Set the font and size for text operations.
 *
 * @param name - Font resource name (e.g., "F0"); normalized to have leading slash
 * @param size - Font size in text space units
 */
export const setFont = (name: string, size: number): Operator =>
  Operator.of(Op.SetFont, normalizeName(name), size);

/**
 * Set the text rendering mode.
 *
 * @param mode - Rendering mode:
 *   - 0: Fill text
 *   - 1: Stroke text
 *   - 2: Fill then stroke
 *   - 3: Invisible (no fill or stroke)
 *   - 4: Fill and add to clipping path
 *   - 5: Stroke and add to clipping path
 *   - 6: Fill, stroke, and add to clipping path
 *   - 7: Add to clipping path (invisible)
 */
export const setTextRenderMode = (mode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7): Operator =>
  Operator.of(Op.SetTextRenderMode, mode);

/**
 * Set the text rise (baseline offset).
 *
 * Moves the baseline up (positive) or down (negative) relative to the
 * current text line. Used for superscripts and subscripts.
 *
 * @param rise - Vertical offset in text space units
 */
export const setTextRise = (rise: number): Operator => Operator.of(Op.SetTextRise, rise);

// ============= Text Positioning =============

/**
 * Begin a text object.
 *
 * Text operations (showText, moveText, setFont, etc.) can only be used
 * between beginText() and endText().
 */
export const beginText = (): Operator => Operator.of(Op.BeginText);

/** End the text object and restore the text state. */
export const endText = (): Operator => Operator.of(Op.EndText);

/**
 * Move to the start of the next line, offset from the current line origin.
 *
 * @param tx - Horizontal offset in text space units
 * @param ty - Vertical offset in text space units
 */
export const moveText = (tx: number, ty: number): Operator => Operator.of(Op.MoveText, tx, ty);

/**
 * Move to the next line and set the leading.
 *
 * Equivalent to: setLeading(-ty), moveText(tx, ty).
 *
 * @param tx - Horizontal offset in text space units
 * @param ty - Vertical offset (negative of the leading)
 */
export const moveTextSetLeading = (tx: number, ty: number): Operator =>
  Operator.of(Op.MoveTextSetLeading, tx, ty);

/**
 * Set the text matrix and text line matrix.
 *
 * Unlike concatMatrix, this replaces (not concatenates) the text matrix.
 *
 * @param a - Horizontal scaling
 * @param b - Horizontal skewing
 * @param c - Vertical skewing
 * @param d - Vertical scaling
 * @param e - Horizontal translation (text position X)
 * @param f - Vertical translation (text position Y)
 */
export const setTextMatrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): Operator => Operator.of(Op.SetTextMatrix, a, b, c, d, e, f);

/**
 * Move to the start of the next line.
 *
 * Equivalent to: moveText(0, -leading), where leading is the current text leading.
 */
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

/**
 * Show text strings with individual position adjustments.
 *
 * The array contains strings and numbers. Numbers are horizontal adjustments
 * in thousandths of a text space unit (negative = move right).
 *
 * @param array - Array of strings and position adjustments
 *
 * @example
 * ```typescript
 * // Kern "AV" by moving V slightly left
 * ops.showTextArray(new PdfArray([
 *   PdfString.fromString("A"),
 *   PdfNumber.of(-50),  // Move left 50/1000 of text space
 *   PdfString.fromString("V"),
 * ]))
 * ```
 */
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

/**
 * Set the stroking color space.
 *
 * @param name - Color space name (e.g., "DeviceRGB", "Pattern"); normalized to have leading slash
 */
export const setStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetStrokingColorSpace, normalizeName(name));

/**
 * Set the non-stroking (fill) color space.
 *
 * @param name - Color space name (e.g., "DeviceRGB", "Pattern"); normalized to have leading slash
 */
export const setNonStrokingColorSpace = (name: string): Operator =>
  Operator.of(Op.SetNonStrokingColorSpace, normalizeName(name));

/**
 * Set the stroking color in the current color space.
 *
 * Number of components depends on the current stroking color space.
 *
 * @param components - Color component values (0-1 for most color spaces)
 */
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

/**
 * Set the non-stroking (fill) color in the current color space.
 *
 * Number of components depends on the current non-stroking color space.
 *
 * @param components - Color component values (0-1 for most color spaces)
 */
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

/**
 * Set the stroking color to a grayscale value.
 *
 * Equivalent to setStrokingColorSpace("DeviceGray"), setStrokingColor(gray).
 *
 * @param gray - Gray value (0 = black, 1 = white)
 */
export const setStrokingGray = (gray: number): Operator => Operator.of(Op.SetStrokingGray, gray);

/**
 * Set the non-stroking (fill) color to a grayscale value.
 *
 * Equivalent to setNonStrokingColorSpace("DeviceGray"), setNonStrokingColor(gray).
 *
 * @param gray - Gray value (0 = black, 1 = white)
 */
export const setNonStrokingGray = (gray: number): Operator =>
  Operator.of(Op.SetNonStrokingGray, gray);

/**
 * Set the stroking color to an RGB value.
 *
 * Equivalent to setStrokingColorSpace("DeviceRGB"), setStrokingColor(r, g, b).
 *
 * @param r - Red component (0-1)
 * @param g - Green component (0-1)
 * @param b - Blue component (0-1)
 */
export const setStrokingRGB = (r: number, g: number, b: number): Operator =>
  Operator.of(Op.SetStrokingRGB, r, g, b);

/**
 * Set the non-stroking (fill) color to an RGB value.
 *
 * Equivalent to setNonStrokingColorSpace("DeviceRGB"), setNonStrokingColor(r, g, b).
 *
 * @param r - Red component (0-1)
 * @param g - Green component (0-1)
 * @param b - Blue component (0-1)
 */
export const setNonStrokingRGB = (r: number, g: number, b: number): Operator =>
  Operator.of(Op.SetNonStrokingRGB, r, g, b);

/**
 * Set the stroking color to a CMYK value.
 *
 * Equivalent to setStrokingColorSpace("DeviceCMYK"), setStrokingColor(c, m, y, k).
 *
 * @param c - Cyan component (0-1)
 * @param m - Magenta component (0-1)
 * @param y - Yellow component (0-1)
 * @param k - Black component (0-1)
 */
export const setStrokingCMYK = (c: number, m: number, y: number, k: number): Operator =>
  Operator.of(Op.SetStrokingCMYK, c, m, y, k);

/**
 * Set the non-stroking (fill) color to a CMYK value.
 *
 * Equivalent to setNonStrokingColorSpace("DeviceCMYK"), setNonStrokingColor(c, m, y, k).
 *
 * @param c - Cyan component (0-1)
 * @param m - Magenta component (0-1)
 * @param y - Yellow component (0-1)
 * @param k - Black component (0-1)
 */
export const setNonStrokingCMYK = (c: number, m: number, y: number, k: number): Operator =>
  Operator.of(Op.SetNonStrokingCMYK, c, m, y, k);

// ============= XObjects =============

/**
 * @deprecated Use paintXObject instead. This alias exists for backwards compatibility.
 */
export const drawXObject = (name: string): Operator => paintXObject(name);

/**
 * Paint an XObject (image or Form XObject).
 *
 * XObjects are external objects that can be rendered in a content stream:
 * - **Images**: Raster graphics (JPEG, PNG, etc.)
 * - **Form XObjects**: Reusable vector content (stamps, watermarks, etc.)
 *
 * The XObject is painted at the current origin. Use concatMatrix to
 * position, scale, and rotate before painting.
 *
 * @param name - XObject resource name (e.g., "Im0", "Fm0"); normalized to have leading slash
 *
 * @example
 * ```typescript
 * // Paint an image at 100x100 size at position (200, 500)
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.concatMatrix(100, 0, 0, 100, 200, 500), // Scale and translate
 *   ops.paintXObject(imageName),
 *   ops.popGraphicsState(),
 * ]);
 *
 * // Paint a form XObject (stamp) at original size
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.concatMatrix(1, 0, 0, 1, 50, 700), // Just translate
 *   ops.paintXObject(stampName),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export const paintXObject = (name: string): Operator =>
  Operator.of(Op.DrawXObject, normalizeName(name));

// ============= Shading =============

/**
 * Paint a shading (gradient) directly, filling the current clipping region.
 *
 * @param name - Shading resource name (e.g., "Sh0"); normalized to have leading slash
 *
 * @example
 * ```typescript
 * // Fill a rectangle with a gradient
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.rectangle(50, 50, 100, 100),
 *   ops.clip(),
 *   ops.endPath(),
 *   ops.paintShading(shadingName),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export const paintShading = (name: string): Operator =>
  Operator.of(Op.PaintShading, normalizeName(name));

// ============= Marked Content =============

/**
 * Designate a marked content point (no content, just a tag).
 *
 * Used for structure and accessibility information.
 *
 * @param tag - Content tag name (e.g., "Artifact", "Figure")
 */
export const designateMarkedContentPoint = (tag: string): Operator =>
  Operator.of(Op.DesignateMarkedContentPoint, tag);

/**
 * Designate a marked content point with properties.
 *
 * @param tag - Content tag name
 * @param props - Property dictionary or property list name
 */
export const designateMarkedContentPointProps = (tag: string, props: PdfDict | string): Operator =>
  Operator.of(Op.DesignateMarkedContentPointProps, tag, props);

/**
 * Begin a marked content sequence.
 *
 * Content between beginMarkedContent() and endMarkedContent() is associated
 * with the given tag for structure/accessibility purposes.
 *
 * @param tag - Content tag name (e.g., "P" for paragraph, "Span")
 */
export const beginMarkedContent = (tag: string): Operator =>
  Operator.of(Op.BeginMarkedContent, tag);

/**
 * Begin a marked content sequence with properties.
 *
 * @param tag - Content tag name
 * @param props - Property dictionary or property list name
 */
export const beginMarkedContentProps = (tag: string, props: PdfDict | string): Operator =>
  Operator.of(Op.BeginMarkedContentProps, tag, props);

/** End the current marked content sequence. */
export const endMarkedContent = (): Operator => Operator.of(Op.EndMarkedContent);
