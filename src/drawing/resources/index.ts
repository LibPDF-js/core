/**
 * Drawing resources - types and classes.
 *
 * This module provides the core resource types for low-level PDF drawing:
 * - Shadings (gradients)
 * - Patterns (tiling and shading)
 * - Extended graphics state (opacity, blend modes)
 * - Form XObjects (reusable content)
 */

// Types
export type { BBox, BlendMode, PatternMatrix } from "./types";

// Shading
export type {
  AxialCoords,
  AxialShadingOptions,
  ColorStop,
  LinearGradientOptions,
  RadialCoords,
  RadialShadingOptions,
} from "./shading";
export { PDFShading } from "./shading";

// Pattern
export type { ImagePatternOptions, ShadingPatternOptions, TilingPatternOptions } from "./pattern";
export { PDFShadingPattern, PDFTilingPattern, type PDFPattern } from "./pattern";

// ExtGState
export type { ExtGStateOptions } from "./extgstate";
export { PDFExtGState } from "./extgstate";

// Form XObject
export type { FormXObjectOptions } from "./form-xobject";
export { PDFFormXObject } from "./form-xobject";
