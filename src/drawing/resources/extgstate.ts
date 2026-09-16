/**
 * Extended graphics state resources.
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";

import type { PDFFormXObject, TransparencyGroupColorSpace } from "./form-xobject";
import type { BlendMode } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for creating extended graphics state.
 */
export interface ExtGStateOptions {
  /** Fill (non-stroking) opacity (0-1) */
  fillOpacity?: number;
  /** Stroke opacity (0-1) */
  strokeOpacity?: number;
  /** Blend mode for compositing */
  blendMode?: BlendMode;
  /** Soft mask for alpha/luminosity compositing */
  softMask?: ExtGStateSoftMask;
}

/** Soft mask using a transparency group source. */
export interface SoftMaskOptions {
  /** Soft mask subtype (/S) */
  subtype: "Alpha" | "Luminosity";
  /** Source transparency group form XObject (/G) */
  group: PDFFormXObject;
  /** Optional backdrop color (/BC) in the group's blending color space */
  backdropColor?: number[];
}

/** ExtGState soft mask option. */
export type ExtGStateSoftMask = SoftMaskOptions | "None";

// ─────────────────────────────────────────────────────────────────────────────
// Resource Class
// ─────────────────────────────────────────────────────────────────────────────

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
export class PDFExtGState {
  readonly type = "extgstate";
  readonly ref: PdfRef;

  constructor(ref: PdfRef) {
    this.ref = ref;
  }

  /**
   * Create the PDF dictionary for an extended graphics state.
   *
   * Opacity values are clamped to the range [0, 1].
   */
  static createDict(options: ExtGStateOptions): PdfDict {
    const dict = new PdfDict();

    if (options.fillOpacity !== undefined) {
      dict.set("ca", PdfNumber.of(Math.max(0, Math.min(1, options.fillOpacity))));
    }

    if (options.strokeOpacity !== undefined) {
      dict.set("CA", PdfNumber.of(Math.max(0, Math.min(1, options.strokeOpacity))));
    }

    if (options.blendMode !== undefined) {
      dict.set("BM", PdfName.of(options.blendMode));
    }

    if (options.softMask !== undefined) {
      if (options.softMask === "None") {
        dict.set("SMask", PdfName.of("None"));
      } else {
        validateSoftMaskOptions(options.softMask);

        const smask = PdfDict.of({
          S: PdfName.of(options.softMask.subtype),
          G: options.softMask.group.ref,
        });

        if (options.softMask.backdropColor) {
          smask.set(
            "BC",
            PdfArray.of(...options.softMask.backdropColor.map(value => PdfNumber.of(value))),
          );
        }

        dict.set("SMask", smask);
      }
    }

    return dict;
  }
}

function validateSoftMaskOptions(options: SoftMaskOptions): void {
  if (options.subtype === "Luminosity") {
    const groupColorSpace = options.group.group?.colorSpace;

    if (!groupColorSpace) {
      throw new Error(
        "Luminosity soft mask requires a form XObject transparency group with a colorSpace",
      );
    }
  }

  if (!options.backdropColor) {
    return;
  }

  const groupColorSpace = options.group.group?.colorSpace;

  if (!groupColorSpace) {
    throw new Error(
      "softMask.backdropColor requires the mask form XObject to define group.colorSpace",
    );
  }

  const expectedComponents = getColorSpaceComponentCount(groupColorSpace);

  if (options.backdropColor.length !== expectedComponents) {
    throw new Error(
      `softMask.backdropColor must have ${expectedComponents} components for ${groupColorSpace}, got ${options.backdropColor.length}`,
    );
  }
}

function getColorSpaceComponentCount(colorSpace: TransparencyGroupColorSpace): number {
  switch (colorSpace) {
    case "DeviceGray":
      return 1;
    case "DeviceRGB":
      return 3;
    case "DeviceCMYK":
      return 4;
  }
}
