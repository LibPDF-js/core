/**
 * Coordinate transformation engine for PDF viewing.
 *
 * Handles bidirectional conversion between PDF coordinate space (points) and
 * screen coordinate space (pixels). Supports zoom levels, page rotation, and
 * device pixel ratio adjustments.
 *
 * PDF coordinate system:
 * - Origin at bottom-left of page
 * - Units in points (1/72 inch)
 * - Y increases upward
 *
 * Screen coordinate system:
 * - Origin at top-left of canvas/element
 * - Units in CSS pixels
 * - Y increases downward
 */

import { Matrix } from "./helpers/matrix";
import type { Viewport } from "./renderers/base-renderer";

/**
 * A 2D point with x and y coordinates.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * A rectangular region defined by position and dimensions.
 */
export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Valid rotation angles in degrees.
 */
export type RotationAngle = 0 | 90 | 180 | 270;

/**
 * Configuration options for CoordinateTransformer.
 */
export interface CoordinateTransformerOptions {
  /**
   * Width of the PDF page in points.
   */
  pageWidth: number;

  /**
   * Height of the PDF page in points.
   */
  pageHeight: number;

  /**
   * Page rotation from the PDF document (0, 90, 180, 270).
   * @default 0
   */
  pageRotation?: RotationAngle;

  /**
   * Viewer-applied rotation in addition to page rotation.
   * @default 0
   */
  viewerRotation?: RotationAngle;

  /**
   * Zoom/scale factor.
   * @default 1
   */
  scale?: number;

  /**
   * Device pixel ratio for high-DPI displays.
   * @default 1
   */
  devicePixelRatio?: number;

  /**
   * X offset of the viewport in screen pixels.
   * @default 0
   */
  offsetX?: number;

  /**
   * Y offset of the viewport in screen pixels.
   * @default 0
   */
  offsetY?: number;
}

/**
 * Minimum allowed zoom level (25%).
 */
export const MIN_ZOOM = 0.25;

/**
 * Maximum allowed zoom level (500%).
 */
export const MAX_ZOOM = 5.0;

/**
 * CoordinateTransformer handles coordinate conversions between PDF space and screen space.
 *
 * This class maintains transformation state (zoom, rotation, offsets) and provides
 * efficient bidirectional coordinate conversion. It uses cached transformation matrices
 * for performance when the same transformation is applied to multiple points.
 *
 * @example
 * ```ts
 * const transformer = new CoordinateTransformer({
 *   pageWidth: 612,
 *   pageHeight: 792,
 *   scale: 1.5,
 *   viewerRotation: 90,
 * });
 *
 * // Convert PDF point to screen pixel
 * const screenPoint = transformer.pdfToScreen({ x: 100, y: 700 });
 *
 * // Convert screen click to PDF coordinate
 * const pdfPoint = transformer.screenToPdf({ x: 150, y: 50 });
 * ```
 */
export class CoordinateTransformer {
  private _pageWidth: number;
  private _pageHeight: number;
  private _pageRotation: RotationAngle;
  private _viewerRotation: RotationAngle;
  private _scale: number;
  private _devicePixelRatio: number;
  private _offsetX: number;
  private _offsetY: number;

  // Cached transformation matrices
  private _pdfToScreenMatrix: Matrix | null = null;
  private _screenToPdfMatrix: Matrix | null = null;

  constructor(options: CoordinateTransformerOptions) {
    this._pageWidth = options.pageWidth;
    this._pageHeight = options.pageHeight;
    this._pageRotation = normalizeRotation(options.pageRotation ?? 0);
    this._viewerRotation = normalizeRotation(options.viewerRotation ?? 0);
    this._scale = clampScale(options.scale ?? 1);
    this._devicePixelRatio = options.devicePixelRatio ?? 1;
    this._offsetX = options.offsetX ?? 0;
    this._offsetY = options.offsetY ?? 0;
  }

  /**
   * Create a CoordinateTransformer from a Viewport object.
   */
  static fromViewport(
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
  ): CoordinateTransformer {
    return new CoordinateTransformer({
      pageWidth,
      pageHeight,
      scale: viewport.scale,
      viewerRotation: normalizeRotation(viewport.rotation),
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
    });
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * The PDF page width in points.
   */
  get pageWidth(): number {
    return this._pageWidth;
  }

  /**
   * The PDF page height in points.
   */
  get pageHeight(): number {
    return this._pageHeight;
  }

  /**
   * The effective page dimensions considering rotation.
   * For 90° or 270° rotation, width and height are swapped.
   */
  get effectivePageSize(): { width: number; height: number } {
    const totalRotation = this.totalRotation;
    const isRotated = totalRotation === 90 || totalRotation === 270;
    return {
      width: isRotated ? this._pageHeight : this._pageWidth,
      height: isRotated ? this._pageWidth : this._pageHeight,
    };
  }

  /**
   * The page rotation from the PDF document.
   */
  get pageRotation(): RotationAngle {
    return this._pageRotation;
  }

  /**
   * The viewer-applied rotation.
   */
  get viewerRotation(): RotationAngle {
    return this._viewerRotation;
  }

  /**
   * The total rotation (page + viewer) normalized to 0-270.
   */
  get totalRotation(): RotationAngle {
    return normalizeRotation(this._pageRotation + this._viewerRotation);
  }

  /**
   * The current zoom/scale factor.
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * The device pixel ratio.
   */
  get devicePixelRatio(): number {
    return this._devicePixelRatio;
  }

  /**
   * The effective scale considering device pixel ratio.
   */
  get effectiveScale(): number {
    return this._scale * this._devicePixelRatio;
  }

  /**
   * The X offset in screen pixels.
   */
  get offsetX(): number {
    return this._offsetX;
  }

  /**
   * The Y offset in screen pixels.
   */
  get offsetY(): number {
    return this._offsetY;
  }

  /**
   * The screen viewport dimensions in CSS pixels.
   */
  get viewportSize(): { width: number; height: number } {
    const { width, height } = this.effectivePageSize;
    return {
      width: width * this._scale,
      height: height * this._scale,
    };
  }

  /**
   * The canvas dimensions in physical pixels (for high-DPI rendering).
   */
  get canvasSize(): { width: number; height: number } {
    const { width, height } = this.viewportSize;
    return {
      width: Math.ceil(width * this._devicePixelRatio),
      height: Math.ceil(height * this._devicePixelRatio),
    };
  }

  // ============================================================================
  // State Modification
  // ============================================================================

  /**
   * Set the zoom/scale factor.
   * Value is clamped to MIN_ZOOM - MAX_ZOOM range.
   */
  setScale(scale: number): void {
    const newScale = clampScale(scale);
    if (newScale !== this._scale) {
      this._scale = newScale;
      this.invalidateMatrices();
    }
  }

  /**
   * Set the viewer rotation.
   */
  setViewerRotation(rotation: number): void {
    const normalized = normalizeRotation(rotation);
    if (normalized !== this._viewerRotation) {
      this._viewerRotation = normalized;
      this.invalidateMatrices();
    }
  }

  /**
   * Set the device pixel ratio.
   */
  setDevicePixelRatio(ratio: number): void {
    if (ratio > 0 && ratio !== this._devicePixelRatio) {
      this._devicePixelRatio = ratio;
      this.invalidateMatrices();
    }
  }

  /**
   * Set the viewport offset.
   */
  setOffset(offsetX: number, offsetY: number): void {
    if (offsetX !== this._offsetX || offsetY !== this._offsetY) {
      this._offsetX = offsetX;
      this._offsetY = offsetY;
      this.invalidateMatrices();
    }
  }

  /**
   * Update page dimensions (e.g., when switching pages).
   */
  setPageSize(width: number, height: number, pageRotation?: RotationAngle): void {
    this._pageWidth = width;
    this._pageHeight = height;
    if (pageRotation !== undefined) {
      this._pageRotation = normalizeRotation(pageRotation);
    }
    this.invalidateMatrices();
  }

  // ============================================================================
  // Coordinate Transformation
  // ============================================================================

  /**
   * Convert a point from PDF space to screen space.
   *
   * @param point - Point in PDF coordinates (origin bottom-left, y up)
   * @returns Point in screen coordinates (origin top-left, y down)
   */
  pdfToScreen(point: Point2D): Point2D {
    const totalRotation = this.totalRotation;
    const scale = this._scale;

    // Step 1: Flip Y to convert from PDF coordinates to screen coordinates
    // PDF (0,0) is bottom-left, screen (0,0) is top-left
    let x = point.x;
    let y = this._pageHeight - point.y;

    // Step 2: Apply rotation around center of the original page
    if (totalRotation !== 0) {
      const centerX = this._pageWidth / 2;
      const centerY = this._pageHeight / 2;

      // Translate to center
      x -= centerX;
      y -= centerY;

      // Rotate
      const radians = (totalRotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const newX = x * cos - y * sin;
      const newY = x * sin + y * cos;
      x = newX;
      y = newY;

      // Translate to center of effective page size
      const { width: effectiveWidth, height: effectiveHeight } = this.effectivePageSize;
      x += effectiveWidth / 2;
      y += effectiveHeight / 2;
    }

    // Step 3: Apply scale
    x *= scale;
    y *= scale;

    // Step 4: Apply offset
    x += this._offsetX;
    y += this._offsetY;

    return { x, y };
  }

  /**
   * Convert a point from screen space to PDF space.
   *
   * @param point - Point in screen coordinates (origin top-left, y down)
   * @returns Point in PDF coordinates (origin bottom-left, y up)
   */
  screenToPdf(point: Point2D): Point2D {
    const totalRotation = this.totalRotation;
    const scale = this._scale;

    // Reverse the transformations in reverse order

    // Step 1: Remove offset
    let x = point.x - this._offsetX;
    let y = point.y - this._offsetY;

    // Step 2: Remove scale
    x /= scale;
    y /= scale;

    // Step 3: Remove rotation
    if (totalRotation !== 0) {
      const { width: effectiveWidth, height: effectiveHeight } = this.effectivePageSize;

      // Translate from center of effective page
      x -= effectiveWidth / 2;
      y -= effectiveHeight / 2;

      // Rotate back (negative angle)
      const radians = (-totalRotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const newX = x * cos - y * sin;
      const newY = x * sin + y * cos;
      x = newX;
      y = newY;

      // Translate from center of original page
      const centerX = this._pageWidth / 2;
      const centerY = this._pageHeight / 2;
      x += centerX;
      y += centerY;
    }

    // Step 4: Flip Y back to PDF coordinates
    y = this._pageHeight - y;

    return { x, y };
  }

  /**
   * Convert a rectangle from PDF space to screen space.
   *
   * @param rect - Rectangle in PDF coordinates
   * @returns Rectangle in screen coordinates (may have different orientation after rotation)
   */
  pdfRectToScreen(rect: Rect2D): Rect2D {
    // Transform all four corners
    const corners = [
      this.pdfToScreen({ x: rect.x, y: rect.y }),
      this.pdfToScreen({ x: rect.x + rect.width, y: rect.y }),
      this.pdfToScreen({ x: rect.x + rect.width, y: rect.y + rect.height }),
      this.pdfToScreen({ x: rect.x, y: rect.y + rect.height }),
    ];

    // Find bounding box of transformed corners
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Convert a rectangle from screen space to PDF space.
   *
   * @param rect - Rectangle in screen coordinates
   * @returns Rectangle in PDF coordinates
   */
  screenRectToPdf(rect: Rect2D): Rect2D {
    // Transform all four corners
    const corners = [
      this.screenToPdf({ x: rect.x, y: rect.y }),
      this.screenToPdf({ x: rect.x + rect.width, y: rect.y }),
      this.screenToPdf({ x: rect.x + rect.width, y: rect.y + rect.height }),
      this.screenToPdf({ x: rect.x, y: rect.y + rect.height }),
    ];

    // Find bounding box of transformed corners
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Convert a distance from PDF units to screen pixels.
   * Unlike point conversion, this only applies scaling, not translation.
   *
   * @param distance - Distance in PDF points
   * @returns Distance in screen pixels
   */
  pdfDistanceToScreen(distance: number): number {
    return distance * this._scale;
  }

  /**
   * Convert a distance from screen pixels to PDF units.
   *
   * @param distance - Distance in screen pixels
   * @returns Distance in PDF points
   */
  screenDistanceToPdf(distance: number): number {
    return distance / this._scale;
  }

  /**
   * Convert multiple points from PDF space to screen space.
   * More efficient than calling pdfToScreen repeatedly.
   *
   * @param points - Array of points in PDF coordinates
   * @returns Array of points in screen coordinates
   */
  pdfPointsToScreen(points: Point2D[]): Point2D[] {
    return points.map(p => this.pdfToScreen(p));
  }

  /**
   * Convert multiple points from screen space to PDF space.
   *
   * @param points - Array of points in screen coordinates
   * @returns Array of points in PDF coordinates
   */
  screenPointsToPdf(points: Point2D[]): Point2D[] {
    return points.map(p => this.screenToPdf(p));
  }

  // ============================================================================
  // Matrix Operations
  // ============================================================================

  /**
   * Get the transformation matrix for PDF to screen conversion.
   */
  getPdfToScreenMatrix(): Matrix {
    if (!this._pdfToScreenMatrix) {
      this._pdfToScreenMatrix = this.computePdfToScreenMatrix();
    }
    return this._pdfToScreenMatrix;
  }

  /**
   * Get the transformation matrix for screen to PDF conversion.
   */
  getScreenToPdfMatrix(): Matrix {
    if (!this._screenToPdfMatrix) {
      this._screenToPdfMatrix = this.computeScreenToPdfMatrix();
    }
    return this._screenToPdfMatrix;
  }

  /**
   * Invalidate cached matrices (call when state changes).
   */
  private invalidateMatrices(): void {
    this._pdfToScreenMatrix = null;
    this._screenToPdfMatrix = null;
  }

  /**
   * Compute the PDF to screen transformation matrix.
   *
   * The transformation handles:
   * 1. Coordinate system flip (PDF y-up to screen y-down)
   * 2. Rotation (if any)
   * 3. Scale
   * 4. Offset
   */
  private computePdfToScreenMatrix(): Matrix {
    const totalRotation = this.totalRotation;
    const scale = this._scale;
    const { width: effectiveWidth, height: effectiveHeight } = this.effectivePageSize;

    // Start with identity
    let matrix = Matrix.identity();

    // Apply transformations in order:
    // 1. First translate so PDF origin (bottom-left) is at the position
    //    that will become screen origin after Y-flip
    // 2. Flip Y axis
    // 3. Apply rotation around center of the rotated output
    // 4. Apply scale
    // 5. Apply offset

    // Flip Y and adjust for PDF's bottom-left origin
    // PDF (0, pageHeight) should map to screen (0, 0)
    matrix = new Matrix(1, 0, 0, -1, 0, this._pageHeight);

    // Apply rotation around center if needed
    if (totalRotation !== 0) {
      const radians = (totalRotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      // Pre-rotation center (in flipped coordinates)
      const preCenterX = this._pageWidth / 2;
      const preCenterY = this._pageHeight / 2;

      // Post-rotation center
      const postCenterX = effectiveWidth / 2;
      const postCenterY = effectiveHeight / 2;

      // Build rotation around center: translate to origin, rotate, translate to new center
      const rotMatrix = new Matrix(cos, sin, -sin, cos, 0, 0);

      // First translate to center origin
      matrix = matrix.translate(-preCenterX, -preCenterY);
      // Then rotate
      matrix = matrix.multiply(rotMatrix);
      // Then translate to new center
      matrix = matrix.translate(postCenterX, postCenterY);
    }

    // Apply scale
    matrix = matrix.scale(scale, scale);

    // Apply offset
    if (this._offsetX !== 0 || this._offsetY !== 0) {
      matrix = matrix.translate(this._offsetX / scale, this._offsetY / scale);
    }

    return matrix;
  }

  /**
   * Compute the screen to PDF transformation matrix.
   * This applies the inverse transformations in reverse order.
   */
  private computeScreenToPdfMatrix(): Matrix {
    const totalRotation = this.totalRotation;
    const scale = this._scale;
    const { width: effectiveWidth, height: effectiveHeight } = this.effectivePageSize;

    // Start with identity
    let matrix = Matrix.identity();

    // Apply inverse transformations in reverse order:
    // 1. Remove offset
    // 2. Remove scale
    // 3. Remove rotation
    // 4. Flip Y back

    // Remove offset
    if (this._offsetX !== 0 || this._offsetY !== 0) {
      matrix = matrix.translate(-this._offsetX / scale, -this._offsetY / scale);
    }

    // Remove scale
    matrix = matrix.scale(1 / scale, 1 / scale);

    // Remove rotation
    if (totalRotation !== 0) {
      const radians = (-totalRotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      // Post-rotation center (where we are now)
      const postCenterX = effectiveWidth / 2;
      const postCenterY = effectiveHeight / 2;

      // Pre-rotation center (where we want to be)
      const preCenterX = this._pageWidth / 2;
      const preCenterY = this._pageHeight / 2;

      // Reverse: translate from new center, rotate back, translate to old center
      const rotMatrix = new Matrix(cos, sin, -sin, cos, 0, 0);

      matrix = matrix.translate(-postCenterX, -postCenterY);
      matrix = matrix.multiply(rotMatrix);
      matrix = matrix.translate(preCenterX, preCenterY);
    }

    // Reverse Y-flip: flip Y and translate
    matrix = matrix.multiply(new Matrix(1, 0, 0, -1, 0, this._pageHeight));

    return matrix;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a screen point is within the rendered page bounds.
   */
  isPointInViewport(screenPoint: Point2D): boolean {
    const { width, height } = this.viewportSize;
    return (
      screenPoint.x >= this._offsetX &&
      screenPoint.x <= this._offsetX + width &&
      screenPoint.y >= this._offsetY &&
      screenPoint.y <= this._offsetY + height
    );
  }

  /**
   * Check if a PDF point is within the page bounds.
   */
  isPointInPage(pdfPoint: Point2D): boolean {
    return (
      pdfPoint.x >= 0 &&
      pdfPoint.x <= this._pageWidth &&
      pdfPoint.y >= 0 &&
      pdfPoint.y <= this._pageHeight
    );
  }

  /**
   * Create a Viewport object compatible with the rendering pipeline.
   */
  toViewport(): Viewport {
    const { width, height } = this.viewportSize;
    return {
      width,
      height,
      scale: this._scale,
      rotation: this.totalRotation,
      offsetX: this._offsetX,
      offsetY: this._offsetY,
    };
  }

  /**
   * Clone this transformer with optional overrides.
   */
  clone(overrides?: Partial<CoordinateTransformerOptions>): CoordinateTransformer {
    return new CoordinateTransformer({
      pageWidth: overrides?.pageWidth ?? this._pageWidth,
      pageHeight: overrides?.pageHeight ?? this._pageHeight,
      pageRotation: overrides?.pageRotation ?? this._pageRotation,
      viewerRotation: overrides?.viewerRotation ?? this._viewerRotation,
      scale: overrides?.scale ?? this._scale,
      devicePixelRatio: overrides?.devicePixelRatio ?? this._devicePixelRatio,
      offsetX: overrides?.offsetX ?? this._offsetX,
      offsetY: overrides?.offsetY ?? this._offsetY,
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a rotation angle to one of the valid PDF rotation values.
 */
function normalizeRotation(angle: number): RotationAngle {
  // Normalize to 0-360 range
  const normalized = ((angle % 360) + 360) % 360;

  // Round to nearest valid rotation
  if (normalized < 45) {
    return 0;
  }
  if (normalized < 135) {
    return 90;
  }
  if (normalized < 225) {
    return 180;
  }
  if (normalized < 315) {
    return 270;
  }
  return 0;
}

/**
 * Clamp a scale value to the allowed range.
 */
function clampScale(scale: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

/**
 * Create a coordinate transformer for quick one-off conversions.
 */
export function createCoordinateTransformer(
  options: CoordinateTransformerOptions,
): CoordinateTransformer {
  return new CoordinateTransformer(options);
}
