/**
 * PDFEmbeddedPage - A page converted to a Form XObject for overlay/underlay.
 *
 * Created via `pdf.embedPage()`, represents a reusable page that can be
 * drawn onto other pages using `page.drawPage()`.
 *
 * @example
 * ```typescript
 * const watermark = await PDF.load(watermarkBytes);
 * const embedded = await pdf.embedPage(watermark, 0);
 *
 * // Draw on multiple pages
 * for (const page of await pdf.getPages()) {
 *   page.drawPage(embedded, { background: true });
 * }
 * ```
 */

import type { PdfRef } from "#src/objects/pdf-ref";

import type { Rectangle } from "./pdf-page";

/**
 * A page embedded as a Form XObject.
 *
 * The embedded page can be drawn onto other pages using `page.drawPage()`.
 * It preserves the original page's content, resources, and dimensions.
 */
export class PDFEmbeddedPage {
  /** Reference to the Form XObject stream */
  readonly ref: PdfRef;

  /** Bounding box in the coordinate space drawPage() maps onto the page */
  readonly box: Rectangle;

  /** Page width in points (rotation-adjusted) */
  readonly width: number;

  /** Page height in points (rotation-adjusted) */
  readonly height: number;

  constructor(ref: PdfRef, box: Rectangle, width: number, height: number) {
    this.ref = ref;
    this.box = box;
    this.width = width;
    this.height = height;
  }
}

/**
 * Compute the Form XObject matrix that reproduces a page's `/Rotate` value,
 * along with the rotated content's extents.
 *
 * Page rotation is clockwise. The matrix maps the page's unrotated user
 * space into the orientation a viewer would see, so the embedded form keeps
 * the same visual orientation as `PDFPage.width`/`height` report. The
 * rotated content always lands in `[0, 0, width, height]` regardless of the
 * source box origin.
 *
 * @param rotation - Normalized rotation in degrees (0, 90, 180, 270)
 * @param box - Raw MediaBox coordinates `[x1, y1, x2, y2]`
 * @returns The matrix and visual extents, or null when no rotation is needed
 */
export function getRotatedFormTransform(
  rotation: number,
  box: readonly [number, number, number, number],
): {
  matrix: [number, number, number, number, number, number];
  width: number;
  height: number;
} | null {
  const quarterTurn = rotation === 90 || rotation === 270;
  const width = quarterTurn ? Math.abs(box[3] - box[1]) : Math.abs(box[2] - box[0]);
  const height = quarterTurn ? Math.abs(box[2] - box[0]) : Math.abs(box[3] - box[1]);

  switch (((rotation % 360) + 360) % 360) {
    case 90:
      // x' = y - y1, y' = x2 - x
      return { matrix: [0, -1, 1, 0, 0 - box[1], box[2]], width, height };
    case 180:
      // x' = x2 - x, y' = y2 - y
      return { matrix: [-1, 0, 0, -1, box[2], box[3]], width, height };
    case 270:
      // x' = y2 - y, y' = x - x1
      return { matrix: [0, 1, -1, 0, box[3], 0 - box[0]], width, height };
    default:
      return null;
  }
}
