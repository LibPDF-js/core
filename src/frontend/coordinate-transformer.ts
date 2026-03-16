/**
 * Coordinate transformation utilities for the frontend module.
 *
 * This module re-exports the core CoordinateTransformer and provides additional
 * convenience functions specifically for frontend use cases like mouse event
 * handling and bounding box visualization.
 *
 * @example
 * ```ts
 * import {
 *   CoordinateTransformer,
 *   getMousePdfCoordinates,
 *   transformBoundingBoxes,
 * } from "@libpdf/core/frontend";
 *
 * const transformer = new CoordinateTransformer({
 *   pageWidth: 612,
 *   pageHeight: 792,
 *   scale: 1.5,
 * });
 *
 * // Handle mouse click
 * canvas.addEventListener("click", (event) => {
 *   const pdfPoint = getMousePdfCoordinates(event, canvas, transformer);
 *   console.log(`Clicked at PDF coordinates: (${pdfPoint.x}, ${pdfPoint.y})`);
 * });
 * ```
 */

// Re-export everything from the core coordinate transformer
export {
  CoordinateTransformer,
  createCoordinateTransformer,
  MAX_ZOOM,
  MIN_ZOOM,
  type CoordinateTransformerOptions,
  type Point2D,
  type Rect2D,
  type RotationAngle,
} from "../coordinate-transformer";

import type { Point2D, Rect2D } from "../coordinate-transformer";
import { CoordinateTransformer } from "../coordinate-transformer";

/**
 * Options for mouse coordinate extraction.
 */
export interface MouseCoordinateOptions {
  /**
   * Whether to clamp coordinates to page bounds.
   * @default true
   */
  clampToPage?: boolean;
}

/**
 * Result of getting mouse PDF coordinates.
 */
export interface MousePdfCoordinateResult {
  /**
   * The point in PDF coordinate space.
   */
  point: Point2D;

  /**
   * Whether the point is within the page bounds.
   */
  isInPage: boolean;

  /**
   * The original screen coordinates before transformation.
   */
  screenPoint: Point2D;
}

/**
 * Get PDF coordinates from a mouse event on a canvas or container element.
 *
 * This function handles the common case of converting mouse event coordinates
 * to PDF space, accounting for element offset, scroll position, and any
 * transformations applied by the CoordinateTransformer.
 *
 * @param event - The mouse event
 * @param element - The canvas or container element
 * @param transformer - The coordinate transformer
 * @param options - Optional configuration
 * @returns The PDF coordinates and additional info
 *
 * @example
 * ```ts
 * canvas.addEventListener("click", (event) => {
 *   const result = getMousePdfCoordinates(event, canvas, transformer);
 *   if (result.isInPage) {
 *     console.log(`Clicked at: (${result.point.x}, ${result.point.y})`);
 *   }
 * });
 * ```
 */
export function getMousePdfCoordinates(
  event: MouseEvent,
  element: HTMLElement,
  transformer: CoordinateTransformer,
  options: MouseCoordinateOptions = {},
): MousePdfCoordinateResult {
  const { clampToPage = true } = options;

  // Get element bounds
  const rect = element.getBoundingClientRect();

  // Calculate screen point relative to element
  const screenPoint: Point2D = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  // Transform to PDF coordinates
  let pdfPoint = transformer.screenToPdf(screenPoint);

  // Check if point is in page bounds
  const isInPage = transformer.isPointInPage(pdfPoint);

  // Optionally clamp to page bounds
  if (clampToPage) {
    pdfPoint = {
      x: Math.max(0, Math.min(transformer.pageWidth, pdfPoint.x)),
      y: Math.max(0, Math.min(transformer.pageHeight, pdfPoint.y)),
    };
  }

  return {
    point: pdfPoint,
    isInPage,
    screenPoint,
  };
}

/**
 * Get PDF coordinates from a touch event on a canvas or container element.
 *
 * @param touch - The touch object from a TouchEvent
 * @param element - The canvas or container element
 * @param transformer - The coordinate transformer
 * @param options - Optional configuration
 * @returns The PDF coordinates and additional info
 *
 * @example
 * ```ts
 * canvas.addEventListener("touchstart", (event) => {
 *   const touch = event.touches[0];
 *   const result = getTouchPdfCoordinates(touch, canvas, transformer);
 *   if (result.isInPage) {
 *     console.log(`Touched at: (${result.point.x}, ${result.point.y})`);
 *   }
 * });
 * ```
 */
export function getTouchPdfCoordinates(
  touch: Touch,
  element: HTMLElement,
  transformer: CoordinateTransformer,
  options: MouseCoordinateOptions = {},
): MousePdfCoordinateResult {
  const { clampToPage = true } = options;

  // Get element bounds
  const rect = element.getBoundingClientRect();

  // Calculate screen point relative to element
  const screenPoint: Point2D = {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };

  // Transform to PDF coordinates
  let pdfPoint = transformer.screenToPdf(screenPoint);

  // Check if point is in page bounds
  const isInPage = transformer.isPointInPage(pdfPoint);

  // Optionally clamp to page bounds
  if (clampToPage) {
    pdfPoint = {
      x: Math.max(0, Math.min(transformer.pageWidth, pdfPoint.x)),
      y: Math.max(0, Math.min(transformer.pageHeight, pdfPoint.y)),
    };
  }

  return {
    point: pdfPoint,
    isInPage,
    screenPoint,
  };
}

/**
 * A bounding box in PDF coordinates with optional metadata.
 */
export interface PdfBoundingBox extends Rect2D {
  /**
   * Optional identifier for the bounding box.
   */
  id?: string;

  /**
   * Optional type classification.
   */
  type?: string;

  /**
   * Optional additional data.
   */
  data?: unknown;
}

/**
 * A transformed bounding box in screen coordinates.
 */
export interface ScreenBoundingBox extends Rect2D {
  /**
   * The original PDF bounding box.
   */
  original: PdfBoundingBox;

  /**
   * Optional identifier (passed through from original).
   */
  id?: string;

  /**
   * Optional type classification (passed through from original).
   */
  type?: string;
}

/**
 * Transform an array of PDF bounding boxes to screen coordinates.
 *
 * This is useful for rendering overlays like text selection, search results,
 * or debug visualizations on top of the PDF canvas.
 *
 * @param boxes - Array of bounding boxes in PDF coordinates
 * @param transformer - The coordinate transformer
 * @returns Array of bounding boxes in screen coordinates
 *
 * @example
 * ```ts
 * const pdfBoxes = [
 *   { x: 72, y: 720, width: 100, height: 12, type: "word" },
 *   { x: 180, y: 720, width: 80, height: 12, type: "word" },
 * ];
 *
 * const screenBoxes = transformBoundingBoxes(pdfBoxes, transformer);
 * screenBoxes.forEach((box) => {
 *   ctx.strokeRect(box.x, box.y, box.width, box.height);
 * });
 * ```
 */
export function transformBoundingBoxes(
  boxes: PdfBoundingBox[],
  transformer: CoordinateTransformer,
): ScreenBoundingBox[] {
  return boxes.map(box => {
    const screenRect = transformer.pdfRectToScreen(box);
    return {
      ...screenRect,
      original: box,
      id: box.id,
      type: box.type,
    };
  });
}

/**
 * Transform a screen bounding box back to PDF coordinates.
 *
 * This is useful for converting user selections or drawn rectangles
 * back to PDF space.
 *
 * @param box - Bounding box in screen coordinates
 * @param transformer - The coordinate transformer
 * @returns Bounding box in PDF coordinates
 */
export function transformScreenRectToPdf(box: Rect2D, transformer: CoordinateTransformer): Rect2D {
  return transformer.screenRectToPdf(box);
}

/**
 * Options for creating a transformer from a page container.
 */
export interface PageContainerTransformerOptions {
  /**
   * The page width in PDF points.
   */
  pageWidth: number;

  /**
   * The page height in PDF points.
   */
  pageHeight: number;

  /**
   * Page rotation from the PDF (0, 90, 180, 270).
   * @default 0
   */
  pageRotation?: 0 | 90 | 180 | 270;

  /**
   * Additional viewer rotation.
   * @default 0
   */
  viewerRotation?: 0 | 90 | 180 | 270;

  /**
   * Whether to account for device pixel ratio.
   * @default true
   */
  useDevicePixelRatio?: boolean;
}

/**
 * Create a CoordinateTransformer configured for a page container element.
 *
 * This function calculates the appropriate scale based on the container's
 * current dimensions and the PDF page size, making it easy to set up
 * coordinate transformation for a rendered page.
 *
 * @param container - The page container element
 * @param options - Configuration options
 * @returns A configured CoordinateTransformer
 *
 * @example
 * ```ts
 * const transformer = createTransformerForPageContainer(pageDiv, {
 *   pageWidth: 612,
 *   pageHeight: 792,
 * });
 *
 * // Now you can transform coordinates between PDF and screen space
 * const screenPoint = transformer.pdfToScreen({ x: 100, y: 700 });
 * ```
 */
export function createTransformerForPageContainer(
  container: HTMLElement,
  options: PageContainerTransformerOptions,
): CoordinateTransformer {
  const {
    pageWidth,
    pageHeight,
    pageRotation = 0,
    viewerRotation = 0,
    useDevicePixelRatio = true,
  } = options;

  // Get container dimensions
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Calculate effective page size considering rotation
  const totalRotation = ((pageRotation + viewerRotation) % 360) as 0 | 90 | 180 | 270;
  const isRotated = totalRotation === 90 || totalRotation === 270;
  const effectiveWidth = isRotated ? pageHeight : pageWidth;
  const effectiveHeight = isRotated ? pageWidth : pageHeight;

  // Calculate scale based on container size
  const scaleX = containerWidth / effectiveWidth;
  const scaleY = containerHeight / effectiveHeight;

  // Use the smaller scale to fit the page in the container
  // If container dimensions are zero, default to scale 1
  const scale = containerWidth > 0 && containerHeight > 0 ? Math.min(scaleX, scaleY) : 1;

  return new CoordinateTransformer({
    pageWidth,
    pageHeight,
    pageRotation,
    viewerRotation,
    scale,
    devicePixelRatio: useDevicePixelRatio ? (globalThis.devicePixelRatio ?? 1) : 1,
  });
}

/**
 * Calculate the centered offset for a page within a container.
 *
 * When rendering a PDF page in a container, you often want to center it.
 * This function calculates the appropriate offsets to achieve that.
 *
 * @param containerWidth - Width of the container in pixels
 * @param containerHeight - Height of the container in pixels
 * @param transformer - The coordinate transformer (used to get viewport size)
 * @returns The offset values to center the page
 */
export function calculateCenteredOffset(
  containerWidth: number,
  containerHeight: number,
  transformer: CoordinateTransformer,
): { offsetX: number; offsetY: number } {
  const { width: viewportWidth, height: viewportHeight } = transformer.viewportSize;

  return {
    offsetX: Math.max(0, (containerWidth - viewportWidth) / 2),
    offsetY: Math.max(0, (containerHeight - viewportHeight) / 2),
  };
}

/**
 * Check if a screen point is within any of the given PDF bounding boxes.
 *
 * This is useful for hit testing - determining which element (if any)
 * the user clicked on.
 *
 * @param screenPoint - The point in screen coordinates
 * @param boxes - Array of bounding boxes in PDF coordinates
 * @param transformer - The coordinate transformer
 * @returns The first matching bounding box, or null if none match
 *
 * @example
 * ```ts
 * canvas.addEventListener("click", (event) => {
 *   const result = getMousePdfCoordinates(event, canvas, transformer);
 *   const hitBox = hitTestBoundingBoxes(result.screenPoint, wordBoxes, transformer);
 *   if (hitBox) {
 *     console.log(`Clicked on word: ${hitBox.data}`);
 *   }
 * });
 * ```
 */
export function hitTestBoundingBoxes(
  screenPoint: Point2D,
  boxes: PdfBoundingBox[],
  transformer: CoordinateTransformer,
): PdfBoundingBox | null {
  // Transform screen point to PDF
  const pdfPoint = transformer.screenToPdf(screenPoint);

  // Find the first box that contains the point
  for (const box of boxes) {
    if (
      pdfPoint.x >= box.x &&
      pdfPoint.x <= box.x + box.width &&
      pdfPoint.y >= box.y &&
      pdfPoint.y <= box.y + box.height
    ) {
      return box;
    }
  }

  return null;
}

/**
 * Find all bounding boxes that contain a given screen point.
 *
 * Unlike hitTestBoundingBoxes which returns only the first match,
 * this function returns all overlapping boxes.
 *
 * @param screenPoint - The point in screen coordinates
 * @param boxes - Array of bounding boxes in PDF coordinates
 * @param transformer - The coordinate transformer
 * @returns All matching bounding boxes
 */
export function findAllBoxesAtPoint(
  screenPoint: Point2D,
  boxes: PdfBoundingBox[],
  transformer: CoordinateTransformer,
): PdfBoundingBox[] {
  // Transform screen point to PDF
  const pdfPoint = transformer.screenToPdf(screenPoint);

  // Find all boxes that contain the point
  return boxes.filter(
    box =>
      pdfPoint.x >= box.x &&
      pdfPoint.x <= box.x + box.width &&
      pdfPoint.y >= box.y &&
      pdfPoint.y <= box.y + box.height,
  );
}

/**
 * Create a selection rectangle from two screen points (e.g., drag start/end).
 *
 * This handles the case where the end point might be above or to the left
 * of the start point, ensuring the returned rectangle has positive dimensions.
 *
 * @param startPoint - The starting screen point
 * @param endPoint - The ending screen point
 * @param transformer - The coordinate transformer
 * @returns The selection rectangle in PDF coordinates
 */
export function createSelectionRect(
  startPoint: Point2D,
  endPoint: Point2D,
  transformer: CoordinateTransformer,
): Rect2D {
  // Create a screen rectangle with proper orientation
  const screenRect: Rect2D = {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  };

  // Transform to PDF coordinates
  return transformer.screenRectToPdf(screenRect);
}

/**
 * Find all bounding boxes that intersect with a selection rectangle.
 *
 * @param selectionRect - The selection rectangle in PDF coordinates
 * @param boxes - Array of bounding boxes in PDF coordinates
 * @returns All bounding boxes that intersect with the selection
 */
export function findBoxesInSelection(
  selectionRect: Rect2D,
  boxes: PdfBoundingBox[],
): PdfBoundingBox[] {
  return boxes.filter(box => {
    // Check for intersection
    const noIntersection =
      box.x + box.width < selectionRect.x ||
      box.x > selectionRect.x + selectionRect.width ||
      box.y + box.height < selectionRect.y ||
      box.y > selectionRect.y + selectionRect.height;

    return !noIntersection;
  });
}
