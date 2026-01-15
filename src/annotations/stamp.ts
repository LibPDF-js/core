/**
 * PDFStampAnnotation - Rubber stamp annotations.
 *
 * Stamp annotations display a rubber stamp-like image on the page.
 * Standard stamps include Approved, Rejected, Draft, etc.
 *
 * PDF Reference: Section 12.5.6.12 "Rubber Stamp Annotations"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { rectToArray } from "./base";
import { PDFMarkupAnnotation } from "./markup";
import type { StampAnnotationOptions, StampName } from "./types";

/**
 * Standard stamp names as defined in PDF spec.
 */
export const STANDARD_STAMPS: StampName[] = [
  "Approved",
  "Experimental",
  "NotApproved",
  "AsIs",
  "Expired",
  "NotForPublicRelease",
  "Confidential",
  "Final",
  "Sold",
  "Departmental",
  "ForComment",
  "TopSecret",
  "Draft",
  "ForPublicRelease",
];

/**
 * Stamp annotation - rubber stamp.
 */
export class PDFStampAnnotation extends PDFMarkupAnnotation {
  /**
   * Create a new stamp annotation dictionary.
   */
  static create(options: StampAnnotationOptions): PdfDict {
    const { rect } = options;

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Stamp"),
      Rect: new PdfArray(rectToArray(rect)),
      Name: PdfName.of(options.name ?? "Draft"),
      F: PdfNumber.of(4), // Print flag
    });

    if (options.contents) {
      annotDict.set("Contents", PdfString.fromString(options.contents));
    }

    return annotDict;
  }

  /**
   * Stamp name/type.
   */
  get stampName(): string {
    const name = this.dict.getName("Name");

    return name?.value ?? "Draft";
  }

  /**
   * Set the stamp name.
   */
  setStampName(name: StampName | string): void {
    this.dict.set("Name", PdfName.of(name));
    this.markModified();
  }

  /**
   * Check if this is a standard stamp.
   */
  isStandardStamp(): boolean {
    return STANDARD_STAMPS.includes(this.stampName as StampName);
  }
}
