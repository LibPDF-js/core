/**
 * Drawing API types and option interfaces.
 */

import type { PDFPattern } from "#src/drawing/resources/index";
import type { BBox } from "#src/drawing/resources/types";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import type { Standard14FontName } from "#src/fonts/standard-14";
import type { Color } from "#src/helpers/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Common Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text alignment for multiline text.
 */
export type TextAlignment = "left" | "center" | "right" | "justify";

/**
 * Line cap style.
 * - "butt": Square end at endpoint (0)
 * - "round": Semicircular end (1)
 * - "square": Square end extending beyond endpoint (2)
 */
export type LineCap = "butt" | "round" | "square";

/**
 * Line join style.
 * - "miter": Sharp corner (0)
 * - "round": Rounded corner (1)
 * - "bevel": Beveled corner (2)
 */
export type LineJoin = "miter" | "round" | "bevel";

/**
 * Named rotation origin positions.
 * These are relative to the bounding box of the object being rotated.
 */
export type RotationOriginName =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Rotation origin - either explicit coordinates or a named position.
 */
export type RotationOrigin = { x: number; y: number } | RotationOriginName;

/**
 * Rotation specification.
 */
export interface Rotation {
  /** Rotation angle in degrees (counter-clockwise) */
  angle: number;
  /**
   * Rotation center point.
   * Can be explicit coordinates `{ x, y }` or a named position like "center", "top-left", etc.
   * Default varies by object type (usually center for shapes, bottom-left for text).
   */
  origin?: RotationOrigin;
}

/**
 * Bounding box for calculating rotation origins.
 *
 * Alias for BBox - both represent { x, y, width, height }.
 */
export type BoundingBox = BBox;

/**
 * Resolve a rotation origin to explicit coordinates.
 *
 * @param origin - The origin specification (coordinates or named position)
 * @param bounds - The bounding box of the object
 * @param defaultOrigin - Default origin if none specified (as coordinates)
 * @returns Explicit { x, y } coordinates
 */
export function resolveRotationOrigin(
  origin: RotationOrigin | undefined,
  bounds: BoundingBox,
  defaultOrigin: { x: number; y: number },
): { x: number; y: number } {
  if (origin === undefined) {
    return defaultOrigin;
  }

  // Explicit coordinates
  if (typeof origin === "object") {
    return origin;
  }

  // Named position - calculate from bounds
  const { x, y, width, height } = bounds;

  switch (origin) {
    case "top-left":
      return { x, y: y + height };
    case "top-center":
      return { x: x + width / 2, y: y + height };
    case "top-right":
      return { x: x + width, y: y + height };
    case "center-left":
      return { x, y: y + height / 2 };
    case "center":
      return { x: x + width / 2, y: y + height / 2 };
    case "center-right":
      return { x: x + width, y: y + height / 2 };
    case "bottom-left":
      return { x, y };
    case "bottom-center":
      return { x: x + width / 2, y };
    case "bottom-right":
      return { x: x + width, y };
  }
}

/**
 * Font type - either a Standard 14 font name or an embedded font.
 */
export type FontInput = Standard14FontName | EmbeddedFont;

// ─────────────────────────────────────────────────────────────────────────────
// Text Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for drawing text.
 */
export interface DrawTextOptions {
  /** X position (default: 0) */
  x?: number;
  /** Y position (default: 0) */
  y?: number;
  /** Font to use (default: "Helvetica") */
  font?: FontInput;
  /** Font size in points (default: 12) */
  size?: number;
  /** Text color (default: black) */
  color?: Color;
  /** Opacity 0-1 (default: 1) */
  opacity?: number;

  // Multiline options
  /** Maximum width for word wrapping */
  maxWidth?: number;
  /** Line height in points (default: size * 1.2) */
  lineHeight?: number;
  /** Text alignment for multiline (default: "left") */
  alignment?: TextAlignment;

  // Transform
  /** Rotation */
  rotate?: Rotation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for drawing an image.
 */
export interface DrawImageOptions {
  /** X position (default: 0) */
  x?: number;
  /** Y position (default: 0) */
  y?: number;
  /** Width in points (default: image natural width) */
  width?: number;
  /** Height in points (default: preserves aspect ratio if width set, otherwise natural height) */
  height?: number;
  /** Opacity 0-1 (default: 1) */
  opacity?: number;
  /** Rotation */
  rotate?: Rotation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for drawing a rectangle.
 */
export interface DrawRectangleOptions {
  /** X position (left edge) */
  x: number;
  /** Y position (bottom edge) */
  y: number;
  /** Width in points */
  width: number;
  /** Height in points */
  height: number;
  /** Fill color (omit for no fill, mutually exclusive with pattern) */
  color?: Color;
  /**
   * Fill pattern (tiling or shading pattern).
   * Use instead of color to fill with a gradient or repeating pattern.
   * Mutually exclusive with color.
   */
  pattern?: PDFPattern;
  /** Border/stroke color (omit for no stroke, mutually exclusive with borderPattern) */
  borderColor?: Color;
  /**
   * Stroke pattern (tiling or shading pattern).
   * Use instead of borderColor to stroke with a gradient or repeating pattern.
   * Mutually exclusive with borderColor.
   */
  borderPattern?: PDFPattern;
  /** Border width in points (default: 1 if borderColor/borderPattern set) */
  borderWidth?: number;
  /** Dash pattern array (e.g., [5, 3] for 5pt dash, 3pt gap) */
  borderDashArray?: number[];
  /** Dash pattern phase (default: 0) */
  borderDashPhase?: number;
  /** Corner radius for rounded rectangles */
  cornerRadius?: number;
  /** Fill opacity 0-1 (default: 1) */
  opacity?: number;
  /** Border opacity 0-1 (default: 1) */
  borderOpacity?: number;
  /** Rotation */
  rotate?: Rotation;
}

/**
 * Options for drawing a line.
 */
export interface DrawLineOptions {
  /** Start point */
  start: { x: number; y: number };
  /** End point */
  end: { x: number; y: number };
  /** Line color (default: black) */
  color?: Color;
  /** Line thickness in points (default: 1) */
  thickness?: number;
  /** Dash pattern array */
  dashArray?: number[];
  /** Dash pattern phase (default: 0) */
  dashPhase?: number;
  /** Line cap style (default: "butt") */
  lineCap?: LineCap;
  /** Opacity 0-1 (default: 1) */
  opacity?: number;
}

/**
 * Options for drawing a circle.
 */
export interface DrawCircleOptions {
  /** Center X coordinate */
  x: number;
  /** Center Y coordinate */
  y: number;
  /** Circle radius in points */
  radius: number;
  /** Fill color (omit for no fill, mutually exclusive with pattern) */
  color?: Color;
  /**
   * Fill pattern (tiling or shading pattern).
   * Use instead of color to fill with a gradient or repeating pattern.
   * Mutually exclusive with color.
   */
  pattern?: PDFPattern;
  /** Border/stroke color (omit for no stroke, mutually exclusive with borderPattern) */
  borderColor?: Color;
  /**
   * Stroke pattern (tiling or shading pattern).
   * Use instead of borderColor to stroke with a gradient or repeating pattern.
   * Mutually exclusive with borderColor.
   */
  borderPattern?: PDFPattern;
  /** Border width in points (default: 1 if borderColor/borderPattern set) */
  borderWidth?: number;
  /** Fill opacity 0-1 (default: 1) */
  opacity?: number;
  /** Border opacity 0-1 (default: 1) */
  borderOpacity?: number;
}

/**
 * Options for drawing an ellipse.
 */
export interface DrawEllipseOptions {
  /** Center X coordinate */
  x: number;
  /** Center Y coordinate */
  y: number;
  /** Horizontal radius in points */
  xRadius: number;
  /** Vertical radius in points */
  yRadius: number;
  /** Fill color (omit for no fill, mutually exclusive with pattern) */
  color?: Color;
  /**
   * Fill pattern (tiling or shading pattern).
   * Use instead of color to fill with a gradient or repeating pattern.
   * Mutually exclusive with color.
   */
  pattern?: PDFPattern;
  /** Border/stroke color (omit for no stroke, mutually exclusive with borderPattern) */
  borderColor?: Color;
  /**
   * Stroke pattern (tiling or shading pattern).
   * Use instead of borderColor to stroke with a gradient or repeating pattern.
   * Mutually exclusive with borderColor.
   */
  borderPattern?: PDFPattern;
  /** Border width in points (default: 1 if borderColor/borderPattern set) */
  borderWidth?: number;
  /** Fill opacity 0-1 (default: 1) */
  opacity?: number;
  /** Border opacity 0-1 (default: 1) */
  borderOpacity?: number;
  /** Rotation */
  rotate?: Rotation;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Path Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for drawing an SVG path.
 *
 * SVG paths are automatically transformed from SVG coordinate space
 * (Y-down, origin at top-left) to PDF coordinate space (Y-up, origin
 * at bottom-left). Use `x`, `y`, and `scale` to position and size
 * the path on the page.
 */
export interface DrawSvgPathOptions {
  /**
   * X position on the page (left edge of the path's bounding box).
   * @default 0
   */
  x?: number;

  /**
   * Y position on the page (bottom edge of the path's bounding box after transform).
   * @default 0
   */
  y?: number;

  /**
   * Scale factor to apply to the path.
   * Useful for SVG icons with large viewBox (e.g., 512x512).
   * A scale of 0.1 would make a 512-unit icon ~51 points.
   * @default 1
   */
  scale?: number;

  /**
   * Whether to flip the Y-axis to convert from SVG coordinates (Y-down)
   * to PDF coordinates (Y-up).
   *
   * Set to `true` (default) when using SVG paths from icon libraries.
   * Set to `false` when using paths already in PDF coordinate space.
   *
   * @default true
   */
  flipY?: boolean;

  /** Fill color (default: black; omit to stroke only if borderColor set, mutually exclusive with pattern) */
  color?: Color;
  /**
   * Fill pattern (tiling or shading pattern).
   * Use instead of color to fill with a gradient or repeating pattern.
   * Mutually exclusive with color.
   */
  pattern?: PDFPattern;
  /** Stroke color (omit for no stroke, mutually exclusive with borderPattern) */
  borderColor?: Color;
  /**
   * Stroke pattern (tiling or shading pattern).
   * Use instead of borderColor to stroke with a gradient or repeating pattern.
   * Mutually exclusive with borderColor.
   */
  borderPattern?: PDFPattern;
  /** Stroke width in points (default: 1 if borderColor/borderPattern set) */
  borderWidth?: number;
  /** Line cap style */
  lineCap?: LineCap;
  /** Line join style */
  lineJoin?: LineJoin;
  /** Miter limit for miter joins */
  miterLimit?: number;
  /** Dash pattern array */
  dashArray?: number[];
  /** Dash pattern phase */
  dashPhase?: number;
  /** Fill opacity 0-1 (default: 1) */
  opacity?: number;
  /** Stroke opacity 0-1 (default: 1) */
  borderOpacity?: number;
  /** Winding rule for fill (default: "nonzero") */
  windingRule?: "nonzero" | "evenodd";
}

// ─────────────────────────────────────────────────────────────────────────────
// Path Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for path painting.
 *
 * @example
 * ```typescript
 * // Solid color fill
 * page.drawPath().rectangle(0, 0, 100, 100).fill({ color: rgb(1, 0, 0) });
 *
 * // Pattern fill (tiling or shading pattern)
 * const gradient = pdf.createAxialShading({...});
 * const pattern = pdf.createShadingPattern({ shading: gradient });
 * page.drawPath().circle(50, 50, 30).fill({ pattern });
 *
 * // Stroke with pattern
 * page.drawPath().rectangle(0, 0, 100, 100).stroke({
 *   borderPattern: pattern,
 *   borderWidth: 5,
 * });
 * ```
 */
export interface PathOptions {
  /** Fill color (omit for no fill, mutually exclusive with pattern) */
  color?: Color;
  /**
   * Fill pattern (tiling or shading pattern).
   *
   * Use instead of color to fill with a gradient or repeating pattern.
   * Mutually exclusive with color.
   */
  pattern?: PDFPattern;
  /** Stroke color (omit for no stroke, mutually exclusive with borderPattern) */
  borderColor?: Color;
  /**
   * Stroke pattern (tiling or shading pattern).
   *
   * Use instead of borderColor to stroke with a gradient or repeating pattern.
   * Mutually exclusive with borderColor.
   */
  borderPattern?: PDFPattern;
  /** Stroke width in points (default: 1 if borderColor/borderPattern set) */
  borderWidth?: number;
  /** Line cap style */
  lineCap?: LineCap;
  /** Line join style */
  lineJoin?: LineJoin;
  /** Miter limit for miter joins */
  miterLimit?: number;
  /** Dash pattern array */
  dashArray?: number[];
  /** Dash pattern phase */
  dashPhase?: number;
  /** Fill opacity 0-1 (default: 1) */
  opacity?: number;
  /** Stroke opacity 0-1 (default: 1) */
  borderOpacity?: number;
  /** Winding rule for fill (default: "nonzero") */
  windingRule?: "nonzero" | "evenodd";
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert LineCap to PDF numeric value.
 */
export function lineCapToNumber(cap: LineCap): 0 | 1 | 2 {
  switch (cap) {
    case "butt":
      return 0;
    case "round":
      return 1;
    case "square":
      return 2;
  }
}

/**
 * Convert LineJoin to PDF numeric value.
 */
export function lineJoinToNumber(join: LineJoin): 0 | 1 | 2 {
  switch (join) {
    case "miter":
      return 0;
    case "round":
      return 1;
    case "bevel":
      return 2;
  }
}
