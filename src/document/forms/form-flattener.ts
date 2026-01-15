/**
 * Form flattening - converts interactive form fields into static page content.
 *
 * This module handles the process of "baking" form field appearances into
 * the page content, making them non-interactive. After flattening:
 * - Field appearances are drawn directly in page content
 * - Widget annotations are removed from pages
 * - The form structure is cleared
 *
 * Use cases:
 * - Creating print-ready PDFs
 * - Archival (remove interactivity)
 * - PDF/A compliance (some profiles disallow forms)
 *
 * PDF Reference: Section 12.7 "Interactive Forms"
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
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

import type { ObjectRegistry } from "../object-registry";
import type { TerminalField } from "./fields";
import type { FormFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * Options for form flattening.
 */
export interface FlattenOptions {
  /** Skip appearance update (use if appearances are known good) */
  skipAppearanceUpdate?: boolean;

  /**
   * Force regeneration of all appearances even if they already exist.
   *
   * By default, existing appearances are preserved to maintain styling
   * (backgrounds, borders, rotation) that the generator cannot reproduce.
   * Set this to true to always use generated appearances with new values.
   *
   * Note: Generated appearances may lack custom styling from the original PDF.
   */
  regenerateAppearances?: boolean;

  /** Font to use when regenerating appearances */
  font?: FormFont;

  /** Font size to use (0 = auto) */
  fontSize?: number;
}

/**
 * Interface for AcroForm methods needed by the flattener.
 */
export interface FlattenableForm {
  getFields(): Promise<TerminalField[]>;
  updateAppearances(options?: { forceRegenerate?: boolean }): Promise<void>;
  getDict(): PdfDict;
  hasSignatures: boolean;
}

/**
 * Interface for page tree access.
 */
export interface PageTreeAccess {
  getPages(): PdfRef[];
}

/**
 * FormFlattener handles converting interactive form fields to static content.
 */
export class FormFlattener {
  private readonly form: FlattenableForm;
  private readonly registry: ObjectRegistry;
  private readonly pageTree: PageTreeAccess | null;

  constructor(form: FlattenableForm, registry: ObjectRegistry, pageTree: PageTreeAccess | null) {
    this.form = form;
    this.registry = registry;
    this.pageTree = pageTree;
  }

  /**
   * Flatten all form fields into static page content.
   */
  async flatten(options: FlattenOptions = {}): Promise<void> {
    // Apply font/size options if provided
    if (options.font || options.fontSize !== undefined) {
      const fields = await this.form.getFields();

      for (const field of fields) {
        // Skip read-only fields - they keep their existing appearance
        if (field.isReadOnly()) {
          continue;
        }

        if (options.font) {
          field.setFont(options.font);
        }

        if (options.fontSize !== undefined) {
          field.setFontSize(options.fontSize);
        }
      }
    }

    // Ensure appearances are up-to-date
    if (!options.skipAppearanceUpdate) {
      await this.form.updateAppearances({
        forceRegenerate: options.regenerateAppearances,
      });
    }

    // Collect widgets grouped by page
    const pageWidgets = await this.collectWidgetsByPage();

    // Process each page
    for (const { pageRef, widgets } of pageWidgets.values()) {
      await this.flattenWidgetsOnPage(pageRef, widgets);
    }

    // Clear form structure
    const dict = this.form.getDict();
    dict.set("Fields", new PdfArray([]));
    dict.delete("NeedAppearances");

    // Remove XFA for hybrid forms (per PDFBox)
    // If we flatten a hybrid PDF but leave XFA, viewers might still try to
    // render the XFA (which would now be invalid/disconnected from the flattened fields)
    dict.delete("XFA");

    // Remove SigFlags if no signatures remain (per PDFBox)
    // After flattening, signature fields are gone, so the flags are meaningless
    if (!this.form.hasSignatures) {
      dict.delete("SigFlags");
    }
  }

  /**
   * Collect all widgets grouped by their containing page.
   */
  private async collectWidgetsByPage(): Promise<
    Map<string, { pageRef: PdfRef; widgets: WidgetAnnotation[] }>
  > {
    const result = new Map<string, { pageRef: PdfRef; widgets: WidgetAnnotation[] }>();
    const fields = await this.form.getFields();

    for (const field of fields) {
      // Widgets are pre-resolved during field creation (resolveWidgets)
      for (const widget of field.getWidgets()) {
        let pageRef = widget.pageRef;

        // If widget doesn't have /P, try to find its page
        if (!pageRef) {
          pageRef = await this.findPageForWidget(widget);
        }

        if (!pageRef) {
          this.registry.addWarning(`Widget without page reference for field "${field.name}"`);
          continue;
        }

        const key = `${pageRef.objectNumber} ${pageRef.generation}`;
        let entry = result.get(key);

        if (!entry) {
          entry = { pageRef, widgets: [] };
          result.set(key, entry);
        }

        entry.widgets.push(widget);
      }
    }

    return result;
  }

  /**
   * Find the page containing a widget by scanning page /Annots arrays.
   * This is expensive but needed for widgets without /P.
   *
   * Uses the PageTree if available for efficient page iteration.
   */
  private async findPageForWidget(widget: WidgetAnnotation): Promise<PdfRef | null> {
    if (!widget.ref) {
      return null;
    }

    // Use the page tree if available
    if (!this.pageTree) {
      this.registry.addWarning("No page tree available; cannot find page for widget without /P");
      return null;
    }

    const pageRefs = this.pageTree.getPages();

    for (const pageRef of pageRefs) {
      const pageDict = await this.registry.resolve(pageRef);

      if (!(pageDict instanceof PdfDict)) {
        continue;
      }

      const annots = pageDict.getArray("Annots");

      if (!annots) {
        continue;
      }

      for (let i = 0; i < annots.length; i++) {
        const annotRef = annots.at(i);

        // PdfRefs are interned, so we can compare with ===
        if (annotRef instanceof PdfRef && annotRef === widget.ref) {
          return pageRef;
        }
      }
    }

    return null;
  }

  /**
   * Flatten widgets on a single page.
   *
   * Following PDFBox's approach, we:
   * 1. Wrap the existing page content in q...Q (save/restore graphics state)
   * 2. Append our flattened content after the Q
   *
   * This isolates the original page's graphics state from our flattened fields.
   */
  private async flattenWidgetsOnPage(pageRef: PdfRef, widgets: WidgetAnnotation[]): Promise<void> {
    const pageDict = await this.registry.resolve(pageRef);

    if (!(pageDict instanceof PdfDict)) {
      return;
    }

    // Get or create page resources
    let resources = pageDict.getDict("Resources");

    if (!resources) {
      resources = new PdfDict();
      pageDict.set("Resources", resources);
    }

    let xObjects = resources.getDict("XObject");

    if (!xObjects) {
      xObjects = new PdfDict();
      resources.set("XObject", xObjects);
    }

    // Build flattening content stream
    const content = new ContentStreamBuilder();
    const widgetRefs = new Set<string>();
    let xObjectIndex = 0;
    let hasVisibleWidgets = false;

    for (const widget of widgets) {
      // Skip hidden widgets
      if (this.isWidgetHidden(widget)) {
        continue;
      }

      // Get appearance stream
      const appearance = await widget.getNormalAppearance(widget.appearanceState ?? undefined);

      if (!appearance) {
        this.registry.addWarning("Widget without appearance stream skipped during flatten");
        continue;
      }

      // Check appearance stream has valid BBox dimensions
      if (!this.isVisibleAppearance(appearance)) {
        continue;
      }

      // Normalize appearance stream - ensure it has required XObject Form entries
      // Some PDFs have appearance streams missing /Subtype /Form which causes
      // rendering failures in some viewers (e.g., Adobe Reader)
      this.normalizeAppearanceStream(appearance);

      // Add appearance as XObject
      const xObjectName = `FlatField${xObjectIndex++}`;
      const appearanceRef = this.registry.register(appearance);
      xObjects.set(xObjectName, appearanceRef);

      // Calculate transformation matrix
      const matrix = this.calculateTransformMatrix(widget, appearance);

      // Add drawing operators
      content.add(
        pushGraphicsState(),
        concatMatrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f),
        drawXObject(`/${xObjectName}`),
        popGraphicsState(),
      );

      hasVisibleWidgets = true;

      // Track widget ref for removal
      if (widget.ref) {
        widgetRefs.add(`${widget.ref.objectNumber} ${widget.ref.generation}`);
      }
    }

    // Wrap existing content and append flattened content
    if (hasVisibleWidgets && !content.isEmpty()) {
      this.wrapAndAppendContent(pageDict, content.toBytes());
    }

    // Remove widget annotations from page
    await this.removeAnnotations(pageDict, widgetRefs);
  }

  /**
   * Check if appearance stream has valid dimensions.
   * Per PDFBox: BBox must exist and have width/height > 0.
   */
  private isVisibleAppearance(appearance: PdfStream): boolean {
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return false;
    }

    const x1 = (bbox.at(0) as PdfNumber | undefined)?.value ?? 0;
    const y1 = (bbox.at(1) as PdfNumber | undefined)?.value ?? 0;
    const x2 = (bbox.at(2) as PdfNumber | undefined)?.value ?? 0;
    const y2 = (bbox.at(3) as PdfNumber | undefined)?.value ?? 0;

    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    return width > 0 && height > 0;
  }

  /**
   * Wrap existing page content in q...Q and append new content.
   *
   * Following PDFBox's approach:
   * - Prepend "q\n" to the existing content streams
   * - Append "Q\n" + new content after
   *
   * This isolates the original page's graphics state from our additions.
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
      // No existing content - just add our content (no wrapping needed)
      page.set("Contents", suffixRef);
    } else if (existing instanceof PdfArray) {
      // Array of content streams
      // Insert prefix at start, suffix at end
      const newArray = PdfArray.of(prefixRef, ...this.getArrayItems(existing), suffixRef);
      page.set("Contents", newArray);
    } else {
      // Single stream or ref - convert to array with prefix and suffix
      page.set("Contents", PdfArray.of(prefixRef, existing, suffixRef));
    }
  }

  /**
   * Get all items from a PdfArray.
   */
  private getArrayItems(arr: PdfArray): PdfRef[] {
    const items: PdfRef[] = [];

    for (let i = 0; i < arr.length; i++) {
      const item = arr.at(i);

      if (item instanceof PdfRef) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Calculate transformation matrix to position appearance in widget rect.
   *
   * This follows PDFBox's approach:
   * 1. The appearance stream may have its own Matrix (handling rotation)
   * 2. We transform the BBox by the appearance Matrix to get "real" bounds
   * 3. We calculate a simple translate+scale to fit in the annotation rect
   *
   * Rotation is handled by the appearance stream's Matrix, NOT by this transform.
   */
  private calculateTransformMatrix(widget: WidgetAnnotation, appearance: PdfStream): Matrix {
    // Widget rectangle on page
    const [rx1, ry1, rx2, ry2] = widget.rect;
    const rectWidth = rx2 - rx1;
    const rectHeight = ry2 - ry1;

    // Get the transformed appearance bounding box
    // This accounts for any Matrix in the appearance stream
    const transformedBBox = this.getTransformedAppearanceBBox(appearance);

    // Calculate simple translate + scale (no rotation - that's in appearance Matrix)
    const scaleX = transformedBBox.width !== 0 ? rectWidth / transformedBBox.width : 1;
    const scaleY = transformedBBox.height !== 0 ? rectHeight / transformedBBox.height : 1;

    // Translate to annotation position, accounting for BBox origin
    const translateX = rx1 - transformedBBox.x * scaleX;
    const translateY = ry1 - transformedBBox.y * scaleY;

    return new Matrix(scaleX, 0, 0, scaleY, translateX, translateY);
  }

  /**
   * Get the appearance BBox transformed by the appearance's Matrix.
   *
   * The appearance stream may have a Matrix that transforms its coordinate
   * system (e.g., for rotation). We need to transform the BBox corners
   * by this matrix to get the "real" bounding box.
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
      // No transformation - return BBox as-is
      return {
        x: bx1,
        y: by1,
        width: bx2 - bx1,
        height: by2 - by1,
      };
    }

    // Transform all four corners of the BBox
    const corners = [
      matrix.transformPoint(bx1, by1), // bottom-left
      matrix.transformPoint(bx2, by1), // bottom-right
      matrix.transformPoint(bx2, by2), // top-right
      matrix.transformPoint(bx1, by2), // top-left
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
   * Get the appearance stream's transformation matrix.
   */
  private getAppearanceMatrix(appearance: PdfStream): Matrix {
    const matrixArray = appearance.getArray("Matrix");

    if (!matrixArray || matrixArray.length < 6) {
      return Matrix.identity();
    }

    return new Matrix(
      (matrixArray.at(0) as PdfNumber | undefined)?.value ?? 1,
      (matrixArray.at(1) as PdfNumber | undefined)?.value ?? 0,
      (matrixArray.at(2) as PdfNumber | undefined)?.value ?? 0,
      (matrixArray.at(3) as PdfNumber | undefined)?.value ?? 1,
      (matrixArray.at(4) as PdfNumber | undefined)?.value ?? 0,
      (matrixArray.at(5) as PdfNumber | undefined)?.value ?? 0,
    );
  }

  /**
   * Get appearance BBox, with fallback.
   */
  private getAppearanceBBox(appearance: PdfStream): [number, number, number, number] {
    // PdfStream extends PdfDict, so we call getArray directly
    const bbox = appearance.getArray("BBox");

    if (!bbox || bbox.length < 4) {
      return [0, 0, 1, 1]; // Fallback
    }

    return [
      (bbox.at(0) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(1) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(2) as PdfNumber | undefined)?.value ?? 0,
      (bbox.at(3) as PdfNumber | undefined)?.value ?? 0,
    ];
  }

  /**
   * Remove specific annotations from page.
   */
  private async removeAnnotations(page: PdfDict, toRemove: Set<string>): Promise<void> {
    // Get Annots - may be direct array or a reference to an array
    const annotsEntry = page.get("Annots");

    if (!annotsEntry) {
      return;
    }

    let annots: PdfArray | null = null;

    if (annotsEntry instanceof PdfArray) {
      annots = annotsEntry;
    } else if (annotsEntry instanceof PdfRef) {
      const resolved = await this.registry.resolve(annotsEntry);

      if (resolved instanceof PdfArray) {
        annots = resolved;
      }
    }

    if (!annots) {
      return;
    }

    const remaining: PdfRef[] = [];

    for (let i = 0; i < annots.length; i++) {
      const item = annots.at(i);

      if (item instanceof PdfRef) {
        const key = `${item.objectNumber} ${item.generation}`;

        if (!toRemove.has(key)) {
          remaining.push(item);
        }
      }
    }

    if (remaining.length === 0) {
      page.delete("Annots");
    } else if (remaining.length < annots.length) {
      // Replace the Annots entry with the filtered array
      page.set("Annots", PdfArray.of(...remaining));
    }
  }

  /**
   * Normalize an appearance stream to ensure it has required XObject Form entries.
   *
   * Per PDF spec, a Form XObject stream requires:
   * - /Subtype /Form (required)
   * - /BBox (required, should already exist for appearance streams)
   * - /FormType 1 (optional, defaults to 1)
   *
   * Some PDFs have appearance streams missing /Subtype /Form, which causes
   * Adobe Reader and other strict viewers to fail rendering.
   */
  private normalizeAppearanceStream(appearance: PdfStream): void {
    // Ensure /Subtype /Form is set (required for XObject Form)
    if (!appearance.has("Subtype")) {
      appearance.set("Subtype", PdfName.of("Form"));
    }

    // Ensure /FormType is set (optional, but good practice)
    if (!appearance.has("FormType")) {
      appearance.set("FormType", new PdfNumber(1));
    }
  }

  /**
   * Check if widget should be skipped (hidden/invisible).
   */
  private isWidgetHidden(widget: WidgetAnnotation): boolean {
    const flags = widget.flags;

    const HIDDEN = 1 << 1; // Bit 2: Hidden
    const INVISIBLE = 1 << 0; // Bit 1: Invisible
    const NO_VIEW = 1 << 5; // Bit 6: NoView

    return (flags & (HIDDEN | INVISIBLE | NO_VIEW)) !== 0;
  }
}
