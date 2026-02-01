/**
 * Shared constants used across the library.
 */

/**
 * Bezier curve approximation constant for circular arcs.
 *
 * This is the control point distance factor for approximating a quarter circle
 * using a cubic Bezier curve. The formula is: 4 * (sqrt(2) - 1) / 3
 *
 * When drawing a circle of radius r, the control points should be placed
 * at a distance of r * KAPPA from the anchor points, perpendicular to the
 * line connecting the anchor points.
 *
 * @example
 * ```typescript
 * // Draw a circle at (cx, cy) with radius r
 * const k = r * KAPPA;
 * ops.moveTo(cx + r, cy);
 * ops.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
 * ops.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
 * ops.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
 * ops.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
 * ```
 */
export const KAPPA = 0.5522847498307936;
