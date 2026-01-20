/**
 * Annotation flattening - converts annotations into static page content.
 *
 * This module handles the process of "baking" annotation appearances into
 * the page content, making them non-interactive. After flattening:
 * - Annotation appearances are drawn directly in page content
 * - Annotations are removed from pages
 *
 * Use cases:
 * - Creating print-ready PDFs
 * - Archival (remove interactivity)
 * - Freezing annotations for distribution
 *
 * PDF Reference: Section 12.5 "Annotations"
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import type { ObjectRegistry } from "#src/document/object-registry";
import { Matrix } from "#src/helpers/matrix";
import {
  concatMatrix,
  drawXObject,
  popGraphicsState,
  pushGraphicsState,
} from "#src/helpers/operators";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import {
  generateHighlightAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
  generateUnderlineAppearance,
} from "./appearance";
import { PDFAnnotation } from "./base";
import { createAnnotation, isPopupAnnotation, isWidgetAnnotation } from "./factory";
import {
  PDFHighlightAnnotation,
  PDFSquigglyAnnotation,
  PDFStrikeOutAnnotation,
  PDFUnderlineAnnotation,
} from "./text-markup";
import { AnnotationFlags, type AnnotationSubtype, type FlattenAnnotationsOptions } from "./types";

/**
 * Annotation types that should never be flattened.
 *
 * - Widget: Handled by forms subsystem
 * - Link: No visual representation to flatten
 * - Popup: Auxiliary annotation, removed with parent
 */
const NON_FLATTENABLE_TYPES: AnnotationSubtype[] = ["Widget", "Link", "Popup"];

/**
 * AnnotationFlattener handles converting annotations to static page content.
 */
export class AnnotationFlattener {
  private readonly registry: ObjectRegistry;

  constructor(registry: ObjectRegistry) {
    this.registry = registry;
  }

  /**
   * Flatten annotations on a single page.
   *
   * @param pageDict The page dictionary
   * @param options Flattening options
   * @returns Number of annotations flattened
   */
  flattenPage(pageDict: PdfDict, options: FlattenAnnotationsOptions = {}): number {
    let annotsEntry = pageDict.get("Annots");

    if (!annotsEntry) {
      return 0;
    }

    if (annotsEntry instanceof PdfRef) {
      annotsEntry = this.registry.resolve(annotsEntry) ?? undefined;
    }

    let annots = annotsEntry instanceof PdfArray ? annotsEntry : null;

    if (!annots || annots.length === 0) {
      return 0;
    }

    // Get or create page resources (may be an indirect reference)
    let resources = pageDict.get("Resources");

    if (resources instanceof PdfRef) {
      resources = this.registry.resolve(resources) ?? undefined;
    }

    if (!(resources instanceof PdfDict)) {
      resources = new PdfDict();
      pageDict.set("Resources", resources);
    }

    let xObjects = resources.get("XObject");

    if (xObjects instanceof PdfRef) {
      xObjects = this.registry.resolve(xObjects) ?? undefined;
    }

    if (!(xObjects instanceof PdfDict)) {
      xObjects = new PdfDict();
      resources.set("XObject", xObjects);
    }

    // Build flattening content stream
    const content = new ContentStreamBuilder();
    const refsToRemove = new Set<string>();
    let xObjectIndex = 0;
    let flattenedCount = 0;

    // Process each annotation
    for (let i = 0; i < annots.length; i++) {
      const entry = annots.at(i);

      if (!entry) {
        continue;
      }

      let annotDict: PdfDict | null = null;
      let annotRef: PdfRef | null = null;

      if (entry instanceof PdfRef) {
        annotRef = entry;
        const resolved = this.registry.resolve(entry);

        if (resolved instanceof PdfDict) {
          annotDict = resolved;
        }
      } else if (entry instanceof PdfDict) {
        annotDict = entry;
      }

      if (!annotDict) {
        continue;
      }

      // Skip Widget annotations (handled by forms subsystem)
      if (isWidgetAnnotation(annotDict)) {
        continue;
      }

      // Skip Popup annotations (removed with parent)
      if (isPopupAnnotation(annotDict)) {
        continue;
      }

      // Get annotation subtype
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const subtype = annotDict.getName("Subtype")?.value as AnnotationSubtype | undefined;

      if (!subtype) {
        continue;
      }

      // Handle Link annotations specially
      if (subtype === "Link") {
        if (options.removeLinks) {
          // Remove Link annotations for signing security (they contain "hidden behavior")
          if (annotRef) {
            refsToRemove.add(`${annotRef.objectNumber} ${annotRef.generation}`);
          }
        }
      }

      // Skip other non-flattenable types
      if (NON_FLATTENABLE_TYPES.includes(subtype)) {
        continue;
      }

      // Check exclude list
      if (options.exclude?.includes(subtype)) {
        continue;
      }

      // Create annotation wrapper to access methods
      const annotation = createAnnotation(annotDict, annotRef, this.registry);

      // Skip hidden annotations
      if (this.isAnnotationHidden(annotation)) {
        // Still remove from page (they're hidden anyway)
        if (annotRef) {
          refsToRemove.add(`${annotRef.objectNumber} ${annotRef.generation}`);
        }
        continue;
      }

      // Get or generate appearance stream
      let appearance = annotation.getNormalAppearance();

      if (!appearance) {
        // Try to generate appearance
        appearance = this.generateAppearance(annotation);
      }

      if (!appearance) {
        // No appearance and can't generate - remove the annotation
        // (per plan: "annotations without appearances that can't be generated are removed")
        if (annotRef) {
          refsToRemove.add(`${annotRef.objectNumber} ${annotRef.generation}`);
          // Also remove associated popup
          this.markPopupForRemoval(annotDict, refsToRemove);
        }
        continue;
      }

      // Check appearance has valid dimensions
      if (!this.isVisibleAppearance(appearance)) {
        if (annotRef) {
          refsToRemove.add(`${annotRef.objectNumber} ${annotRef.generation}`);
          this.markPopupForRemoval(annotDict, refsToRemove);
        }
        continue;
      }

      // Normalize appearance stream (only if needed)
      this.normalizeAppearanceStream(appearance);

      // Add appearance as XObject - reuse existing ref if already registered
      const xObjectName = `FlatAnnot${xObjectIndex++}`;
      let appearanceRef = this.registry.getRef(appearance);

      if (!appearanceRef) {
        appearanceRef = this.registry.register(appearance);
      }

      xObjects.set(xObjectName, appearanceRef);

      // Calculate transformation matrix
      const rect = this.getAnnotationRect(annotDict);
      const matrix = this.calculateTransformMatrix(rect, appearance);

      // Add drawing operators
      content.add(
        pushGraphicsState(),
        concatMatrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f),
        drawXObject(`/${xObjectName}`),
        popGraphicsState(),
      );

      flattenedCount++;

      // Mark annotation and popup for removal
      if (annotRef) {
        refsToRemove.add(`${annotRef.objectNumber} ${annotRef.generation}`);
        this.markPopupForRemoval(annotDict, refsToRemove);
      }
    }

    // Wrap existing content and append flattened content
    if (flattenedCount > 0 && !content.isEmpty()) {
      this.wrapAndAppendContent(pageDict, content.toBytes());
    }

    // Remove flattened annotations from page
    this.removeAnnotations(pageDict, refsToRemove);

    return flattenedCount;
  }

  /**
   * Check if annotation should be skipped (hidden/invisible).
   */
  private isAnnotationHidden(annotation: PDFAnnotation): boolean {
    return (
      annotation.hasFlag(AnnotationFlags.Hidden) ||
      annotation.hasFlag(AnnotationFlags.Invisible) ||
      annotation.hasFlag(AnnotationFlags.NoView)
    );
  }

  /**
   * Generate appearance for annotation types we support.
   */
  private generateAppearance(annotation: PDFAnnotation): PdfStream | null {
    const rect = annotation.rect;

    // Use instanceof checks for annotation types instead of a switch on `type`
    if (annotation instanceof PDFHighlightAnnotation) {
      const highlight = annotation;
      const quadPoints = highlight.quadPoints;
      const color = highlight.color;
      const opacity = highlight.opacity;

      if (!color || quadPoints.length === 0) {
        return null;
      }

      const appearance = generateHighlightAppearance(quadPoints, color, rect, opacity);
      annotation.setNormalAppearance(appearance);

      return appearance;
    }

    if (annotation instanceof PDFUnderlineAnnotation) {
      const underline = annotation;
      const quadPoints = underline.quadPoints;
      const color = underline.color;

      if (!color || quadPoints.length === 0) {
        return null;
      }

      const appearance = generateUnderlineAppearance(quadPoints, color, rect);
      annotation.setNormalAppearance(appearance);

      return appearance;
    }

    if (annotation instanceof PDFStrikeOutAnnotation) {
      const strikeout = annotation;
      const quadPoints = strikeout.quadPoints;
      const color = strikeout.color;

      if (!color || quadPoints.length === 0) {
        return null;
      }

      const appearance = generateStrikeOutAppearance(quadPoints, color, rect);
      annotation.setNormalAppearance(appearance);

      return appearance;
    }

    if (annotation instanceof PDFSquigglyAnnotation) {
      const squiggly = annotation;
      const quadPoints = squiggly.quadPoints;
      const color = squiggly.color;

      if (!color || quadPoints.length === 0) {
        return null;
      }

      const appearance = generateSquigglyAppearance(quadPoints, color, rect);
      annotation.setNormalAppearance(appearance);

      return appearance;
    }

    // For other types, we can only flatten if they already have appearances
    return null;
  }

  /**
   * Mark associated popup annotation for removal.
   */
  private markPopupForRemoval(annotDict: PdfDict, refsToRemove: Set<string>): void {
    const popup = annotDict.get("Popup");

    if (popup instanceof PdfRef) {
      refsToRemove.add(`${popup.objectNumber} ${popup.generation}`);
    }
  }

  /**
   * Get annotation rectangle as [x1, y1, x2, y2].
   */
  private getAnnotationRect(annotDict: PdfDict): [number, number, number, number] {
    let rectArray = annotDict.get("Rect");

    if (rectArray instanceof PdfRef) {
      rectArray = this.registry.resolve(rectArray) ?? undefined;
    }

    let rect = rectArray instanceof PdfArray ? rectArray : null;

    if (!rect || rect.length < 4) {
      return [0, 0, 1, 1];
    }

    const [x1, y1, x2, y2] = rect
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    return [x1, y1, x2, y2];
  }

  /**
   * Calculate transformation matrix to position appearance in annotation rect.
   */
  private calculateTransformMatrix(
    rect: [number, number, number, number],
    appearance: PdfStream,
  ): Matrix {
    const [rx1, ry1, rx2, ry2] = rect;

    const rectWidth = rx2 - rx1;
    const rectHeight = ry2 - ry1;

    // Get the transformed appearance bounding box
    const transformedBBox = this.getTransformedAppearanceBBox(appearance);

    // Calculate simple translate + scale
    const scaleX = transformedBBox.width !== 0 ? rectWidth / transformedBBox.width : 1;
    const scaleY = transformedBBox.height !== 0 ? rectHeight / transformedBBox.height : 1;

    // Translate to annotation position, accounting for BBox origin
    const translateX = rx1 - transformedBBox.x * scaleX;
    const translateY = ry1 - transformedBBox.y * scaleY;

    return new Matrix(scaleX, 0, 0, scaleY, translateX, translateY);
  }

  /**
   * Get the appearance BBox transformed by the appearance's Matrix.
   */
  private getTransformedAppearanceBBox(appearance: PdfStream): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const [bx1, by1, bx2, by2] = this.getAppearanceBBox(appearance);

    // Get the appearance's Matrix (if any)
    const matrix = this.getAppearanceMatrix(appearance);

    if (matrix.isIdentity()) {
      return {
        x: bx1,
        y: by1,
        width: bx2 - bx1,
        height: by2 - by1,
      };
    }

    // Transform all four corners of the BBox
    const corners = [
      matrix.transformPoint(bx1, by1),
      matrix.transformPoint(bx2, by1),
      matrix.transformPoint(bx2, by2),
      matrix.transformPoint(bx1, by2),
    ];

    // Find the bounding box of transformed corners
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get appearance BBox, with fallback.
   */
  private getAppearanceBBox(appearance: PdfStream): [number, number, number, number] {
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return [0, 0, 1, 1];
    }

    const [x1, y1, x2, y2] = bbox
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    return [x1 ?? 0, y1 ?? 0, x2 ?? 0, y2 ?? 0];
  }

  /**
   * Get the appearance stream's transformation matrix.
   */
  private getAppearanceMatrix(appearance: PdfStream): Matrix {
    const matrixArray = appearance.getArray("Matrix");

    if (!matrixArray || matrixArray.length < 6) {
      return Matrix.identity();
    }

    const [a, b, c, d, e, f] = matrixArray
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    return new Matrix(a ?? 0, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0);
  }

  /**
   * Check if appearance stream has valid dimensions.
   */
  private isVisibleAppearance(appearance: PdfStream): boolean {
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return false;
    }

    const [x1, y1, x2, y2] = bbox
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    const width = Math.abs((x2 ?? 0) - (x1 ?? 0));
    const height = Math.abs((y2 ?? 0) - (y1 ?? 0));

    return width > 0 && height > 0;
  }

  /**
   * Normalize an appearance stream to ensure it has required XObject Form entries.
   */
  private normalizeAppearanceStream(appearance: PdfStream): void {
    if (!appearance.has("Subtype")) {
      appearance.set("Subtype", PdfName.of("Form"));
    }

    if (!appearance.has("FormType")) {
      appearance.set("FormType", PdfNumber.of(1));
    }
  }

  /**
   * Wrap existing page content in q...Q and append new content.
   */
  private wrapAndAppendContent(page: PdfDict, newContent: Uint8Array): void {
    const existing = page.get("Contents");

    // Create prefix stream with "q\n"
    const prefixBytes = new Uint8Array([0x71, 0x0a]); // "q\n"
    const prefixStream = new PdfStream(new PdfDict(), prefixBytes);
    const prefixRef = this.registry.register(prefixStream);

    // Create suffix stream with "Q\n" + new content
    const suffixBytes = new Uint8Array(2 + newContent.length);
    suffixBytes[0] = 0x51; // "Q"
    suffixBytes[1] = 0x0a; // "\n"
    suffixBytes.set(newContent, 2);
    const suffixStream = new PdfStream(new PdfDict(), suffixBytes);
    const suffixRef = this.registry.register(suffixStream);

    if (!existing) {
      // No existing content - just add our content
      page.set("Contents", suffixRef);

      return;
    }

    // If Contents is an indirect reference, resolve to check if it's an array
    let resolved = existing;

    if (existing instanceof PdfRef) {
      resolved = this.registry.resolve(existing) ?? existing;
    }

    if (resolved instanceof PdfArray) {
      // Array of content streams - insert prefix at start, suffix at end
      const items: PdfRef[] = [];

      for (let i = 0; i < resolved.length; i++) {
        const item = resolved.at(i);

        if (item instanceof PdfRef) {
          items.push(item);
        }
      }

      const newArray = PdfArray.of(prefixRef, ...items, suffixRef);

      page.set("Contents", newArray);

      return;
    }

    // Single stream or ref - convert to array with prefix and suffix
    // Use the original reference (not resolved object) to keep it as a ref
    page.set("Contents", PdfArray.of(prefixRef, existing, suffixRef));
  }

  /**
   * Remove specific annotations from page.
   *
   * IMPORTANT: If Annots is an indirect reference, we modify the array in-place
   * to preserve the indirection. This is critical for signing: if we convert
   * an indirect Annots to a direct array, then later signing will convert it
   * back to indirect, modifying the page object and potentially breaking
   * signature validation.
   */
  private removeAnnotations(page: PdfDict, toRemove: Set<string>): void {
    if (toRemove.size === 0) {
      return;
    }

    const annotsEntry = page.get("Annots");

    if (!annotsEntry) {
      return;
    }

    // Track if Annots was indirect - we need to preserve this
    const wasIndirect = annotsEntry instanceof PdfRef;
    let annots: PdfArray | undefined;

    if (annotsEntry instanceof PdfRef) {
      const resolved = this.registry.resolve(annotsEntry);
      annots = resolved instanceof PdfArray ? resolved : undefined;
    } else if (annotsEntry instanceof PdfArray) {
      annots = annotsEntry;
    }

    if (!annots) {
      return;
    }

    // Find indices to remove (in reverse order for safe removal)
    const indicesToRemove: number[] = [];

    for (let i = 0; i < annots.length; i++) {
      const item = annots.at(i);

      if (item instanceof PdfRef) {
        const key = `${item.objectNumber} ${item.generation}`;

        if (toRemove.has(key)) {
          indicesToRemove.push(i);
        }
      }
    }

    if (indicesToRemove.length === 0) {
      return;
    }

    // If Annots was indirect, modify in-place to preserve indirection
    if (wasIndirect) {
      // Remove in reverse order to maintain valid indices
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        annots.remove(indicesToRemove[i]);
      }
    } else {
      // Annots was direct - build a new array with remaining items
      const remaining: PdfRef[] = [];

      for (let i = 0; i < annots.length; i++) {
        if (!indicesToRemove.includes(i)) {
          const item = annots.at(i);

          if (item instanceof PdfRef) {
            remaining.push(item);
          }
        }
      }

      page.set("Annots", PdfArray.of(...remaining));
    }
  }
}
