/**
 * PDFPage - High-level wrapper for a PDF page.
 *
 * Provides convenient access to page properties and operations.
 * Obtained via `pdf.getPage(index)` or `pdf.getPages()`.
 *
 * @example
 * ```typescript
 * const pdf = await PDF.load(bytes);
 * const page = pdf.getPage(0);
 *
 * // Access page properties
 * console.log(`Size: ${page.width} x ${page.height}`);
 * console.log(`Rotation: ${page.rotation}`);
 *
 * // Get underlying objects for low-level access
 * const ref = page.ref;
 * const dict = page.dict;
 * ```
 */

// Annotation types
import type { PDFAnnotation } from "#src/annotations/base";
import type { PDFCaretAnnotation } from "#src/annotations/caret";
import { createAnnotation, isPopupAnnotation, isWidgetAnnotation } from "#src/annotations/factory";
import type { PDFFileAttachmentAnnotation } from "#src/annotations/file-attachment";
import type { PDFFreeTextAnnotation } from "#src/annotations/free-text";
import { PDFInkAnnotation } from "#src/annotations/ink";
import { PDFLineAnnotation } from "#src/annotations/line";
import { PDFLinkAnnotation } from "#src/annotations/link";
import type { PDFPolygonAnnotation, PDFPolylineAnnotation } from "#src/annotations/polygon";
import { PDFPopupAnnotation } from "#src/annotations/popup";
import { PDFCircleAnnotation, PDFSquareAnnotation } from "#src/annotations/square-circle";
import { PDFStampAnnotation } from "#src/annotations/stamp";
import { PDFTextAnnotation } from "#src/annotations/text";
import {
  PDFHighlightAnnotation,
  PDFSquigglyAnnotation,
  PDFStrikeOutAnnotation,
  PDFUnderlineAnnotation,
} from "#src/annotations/text-markup";
import type {
  CircleAnnotationOptions,
  InkAnnotationOptions,
  LineAnnotationOptions,
  LinkAnnotationOptions,
  RemoveAnnotationsOptions,
  SquareAnnotationOptions,
  StampAnnotationOptions,
  TextAnnotationOptions,
  TextMarkupAnnotationOptions,
} from "#src/annotations/types";
import type { Operator } from "#src/content/operators";
import { AcroForm } from "#src/document/forms/acro-form";
import { AppearanceGenerator } from "#src/document/forms/appearance-generator";
import type {
  CheckboxField,
  DropdownField,
  FormField,
  ListBoxField,
  RadioField,
  TextField,
} from "#src/document/forms/fields";
import { TerminalField } from "#src/document/forms/fields/base";
import { EmbeddedFont } from "#src/fonts/embedded-font";
import { parseFont } from "#src/fonts/font-factory";
import type { PdfFont } from "#src/fonts/pdf-font";
import { isStandard14Font } from "#src/fonts/standard-14";
import { parseToUnicode } from "#src/fonts/to-unicode";
// Annotation utilities - imported here to avoid dynamic require issues
import { black } from "#src/helpers/colors";
import {
  beginText,
  concatMatrix,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFont,
  setGraphicsState,
  setTextMatrix,
  showText,
} from "#src/helpers/operators";
import type { PDFImage } from "#src/images/pdf-image";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { getPlainText, groupCharsIntoLines } from "#src/text/line-grouper";
import { TextExtractor } from "#src/text/text-extractor";
import { searchPage } from "#src/text/text-search";
import type { ExtractTextOptions, FindTextOptions, PageText, TextMatch } from "#src/text/types";

import {
  drawCircleOps,
  drawEllipseOps,
  drawLineOps,
  drawRectangleOps,
  setFillColor,
} from "./drawing/operations";
import { PathBuilder } from "./drawing/path-builder";
import { layoutJustifiedLine, layoutText, measureText } from "./drawing/text-layout";
import type {
  DrawCircleOptions,
  DrawEllipseOptions,
  DrawImageOptions,
  DrawLineOptions,
  DrawRectangleOptions,
  DrawTextOptions,
  FontInput,
} from "./drawing/types";
import type { PDFContext } from "./pdf-context";
import type { PDFEmbeddedPage } from "./pdf-embedded-page";

/**
 * A rectangle defined by [x1, y1, x2, y2] coordinates.
 */
export interface Rectangle {
  /** Left x coordinate */
  x1: number;
  /** Bottom y coordinate */
  y1: number;
  /** Right x coordinate */
  x2: number;
  /** Top y coordinate */
  y2: number;
}

/**
 * Options for drawing an embedded page.
 *
 * **Scale vs Width/Height Priority:**
 * - If `width` is specified, it takes precedence over `scale` for horizontal sizing
 * - If `height` is specified, it takes precedence over `scale` for vertical sizing
 * - If only `width` is specified, `height` is calculated to maintain aspect ratio
 * - If only `height` is specified, `width` is calculated to maintain aspect ratio
 * - If both `width` and `height` are specified, aspect ratio may not be preserved
 * - If neither `width` nor `height` is specified, `scale` is used (default: 1.0)
 */
export interface DrawPageOptions {
  /** X position from left edge (default: 0) */
  x?: number;
  /** Y position from bottom edge (default: 0) */
  y?: number;
  /**
   * Uniform scale factor (default: 1.0).
   * Ignored if `width` or `height` is specified.
   */
  scale?: number;
  /**
   * Target width in points.
   * Takes precedence over `scale`. If specified without `height`,
   * the aspect ratio is preserved.
   */
  width?: number;
  /**
   * Target height in points.
   * Takes precedence over `scale`. If specified without `width`,
   * the aspect ratio is preserved.
   */
  height?: number;
  /** Opacity 0-1 (default: 1.0, fully opaque) */
  opacity?: number;
  /** Draw as background behind existing content (default: false = foreground) */
  background?: boolean;
}

/**
 * Options for placing a form field widget on a page.
 */
export interface DrawFieldOptions {
  /** X position from left edge of page */
  x: number;
  /** Y position from bottom edge of page */
  y: number;
  /** Widget width in points */
  width: number;
  /** Widget height in points */
  height: number;
  /** Option value (required for radio groups, ignored for other types) */
  option?: string;
}

/**
 * PDFPage wraps a page dictionary with convenient accessors.
 */
export class PDFPage {
  /** The page reference */
  readonly ref: PdfRef;

  /** The page dictionary */
  readonly dict: PdfDict;

  /** The page index (0-based) */
  readonly index: number;

  /** Document context for registering objects */
  private readonly ctx?: PDFContext;

  constructor(ref: PdfRef, dict: PdfDict, index: number, ctx?: PDFContext) {
    this.ref = ref;
    this.dict = dict;
    this.index = index;
    this.ctx = ctx;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Page Dimensions
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the MediaBox (page boundary).
   *
   * Returns the effective MediaBox, accounting for inheritance from parent pages.
   * If no MediaBox is found, returns a default US Letter size.
   */
  getMediaBox(): Rectangle {
    return this.getBox("MediaBox") ?? { x1: 0, y1: 0, x2: 612, y2: 792 };
  }

  /**
   * Get the CropBox (visible region).
   *
   * Falls back to MediaBox if CropBox is not defined.
   */
  getCropBox(): Rectangle {
    return this.getBox("CropBox") ?? this.getMediaBox();
  }

  /**
   * Get the BleedBox (printing bleed area).
   *
   * Falls back to CropBox if BleedBox is not defined.
   */
  getBleedBox(): Rectangle {
    return this.getBox("BleedBox") ?? this.getCropBox();
  }

  /**
   * Get the TrimBox (intended page dimensions after trimming).
   *
   * Falls back to CropBox if TrimBox is not defined.
   */
  getTrimBox(): Rectangle {
    return this.getBox("TrimBox") ?? this.getCropBox();
  }

  /**
   * Get the ArtBox (meaningful content area).
   *
   * Falls back to CropBox if ArtBox is not defined.
   */
  getArtBox(): Rectangle {
    return this.getBox("ArtBox") ?? this.getCropBox();
  }

  /**
   * Page width in points (based on MediaBox).
   *
   * Accounts for page rotation - if rotated 90 or 270 degrees,
   * returns the height of the MediaBox instead.
   */
  get width(): number {
    const box = this.getMediaBox();
    const rotation = this.rotation;

    if (rotation === 90 || rotation === 270) {
      return Math.abs(box.y2 - box.y1);
    }

    return Math.abs(box.x2 - box.x1);
  }

  /**
   * Page height in points (based on MediaBox).
   *
   * Accounts for page rotation - if rotated 90 or 270 degrees,
   * returns the width of the MediaBox instead.
   */
  get height(): number {
    const box = this.getMediaBox();
    const rotation = this.rotation;

    if (rotation === 90 || rotation === 270) {
      return Math.abs(box.x2 - box.x1);
    }

    return Math.abs(box.y2 - box.y1);
  }

  /**
   * Whether the page is in landscape orientation.
   *
   * A page is landscape when its width is greater than its height.
   * This accounts for page rotation.
   */
  get isLandscape(): boolean {
    return this.width > this.height;
  }

  /**
   * Whether the page is in portrait orientation.
   *
   * A page is portrait when its height is greater than or equal to its width.
   * This accounts for page rotation.
   */
  get isPortrait(): boolean {
    return this.height >= this.width;
  }

  /**
   * Page rotation in degrees (0, 90, 180, or 270).
   */
  get rotation(): 0 | 90 | 180 | 270 {
    const rotate = this.dict.get("Rotate");

    if (rotate instanceof PdfNumber) {
      const value = rotate.value % 360;
      // Normalize to 0, 90, 180, 270

      if (value === 90 || value === -270) {
        return 90;
      }

      if (value === 180 || value === -180) {
        return 180;
      }

      if (value === 270 || value === -90) {
        return 270;
      }
    }

    return 0;
  }

  /**
   * Set the page rotation.
   *
   * @param degrees - Rotation in degrees (must be 0, 90, 180, or 270)
   */
  setRotation(degrees: 0 | 90 | 180 | 270): void {
    if (degrees === 0) {
      this.dict.delete("Rotate");
    } else {
      this.dict.set("Rotate", PdfNumber.of(degrees));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Resources
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the page's Resources dictionary.
   *
   * Creates an empty one if it doesn't exist.
   */
  getResources(): PdfDict {
    let resources = this.dict.get("Resources");

    if (!(resources instanceof PdfDict)) {
      resources = new PdfDict();

      this.dict.set("Resources", resources);
    }

    return resources;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draw an embedded page onto this page.
   *
   * The embedded page (created via `pdf.embedPage()`) is drawn as a Form XObject.
   * By default, it's drawn in the foreground (on top of existing content).
   * Use `{ background: true }` to draw behind existing content.
   *
   * @param embedded - The embedded page to draw
   * @param options - Drawing options (position, scale, opacity, background)
   *
   * @example
   * ```typescript
   * // Draw a watermark centered on each page
   * const watermark = await pdf.embedPage(watermarkPdf, 0);
   *
   * for (const page of await pdf.getPages()) {
   *   page.drawPage(watermark, {
   *     x: (page.width - watermark.width) / 2,
   *     y: (page.height - watermark.height) / 2,
   *     opacity: 0.5,
   *   });
   * }
   *
   * // Draw as a background
   * page.drawPage(letterhead, { background: true });
   * ```
   */
  drawPage(embedded: PDFEmbeddedPage, options: DrawPageOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;

    // Calculate scale
    let scaleX = options.scale ?? 1;
    let scaleY = options.scale ?? 1;

    if (options.width !== undefined) {
      scaleX = options.width / embedded.width;
    }

    if (options.height !== undefined) {
      scaleY = options.height / embedded.height;
    }

    // If only width or height specified, maintain aspect ratio
    if (options.width !== undefined && options.height === undefined) {
      scaleY = scaleX;
    } else if (options.height !== undefined && options.width === undefined) {
      scaleX = scaleY;
    }

    // Add XObject to resources
    const xobjectName = this.addXObjectResource(embedded.ref);

    // Build content stream operators
    const ops: string[] = [];
    ops.push("q"); // Save graphics state

    // Set opacity if needed (via ExtGState)
    if (options.opacity !== undefined && options.opacity < 1) {
      const gsName = this.addGraphicsState({ ca: options.opacity, CA: options.opacity });
      ops.push(`/${gsName} gs`);
    }

    // Apply transformation matrix: [scaleX 0 0 scaleY x y]
    // Account for the embedded page's BBox origin
    const translateX = x - embedded.box.x1 * scaleX;
    const translateY = y - embedded.box.y1 * scaleY;
    ops.push(
      `${this.formatNumber(scaleX)} 0 0 ${this.formatNumber(scaleY)} ${this.formatNumber(translateX)} ${this.formatNumber(translateY)} cm`,
    );

    // Draw the XObject
    ops.push(`/${xobjectName} Do`);

    ops.push("Q"); // Restore graphics state

    const contentOps = ops.join("\n");

    if (options.background) {
      this.prependContent(contentOps);
    } else {
      this.appendContent(contentOps);
    }
  }

  /**
   * Draw a form field widget on this page.
   *
   * Creates a widget annotation for the field and adds it to both the field's
   * /Kids array and this page's /Annots array. The widget is sized and positioned
   * according to the options.
   *
   * For radio groups, the `option` parameter is required and specifies which
   * radio option this widget represents.
   *
   * @param field - The form field to draw
   * @param options - Position, size, and option settings
   * @throws {Error} If page has no context (not attached to a document)
   * @throws {Error} If field is not a terminal field
   * @throws {Error} If field is a signature field (use form.createSignatureField)
   * @throws {Error} If field is a radio group and option is not specified
   * @throws {Error} If radio option is invalid for the field
   *
   * @example
   * ```typescript
   * // Text field
   * await page.drawField(nameField, { x: 100, y: 700, width: 200, height: 24 });
   *
   * // Checkbox
   * await page.drawField(agreeBox, { x: 100, y: 650, width: 18, height: 18 });
   *
   * // Radio group - each option needs its own widget
   * await page.drawField(paymentRadio, { x: 100, y: 550, width: 16, height: 16, option: "Credit" });
   * await page.drawField(paymentRadio, { x: 100, y: 520, width: 16, height: 16, option: "PayPal" });
   * ```
   */
  async drawField(field: FormField, options: DrawFieldOptions): Promise<void> {
    if (!this.ctx) {
      throw new Error("Cannot draw field on page without context");
    }

    // Validate that field is a terminal field
    if (!(field instanceof TerminalField)) {
      throw new Error(`Cannot draw non-terminal field "${field.name}"`);
    }

    // Signature fields use merged field+widget model and are created via createSignatureField
    if (field.type === "signature") {
      throw new Error(
        `Signature fields cannot be drawn with drawField. ` +
          `Use form.createSignatureField() which creates the widget automatically.`,
      );
    }

    // Validate radio group option requirement
    if (field.type === "radio") {
      if (!options.option) {
        throw new Error(`Radio group "${field.name}" requires option parameter in drawField`);
      }

      // Validate option exists
      const radioField = field as RadioField;
      const availableOptions = radioField.getOptions();

      // For new radio fields, options might be in /Opt array
      const fieldDict = field.acroField();
      const optArray = fieldDict.getArray("Opt");

      if (optArray) {
        const optValues: string[] = [];

        for (let i = 0; i < optArray.length; i++) {
          const item = optArray.at(i);

          if (item?.type === "string") {
            optValues.push((item as unknown as { asString(): string }).asString());
          }
        }

        if (!optValues.includes(options.option)) {
          throw new Error(
            `Invalid option "${options.option}" for radio group "${field.name}". Available: ${optValues.join(", ")}`,
          );
        }
      } else if (availableOptions.length > 0 && !availableOptions.includes(options.option)) {
        throw new Error(
          `Invalid option "${options.option}" for radio group "${field.name}". Available: ${availableOptions.join(", ")}`,
        );
      }
    }

    // Create widget annotation dictionary
    const widgetDict = this.buildWidgetDict(field, options);

    // Add widget to field's /Kids array
    const widget = field.addWidget(widgetDict);

    // Add widget ref to page's /Annots array
    if (!widget.ref) {
      throw new Error("Widget annotation must have a reference");
    }
    this.addAnnotationRef(widget.ref);

    // Generate appearance stream for the widget
    await this.generateWidgetAppearance(field, widget, options);
  }

  /**
   * Build a widget annotation dictionary for a field.
   */
  private buildWidgetDict(field: TerminalField, options: DrawFieldOptions): PdfDict {
    const { x, y, width, height } = options;

    const fieldRef = field.getRef();
    if (!fieldRef) {
      throw new Error("Field must be registered before adding widgets");
    }

    // Create basic widget dict
    const widgetDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Widget"),
      Rect: new PdfArray([
        PdfNumber.of(x),
        PdfNumber.of(y),
        PdfNumber.of(x + width),
        PdfNumber.of(y + height),
      ]),
      P: this.ref,
      Parent: fieldRef,
      F: PdfNumber.of(4), // Print flag
    });

    // Get field's styling metadata
    const fieldDict = field.acroField();

    // Build MK (appearance characteristics) dictionary
    const mk = new PdfDict();
    let hasMk = false;

    // Background color
    const bg = fieldDict.getArray("_BG");

    if (bg) {
      mk.set("BG", bg);
      hasMk = true;
    }

    // Border color
    const bc = fieldDict.getArray("_BC");

    if (bc) {
      mk.set("BC", bc);
      hasMk = true;
    }

    // Rotation
    const r = fieldDict.getNumber("_R");

    if (r) {
      mk.set("R", r);
      hasMk = true;
    }

    if (hasMk) {
      widgetDict.set("MK", mk);
    }

    // Border style
    const bw = fieldDict.getNumber("_BW");

    if (bw) {
      const bs = PdfDict.of({
        W: bw,
        S: PdfName.of("S"), // Solid
      });
      widgetDict.set("BS", bs);
    }

    // For radio buttons, set the appearance state
    if (field.type === "radio" && options.option) {
      const radioField = field as RadioField;
      const currentValue = radioField.getValue();

      // Set appearance state to option value if selected, otherwise "Off"
      widgetDict.set("AS", PdfName.of(currentValue === options.option ? options.option : "Off"));
    }

    // For checkboxes, set the appearance state
    if (field.type === "checkbox") {
      const checkboxField = field as CheckboxField;
      const isChecked = checkboxField.isChecked();
      const onValue = checkboxField.getOnValue();
      widgetDict.set("AS", PdfName.of(isChecked ? onValue : "Off"));
    }

    return widgetDict;
  }

  /**
   * Generate appearance stream for a widget.
   */
  private async generateWidgetAppearance(
    field: TerminalField,
    widget: import("#src/document/forms/widget-annotation").WidgetAnnotation,
    options: DrawFieldOptions,
  ): Promise<void> {
    if (!this.ctx) {
      return;
    }

    // We need access to AcroForm for appearance generation
    // Load it via catalog
    const catalogDict = this.ctx.catalog.getDict();
    const acroForm = await AcroForm.load(catalogDict, this.ctx.registry);

    if (!acroForm) {
      return;
    }

    const generator = new AppearanceGenerator(acroForm, this.ctx.registry);

    switch (field.type) {
      case "text": {
        const textField = field as TextField;
        const stream = generator.generateTextAppearance(textField, widget);
        widget.setNormalAppearance(stream);
        break;
      }

      case "checkbox": {
        const checkboxField = field as CheckboxField;
        const onValue = checkboxField.getOnValue();
        const { on, off } = generator.generateCheckboxAppearance(checkboxField, widget, onValue);
        widget.setNormalAppearance(on, onValue);
        widget.setNormalAppearance(off, "Off");
        break;
      }

      case "radio": {
        const radioField = field as RadioField;
        // options.option is validated in drawField() before reaching here
        if (!options.option) {
          throw new Error("Radio field requires an option value");
        }
        const { selected, off } = generator.generateRadioAppearance(
          radioField,
          widget,
          options.option,
        );
        widget.setNormalAppearance(selected, options.option);
        widget.setNormalAppearance(off, "Off");
        break;
      }

      case "dropdown": {
        const dropdownField = field as DropdownField;
        const stream = generator.generateDropdownAppearance(dropdownField, widget);
        widget.setNormalAppearance(stream);
        break;
      }

      case "listbox": {
        const listboxField = field as ListBoxField;
        const stream = generator.generateListBoxAppearance(listboxField, widget);
        widget.setNormalAppearance(stream);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Shape Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draw a rectangle on the page.
   *
   * @example
   * ```typescript
   * // Filled rectangle
   * page.drawRectangle({
   *   x: 50, y: 500, width: 200, height: 100,
   *   color: rgb(0.95, 0.95, 0.95),
   * });
   *
   * // Stroked rectangle with rounded corners
   * page.drawRectangle({
   *   x: 50, y: 500, width: 200, height: 100,
   *   borderColor: rgb(0, 0, 0),
   *   borderWidth: 2,
   *   cornerRadius: 10,
   * });
   * ```
   */
  drawRectangle(options: DrawRectangleOptions): void {
    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsStateForOpacity(options.opacity, options.borderOpacity);
    }

    // Calculate rotation center if rotating
    let rotate: { angle: number; originX: number; originY: number } | undefined;

    if (options.rotate) {
      const originX = options.rotate.origin?.x ?? options.x + options.width / 2;
      const originY = options.rotate.origin?.y ?? options.y + options.height / 2;
      rotate = { angle: options.rotate.angle, originX, originY };
    }

    const ops = drawRectangleOps({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      fillColor: options.color,
      strokeColor: options.borderColor,
      strokeWidth: options.borderWidth,
      dashArray: options.borderDashArray,
      dashPhase: options.borderDashPhase,
      cornerRadius: options.cornerRadius,
      graphicsStateName: gsName ?? undefined,
      rotate,
    });

    this.appendOperators(ops);
  }

  /**
   * Draw a line on the page.
   *
   * @example
   * ```typescript
   * page.drawLine({
   *   start: { x: 50, y: 500 },
   *   end: { x: 550, y: 500 },
   *   color: rgb(0, 0, 0),
   *   thickness: 1,
   * });
   *
   * // Dashed line
   * page.drawLine({
   *   start: { x: 50, y: 450 },
   *   end: { x: 550, y: 450 },
   *   color: rgb(0, 0, 0),
   *   dashArray: [5, 3],
   * });
   * ```
   */
  drawLine(options: DrawLineOptions): void {
    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined) {
      gsName = this.registerGraphicsStateForOpacity(undefined, options.opacity);
    }

    const ops = drawLineOps({
      startX: options.start.x,
      startY: options.start.y,
      endX: options.end.x,
      endY: options.end.y,
      color: options.color ?? black,
      thickness: options.thickness,
      dashArray: options.dashArray,
      dashPhase: options.dashPhase,
      lineCap: options.lineCap,
      graphicsStateName: gsName ?? undefined,
    });

    this.appendOperators(ops);
  }

  /**
   * Draw a circle on the page.
   *
   * @example
   * ```typescript
   * page.drawCircle({
   *   x: 300, y: 400,
   *   radius: 50,
   *   color: rgb(1, 0, 0),
   *   borderColor: rgb(0, 0, 0),
   *   borderWidth: 2,
   * });
   * ```
   */
  drawCircle(options: DrawCircleOptions): void {
    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsStateForOpacity(options.opacity, options.borderOpacity);
    }

    const ops = drawCircleOps({
      cx: options.x,
      cy: options.y,
      radius: options.radius,
      fillColor: options.color,
      strokeColor: options.borderColor,
      strokeWidth: options.borderWidth,
      graphicsStateName: gsName ?? undefined,
    });

    this.appendOperators(ops);
  }

  /**
   * Draw an ellipse on the page.
   *
   * @example
   * ```typescript
   * page.drawEllipse({
   *   x: 300, y: 400,
   *   xRadius: 100,
   *   yRadius: 50,
   *   color: rgb(0, 0, 1),
   * });
   * ```
   */
  drawEllipse(options: DrawEllipseOptions): void {
    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsStateForOpacity(options.opacity, options.borderOpacity);
    }

    // Calculate rotation center if rotating
    let rotate: { angle: number; originX: number; originY: number } | undefined;

    if (options.rotate) {
      const originX = options.rotate.origin?.x ?? options.x;
      const originY = options.rotate.origin?.y ?? options.y;
      rotate = { angle: options.rotate.angle, originX, originY };
    }

    const ops = drawEllipseOps({
      cx: options.x,
      cy: options.y,
      rx: options.xRadius,
      ry: options.yRadius,
      fillColor: options.color,
      strokeColor: options.borderColor,
      strokeWidth: options.borderWidth,
      graphicsStateName: gsName ?? undefined,
      rotate,
    });

    this.appendOperators(ops);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draw text on the page.
   *
   * For multiline text, set `maxWidth` to enable word wrapping.
   * Text containing `\n` will always create line breaks.
   *
   * @example
   * ```typescript
   * // Simple text
   * page.drawText("Hello, World!", {
   *   x: 50,
   *   y: 700,
   *   size: 24,
   *   color: rgb(0, 0, 0),
   * });
   *
   * // With a different font
   * page.drawText("Bold Title", {
   *   x: 50,
   *   y: 650,
   *   font: StandardFonts.TimesBold,
   *   size: 18,
   * });
   *
   * // Multiline with wrapping
   * page.drawText(longText, {
   *   x: 50,
   *   y: 600,
   *   maxWidth: 500,
   *   lineHeight: 18,
   *   alignment: "justify",
   * });
   * ```
   */
  drawText(text: string, options: DrawTextOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const font = options.font ?? "Helvetica";
    const fontSize = options.size ?? 12;
    const color = options.color ?? black;
    const lineHeight = options.lineHeight ?? fontSize * 1.2;
    const alignment = options.alignment ?? "left";

    // Register font and get its name
    const fontName = this.addFontResource(font);

    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined && options.opacity < 1) {
      gsName = this.registerGraphicsStateForOpacity(options.opacity, undefined);
    }

    // Layout the text if multiline
    let lines: { text: string; width: number }[];

    if (options.maxWidth !== undefined) {
      const layout = layoutText(text, font, fontSize, options.maxWidth, lineHeight);
      lines = layout.lines;
    } else {
      // Split on explicit line breaks only
      lines = text.split(/\r\n|\r|\n/).map(line => ({
        text: line,
        width: measureText(line, font, fontSize),
      }));
    }

    // Build operators
    const ops: Operator[] = [pushGraphicsState()];

    if (gsName) {
      ops.push(setGraphicsState(gsName));
    }

    // Apply rotation if specified
    if (options.rotate) {
      const originX = options.rotate.origin?.x ?? x;
      const originY = options.rotate.origin?.y ?? y;
      const rad = (options.rotate.angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      ops.push(concatMatrix(1, 0, 0, 1, originX, originY));
      ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));
      ops.push(concatMatrix(1, 0, 0, 1, -originX, -originY));
    }

    // Set fill color for text
    ops.push(setFillColor(color));

    ops.push(beginText());
    ops.push(setFont(`/${fontName}`, fontSize));

    // Draw each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineY = y - i * lineHeight;

      if (line.text === "") {
        continue; // Skip empty lines (they still contribute to height)
      }

      // Calculate x position based on alignment
      let lineX = x;

      if (alignment === "center" && options.maxWidth !== undefined) {
        lineX = x + (options.maxWidth - line.width) / 2;
      } else if (alignment === "right" && options.maxWidth !== undefined) {
        lineX = x + options.maxWidth - line.width;
      }

      if (alignment === "justify" && options.maxWidth !== undefined && i < lines.length - 1) {
        // Justified text - draw each word separately
        const words = line.text.split(/\s+/).filter(w => w.length > 0);

        if (words.length > 1) {
          const positioned = layoutJustifiedLine(words, font, fontSize, options.maxWidth);

          for (const pw of positioned) {
            ops.push(setTextMatrix(1, 0, 0, 1, x + pw.x, lineY));
            ops.push(showText(this.encodeTextForFont(pw.word, font)));
          }

          continue;
        }
      }

      // Normal line drawing
      ops.push(setTextMatrix(1, 0, 0, 1, lineX, lineY));
      ops.push(showText(this.encodeTextForFont(line.text, font)));
    }

    ops.push(endText());
    ops.push(popGraphicsState());

    this.appendOperators(ops);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Image Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Draw an image on the page.
   *
   * If only width or height is specified, aspect ratio is preserved.
   * If neither is specified, image is drawn at natural size (in points).
   *
   * @example
   * ```typescript
   * const image = await pdf.embedImage(jpegBytes);
   *
   * // Draw at natural size
   * page.drawImage(image, { x: 50, y: 500 });
   *
   * // Scale to width, preserving aspect ratio
   * page.drawImage(image, { x: 50, y: 400, width: 200 });
   *
   * // With rotation
   * page.drawImage(image, {
   *   x: 300, y: 400,
   *   width: 100, height: 100,
   *   rotate: { angle: 45 },
   * });
   * ```
   */
  drawImage(image: PDFImage, options: DrawImageOptions = {}): void {
    const x = options.x ?? 0;
    const y = options.y ?? 0;

    // Calculate dimensions
    let width: number;
    let height: number;

    if (options.width !== undefined && options.height !== undefined) {
      // Both specified - use as is (may distort)
      width = options.width;
      height = options.height;
    } else if (options.width !== undefined) {
      // Width specified - calculate height from aspect ratio
      width = options.width;
      height = width / image.aspectRatio;
    } else if (options.height !== undefined) {
      // Height specified - calculate width from aspect ratio
      height = options.height;
      width = height * image.aspectRatio;
    } else {
      // Neither specified - use natural size in points
      width = image.widthInPoints;
      height = image.heightInPoints;
    }

    // Add image XObject to resources
    const imageName = this.addXObjectResource(image.ref);

    // Build operators
    const ops: string[] = [];
    ops.push("q"); // Save graphics state

    // Apply opacity if needed
    if (options.opacity !== undefined && options.opacity < 1) {
      const gsName = this.addGraphicsState({ ca: options.opacity, CA: options.opacity });
      ops.push(`/${gsName} gs`);
    }

    // Apply rotation if specified
    if (options.rotate) {
      const originX = options.rotate.origin?.x ?? x + width / 2;
      const originY = options.rotate.origin?.y ?? y + height / 2;
      const rad = (options.rotate.angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Translate to origin, rotate, translate back
      ops.push(`1 0 0 1 ${this.formatNumber(originX)} ${this.formatNumber(originY)} cm`);
      ops.push(
        `${this.formatNumber(cos)} ${this.formatNumber(sin)} ${this.formatNumber(-sin)} ${this.formatNumber(cos)} 0 0 cm`,
      );
      ops.push(`1 0 0 1 ${this.formatNumber(-originX)} ${this.formatNumber(-originY)} cm`);
    }

    // Apply transformation matrix to scale and position
    // Image XObjects are 1x1 unit, so we scale to desired size
    ops.push(
      `${this.formatNumber(width)} 0 0 ${this.formatNumber(height)} ${this.formatNumber(x)} ${this.formatNumber(y)} cm`,
    );

    // Draw the image
    ops.push(`/${imageName} Do`);

    ops.push("Q"); // Restore graphics state

    this.appendContent(ops.join("\n"));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Path Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start building a custom path.
   *
   * Returns a PathBuilder with a fluent API for constructing paths.
   * The path is drawn when you call stroke(), fill(), or fillAndStroke().
   *
   * @example
   * ```typescript
   * // Triangle
   * page.drawPath()
   *   .moveTo(100, 100)
   *   .lineTo(200, 100)
   *   .lineTo(150, 200)
   *   .close()
   *   .fill({ color: rgb(1, 0, 0) });
   *
   * // Complex shape
   * page.drawPath()
   *   .moveTo(50, 50)
   *   .curveTo(100, 100, 150, 100, 200, 50)
   *   .lineTo(200, 150)
   *   .close()
   *   .fillAndStroke({
   *     color: rgb(0.9, 0.9, 1),
   *     borderColor: rgb(0, 0, 1),
   *   });
   * ```
   */
  drawPath(): PathBuilder {
    return new PathBuilder(
      content => this.appendContent(content),
      (fillOpacity, strokeOpacity) =>
        this.registerGraphicsStateForOpacity(fillOpacity, strokeOpacity),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Annotations
  // ─────────────────────────────────────────────────────────────────────────────

  /** Cached annotations for this page */
  private _annotationCache: PDFAnnotation[] | null = null;

  /**
   * Get all annotations on this page (excludes Widget and Popup annotations).
   *
   * Widget annotations are handled by the forms subsystem via PDFForm.
   * Popup annotations are accessed via annotation.getPopup().
   *
   * Results are cached - repeated calls return the same instances.
   * The cache is invalidated when annotations are added or removed.
   *
   * @returns Array of annotation objects
   *
   * @example
   * ```typescript
   * const annotations = await page.getAnnotations();
   * for (const annot of annotations) {
   *   console.log(annot.type, annot.contents);
   * }
   * ```
   */
  async getAnnotations(): Promise<PDFAnnotation[]> {
    if (this._annotationCache) {
      return this._annotationCache;
    }

    const annotations: PDFAnnotation[] = [];
    const annotsArray = this.dict.getArray("Annots");

    if (!annotsArray || !this.ctx) {
      this._annotationCache = annotations;

      return annotations;
    }

    for (let i = 0; i < annotsArray.length; i++) {
      const entry = annotsArray.at(i);

      if (!entry) {
        continue;
      }

      let annotDict: PdfDict | null = null;
      let annotRef: PdfRef | null = null;

      if (entry instanceof PdfRef) {
        annotRef = entry;
        const resolved = await this.ctx.resolve(entry);

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

      // Skip Popup annotations (accessed via parent annotation)
      if (isPopupAnnotation(annotDict)) {
        continue;
      }

      annotations.push(createAnnotation(annotDict, annotRef, this.ctx.registry));
    }

    this._annotationCache = annotations;

    return annotations;
  }

  /**
   * Get all popup annotations on this page.
   *
   * Popups are typically accessed via their parent markup annotation
   * using `annotation.getPopup()`, but this method allows direct access.
   */
  async getPopupAnnotations(): Promise<PDFPopupAnnotation[]> {
    const popups: PDFPopupAnnotation[] = [];
    const annotsArray = this.dict.getArray("Annots");

    if (!annotsArray || !this.ctx) {
      return popups;
    }

    for (let i = 0; i < annotsArray.length; i++) {
      const entry = annotsArray.at(i);

      if (!entry) {
        continue;
      }

      let annotDict: PdfDict | null = null;
      let annotRef: PdfRef | null = null;

      if (entry instanceof PdfRef) {
        annotRef = entry;
        const resolved = await this.ctx.resolve(entry);

        if (resolved instanceof PdfDict) {
          annotDict = resolved;
        }
      } else if (entry instanceof PdfDict) {
        annotDict = entry;
      }

      if (!annotDict || !isPopupAnnotation(annotDict)) {
        continue;
      }

      popups.push(new PDFPopupAnnotation(annotDict, annotRef, this.ctx.registry));
    }

    return popups;
  }

  // Type-specific annotation getters

  /**
   * Get all highlight annotations on this page.
   */
  async getHighlightAnnotations(): Promise<PDFHighlightAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFHighlightAnnotation => a.type === "Highlight");
  }

  /**
   * Get all underline annotations on this page.
   */
  async getUnderlineAnnotations(): Promise<PDFUnderlineAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFUnderlineAnnotation => a.type === "Underline");
  }

  /**
   * Get all strikeout annotations on this page.
   */
  async getStrikeOutAnnotations(): Promise<PDFStrikeOutAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFStrikeOutAnnotation => a.type === "StrikeOut");
  }

  /**
   * Get all squiggly annotations on this page.
   */
  async getSquigglyAnnotations(): Promise<PDFSquigglyAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFSquigglyAnnotation => a.type === "Squiggly");
  }

  /**
   * Get all link annotations on this page.
   */
  async getLinkAnnotations(): Promise<PDFLinkAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFLinkAnnotation => a.type === "Link");
  }

  /**
   * Get all text annotations (sticky notes) on this page.
   */
  async getTextAnnotations(): Promise<PDFTextAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFTextAnnotation => a.type === "Text");
  }

  /**
   * Get all free text annotations on this page.
   */
  async getFreeTextAnnotations(): Promise<PDFFreeTextAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFFreeTextAnnotation => a.type === "FreeText");
  }

  /**
   * Get all line annotations on this page.
   */
  async getLineAnnotations(): Promise<PDFLineAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFLineAnnotation => a.type === "Line");
  }

  /**
   * Get all square annotations on this page.
   */
  async getSquareAnnotations(): Promise<PDFSquareAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFSquareAnnotation => a.type === "Square");
  }

  /**
   * Get all circle annotations on this page.
   */
  async getCircleAnnotations(): Promise<PDFCircleAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFCircleAnnotation => a.type === "Circle");
  }

  /**
   * Get all stamp annotations on this page.
   */
  async getStampAnnotations(): Promise<PDFStampAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFStampAnnotation => a.type === "Stamp");
  }

  /**
   * Get all ink annotations on this page.
   */
  async getInkAnnotations(): Promise<PDFInkAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFInkAnnotation => a.type === "Ink");
  }

  /**
   * Get all polygon annotations on this page.
   */
  async getPolygonAnnotations(): Promise<PDFPolygonAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFPolygonAnnotation => a.type === "Polygon");
  }

  /**
   * Get all polyline annotations on this page.
   */
  async getPolylineAnnotations(): Promise<PDFPolylineAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFPolylineAnnotation => a.type === "PolyLine");
  }

  /**
   * Get all caret annotations on this page.
   */
  async getCaretAnnotations(): Promise<PDFCaretAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFCaretAnnotation => a.type === "Caret");
  }

  /**
   * Get all file attachment annotations on this page.
   */
  async getFileAttachmentAnnotations(): Promise<PDFFileAttachmentAnnotation[]> {
    const annotations = await this.getAnnotations();

    return annotations.filter((a): a is PDFFileAttachmentAnnotation => a.type === "FileAttachment");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Adding Annotations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a highlight annotation.
   *
   * @param options - Highlight options (rect, rects, or quadPoints)
   * @returns The created annotation
   *
   * @example
   * ```typescript
   * // Simple rect for horizontal text
   * page.addHighlightAnnotation({
   *   rect: { x: 100, y: 680, width: 200, height: 20 },
   *   color: rgb(1, 1, 0),
   * });
   *
   * // Multiple rects for multi-line selection
   * page.addHighlightAnnotation({
   *   rects: [
   *     { x: 100, y: 700, width: 400, height: 14 },
   *     { x: 100, y: 680, width: 250, height: 14 },
   *   ],
   *   color: rgb(1, 1, 0),
   * });
   * ```
   */
  addHighlightAnnotation(options: TextMarkupAnnotationOptions): PDFHighlightAnnotation {
    return this.addTextMarkupAnnotation("Highlight", options) as PDFHighlightAnnotation;
  }

  /**
   * Add an underline annotation.
   */
  addUnderlineAnnotation(options: TextMarkupAnnotationOptions): PDFUnderlineAnnotation {
    return this.addTextMarkupAnnotation("Underline", options) as PDFUnderlineAnnotation;
  }

  /**
   * Add a strikeout annotation.
   */
  addStrikeOutAnnotation(options: TextMarkupAnnotationOptions): PDFStrikeOutAnnotation {
    return this.addTextMarkupAnnotation("StrikeOut", options) as PDFStrikeOutAnnotation;
  }

  /**
   * Add a squiggly underline annotation.
   */
  addSquigglyAnnotation(options: TextMarkupAnnotationOptions): PDFSquigglyAnnotation {
    return this.addTextMarkupAnnotation("Squiggly", options) as PDFSquigglyAnnotation;
  }

  /**
   * Add a text markup annotation (internal helper).
   */
  private addTextMarkupAnnotation(
    subtype: "Highlight" | "Underline" | "StrikeOut" | "Squiggly",
    options: TextMarkupAnnotationOptions,
  ): PDFAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    // Use the static create method on the appropriate class
    let annotDict: PdfDict;

    switch (subtype) {
      case "Highlight":
        annotDict = PDFHighlightAnnotation.create(options);
        break;
      case "Underline":
        annotDict = PDFUnderlineAnnotation.create(options);
        break;
      case "StrikeOut":
        annotDict = PDFStrikeOutAnnotation.create(options);
        break;
      case "Squiggly":
        annotDict = PDFSquigglyAnnotation.create(options);
        break;
    }

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry);
  }

  /**
   * Add a link annotation.
   *
   * @param options - Link options (uri or destination)
   * @returns The created annotation
   *
   * @example
   * ```typescript
   * // External link
   * page.addLinkAnnotation({
   *   rect: { x: 100, y: 600, width: 200, height: 20 },
   *   uri: "https://example.com",
   * });
   *
    * // Internal link to another page (recommended)
    * page.addLinkAnnotation({
    *   rect: { x: 100, y: 550, width: 200, height: 20 },
    *   destination: { page: otherPage, type: "Fit" },
    * });
    *
    * // Or using a page reference directly
    * page.addLinkAnnotation({
    *   rect: { x: 100, y: 520, width: 200, height: 20 },
    *   destination: { page: otherPage.ref, type: "Fit" },
    * });

   * ```
   */
  addLinkAnnotation(options: LinkAnnotationOptions): PDFLinkAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const destination = options.destination;

    if (destination) {
      const destinationPage = destination.page;

      const destinationPageRef =
        destinationPage instanceof PDFPage ? destinationPage.ref : destinationPage;

      if (!(destinationPageRef instanceof PdfRef)) {
        throw new Error("Link destination page must be a PDFPage or PdfRef");
      }

      const pageRefs = this.ctx.pages.getPages();
      const matchesPage = pageRefs.some(
        ref =>
          ref.objectNumber === destinationPageRef.objectNumber &&
          ref.generation === destinationPageRef.generation,
      );

      if (!matchesPage) {
        throw new Error("Link destination page ref not found in document");
      }
    }

    const annotDict = PDFLinkAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFLinkAnnotation;
  }

  /**
   * Add a text annotation (sticky note).
   *
   * @param options - Text annotation options
   * @returns The created annotation
   */
  addTextAnnotation(options: TextAnnotationOptions): PDFTextAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFTextAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFTextAnnotation;
  }

  /**
   * Add a line annotation.
   *
   * @param options - Line annotation options
   * @returns The created annotation
   */
  addLineAnnotation(options: LineAnnotationOptions): PDFLineAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFLineAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFLineAnnotation;
  }

  /**
   * Add a square (rectangle) annotation.
   *
   * @param options - Square annotation options
   * @returns The created annotation
   */
  addSquareAnnotation(options: SquareAnnotationOptions): PDFSquareAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFSquareAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFSquareAnnotation;
  }

  /**
   * Add a circle (ellipse) annotation.
   *
   * @param options - Circle annotation options
   * @returns The created annotation
   */
  addCircleAnnotation(options: CircleAnnotationOptions): PDFCircleAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFCircleAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFCircleAnnotation;
  }

  /**
   * Add a stamp annotation.
   *
   * @param options - Stamp annotation options
   * @returns The created annotation
   */
  addStampAnnotation(options: StampAnnotationOptions): PDFStampAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFStampAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFStampAnnotation;
  }

  /**
   * Add an ink (freehand drawing) annotation.
   *
   * @param options - Ink annotation options
   * @returns The created annotation
   */
  addInkAnnotation(options: InkAnnotationOptions): PDFInkAnnotation {
    if (!this.ctx) {
      throw new Error("Cannot add annotation to page without context");
    }

    const annotDict = PDFInkAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFInkAnnotation;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Removing Annotations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Remove a specific annotation from the page.
   *
   * Also removes any linked Popup annotation.
   *
   * @param annotation - The annotation to remove
   *
   * @example
   * ```typescript
   * const highlights = await page.getHighlightAnnotations();
   * await page.removeAnnotation(highlights[0]);
   * ```
   */
  async removeAnnotation(annotation: PDFAnnotation): Promise<void> {
    if (!this.ctx) {
      return;
    }

    const annots = this.dict.getArray("Annots");

    if (!annots) {
      return;
    }

    const removeMatchingEntry = (predicate: (entry: unknown) => boolean): void => {
      for (let i = 0; i < annots.length; i++) {
        const entry = annots.at(i);

        if (predicate(entry)) {
          annots.remove(i);
          return;
        }
      }
    };

    const annotRef = annotation.ref;

    if (annotRef) {
      // Find and remove the annotation reference
      removeMatchingEntry(
        entry =>
          entry instanceof PdfRef &&
          entry.objectNumber === annotRef.objectNumber &&
          entry.generation === annotRef.generation,
      );
    } else {
      // Direct annotation dict entry
      removeMatchingEntry(entry => entry instanceof PdfDict && entry === annotation.dict);
    }

    // Check if the annotation has an associated Popup to remove
    const popup = annotation.dict.get("Popup");

    if (popup instanceof PdfRef) {
      removeMatchingEntry(
        entry =>
          entry instanceof PdfRef &&
          entry.objectNumber === popup.objectNumber &&
          entry.generation === popup.generation,
      );
    } else if (popup instanceof PdfDict) {
      removeMatchingEntry(entry => entry instanceof PdfDict && entry === popup);
    }

    this.invalidateAnnotationCache();
  }

  /**
   * Remove annotations from the page.
   *
   * Without options, removes all annotations (except Widget annotations).
   * With type filter, removes only annotations of the specified type.
   *
   * @param options - Optional filter by annotation type
   *
   * @example
   * ```typescript
   * // Remove all highlights
   * await page.removeAnnotations({ type: "Highlight" });
   *
   * // Remove all annotations
   * await page.removeAnnotations();
   * ```
   */
  async removeAnnotations(options?: RemoveAnnotationsOptions): Promise<void> {
    const annotations = await this.getAnnotations();

    let toRemove = annotations;

    if (options?.type) {
      toRemove = annotations.filter(a => a.type === options.type);
    }

    for (const annotation of toRemove) {
      await this.removeAnnotation(annotation);
    }
  }

  /**
   * Add an annotation reference to the page's /Annots array.
   * Internal method - also invalidates the annotation cache.
   */
  private addAnnotationRef(annotRef: PdfRef): void {
    let annots = this.dict.getArray("Annots");

    if (!annots) {
      annots = new PdfArray([]);
      this.dict.set("Annots", annots);
    }

    annots.push(annotRef);
    this.invalidateAnnotationCache();
  }

  /**
   * Invalidate the annotation cache.
   * Called when annotations are added or removed.
   */
  private invalidateAnnotationCache(): void {
    this._annotationCache = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add an XObject reference to the page's resources.
   * Returns the name assigned to the XObject.
   */
  private addXObjectResource(ref: PdfRef): string {
    const resources = this.getResources();
    let xobjects = resources.get("XObject");

    if (!(xobjects instanceof PdfDict)) {
      xobjects = new PdfDict();
      resources.set("XObject", xobjects);
    }

    // Generate unique name
    const name = this.generateUniqueName(xobjects, "Fm");
    xobjects.set(name, ref);

    return name;
  }

  /**
   * Add a graphics state to the page's resources.
   * Returns the name assigned to the ExtGState.
   */
  private addGraphicsState(params: { ca?: number; CA?: number }): string {
    const resources = this.getResources();
    let extGState = resources.get("ExtGState");

    if (!(extGState instanceof PdfDict)) {
      extGState = new PdfDict();
      resources.set("ExtGState", extGState);
    }

    // Create the graphics state dict
    const gsDict = new PdfDict();

    if (params.ca !== undefined) {
      gsDict.set("ca", PdfNumber.of(params.ca)); // Stroke opacity
    }

    if (params.CA !== undefined) {
      gsDict.set("CA", PdfNumber.of(params.CA)); // Fill opacity
    }

    // Generate unique name
    const name = this.generateUniqueName(extGState, "GS");
    extGState.set(name, gsDict);

    return name;
  }

  /**
   * Generate a unique name not already in the dictionary.
   */
  private generateUniqueName(dict: PdfDict, prefix: string): string {
    let counter = 0;
    let name = `${prefix}${counter}`;

    while (dict.has(name)) {
      counter++;
      name = `${prefix}${counter}`;
    }

    return name;
  }

  /**
   * Format a number for PDF content stream (avoid unnecessary decimals).
   */
  private formatNumber(n: number): string {
    // Round to 4 decimal places to avoid floating point noise
    const rounded = Math.round(n * 10000) / 10000;

    // Use integer if possible
    if (Number.isInteger(rounded)) {
      return String(rounded);
    }

    return rounded.toString();
  }

  /**
   * Create and register a content stream.
   */
  private createContentStream(content: string): PdfRef | PdfStream {
    const bytes = new TextEncoder().encode(content);
    const stream = new PdfStream([], bytes);

    // If we have a context, register the stream and return a ref
    if (this.ctx) {
      return this.ctx.register(stream);
    }

    // Otherwise return the stream directly (for new pages not yet in a document)
    return stream;
  }

  /**
   * Prepend content to the page's content stream (for background drawing).
   */
  private prependContent(content: string): void {
    const existingContents = this.dict.get("Contents");
    const newContent = this.createContentStream(`${content}\n`);

    if (!existingContents) {
      // No existing content - just set our stream
      this.dict.set("Contents", newContent);
    } else if (existingContents instanceof PdfRef) {
      // Reference to a stream - wrap in array with our content first
      this.dict.set("Contents", new PdfArray([newContent, existingContents]));
      this._contentWrapped = true; // Mark as modified to prevent double-wrapping in appendContent
    } else if (existingContents instanceof PdfStream) {
      // Direct stream - wrap in array with our content first
      this.dict.set("Contents", new PdfArray([newContent, existingContents]));
      this._contentWrapped = true; // Mark as modified to prevent double-wrapping in appendContent
    } else if (existingContents instanceof PdfArray) {
      // Array of streams/refs - prepend our stream
      existingContents.insert(0, newContent);
      this._contentWrapped = true; // Mark as modified to prevent double-wrapping in appendContent
    }
  }

  /** Track whether we've already wrapped the original content in q/Q */
  private _contentWrapped = false;

  /**
   * Append content to the page's content stream (for foreground drawing).
   *
   * To ensure our drawing uses standard PDF coordinates (Y=0 at bottom),
   * we wrap the existing content in q/Q so any CTM changes are isolated,
   * then append our content which runs with the default CTM.
   */
  private appendContent(content: string): void {
    const existingContents = this.dict.get("Contents");
    const newContent = this.createContentStream(`\n${content}`);

    if (!existingContents) {
      // No existing content - just set our stream
      this.dict.set("Contents", newContent);
      return;
    }

    // First time appending: wrap existing content in q/Q to isolate CTM changes
    if (!this._contentWrapped) {
      this._contentWrapped = true;
      const qStream = this.createContentStream("q\n");
      const QStream = this.createContentStream("\nQ");

      if (existingContents instanceof PdfRef) {
        this.dict.set("Contents", new PdfArray([qStream, existingContents, QStream, newContent]));
      } else if (existingContents instanceof PdfStream) {
        this.dict.set("Contents", new PdfArray([qStream, existingContents, QStream, newContent]));
      } else if (existingContents instanceof PdfArray) {
        // Insert q at beginning, Q after existing, then our content
        const newArray = new PdfArray([qStream]);
        for (let i = 0; i < existingContents.length; i++) {
          const item = existingContents.at(i);
          if (item) {
            newArray.push(item);
          }
        }
        newArray.push(QStream);
        newArray.push(newContent);
        this.dict.set("Contents", newArray);
      }
    } else {
      // Already wrapped - just append our new content
      const contents = this.dict.get("Contents");
      if (contents instanceof PdfArray) {
        contents.push(newContent);
      } else {
        // Unexpected state - contents should be an array after wrapping
        // Wrap in array now to recover
        this.dict.set("Contents", new PdfArray([contents as PdfStream | PdfRef, newContent]));
      }
    }
  }

  /**
   * Get a box (MediaBox, CropBox, etc.) from the page dictionary.
   */
  private getBox(name: string): Rectangle | null {
    const box = this.dict.get(name);

    if (!(box instanceof PdfArray) || box.length < 4) {
      return null;
    }

    const x1 = box.at(0);
    const y1 = box.at(1);
    const x2 = box.at(2);
    const y2 = box.at(3);

    if (
      !(x1 instanceof PdfNumber) ||
      !(y1 instanceof PdfNumber) ||
      !(x2 instanceof PdfNumber) ||
      !(y2 instanceof PdfNumber)
    ) {
      return null;
    }

    return {
      x1: x1.value,
      y1: y1.value,
      x2: x2.value,
      y2: y2.value,
    };
  }

  /**
   * Register a graphics state for opacity and return its name.
   * Returns null if no opacity is needed.
   */
  private registerGraphicsStateForOpacity(
    fillOpacity?: number,
    strokeOpacity?: number,
  ): string | null {
    if (fillOpacity === undefined && strokeOpacity === undefined) {
      return null;
    }

    const params: { ca?: number; CA?: number } = {};

    if (fillOpacity !== undefined) {
      params.CA = Math.max(0, Math.min(1, fillOpacity)); // Fill opacity
    }

    if (strokeOpacity !== undefined) {
      params.ca = Math.max(0, Math.min(1, strokeOpacity)); // Stroke opacity
    }

    return this.addGraphicsState(params);
  }

  /**
   * Append operators to the page content stream.
   */
  private appendOperators(ops: Operator[]): void {
    const content = ops.map(op => op.toString()).join("\n");
    this.appendContent(content);
  }

  /**
   * Add a font resource to the page and return its name.
   */
  private addFontResource(font: FontInput): string {
    const resources = this.getResources();
    let fonts = resources.get("Font");

    if (!(fonts instanceof PdfDict)) {
      fonts = new PdfDict();
      resources.set("Font", fonts);
    }

    if (typeof font === "string") {
      // Standard 14 font - create inline font dict
      if (!isStandard14Font(font)) {
        throw new Error(`Unknown Standard 14 font: ${font}`);
      }

      // Check if we already have this font
      for (const [existingName, value] of fonts) {
        if (value instanceof PdfDict) {
          const baseFont = value.get("BaseFont");

          if (baseFont instanceof PdfName && baseFont.value === font) {
            return existingName.value;
          }
        }
      }

      // Create new font dict
      const fontDict = PdfDict.of({
        Type: PdfName.of("Font"),
        Subtype: PdfName.of("Type1"),
        BaseFont: PdfName.of(font),
      });

      const fontName = this.generateUniqueName(fonts, "F");
      fonts.set(fontName, fontDict);

      return fontName;
    }

    // Embedded font - get reference from PDFFonts
    if (font instanceof EmbeddedFont) {
      if (!this.ctx) {
        throw new Error("Cannot use embedded fonts without document context");
      }

      const fontRef = this.ctx.getFontRef(font);

      // Check if we already have this font reference
      for (const [existingName, value] of fonts) {
        if (
          value instanceof PdfRef &&
          value.objectNumber === fontRef.objectNumber &&
          value.generation === fontRef.generation
        ) {
          return existingName.value;
        }
      }

      // Add font reference to page resources
      const fontName = this.generateUniqueName(fonts, "F");
      fonts.set(fontName, fontRef);

      return fontName;
    }

    throw new Error("Unknown font type");
  }

  /**
   * Encode text to a PDF string for the given font.
   */
  private encodeTextForFont(text: string, font: FontInput): PdfString {
    if (typeof font === "string") {
      // Standard 14 font - use WinAnsi encoding (Latin-1 subset)
      return PdfString.fromString(text);
    }

    // Embedded font - use Identity-H encoding with GIDs
    // With CIDToGIDMap /Identity, the content stream must contain glyph IDs
    const gids = font.encodeTextToGids(text);
    const bytes = new Uint8Array(gids.length * 2);

    for (let i = 0; i < gids.length; i++) {
      const gid = gids[i];
      bytes[i * 2] = (gid >> 8) & 0xff;
      bytes[i * 2 + 1] = gid & 0xff;
    }

    return PdfString.fromBytes(bytes);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Extraction
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extract all text content from this page.
   *
   * Returns structured text with line/span organization and position information.
   * The plain text is available in the `text` property.
   *
   * @param options - Extraction options
   * @returns Page text with structured content and positions
   *
   * @example
   * ```typescript
   * const pageText = await page.extractText();
   * console.log(pageText.text); // Plain text
   *
   * // Access structured content
   * for (const line of pageText.lines) {
   *   console.log(`Line at y=${line.baseline}: "${line.text}"`);
   * }
   * ```
   */
  async extractText(_options: ExtractTextOptions = {}): Promise<PageText> {
    // Get content stream bytes
    const contentBytes = await this.getContentBytes();

    // Create font resolver
    const resolveFont = await this.createFontResolver();

    // Extract characters
    const extractor = new TextExtractor({ resolveFont });
    const chars = extractor.extract(contentBytes);

    // Group into lines and spans
    const lines = groupCharsIntoLines(chars);

    // Build plain text
    const text = getPlainText(lines);

    return {
      pageIndex: this.index,
      width: this.width,
      height: this.height,
      lines,
      text,
    };
  }

  /**
   * Search for text on this page.
   *
   * @param query - String or RegExp to search for
   * @param options - Search options (case sensitivity, whole word)
   * @returns Array of matches with positions
   *
   * @example
   * ```typescript
   * // String search
   * const matches = await page.findText("{{ name }}");
   * for (const match of matches) {
   *   console.log(`Found at:`, match.bbox);
   * }
   *
   * // Regex search
   * const placeholders = await page.findText(/\{\{\s*\w+\s*\}\}/g);
   * ```
   */
  async findText(query: string | RegExp, options: FindTextOptions = {}): Promise<TextMatch[]> {
    const pageText = await this.extractText();

    return searchPage(pageText, query, options);
  }

  /**
   * Get the concatenated content stream bytes.
   */
  private async getContentBytes(): Promise<Uint8Array> {
    const contents = this.dict.get("Contents");

    if (!contents) {
      return new Uint8Array(0);
    }

    // Single stream reference
    if (contents instanceof PdfRef && this.ctx) {
      const stream = await this.ctx.resolve(contents);

      if (stream instanceof PdfStream) {
        return await stream.getDecodedData();
      }
    }

    // Direct stream
    if (contents instanceof PdfStream) {
      return await contents.getDecodedData();
    }

    // Array of streams
    if (contents instanceof PdfArray) {
      const chunks: Uint8Array[] = [];

      for (let i = 0; i < contents.length; i++) {
        const item = contents.at(i);

        if (item instanceof PdfRef && this.ctx) {
          const stream = await this.ctx.resolve(item);

          if (stream instanceof PdfStream) {
            chunks.push(await stream.getDecodedData());
          }
        } else if (item instanceof PdfStream) {
          chunks.push(await item.getDecodedData());
        }
      }

      // Concatenate with space separator
      return this.concatenateChunks(chunks);
    }

    return new Uint8Array(0);
  }

  /**
   * Concatenate multiple byte arrays with space separator.
   */
  private concatenateChunks(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) {
      return new Uint8Array(0);
    }

    if (chunks.length === 1) {
      return chunks[0];
    }

    // Calculate total size (with spaces between chunks)
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + chunks.length - 1;
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        result[offset++] = 0x20; // Space between streams
      }

      result.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    return result;
  }

  /**
   * Resolve the Resources dictionary, walking up the page tree if needed.
   *
   * PDF pages can inherit Resources from parent Pages nodes (see PDF spec 7.7.3.4).
   * This method checks the page first, then walks up the Parent chain.
   */
  private async resolveInheritedResources(): Promise<PdfDict | null> {
    if (!this.ctx) {
      return null;
    }

    // Start with the page dict
    let currentDict: PdfDict | null = this.dict;

    while (currentDict) {
      // Check for Resources on the current node
      const resourcesEntry = currentDict.get("Resources");

      if (resourcesEntry instanceof PdfRef) {
        const resolved = await this.ctx.resolve(resourcesEntry);

        if (resolved instanceof PdfDict) {
          return resolved;
        }
      } else if (resourcesEntry instanceof PdfDict) {
        return resourcesEntry;
      }

      // Walk up to the Parent node
      const parentEntry = currentDict.get("Parent");

      if (parentEntry instanceof PdfRef) {
        const parent = await this.ctx.resolve(parentEntry);

        if (parent instanceof PdfDict) {
          currentDict = parent;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return null;
  }

  /**
   * Create a font resolver function for text extraction.
   */
  private async createFontResolver(): Promise<(name: string) => PdfFont | null> {
    // Get the page's Font resources (may be a ref or inherited from parent)
    const resourcesDict = await this.resolveInheritedResources();

    if (!resourcesDict) {
      return () => null;
    }

    let fontDict: PdfDict | null = null;
    const fontEntry = resourcesDict.get("Font");

    // Resolve if it's a reference
    if (fontEntry instanceof PdfRef && this.ctx) {
      const resolved = await this.ctx.resolve(fontEntry);

      if (resolved instanceof PdfDict) {
        fontDict = resolved;
      }
    } else if (fontEntry instanceof PdfDict) {
      fontDict = fontEntry;
    }

    if (!fontDict) {
      return () => null;
    }

    // Preload all font dictionaries and build the cache
    const fontCache = new Map<string, PdfFont>();

    for (const [nameObj, fontEntry] of fontDict) {
      const name = nameObj.value;
      let fontDictEntry: PdfDict | null = null;

      if (fontEntry instanceof PdfRef && this.ctx) {
        const resolved = await this.ctx.resolve(fontEntry);

        if (resolved instanceof PdfDict) {
          fontDictEntry = resolved;
        }
      } else if (fontEntry instanceof PdfDict) {
        fontDictEntry = fontEntry;
      }

      if (!fontDictEntry) {
        continue;
      }

      // Parse ToUnicode CMap if present
      let toUnicodeMap = null;
      const toUnicodeEntry = fontDictEntry.get("ToUnicode");

      if (toUnicodeEntry && this.ctx) {
        let toUnicodeStream: PdfStream | null = null;

        if (toUnicodeEntry instanceof PdfRef) {
          const resolved = await this.ctx.resolve(toUnicodeEntry);

          if (resolved instanceof PdfStream) {
            toUnicodeStream = resolved;
          }
        } else if (toUnicodeEntry instanceof PdfStream) {
          toUnicodeStream = toUnicodeEntry;
        }

        if (toUnicodeStream) {
          try {
            const decoded = await toUnicodeStream.getDecodedData();
            toUnicodeMap = parseToUnicode(decoded);
          } catch {
            // ToUnicode parsing failed - continue without it
          }
        }
      }

      // Pre-resolve all refs that parseFont might need (DescendantFonts, FontDescriptor, etc.)
      // This is necessary because parseFont uses a synchronous resolveRef callback,
      // but ctx.getObject() doesn't work for all refs - only ctx.resolve() (async) does.
      const resolvedRefs = new Map<string, PdfDict | PdfArray | PdfStream>();
      // Pre-decoded stream data (keyed by ref string for consistent lookup)
      const decodedStreams = new Map<string, Uint8Array>();

      const preResolveValue = async (value: unknown): Promise<void> => {
        if (!this.ctx) {
          return;
        }

        // If it's a ref, resolve it and cache
        if (value instanceof PdfRef) {
          const key = `${value.objectNumber} ${value.generation} R`;
          if (resolvedRefs.has(key)) {
            return;
          }

          const resolved = await this.ctx.resolve(value);
          if (
            resolved instanceof PdfDict ||
            resolved instanceof PdfArray ||
            resolved instanceof PdfStream
          ) {
            resolvedRefs.set(key, resolved);
            // Pre-decode streams (for font file data)
            if (resolved instanceof PdfStream) {
              try {
                const decoded = await resolved.getDecodedData();
                decodedStreams.set(key, decoded);
              } catch {
                // Decoding failed - will use raw data as fallback
              }
            }
            // Recursively resolve nested values
            await preResolveValue(resolved);
          }
        } else if (value instanceof PdfDict) {
          // Traverse dict values
          for (const [, v] of value) {
            await preResolveValue(v);
          }
        } else if (value instanceof PdfArray) {
          // Traverse array items
          for (let i = 0; i < value.length; i++) {
            await preResolveValue(value.at(i));
          }
        }
      };

      // Pre-resolve DescendantFonts (critical for composite fonts)
      const descendantFontsEntry = fontDictEntry.get("DescendantFonts");
      await preResolveValue(descendantFontsEntry);

      // Pre-resolve FontDescriptor (for simple fonts)
      const fontDescriptorEntry = fontDictEntry.get("FontDescriptor");
      await preResolveValue(fontDescriptorEntry);

      // Pre-resolve Encoding if it's a ref
      const encodingEntry = fontDictEntry.get("Encoding");
      await preResolveValue(encodingEntry);

      // Pre-resolve Widths if it's a ref (for simple fonts)
      const widthsEntry = fontDictEntry.get("Widths");
      await preResolveValue(widthsEntry);

      // Parse the font with resolved references
      const pdfFont = parseFont(fontDictEntry, {
        resolveRef: ref => {
          if (ref instanceof PdfRef && this.ctx) {
            const key = `${ref.objectNumber} ${ref.generation} R`;
            const preResolved = resolvedRefs.get(key);

            if (preResolved) {
              return preResolved;
            }

            // Fallback to sync getObject (works for some refs)
            const obj = this.ctx.getObject(ref);

            if (obj instanceof PdfDict || obj instanceof PdfArray || obj instanceof PdfStream) {
              return obj;
            }
          }

          return null;
        },
        decodeStream: stream => {
          // Check if it's a ref - look up pre-decoded data by ref key
          if (stream instanceof PdfRef) {
            const key = `${stream.objectNumber} ${stream.generation} R`;
            const decoded = decodedStreams.get(key);

            if (decoded) {
              return decoded;
            }

            // Fallback to resolving and using raw data
            const preResolved = resolvedRefs.get(key);

            if (preResolved instanceof PdfStream) {
              return preResolved.data;
            }
          }

          // Direct stream - need to find the ref key that resolved to this stream
          if (stream instanceof PdfStream) {
            // Search for the stream in resolvedRefs to find its key
            for (const [key, resolved] of resolvedRefs) {
              if (resolved === stream) {
                const decoded = decodedStreams.get(key);

                if (decoded) {
                  return decoded;
                }
              }
            }

            // Fallback to raw data
            return stream.data;
          }

          return null;
        },
        toUnicodeMap,
      });

      fontCache.set(name, pdfFont);
    }

    return (name: string): PdfFont | null => {
      return fontCache.get(name) ?? null;
    };
  }
}
