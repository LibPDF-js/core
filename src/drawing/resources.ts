/**
 * Core types for low-level PDF drawing resources.
 *
 * These types represent PDF resources (shadings, patterns, graphics state)
 * that can be created and registered for use with raw drawing operators.
 *
 * This is a core/internal module - users interact with these through the
 * high-level API methods on PDF and PDFPage classes.
 */

import type { PdfRef } from "#src/objects/pdf-ref";

import type { BBox } from "./factory";

/**
 * A shading (gradient) resource.
 *
 * Shadings define smooth color transitions (gradients) that can fill
 * arbitrary shapes. Two types are supported:
 * - **axial**: Linear gradient along a line segment
 * - **radial**: Circular gradient between two circles
 *
 * @example
 * ```typescript
 * const gradient = pdf.createAxialShading({
 *   coords: [0, 0, 100, 0],
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 *
 * const name = page.registerShading(gradient);
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.rectangle(50, 50, 100, 100),
 *   ops.clip(),
 *   ops.endPath(),
 *   ops.paintShading(name),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export interface PDFShading {
  readonly type: "shading";
  readonly ref: PdfRef;
  readonly shadingType: "axial" | "radial";
}

/**
 * A tiling pattern resource (PatternType 1).
 *
 * Tiling patterns repeat a small graphic cell to fill an area.
 * Useful for textures, backgrounds, and decorative fills.
 *
 * @example
 * ```typescript
 * const dots = pdf.createTilingPattern({
 *   bbox: [0, 0, 10, 10],
 *   xStep: 10,
 *   yStep: 10,
 *   operators: [
 *     ops.setNonStrokingGray(0.5),
 *     // Draw a small circle at center
 *     ops.moveTo(7, 5),
 *     ops.curveTo(7, 6.1, 6.1, 7, 5, 7),
 *     ops.curveTo(3.9, 7, 3, 6.1, 3, 5),
 *     ops.curveTo(3, 3.9, 3.9, 3, 5, 3),
 *     ops.curveTo(6.1, 3, 7, 3.9, 7, 5),
 *     ops.fill(),
 *   ],
 * });
 *
 * const name = page.registerPattern(dots);
 * page.drawOperators([
 *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
 *   ops.setNonStrokingColorN(name),
 *   ops.rectangle(100, 100, 200, 200),
 *   ops.fill(),
 * ]);
 * ```
 */
export interface PDFTilingPattern {
  readonly type: "pattern";
  readonly ref: PdfRef;
  readonly patternType: "tiling";
}

/**
 * A shading pattern resource (PatternType 2).
 *
 * Shading patterns wrap a gradient (shading) so it can be used as a fill or
 * stroke color. Unlike direct shading fills via `paintShading()`, shading
 * patterns work with any path shape without explicit clipping.
 *
 * @example
 * ```typescript
 * // Create a gradient
 * const gradient = pdf.createAxialShading({
 *   coords: [0, 0, 100, 0],
 *   stops: [
 *     { offset: 0, color: rgb(1, 0, 0) },
 *     { offset: 1, color: rgb(0, 0, 1) },
 *   ],
 * });
 *
 * // Wrap it in a shading pattern
 * const gradientPattern = pdf.createShadingPattern(gradient);
 *
 * // Use like any other pattern
 * const name = page.registerPattern(gradientPattern);
 * page.drawOperators([
 *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
 *   ops.setNonStrokingColorN(name),
 *   ops.rectangle(100, 100, 200, 200),
 *   ops.fill(),
 * ]);
 *
 * // Or with PathBuilder
 * page.drawPath()
 *   .circle(200, 200, 50)
 *   .fill({ pattern: gradientPattern });
 * ```
 */
export interface PDFShadingPattern {
  readonly type: "pattern";
  readonly ref: PdfRef;
  readonly patternType: "shading";
  /** The underlying shading this pattern wraps */
  readonly shading: PDFShading;
}

/**
 * Any pattern resource (tiling or shading).
 */
export type PDFPattern = PDFTilingPattern | PDFShadingPattern;

/**
 * An extended graphics state resource.
 *
 * Extended graphics state (ExtGState) provides advanced rendering options
 * not available in the basic graphics state:
 * - **Opacity**: Separate fill and stroke transparency
 * - **Blend modes**: Photoshop-style compositing (Multiply, Screen, etc.)
 *
 * @example
 * ```typescript
 * const semiTransparent = pdf.createExtGState({
 *   fillOpacity: 0.5,
 *   blendMode: "Multiply",
 * });
 *
 * const name = page.registerExtGState(semiTransparent);
 * page.drawOperators([
 *   ops.pushGraphicsState(),
 *   ops.setGraphicsState(name),
 *   ops.setNonStrokingRGB(1, 0, 0),
 *   ops.rectangle(100, 100, 50, 50),
 *   ops.fill(),
 *   ops.popGraphicsState(),
 * ]);
 * ```
 */
export interface PDFExtGState {
  readonly type: "extgstate";
  readonly ref: PdfRef;
}

/**
 * A Form XObject (reusable content) resource.
 *
 * Form XObjects are like "stamps" - define once, use many times.
 * They're ideal for:
 * - Watermarks applied to every page
 * - Headers and footers
 * - Logos and repeated graphics
 * - Any content that appears multiple times
 *
 * @example
 * ```typescript
 * const logo = pdf.createFormXObject({
 *   bbox: [0, 0, 100, 50],
 *   operators: [
 *     ops.setNonStrokingRGB(0.2, 0.4, 0.8),
 *     ops.rectangle(0, 0, 100, 50),
 *     ops.fill(),
 *   ],
 * });
 *
 * // Use on multiple pages
 * for (const page of pdf.getPages()) {
 *   const name = page.registerXObject(logo);
 *   page.drawOperators([
 *     ops.pushGraphicsState(),
 *     ops.concatMatrix(1, 0, 0, 1, 50, 700),
 *     ops.paintXObject(name),
 *     ops.popGraphicsState(),
 *   ]);
 * }
 * ```
 */
export interface PDFFormXObject {
  readonly type: "formxobject";
  readonly ref: PdfRef;
  readonly bbox: BBox;
}
