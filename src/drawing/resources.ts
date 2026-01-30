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

/**
 * A shading (gradient) resource.
 *
 * Created via PDF.createAxialShading() or PDF.createRadialShading().
 * Register on a page with page.registerShading() to get an operator name.
 */
export interface PDFShading {
  readonly type: "shading";
  readonly ref: PdfRef;
  readonly shadingType: "axial" | "radial";
}

/**
 * A tiling pattern resource.
 *
 * Created via PDF.createTilingPattern().
 * Register on a page with page.registerPattern() to get an operator name.
 */
export interface PDFPattern {
  readonly type: "pattern";
  readonly ref: PdfRef;
  readonly patternType: "tiling";
}

/**
 * An extended graphics state resource.
 *
 * Created via PDF.createExtGState().
 * Register on a page with page.registerExtGState() to get an operator name.
 */
export interface PDFExtGState {
  readonly type: "extgstate";
  readonly ref: PdfRef;
}

/**
 * A Form XObject (reusable content) resource.
 *
 * Created via PDF.createFormXObject().
 * Register on a page with page.registerXObject() to get an operator name.
 */
export interface PDFFormXObject {
  readonly type: "formxobject";
  readonly ref: PdfRef;
  readonly bbox: [number, number, number, number];
}
