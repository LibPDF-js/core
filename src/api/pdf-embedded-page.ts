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

  /** Original page bounding box */
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
