/**
 * PDF color space constants for use with low-level drawing operators.
 *
 * These are the standard PDF color space names used with setStrokingColorSpace
 * and setNonStrokingColorSpace operators.
 */

export const ColorSpace = {
  /** Device Gray color space (single component: 0-1) */
  DeviceGray: "DeviceGray",

  /** Device RGB color space (three components: 0-1 each) */
  DeviceRGB: "DeviceRGB",

  /** Device CMYK color space (four components: 0-1 each) */
  DeviceCMYK: "DeviceCMYK",

  /** Pattern color space (for tiling patterns) */
  Pattern: "Pattern",
} as const;

export type ColorSpace = (typeof ColorSpace)[keyof typeof ColorSpace];
