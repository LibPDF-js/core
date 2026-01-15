/**
 * PDFPolygonAnnotation and PDFPolylineAnnotation - Multi-vertex shape annotations.
 *
 * Polygon annotations display a closed polygon on the page.
 * Polyline annotations display an open polyline on the page.
 *
 * PDF Reference: Section 12.5.6.9 "Polygon and Polyline Annotations"
 */

import { type Color, colorToArray } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";

import { parseColorArray } from "./base";
import { PDFMarkupAnnotation } from "./markup";
import type { LineEndingStyle, Point } from "./types";

/**
 * Base class for Polygon and Polyline annotations.
 */
abstract class PDFPolyAnnotation extends PDFMarkupAnnotation {
  /**
   * Get the vertices of the polygon/polyline.
   */
  get vertices(): Point[] {
    const verts = this.dict.getArray("Vertices");

    if (!verts) {
      return [];
    }

    const points: Point[] = [];

    for (let i = 0; i < verts.length; i += 2) {
      const x = verts.at(i);
      const y = verts.at(i + 1);

      if (x instanceof PdfNumber && y instanceof PdfNumber) {
        points.push({ x: x.value, y: y.value });
      }
    }

    return points;
  }

  /**
   * Set the vertices.
   */
  setVertices(vertices: Point[]): void {
    const arr = new PdfArray([]);

    for (const point of vertices) {
      arr.push(PdfNumber.of(point.x));
      arr.push(PdfNumber.of(point.y));
    }

    this.dict.set("Vertices", arr);
    this.markModified();
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
 * Polygon annotation - closed polygon shape.
 */
export class PDFPolygonAnnotation extends PDFPolyAnnotation {
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
   * Intent - specific to polygon annotations.
   * Can be "PolygonCloud" or "PolygonDimension".
   */
  get polygonIntent(): string | null {
    const it = this.dict.getName("IT");

    return it?.value ?? null;
  }
}

/**
 * Polyline annotation - open polyline shape.
 */
export class PDFPolylineAnnotation extends PDFPolyAnnotation {
  /**
   * Line ending styles [start, end].
   */
  get lineEndingStyles(): [LineEndingStyle, LineEndingStyle] {
    const le = this.dict.getArray("LE");

    if (!le || le.length < 2) {
      return ["None", "None"];
    }

    const startStyle = (le.at(0) as { value?: string } | null)?.value ?? "None";
    const endStyle = (le.at(1) as { value?: string } | null)?.value ?? "None";

    return [startStyle as LineEndingStyle, endStyle as LineEndingStyle];
  }

  /**
   * Set the line ending styles.
   */
  setLineEndingStyles(startStyle: LineEndingStyle, endStyle: LineEndingStyle): void {
    this.dict.set("LE", new PdfArray([PdfName.of(startStyle), PdfName.of(endStyle)]));
    this.markModified();
  }

  /**
   * Intent - specific to polyline annotations.
   * Can be "PolyLineDimension".
   */
  get polylineIntent(): string | null {
    const it = this.dict.getName("IT");

    return it?.value ?? null;
  }
}
