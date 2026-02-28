/**
 * Form XObject (reusable content) resources.
 */

import type { Operator } from "#src/content/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import type { BBox } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating a Form XObject (reusable content).
 *
 * Form XObjects are like "stamps" - define once, use many times.
 * They're perfect for watermarks, headers, footers, and repeated graphics.
 *
 * @example
 * ```typescript
 * // Create a "DRAFT" watermark stamp
 * const draftStamp = pdf.createFormXObject({
 *   bbox: { x: 0, y: 0, width: 200, height: 50 },
 *   operators: [
 *     ops.setNonStrokingRGB(0.9, 0.1, 0.1),
 *     ops.beginText(),
 *     ops.setFont(fontName, 36),
 *     ops.moveText(10, 10),
 *     ops.showText("DRAFT"),
 *     ops.endText(),
 *   ],
 * });
 *
 * // Use on every page
 * for (const page of pdf.getPages()) {
 *   const name = page.registerXObject(draftStamp);
 *   page.drawOperators([
 *     ops.pushGraphicsState(),
 *     ops.concatMatrix(1, 0, 0, 1, 200, 700),
 *     ops.paintXObject(name),
 *     ops.popGraphicsState(),
 *   ]);
 * }
 * ```
 */
export interface FormXObjectOptions {
  /**
   * Bounding box of the Form XObject.
   *
   * Defines the coordinate space for the form's operators.
   * Usually starts at { x: 0, y: 0, width, height }.
   */
  bbox: BBox;
  /** Operators that draw the form content */
  operators: Operator[];
  /** Optional resources dictionary for self-contained form content */
  resources?: PdfDict;
  /** Optional transparency group dictionary */
  group?: TransparencyGroupOptions;
}

/** Supported transparency group color spaces. */
export type TransparencyGroupColorSpace = "DeviceGray" | "DeviceRGB" | "DeviceCMYK";

/**
 * Form XObject transparency group options.
 */
export interface TransparencyGroupOptions {
  /** Group blending color space (/CS) */
  colorSpace: TransparencyGroupColorSpace;
  /** Isolated group flag (/I) */
  isolated?: boolean;
  /** Knockout group flag (/K) */
  knockout?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Class
// ─────────────────────────────────────────────────────────────────────────────

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
 *   bbox: { x: 0, y: 0, width: 100, height: 50 },
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
export class PDFFormXObject {
  readonly type = "formxobject";
  readonly ref: PdfRef;
  readonly bbox: BBox;
  readonly group?: TransparencyGroupOptions;

  constructor(ref: PdfRef, bbox: BBox, group?: TransparencyGroupOptions) {
    this.ref = ref;
    this.bbox = bbox;
    this.group = group;
  }

  /**
   * Create the PDF stream for a Form XObject.
   */
  static createStream(options: FormXObjectOptions, contentBytes: Uint8Array): PdfStream {
    const { x, y, width, height } = options.bbox;

    const dict = PdfDict.of({
      Type: PdfName.of("XObject"),
      Subtype: PdfName.of("Form"),
      FormType: PdfNumber.of(1),
      // PDF spec: BBox is [llx, lly, urx, ury] (lower-left and upper-right corners)
      BBox: new PdfArray([
        PdfNumber.of(x),
        PdfNumber.of(y),
        PdfNumber.of(x + width),
        PdfNumber.of(y + height),
      ]),
    });

    if (options.resources) {
      dict.set("Resources", options.resources);
    }

    if (options.group) {
      const group = PdfDict.of({
        S: PdfName.of("Transparency"),
        CS: PdfName.of(options.group.colorSpace),
      });

      if (options.group.isolated !== undefined) {
        group.set("I", PdfBool.of(options.group.isolated));
      }

      if (options.group.knockout !== undefined) {
        group.set("K", PdfBool.of(options.group.knockout));
      }

      dict.set("Group", group);
    }

    return new PdfStream(dict, contentBytes);
  }
}
