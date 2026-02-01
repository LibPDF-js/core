/**
 * Common types for drawing resources.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bounding box in PDF coordinate space.
 *
 * Defines a rectangle where (x, y) is the lower-left corner.
 * Used for patterns, Form XObjects, and clipping regions.
 */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Matrix for transforming a pattern.
 *
 * Standard PDF transformation matrix [a, b, c, d, e, f] where:
 * - a, d: Scale factors
 * - b, c: Rotation/skew factors
 * - e, f: Translation
 */
export type PatternMatrix = [a: number, b: number, c: number, d: number, e: number, f: number];

// ─────────────────────────────────────────────────────────────────────────────
// Blend Modes
// ─────────────────────────────────────────────────────────────────────────────

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
