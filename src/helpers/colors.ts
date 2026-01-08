/**
 * Color types and helper functions for form fields.
 *
 * Provides RGB, Grayscale, and CMYK color types for use with form field styling.
 */

/**
 * RGB color with values in the 0-1 range.
 */
export interface RGB {
  type: "RGB";
  red: number;
  green: number;
  blue: number;
}

/**
 * Grayscale color with value in the 0-1 range.
 * 0 = black, 1 = white.
 */
export interface Grayscale {
  type: "Grayscale";
  gray: number;
}

/**
 * CMYK color with values in the 0-1 range.
 */
export interface CMYK {
  type: "CMYK";
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
}

/**
 * Union type for all supported color types.
 */
export type Color = RGB | Grayscale | CMYK;

/**
 * Create an RGB color.
 *
 * @param r Red component (0-1)
 * @param g Green component (0-1)
 * @param b Blue component (0-1)
 * @returns RGB color object
 *
 * @example
 * ```typescript
 * const red = rgb(1, 0, 0);
 * const gray50 = rgb(0.5, 0.5, 0.5);
 * const cream = rgb(1, 1, 0.9);
 * ```
 */
export function rgb(r: number, g: number, b: number): RGB {
  return { type: "RGB", red: r, green: g, blue: b };
}

/**
 * Create a grayscale color.
 *
 * @param gray Gray value (0 = black, 1 = white)
 * @returns Grayscale color object
 *
 * @example
 * ```typescript
 * const black = grayscale(0);
 * const white = grayscale(1);
 * const midGray = grayscale(0.5);
 * ```
 */
export function grayscale(gray: number): Grayscale {
  return { type: "Grayscale", gray };
}

/**
 * Create a CMYK color.
 *
 * @param c Cyan component (0-1)
 * @param m Magenta component (0-1)
 * @param y Yellow component (0-1)
 * @param k Black component (0-1)
 * @returns CMYK color object
 *
 * @example
 * ```typescript
 * const black = cmyk(0, 0, 0, 1);
 * const cyan = cmyk(1, 0, 0, 0);
 * ```
 */
export function cmyk(c: number, m: number, y: number, k: number): CMYK {
  return { type: "CMYK", cyan: c, magenta: m, yellow: y, black: k };
}

/**
 * Convert a Color to an array of numbers for PDF operators.
 *
 * @param color The color to convert
 * @returns Array of color components
 */
export function colorToArray(color: Color): number[] {
  switch (color.type) {
    case "RGB":
      return [color.red, color.green, color.blue];
    case "Grayscale":
      return [color.gray];
    case "CMYK":
      return [color.cyan, color.magenta, color.yellow, color.black];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Presets
// ─────────────────────────────────────────────────────────────────────────────

/** Black color (grayscale 0) */
export const black: Grayscale = grayscale(0);

/** White color (grayscale 1) */
export const white: Grayscale = grayscale(1);

/** Red color (RGB) */
export const red: RGB = rgb(1, 0, 0);

/** Green color (RGB) */
export const green: RGB = rgb(0, 1, 0);

/** Blue color (RGB) */
export const blue: RGB = rgb(0, 0, 1);
