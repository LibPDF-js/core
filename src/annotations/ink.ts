/**
 * PDFInkAnnotation - Freehand drawing annotations.
 *
 * Ink annotations represent freehand scribbles on the page.
 * They consist of one or more disjoint paths.
 *
 * PDF Reference: Section 12.5.6.13 "Ink Annotations"
 */

import { colorToArray, rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";

import { PDFMarkupAnnotation } from "./markup";
import type { InkAnnotationOptions, Point } from "./types";

/**
 * Ink annotation - freehand drawing.
 */
export class PDFInkAnnotation extends PDFMarkupAnnotation {
  /**
   * Create a new ink annotation dictionary.
   */
  static create(options: InkAnnotationOptions): PdfDict {
    const { paths } = options;
    const color = options.color ?? rgb(0, 0, 0);
    const colorComponents = colorToArray(color);

    // Calculate bounding rect from all paths
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const path of paths) {
      for (const point of path) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    // Build InkList
    const inkList = new PdfArray([]);

    for (const path of paths) {
      const pathArr = new PdfArray([]);

      for (const point of path) {
        pathArr.push(PdfNumber.of(point.x));
        pathArr.push(PdfNumber.of(point.y));
      }

      inkList.push(pathArr);
    }

    const annotDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Ink"),
      Rect: new PdfArray([
        PdfNumber.of(minX),
        PdfNumber.of(minY),
        PdfNumber.of(maxX),
        PdfNumber.of(maxY),
      ]),
      InkList: inkList,
      C: new PdfArray(colorComponents.map(PdfNumber.of)),
      F: PdfNumber.of(4), // Print flag
    });

    // Border style for stroke width
    if (options.width !== undefined) {
      const bs = new PdfDict();
      bs.set("W", PdfNumber.of(options.width));
      bs.set("S", PdfName.of("S"));
      annotDict.set("BS", bs);
    }

    if (options.contents) {
      annotDict.set("Contents", PdfString.fromString(options.contents));
    }

    return annotDict;
  }

  /**
   * Get the ink paths.
   * Each path is an array of points.
   */
  get inkPaths(): Point[][] {
    const inkList = this.dict.getArray("InkList");

    if (!inkList) {
      return [];
    }

    const paths: Point[][] = [];

    for (let i = 0; i < inkList.length; i++) {
      const pathEntry = inkList.at(i);

      if (pathEntry && (pathEntry as { type: string }).type === "array") {
        const pathArr = pathEntry as PdfArray;
        const points: Point[] = [];

        for (let j = 0; j < pathArr.length; j += 2) {
          const x = pathArr.at(j);
          const y = pathArr.at(j + 1);

          if (x instanceof PdfNumber && y instanceof PdfNumber) {
            points.push({ x: x.value, y: y.value });
          }
        }

        paths.push(points);
      }
    }

    return paths;
  }

  /**
   * Set the ink paths.
   */
  setInkPaths(paths: Point[][]): void {
    const inkList = new PdfArray([]);

    for (const path of paths) {
      const pathArr = new PdfArray([]);

      for (const point of path) {
        pathArr.push(PdfNumber.of(point.x));
        pathArr.push(PdfNumber.of(point.y));
      }

      inkList.push(pathArr);
    }

    this.dict.set("InkList", inkList);
    this.markModified();
  }

  /**
   * Stroke width from border style.
   */
  get strokeWidth(): number {
    const bs = this.getBorderStyle();

    return bs?.width ?? 1;
  }
}
