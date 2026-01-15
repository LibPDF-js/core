/**
 * PDFSquareAnnotation and PDFCircleAnnotation - Shape annotations.
 *
 * Square annotations display a rectangle on the page.
 * Circle annotations display an ellipse on the page.
 *
 * PDF Reference: Section 12.5.6.8 "Square and Circle Annotations"
 */

import { type Color, colorToArray, rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { parseColorArray, rectToArray } from "./base";
import { PDFMarkupAnnotation } from "./markup";
import type { CircleAnnotationOptions, Rect, SquareAnnotationOptions } from "./types";

/**
 * Base class for square and circle annotations.
 */
abstract class PDFShapeAnnotation extends PDFMarkupAnnotation {
  /**
   * Interior color (fill color).
   */
  get interiorColor(): Color | null {
    const ic = this.dict.getArray("IC");

    return parseColorArray(ic);
  }

  /**
   * Set the interior color.
   */
  setInteriorColor(color: Color): void {
    const components = colorToArray(color);
    this.dict.set("IC", new PdfArray(components.map(PdfNumber.of)));
    this.markModified();
  }

  /**
   * Rectangle difference (RD) - inset of the drawing from the Rect.
   * [left, bottom, right, top] offsets.
   */
  get rectDifference(): [number, number, number, number] | null {
    const rd = this.dict.getArray("RD");

    if (!rd || rd.length < 4) {
      return null;
    }

    return [
      (rd.at(0) as PdfNumber | null)?.value ?? 0,
      (rd.at(1) as PdfNumber | null)?.value ?? 0,
      (rd.at(2) as PdfNumber | null)?.value ?? 0,
      (rd.at(3) as PdfNumber | null)?.value ?? 0,
    ];
  }

  /**
   * Get the actual drawing rectangle (Rect minus RD).
   */
  getDrawingRect(): Rect {
    const rect = this.rect;
    const rd = this.rectDifference;

    if (!rd) {
      return rect;
    }

    return {
      x: rect.x + rd[0],
      y: rect.y + rd[1],
      width: rect.width - rd[0] - rd[2],
      height: rect.height - rd[1] - rd[3],
    };
  }

  /**
   * Border width from border style.
   */
  get borderWidth(): number {
    const bs = this.getBorderStyle();

    return bs?.width ?? 1;
  }
}

/**
 * Square annotation - rectangle shape.
 */
export class PDFSquareAnnotation extends PDFShapeAnnotation {
  /**
   * Create a new square annotation dictionary.
   */
  static create(options: SquareAnnotationOptions): PdfDict {
    const { rect } = options;
    const color = options.color ?? rgb(0, 0, 0);
    const colorComponents = colorToArray(color);

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Square"),
      Rect: new PdfArray(rectToArray(rect)),
      C: new PdfArray(colorComponents.map(PdfNumber.of)),
      F: PdfNumber.of(4), // Print flag
    });

    // Border style
    if (options.borderWidth !== undefined) {
      const bs = new PdfDict();
      bs.set("W", PdfNumber.of(options.borderWidth));
      bs.set("S", PdfName.of("S"));
      annotDict.set("BS", bs);
    }

    // Interior color (fill)
    if (options.fillColor) {
      const icComponents = colorToArray(options.fillColor);
      annotDict.set("IC", new PdfArray(icComponents.map(PdfNumber.of)));
    }

    if (options.contents) {
      annotDict.set("Contents", PdfString.fromString(options.contents));
    }

    return annotDict;
  }
}

/**
 * Circle annotation - ellipse shape.
 */
export class PDFCircleAnnotation extends PDFShapeAnnotation {
  /**
   * Create a new circle annotation dictionary.
   */
  static create(options: CircleAnnotationOptions): PdfDict {
    const { rect } = options;
    const color = options.color ?? rgb(0, 0, 0);
    const colorComponents = colorToArray(color);

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Circle"),
      Rect: new PdfArray(rectToArray(rect)),
      C: new PdfArray(colorComponents.map(PdfNumber.of)),
      F: PdfNumber.of(4), // Print flag
    });

    // Border style
    if (options.borderWidth !== undefined) {
      const bs = new PdfDict();
      bs.set("W", PdfNumber.of(options.borderWidth));
      bs.set("S", PdfName.of("S"));
      annotDict.set("BS", bs);
    }

    // Interior color (fill)
    if (options.fillColor) {
      const icComponents = colorToArray(options.fillColor);
      annotDict.set("IC", new PdfArray(icComponents.map(PdfNumber.of)));
    }

    if (options.contents) {
      annotDict.set("Contents", PdfString.fromString(options.contents));
    }

    return annotDict;
  }
}
