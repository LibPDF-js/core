/**
 * PDFPopupAnnotation - Popup windows associated with markup annotations.
 *
 * Popup annotations display text in a pop-up window for reviewing.
 * They are typically linked to a parent markup annotation.
 *
 * PDF Reference: Section 12.5.6.14 "Popup Annotations"
 */

import { PdfBool } from "#src/objects/pdf-bool";
import type { PdfRef } from "#src/objects/pdf-ref";

import { PDFAnnotation } from "./base";

/**
 * Popup annotation - displays text in a pop-up window.
 */
export class PDFPopupAnnotation extends PDFAnnotation {
  /**
   * Reference to the parent annotation that this popup is associated with.
   */
  get parentRef(): PdfRef | null {
    const parent = this.dict.get("Parent");

    return parent?.type === "ref" ? parent : null;
  }

  /**
   * Whether the popup is initially open.
   */
  get isOpen(): boolean {
    const open = this.dict.getBool("Open");

    return open?.value ?? false;
  }

  /**
   * Set whether the popup is open.
   */
  setOpen(open: boolean): void {
    this.dict.set("Open", PdfBool.of(open));
    this.markModified();
  }
}
