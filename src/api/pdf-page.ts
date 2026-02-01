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
import { AnnotationFlattener } from "#src/annotations/flattener";
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
  FlattenAnnotationsOptions,
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
import {
  CheckboxField,
  DropdownField,
  ListBoxField,
  RadioField,
  SignatureField,
  TextField,
  type FormField,
} from "#src/document/forms/fields";
import { TerminalField } from "#src/document/forms/fields/base";
import type { WidgetAnnotation } from "#src/document/forms/widget-annotation";
import {
  drawCircleOps,
  drawEllipseOps,
  drawLineOps,
  drawRectangleOps,
  setFillColor,
} from "#src/drawing/operations";
import { PathBuilder } from "#src/drawing/path-builder";
import type { PDFFormXObject, PDFPattern, PDFShading } from "#src/drawing/resources/index";
import { PDFExtGState } from "#src/drawing/resources/index";
import { serializeOperators } from "#src/drawing/serialize";
import { layoutJustifiedLine, layoutText, measureText } from "#src/drawing/text-layout";
import type {
  DrawCircleOptions,
  DrawEllipseOptions,
  DrawImageOptions,
  DrawLineOptions,
  DrawRectangleOptions,
  DrawSvgPathOptions,
  DrawTextOptions,
  FontInput,
  Rotation,
} from "#src/drawing/types";
import { resolveRotationOrigin } from "#src/drawing/types";
import { EmbeddedFont } from "#src/fonts/embedded-font";
import { parseFont } from "#src/fonts/font-factory";
import type { PdfFont } from "#src/fonts/pdf-font";
import {
  getEncodingForStandard14,
  getStandard14BasicMetrics,
  isStandard14Font,
  isWinAnsiStandard14,
} from "#src/fonts/standard-14";
import { parseToUnicode } from "#src/fonts/to-unicode";
// Annotation utilities - imported here to avoid dynamic require issues
import { concatBytes } from "#src/helpers/buffer";
import { black } from "#src/helpers/colors";
import { ColorSpace } from "#src/helpers/colorspace";
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
import * as operatorHelpers from "#src/helpers/operators";
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

import type { PDFContext } from "./pdf-context";
import type { PDFEmbeddedPage } from "./pdf-embedded-page";

/**
 * A rectangle defined by [x1, y1, x2, y2] coordinates.
 */
export interface Rectangle {
  /** Left x coordinate */
  x: number;
  /** Bottom y coordinate */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
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
  /**
   * Rotation specification.
   * Can be a simple number (degrees) or an object with angle and origin.
   *
   * @example
   * ```typescript
   * // Simple rotation (around position x, y)
   * page.drawPage(embedded, { x: 100, y: 100, rotate: 45 });
   *
   * // Rotation with custom origin
   * page.drawPage(embedded, { x: 100, y: 100, rotate: { angle: 45, origin: "center" } });
   *
   * // Rotation with explicit origin coordinates
   * page.drawPage(embedded, { x: 100, y: 100, rotate: { angle: 45, origin: { x: 150, y: 150 } } });
   * ```
   */
  rotate?: number | Rotation;
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
  private readonly ctx: PDFContext;

  /** Resource cache for deduplication - maps object refs to resource names */
  private _resourceCache: Map<PdfRef, string> = new Map();

  constructor(ref: PdfRef, dict: PdfDict, index: number, ctx: PDFContext) {
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
    return this.getBox("MediaBox") ?? { x: 0, y: 0, width: 612, height: 792 };
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
    const box = this.getEffectiveBox();
    const rotation = this.rotation;

    if (rotation === 90 || rotation === 270) {
      return Math.abs(box.height);
    }

    return Math.abs(box.width);
  }

  /**
   * Page height in points (based on MediaBox).
   *
   * Accounts for page rotation - if rotated 90 or 270 degrees,
   * returns the width of the MediaBox instead.
   */
  get height(): number {
    const box = this.getEffectiveBox();
    const rotation = this.rotation;

    if (rotation === 90 || rotation === 270) {
      return Math.abs(box.width);
    }

    return Math.abs(box.height);
  }

  /**
   * Get the effective box for dimension calculations.
   *
   * Returns CropBox if it's smaller than MediaBox, otherwise MediaBox.
   */
  private getEffectiveBox(): Rectangle {
    const mediaBox = this.getMediaBox();
    const cropBox = this.getCropBox();

    if (cropBox.width < mediaBox.width || cropBox.height < mediaBox.height) {
      return cropBox;
    }

    return mediaBox;
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
    const rotate = this.dict.getNumber("Rotate", this.ctx.resolve.bind(this.ctx));

    if (rotate) {
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
   * If Resources is a reference, it's dereferenced.
   * If Resources doesn't exist or is inherited from a parent,
   * a new empty dict is created on this page.
   */
  getResources(): PdfDict {
    let resources = this.dict.get("Resources", this.ctx.resolve.bind(this.ctx));

    if (resources instanceof PdfDict) {
      return resources;
    }

    resources = new PdfDict();

    this.dict.set("Resources", resources);

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
   * @param options - Drawing options (position, scale, rotate, opacity, background)
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
   *
   * // Draw rotated 45 degrees counter-clockwise (around position x, y)
   * page.drawPage(stamp, { x: 100, y: 100, rotate: 45, scale: 0.5 });
   *
   * // Draw rotated around the center of the embedded page
   * page.drawPage(stamp, { x: 100, y: 100, rotate: { angle: 45, origin: "center" }, scale: 0.5 });
   *
   * // Draw rotated around a custom point
   * page.drawPage(stamp, { x: 100, y: 100, rotate: { angle: 90, origin: { x: 200, y: 200 } } });
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
    const ops: Operator[] = [];
    ops.push(pushGraphicsState());

    // Set opacity if needed (via ExtGState)
    if (options.opacity !== undefined && options.opacity < 1) {
      const gsName = this.registerGraphicsState({
        fillOpacity: options.opacity,
        strokeOpacity: options.opacity,
      });
      ops.push(setGraphicsState(`/${gsName}`));
    }

    // Parse rotation options
    let rotateDegrees = 0;
    let rotateOriginX = x;
    let rotateOriginY = y;

    if (options.rotate !== undefined) {
      if (typeof options.rotate === "number") {
        // Simple number: rotate around (x, y)
        rotateDegrees = options.rotate;
      } else {
        // Rotation object with optional origin
        rotateDegrees = options.rotate.angle;

        // Calculate the actual rendered bounds for origin resolution
        const renderedWidth = embedded.width * scaleX;
        const renderedHeight = embedded.height * scaleY;
        const bounds = { x, y, width: renderedWidth, height: renderedHeight };
        const defaultOrigin = { x, y }; // Default: bottom-left corner (position)

        const origin = resolveRotationOrigin(options.rotate.origin, bounds, defaultOrigin);

        rotateOriginX = origin.x;
        rotateOriginY = origin.y;
      }
    }

    // Apply transformations
    if (rotateDegrees !== 0) {
      // With rotation: translate to rotation origin, rotate, translate back, then position and scale
      const radians = (rotateDegrees * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      // Translate to rotation origin
      ops.push(concatMatrix(1, 0, 0, 1, rotateOriginX, rotateOriginY));

      // Rotate
      ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));

      // Translate back from rotation origin to position, then adjust for BBox and scale
      const offsetX = x - rotateOriginX - embedded.box.x * scaleX;
      const offsetY = y - rotateOriginY - embedded.box.y * scaleY;

      ops.push(concatMatrix(scaleX, 0, 0, scaleY, offsetX, offsetY));
    } else {
      // No rotation: simple translate and scale
      const translateX = x - embedded.box.x * scaleX;
      const translateY = y - embedded.box.y * scaleY;

      ops.push(concatMatrix(scaleX, 0, 0, scaleY, translateX, translateY));
    }

    // Draw the XObject
    ops.push(operatorHelpers.paintXObject(xobjectName));

    ops.push(popGraphicsState());

    if (options.background) {
      this.prependOperators(ops);
    } else {
      this.appendOperators(ops);
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
  drawField(field: FormField, options: DrawFieldOptions): void {
    // Validate that field is a terminal field
    if (!(field instanceof TerminalField)) {
      throw new Error(`Cannot draw non-terminal field "${field.name}"`);
    }

    // Signature fields use merged field+widget model and are created via createSignatureField
    if (field instanceof SignatureField) {
      throw new Error(
        `Signature fields cannot be drawn with drawField. ` +
          `Use form.createSignatureField() which creates the widget automatically.`,
      );
    }

    // Validate radio group option requirement
    if (field instanceof RadioField) {
      if (!options.option) {
        throw new Error(`Radio group "${field.name}" requires option parameter in drawField`);
      }

      // Validate option exists
      const radioField = field;
      const availableOptions = radioField.getOptions();

      // For new radio fields, options might be in /Opt array
      const fieldDict = field.acroField();
      const optArray = fieldDict.getArray("Opt");

      if (optArray) {
        const optValues: string[] = [];

        for (let i = 0; i < optArray.length; i++) {
          const item = optArray.at(i);

          if (item instanceof PdfString) {
            optValues.push(item.asString());
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
    this.generateWidgetAppearance(field, widget, options);
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
    if (field instanceof RadioField && options.option) {
      const currentValue = field.getValue();

      widgetDict.set("AS", PdfName.of(currentValue === options.option ? options.option : "Off"));
    }

    // For checkboxes, set the appearance state
    if (field instanceof CheckboxField) {
      const onValue = field.getOnValue();

      widgetDict.set("AS", PdfName.of(field.isChecked() ? onValue : "Off"));
    }

    return widgetDict;
  }

  /**
   * Generate appearance stream for a widget.
   */
  private generateWidgetAppearance(
    field: TerminalField,
    widget: WidgetAnnotation,
    options: DrawFieldOptions,
  ): void {
    // We need access to AcroForm for appearance generation
    // Load it via catalog
    const catalogDict = this.ctx.catalog.getDict();
    const acroForm = AcroForm.load(catalogDict, this.ctx.registry);

    if (!acroForm) {
      return;
    }

    const generator = new AppearanceGenerator(acroForm, this.ctx.registry);

    if (field instanceof TextField) {
      const stream = generator.generateTextAppearance(field, widget);

      widget.setNormalAppearance(stream);

      return;
    }

    if (field instanceof CheckboxField) {
      const onValue = field.getOnValue();

      const { on, off } = generator.generateCheckboxAppearance(field, widget, onValue);

      widget.setNormalAppearance(on, onValue);
      widget.setNormalAppearance(off, "Off");

      return;
    }

    if (field instanceof RadioField) {
      // options.option is validated in drawField() before reaching here
      if (!options.option) {
        throw new Error("Radio field requires an option value");
      }

      const { selected, off } = generator.generateRadioAppearance(field, widget, options.option);

      widget.setNormalAppearance(selected, options.option);
      widget.setNormalAppearance(off, "Off");

      return;
    }

    if (field instanceof DropdownField) {
      const stream = generator.generateDropdownAppearance(field, widget);

      widget.setNormalAppearance(stream);

      return;
    }

    if (field instanceof ListBoxField) {
      const stream = generator.generateListBoxAppearance(field, widget);

      widget.setNormalAppearance(stream);
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
    let gsName: string | undefined;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsState({
        fillOpacity: options.opacity,
        strokeOpacity: options.borderOpacity,
      });
    }

    // Register patterns if provided
    const fillPatternName = options.pattern ? this.registerPattern(options.pattern) : undefined;
    const strokePatternName = options.borderPattern
      ? this.registerPattern(options.borderPattern)
      : undefined;

    // Calculate rotation center if rotating
    let rotate: { angle: number; originX: number; originY: number } | undefined;

    if (options.rotate) {
      const bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      const defaultOrigin = { x: options.x + options.width / 2, y: options.y + options.height / 2 };
      const origin = resolveRotationOrigin(options.rotate.origin, bounds, defaultOrigin);
      rotate = { angle: options.rotate.angle, originX: origin.x, originY: origin.y };
    }

    const ops = drawRectangleOps({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      fillColor: options.color,
      fillPatternName,
      strokeColor: options.borderColor,
      strokePatternName,
      strokeWidth: options.borderWidth,
      dashArray: options.borderDashArray,
      dashPhase: options.borderDashPhase,
      cornerRadius: options.cornerRadius,
      graphicsStateName: gsName ? `/${gsName}` : undefined,
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
    let gsName: string | undefined;

    if (options.opacity !== undefined) {
      gsName = this.registerGraphicsState({ strokeOpacity: options.opacity });
    }

    const ops = drawLineOps({
      startX: options.start.x,
      startY: options.start.y,
      endX: options.end.x,
      endY: options.end.y,
      color: options.color ?? black,
      strokeWidth: options.thickness,
      dashArray: options.dashArray,
      dashPhase: options.dashPhase,
      lineCap: options.lineCap,
      graphicsStateName: gsName ? `/${gsName}` : undefined,
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
    let gsName: string | undefined;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsState({
        fillOpacity: options.opacity,
        strokeOpacity: options.borderOpacity,
      });
    }

    // Register patterns if provided
    const fillPatternName = options.pattern ? this.registerPattern(options.pattern) : undefined;
    const strokePatternName = options.borderPattern
      ? this.registerPattern(options.borderPattern)
      : undefined;

    const ops = drawCircleOps({
      cx: options.x,
      cy: options.y,
      radius: options.radius,
      fillColor: options.color,
      fillPatternName,
      strokeColor: options.borderColor,
      strokePatternName,
      strokeWidth: options.borderWidth,
      graphicsStateName: gsName ? `/${gsName}` : undefined,
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
    let gsName: string | undefined;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsState({
        fillOpacity: options.opacity,
        strokeOpacity: options.borderOpacity,
      });
    }

    // Calculate rotation center if rotating
    let rotate: { angle: number; originX: number; originY: number } | undefined;

    if (options.rotate) {
      // Ellipse bounds: x,y is center, so bounds start at x - xRadius, y - yRadius
      const bounds = {
        x: options.x - options.xRadius,
        y: options.y - options.yRadius,
        width: options.xRadius * 2,
        height: options.yRadius * 2,
      };
      const defaultOrigin = { x: options.x, y: options.y }; // center
      const origin = resolveRotationOrigin(options.rotate.origin, bounds, defaultOrigin);
      rotate = { angle: options.rotate.angle, originX: origin.x, originY: origin.y };
    }

    // Register patterns if provided
    const fillPatternName = options.pattern ? this.registerPattern(options.pattern) : undefined;
    const strokePatternName = options.borderPattern
      ? this.registerPattern(options.borderPattern)
      : undefined;

    const ops = drawEllipseOps({
      cx: options.x,
      cy: options.y,
      rx: options.xRadius,
      ry: options.yRadius,
      fillColor: options.color,
      fillPatternName,
      strokeColor: options.borderColor,
      strokePatternName,
      strokeWidth: options.borderWidth,
      graphicsStateName: gsName ? `/${gsName}` : undefined,
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
    let gsName: string | undefined;

    if (options.opacity !== undefined && options.opacity < 1) {
      gsName = this.registerGraphicsState({ fillOpacity: options.opacity });
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
      ops.push(setGraphicsState(`/${gsName}`));
    }

    // Apply rotation if specified
    if (options.rotate) {
      // Calculate text bounds for named origins using font metrics
      const textWidth = options.maxWidth ?? Math.max(...lines.map(l => l.width));

      // Get font metrics for accurate bounds
      let ascent: number;
      let descent: number;

      if (typeof font === "string") {
        // Standard 14 font - use built-in metrics
        const metrics = getStandard14BasicMetrics(font);
        ascent = metrics ? (metrics.ascent * fontSize) / 1000 : fontSize * 0.8;
        descent = metrics ? (Math.abs(metrics.descent) * fontSize) / 1000 : fontSize * 0.2;
      } else {
        // Embedded font - use font descriptor
        const desc = font.descriptor;
        ascent = desc ? (desc.ascent * fontSize) / 1000 : fontSize * 0.8;
        descent = desc ? (Math.abs(desc.descent) * fontSize) / 1000 : fontSize * 0.2;
      }

      // For multiline text, height is from top of first line to bottom of last line
      const firstLineTop = y + ascent;
      const lastLineBottom = y - (lines.length - 1) * lineHeight - descent;
      const textHeight = firstLineTop - lastLineBottom;

      // Bounds: x is left edge, y is bottom of text block
      const bounds = { x, y: lastLineBottom, width: textWidth, height: textHeight };
      const defaultOrigin = { x, y }; // baseline of first line
      const origin = resolveRotationOrigin(options.rotate.origin, bounds, defaultOrigin);

      const rad = (options.rotate.angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      ops.push(concatMatrix(1, 0, 0, 1, origin.x, origin.y));
      ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));
      ops.push(concatMatrix(1, 0, 0, 1, -origin.x, -origin.y));
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

    const { width, height } = this.computeImageDimensions(image, options);

    // Add image XObject to resources
    const imageName = this.addXObjectResource(image.ref);

    // Build operators
    const ops: Operator[] = [pushGraphicsState()];

    // Apply opacity if needed
    if (options.opacity !== undefined && options.opacity < 1) {
      const gsName = this.registerGraphicsState({
        fillOpacity: options.opacity,
        strokeOpacity: options.opacity,
      });
      ops.push(setGraphicsState(`/${gsName}`));
    }

    // Apply rotation if specified
    if (options.rotate) {
      const bounds = { x, y, width, height };
      const defaultOrigin = { x: x + width / 2, y: y + height / 2 };
      const origin = resolveRotationOrigin(options.rotate.origin, bounds, defaultOrigin);

      const rad = (options.rotate.angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      ops.push(concatMatrix(1, 0, 0, 1, origin.x, origin.y));
      ops.push(concatMatrix(cos, sin, -sin, cos, 0, 0));
      ops.push(concatMatrix(1, 0, 0, 1, -origin.x, -origin.y));
    }

    // Apply transformation matrix to scale and position
    // Image XObjects are 1x1 unit, so we scale to desired size
    ops.push(concatMatrix(width, 0, 0, height, x, y));
    ops.push(operatorHelpers.paintXObject(imageName));
    ops.push(popGraphicsState());

    this.appendOperators(ops);
  }

  /**
   * Compute image dimensions based on options, preserving aspect ratio when appropriate.
   */
  private computeImageDimensions(
    image: PDFImage,
    options: DrawImageOptions,
  ): { width: number; height: number } {
    // Both specified - use as is (may distort)
    if (options.width !== undefined && options.height !== undefined) {
      return { width: options.width, height: options.height };
    }

    // Width specified - calculate height from aspect ratio
    if (options.width !== undefined) {
      return { width: options.width, height: options.width / image.aspectRatio };
    }

    // Height specified - calculate width from aspect ratio
    if (options.height !== undefined) {
      return { width: options.height * image.aspectRatio, height: options.height };
    }

    // Neither specified - use natural size in points
    return { width: image.widthInPoints, height: image.heightInPoints };
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
   * // Triangle with solid color
   * page.drawPath()
   *   .moveTo(100, 100)
   *   .lineTo(200, 100)
   *   .lineTo(150, 200)
   *   .close()
   *   .fill({ color: rgb(1, 0, 0) });
   *
   * // Complex shape with fill and stroke
   * page.drawPath()
   *   .moveTo(50, 50)
   *   .curveTo(100, 100, 150, 100, 200, 50)
   *   .lineTo(200, 150)
   *   .close()
   *   .fillAndStroke({
   *     color: rgb(0.9, 0.9, 1),
   *     borderColor: rgb(0, 0, 1),
   *   });
   *
   * // Circle with gradient fill (using shading pattern)
   * const gradient = pdf.createAxialShading({
   *   coords: [0, 0, 100, 0],
   *   stops: [{ offset: 0, color: rgb(1, 0, 0) }, { offset: 1, color: rgb(0, 0, 1) }],
   * });
   * const gradientPattern = pdf.createShadingPattern({ shading: gradient });
   * page.drawPath()
   *   .circle(200, 200, 50)
   *   .fill({ pattern: gradientPattern });
   *
   * // Rectangle with tiling pattern fill
   * const pattern = pdf.createTilingPattern({...});
   * page.drawPath()
   *   .rectangle(50, 300, 100, 100)
   *   .fill({ pattern });
   * ```
   */
  drawPath(): PathBuilder {
    return new PathBuilder(
      content => this.appendContent(content),
      options => {
        if (options.fillOpacity === undefined && options.strokeOpacity === undefined) {
          return null;
        }

        return this.registerGraphicsState(options);
      },
      shading => this.registerShading(shading),
      pattern => this.registerPattern(pattern),
    );
  }

  /**
   * Draw an SVG path on the page.
   *
   * This is a convenience method that parses an SVG path `d` attribute string
   * and draws it with the specified options. For more control, use `drawPath()`
   * with `appendSvgPath()`.
   *
   * By default, the path is filled with black. Specify `borderColor` without
   * `color` to stroke without filling.
   *
   * SVG paths are automatically transformed from SVG coordinate space (Y-down)
   * to PDF coordinate space (Y-up). Use `x`, `y` to position the path, and
   * `scale` to resize it.
   *
   * @param pathData - SVG path `d` attribute string
   * @param options - Drawing options (x, y, scale, color, etc.)
   *
   * @example
   * ```typescript
   * // Draw a Font Awesome heart icon at position (100, 500)
   * // Icon is 512x512 in SVG, scale to ~50pt
   * page.drawSvgPath(faHeartPath, {
   *   x: 100,
   *   y: 500,
   *   scale: 0.1,
   *   color: rgb(1, 0, 0),
   * });
   *
   * // Draw a simple triangle at default position (0, 0)
   * page.drawSvgPath("M 0 0 L 50 0 L 25 40 Z", {
   *   color: rgb(0, 0, 1),
   * });
   *
   * // Stroke a curve
   * page.drawSvgPath("M 0 0 C 10 10, 30 10, 40 0", {
   *   x: 200,
   *   y: 300,
   *   borderColor: rgb(0, 0, 0),
   *   borderWidth: 2,
   * });
   * ```
   */
  drawSvgPath(pathData: string, options: DrawSvgPathOptions = {}): void {
    const builder = this.drawPath();
    builder.appendSvgPath(pathData, {
      flipY: options.flipY ?? true,
      scale: options.scale ?? 1,
      translateX: options.x ?? 0,
      translateY: options.y ?? 0,
    });

    const hasFill = options.color !== undefined || options.pattern !== undefined;
    const hasStroke = options.borderColor !== undefined || options.borderPattern !== undefined;

    if (hasFill && hasStroke) {
      builder.fillAndStroke(options);

      return;
    }

    if (hasStroke) {
      builder.stroke(options);

      return;
    }

    // Default: fill with black if no color specified and no pattern
    builder.fill(hasFill ? options : { ...options, color: black });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Low-Level Drawing API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Emit raw PDF operators to the page content stream.
   *
   * This is the low-level drawing API that gives you direct control over
   * PDF content stream operators. Use this when you need advanced features
   * like matrix transforms, graphics state stack, gradients, or patterns
   * that aren't available through the high-level drawing methods.
   *
   * **Important**: The caller is responsible for valid operator sequences.
   * Invalid sequences may produce corrupted PDFs that won't render correctly.
   *
   * @param operators - Array of operators to emit
   *
   * @example
   * ```typescript
   * import { PDF, ops } from "@libpdf/core";
   *
   * const pdf = await PDF.create();
   * const page = pdf.addPage();
   *
   * page.drawOperators([
   *   ops.pushGraphicsState(),
   *   ops.concatMatrix(1, 0, 0, 1, 100, 200),  // translate
   *   ops.setNonStrokingRGB(1, 0, 0),
   *   ops.rectangle(0, 0, 50, 50),
   *   ops.fill(),
   *   ops.popGraphicsState(),
   * ]);
   * ```
   */
  drawOperators(operators: Operator[]): void {
    this.appendOperators(operators);
  }

  /**
   * Register a font resource and return its operator name.
   *
   * The same font registered multiple times returns the same name (deduplication).
   *
   * @param font - Font to register (EmbeddedFont or Standard 14 font name)
   * @returns The resource name for use with operators (e.g., "F0")
   *
   * @example
   * ```typescript
   * const font = await pdf.embedFont(fontBytes);
   * const fontName = page.registerFont(font);
   *
   * page.drawOperators([
   *   ops.beginText(),
   *   ops.setFont(fontName, 12),
   *   ops.showText("Hello"),
   *   ops.endText(),
   * ]);
   * ```
   */
  registerFont(font: FontInput): string {
    if (typeof font === "string") {
      // Standard 14 font - inline dicts, not references
      return this.addFontResource(font);
    }

    // Embedded font - get reference
    const fontRef = this.ctx.getFontRef(font);

    if (!fontRef) {
      throw new Error("Font must be prepared before registering");
    }

    return this.registerResource(fontRef, "Font", "F");
  }

  /**
   * Register an image resource and return its operator name.
   *
   * The same image registered multiple times returns the same name (deduplication).
   *
   * @param image - The PDFImage to register
   * @returns The resource name for use with paintXObject operator (e.g., "Im0")
   *
   * @example
   * ```typescript
   * const image = await pdf.embedImage(imageBytes);
   * const imageName = page.registerImage(image);
   *
   * page.drawOperators([
   *   ops.pushGraphicsState(),
   *   ops.concatMatrix(100, 0, 0, 100, 200, 500),
   *   ops.paintXObject(imageName),
   *   ops.popGraphicsState(),
   * ]);
   * ```
   */
  registerImage(image: PDFImage): string {
    return this.registerResource(image.ref, "XObject", "Im");
  }

  /**
   * Register a shading (gradient) resource and return its operator name.
   *
   * The same shading registered multiple times returns the same name (deduplication).
   *
   * @param shading - The PDFShading to register
   * @returns The resource name for use with paintShading operator (e.g., "Sh0")
   *
   * @example
   * ```typescript
   * const gradient = pdf.createAxialShading({
   *   coords: [0, 0, 100, 0],
   *   stops: [{ offset: 0, color: rgb(1, 0, 0) }, { offset: 1, color: rgb(0, 0, 1) }],
   * });
   * const shadingName = page.registerShading(gradient);
   *
   * page.drawOperators([
   *   ops.pushGraphicsState(),
   *   ops.rectangle(50, 50, 100, 100),
   *   ops.clip(),
   *   ops.endPath(),
   *   ops.paintShading(shadingName),
   *   ops.popGraphicsState(),
   * ]);
   * ```
   */
  registerShading(shading: PDFShading): string {
    return this.registerResource(shading.ref, "Shading", "Sh");
  }

  /**
   * Register a pattern resource and return its operator name.
   *
   * The same pattern registered multiple times returns the same name (deduplication).
   *
   * @param pattern - The PDFPattern to register
   * @returns The resource name for use with setNonStrokingColorN operator (e.g., "P0")
   *
   * @example
   * ```typescript
   * // Create a checkerboard pattern
   * const pattern = pdf.createTilingPattern({
   *   bbox: { x: 0, y: 0, width: 10, height: 10 },
   *   xStep: 10,
   *   yStep: 10,
   *   operators: [
   *     ops.setNonStrokingGray(0.8),
   *     ops.rectangle(0, 0, 5, 5),
   *     ops.fill(),
   *   ],
   * });
   * const patternName = page.registerPattern(pattern);
   *
   * // Fill a rectangle with the pattern
   * page.drawOperators([
   *   ops.setNonStrokingColorSpace(ColorSpace.Pattern),
   *   ops.setNonStrokingColorN(patternName),
   *   ops.rectangle(100, 100, 200, 200),
   *   ops.fill(),
   * ]);
   * ```
   */
  registerPattern(pattern: PDFPattern): string {
    return this.registerResource(pattern.ref, "Pattern", "P");
  }

  /**
   * Register an extended graphics state resource and return its operator name.
   *
   * The same ExtGState registered multiple times returns the same name (deduplication).
   *
   * @param state - The PDFExtGState to register
   * @returns The resource name for use with setGraphicsState operator (e.g., "GS0")
   *
   * @example
   * ```typescript
   * const gs = pdf.createExtGState({
   *   fillOpacity: 0.5,
   *   strokeOpacity: 0.8,
   *   blendMode: "Multiply",
   * });
   * const gsName = page.registerExtGState(gs);
   *
   * page.drawOperators([
   *   ops.pushGraphicsState(),
   *   ops.setGraphicsState(gsName),
   *   ops.setNonStrokingRGB(1, 0, 0),
   *   ops.rectangle(100, 100, 50, 50),
   *   ops.fill(),
   *   ops.popGraphicsState(),
   * ]);
   * ```
   */
  registerExtGState(state: PDFExtGState): string {
    return this.registerResource(state.ref, "ExtGState", "GS");
  }

  /**
   * Register a Form XObject resource and return its operator name.
   *
   * The same XObject registered multiple times returns the same name (deduplication).
   *
   * @param xobject - The PDFFormXObject or PDFEmbeddedPage to register
   * @returns The resource name for use with paintXObject operator (e.g., "Fm0")
   *
   * @example
   * ```typescript
   * // Create a reusable stamp
   * const stamp = pdf.createFormXObject({
   *   bbox: { x: 0, y: 0, width: 100, height: 50 },
   *   operators: [
   *     ops.setNonStrokingRGB(1, 0, 0),
   *     ops.rectangle(0, 0, 100, 50),
   *     ops.fill(),
   *     ops.beginText(),
   *     ops.setFont(fontName, 12),
   *     ops.setNonStrokingGray(1),
   *     ops.moveText(10, 18),
   *     ops.showText("STAMP"),
   *     ops.endText(),
   *   ],
   * });
   * const xobjectName = page.registerXObject(stamp);
   *
   * // Use the stamp at different positions
   * page.drawOperators([
   *   ops.pushGraphicsState(),
   *   ops.concatMatrix(1, 0, 0, 1, 200, 700),
   *   ops.paintXObject(xobjectName),
   *   ops.popGraphicsState(),
   * ]);
   * ```
   */
  registerXObject(xobject: PDFFormXObject | PDFEmbeddedPage): string {
    return this.registerResource(xobject.ref, "XObject", "Fm");
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
   * const annotations = page.getAnnotations();
   * for (const annot of annotations) {
   *   console.log(annot.type, annot.contents);
   * }
   * ```
   */
  getAnnotations(): PDFAnnotation[] {
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

      const resolved = entry instanceof PdfRef ? this.ctx.resolve(entry) : entry;

      const annotRef = entry instanceof PdfRef ? entry : null;
      const annotDict = resolved instanceof PdfDict ? resolved : null;

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
  getPopupAnnotations(): PDFPopupAnnotation[] {
    const popups: PDFPopupAnnotation[] = [];
    const annotsArray = this.dict.getArray("Annots");

    if (!annotsArray || !this.ctx) {
      return popups;
    }

    for (let i = 0; i < annotsArray.length; i++) {
      let entry = annotsArray.at(i);

      if (!entry) {
        continue;
      }

      const resolved = entry instanceof PdfRef ? this.ctx.resolve(entry) : entry;

      const annotRef = entry instanceof PdfRef ? entry : null;
      const annotDict = resolved instanceof PdfDict ? resolved : null;

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
  getHighlightAnnotations(): PDFHighlightAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFHighlightAnnotation => a.type === "Highlight");
  }

  /**
   * Get all underline annotations on this page.
   */
  getUnderlineAnnotations(): PDFUnderlineAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFUnderlineAnnotation => a.type === "Underline");
  }

  /**
   * Get all strikeout annotations on this page.
   */
  getStrikeOutAnnotations(): PDFStrikeOutAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFStrikeOutAnnotation => a.type === "StrikeOut");
  }

  /**
   * Get all squiggly annotations on this page.
   */
  getSquigglyAnnotations(): PDFSquigglyAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFSquigglyAnnotation => a.type === "Squiggly");
  }

  /**
   * Get all link annotations on this page.
   */
  getLinkAnnotations(): PDFLinkAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFLinkAnnotation => a.type === "Link");
  }

  /**
   * Get all text annotations (sticky notes) on this page.
   */
  getTextAnnotations(): PDFTextAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFTextAnnotation => a.type === "Text");
  }

  /**
   * Get all free text annotations on this page.
   */
  getFreeTextAnnotations(): PDFFreeTextAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFFreeTextAnnotation => a.type === "FreeText");
  }

  /**
   * Get all line annotations on this page.
   */
  getLineAnnotations(): PDFLineAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFLineAnnotation => a.type === "Line");
  }

  /**
   * Get all square annotations on this page.
   */
  getSquareAnnotations(): PDFSquareAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFSquareAnnotation => a.type === "Square");
  }

  /**
   * Get all circle annotations on this page.
   */
  getCircleAnnotations(): PDFCircleAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFCircleAnnotation => a.type === "Circle");
  }

  /**
   * Get all stamp annotations on this page.
   */
  getStampAnnotations(): PDFStampAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFStampAnnotation => a.type === "Stamp");
  }

  /**
   * Get all ink annotations on this page.
   */
  getInkAnnotations(): PDFInkAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFInkAnnotation => a.type === "Ink");
  }

  /**
   * Get all polygon annotations on this page.
   */
  getPolygonAnnotations(): PDFPolygonAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFPolygonAnnotation => a.type === "Polygon");
  }

  /**
   * Get all polyline annotations on this page.
   */
  getPolylineAnnotations(): PDFPolylineAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFPolylineAnnotation => a.type === "PolyLine");
  }

  /**
   * Get all caret annotations on this page.
   */
  getCaretAnnotations(): PDFCaretAnnotation[] {
    const annotations = this.getAnnotations();

    return annotations.filter((a): a is PDFCaretAnnotation => a.type === "Caret");
  }

  /**
   * Get all file attachment annotations on this page.
   */
  getFileAttachmentAnnotations(): PDFFileAttachmentAnnotation[] {
    const annotations = this.getAnnotations();

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.addTextMarkupAnnotation("Highlight", options) as PDFHighlightAnnotation;
  }

  /**
   * Add an underline annotation.
   */
  addUnderlineAnnotation(options: TextMarkupAnnotationOptions): PDFUnderlineAnnotation {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.addTextMarkupAnnotation("Underline", options) as PDFUnderlineAnnotation;
  }

  /**
   * Add a strikeout annotation.
   */
  addStrikeOutAnnotation(options: TextMarkupAnnotationOptions): PDFStrikeOutAnnotation {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.addTextMarkupAnnotation("StrikeOut", options) as PDFStrikeOutAnnotation;
  }

  /**
   * Add a squiggly underline annotation.
   */
  addSquigglyAnnotation(options: TextMarkupAnnotationOptions): PDFSquigglyAnnotation {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.addTextMarkupAnnotation("Squiggly", options) as PDFSquigglyAnnotation;
  }

  /**
   * Add a text markup annotation (internal helper).
   */
  private addTextMarkupAnnotation(
    subtype: "Highlight" | "Underline" | "StrikeOut" | "Squiggly",
    options: TextMarkupAnnotationOptions,
  ): PDFAnnotation {
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

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFLinkAnnotation;
  }

  /**
   * Add a text annotation (sticky note).
   *
   * @param options - Text annotation options
   * @returns The created annotation
   */
  addTextAnnotation(options: TextAnnotationOptions): PDFTextAnnotation {
    const annotDict = PDFTextAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFTextAnnotation;
  }

  /**
   * Add a line annotation.
   *
   * @param options - Line annotation options
   * @returns The created annotation
   */
  addLineAnnotation(options: LineAnnotationOptions): PDFLineAnnotation {
    const annotDict = PDFLineAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFLineAnnotation;
  }

  /**
   * Add a square (rectangle) annotation.
   *
   * @param options - Square annotation options
   * @returns The created annotation
   */
  addSquareAnnotation(options: SquareAnnotationOptions): PDFSquareAnnotation {
    const annotDict = PDFSquareAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFSquareAnnotation;
  }

  /**
   * Add a circle (ellipse) annotation.
   *
   * @param options - Circle annotation options
   * @returns The created annotation
   */
  addCircleAnnotation(options: CircleAnnotationOptions): PDFCircleAnnotation {
    const annotDict = PDFCircleAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFCircleAnnotation;
  }

  /**
   * Add a stamp annotation.
   *
   * @param options - Stamp annotation options
   * @returns The created annotation
   */
  addStampAnnotation(options: StampAnnotationOptions): PDFStampAnnotation {
    const annotDict = PDFStampAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createAnnotation(annotDict, annotRef, this.ctx.registry) as PDFStampAnnotation;
  }

  /**
   * Add an ink (freehand drawing) annotation.
   *
   * @param options - Ink annotation options
   * @returns The created annotation
   */
  addInkAnnotation(options: InkAnnotationOptions): PDFInkAnnotation {
    const annotDict = PDFInkAnnotation.create(options);

    // Register and add to page
    const annotRef = this.ctx.register(annotDict);
    this.addAnnotationRef(annotRef);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
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
   * const highlights = page.getHighlightAnnotations();
   * page.removeAnnotation(highlights[0]);
   * ```
   */
  removeAnnotation(annotation: PDFAnnotation): void {
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
   * page.removeAnnotations({ type: "Highlight" });
   *
   * // Remove all annotations
   * page.removeAnnotations();
   * ```
   */
  removeAnnotations(options?: RemoveAnnotationsOptions): void {
    const annotations = this.getAnnotations();

    let toRemove = annotations;

    if (options?.type) {
      toRemove = annotations.filter(a => a.type === options.type);
    }

    for (const annotation of toRemove) {
      this.removeAnnotation(annotation);
    }
  }

  /**
   * Flatten all annotations on this page into static content.
   *
   * Annotations are converted to static graphics drawn on the page content.
   * After flattening, annotations are removed from the page.
   *
   * Annotations without appearances that cannot be generated are removed.
   * Widget annotations (form fields) and Link annotations are not affected.
   *
   * @param options - Flattening options
   * @returns Number of annotations flattened
   *
   * @example
   * ```typescript
   * // Flatten all annotations on a page
   * const count = page.flattenAnnotations();
   *
   * // Flatten but keep link annotations interactive
   * page.flattenAnnotations({ exclude: ["Link"] });
   * ```
   */
  flattenAnnotations(options?: FlattenAnnotationsOptions): number {
    const flattener = new AnnotationFlattener(this.ctx.registry);
    const count = flattener.flattenPage(this.dict, options);

    // Invalidate annotation cache since annotations were removed
    this.invalidateAnnotationCache();

    return count;
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
   * Register a resource reference in a resource subdictionary.
   *
   * Handles deduplication via cache and existing entry scanning.
   *
   * @param ref - The object reference to register
   * @param resourceType - The resource subdictionary key (e.g., "Font", "XObject")
   * @param prefix - The name prefix (e.g., "F", "Im", "Sh")
   * @returns The resource name for use in operators
   */
  private registerResource(ref: PdfRef, resourceType: string, prefix: string): string {
    // Check cache for deduplication
    const cachedName = this._resourceCache.get(ref);

    if (cachedName) {
      return cachedName;
    }

    // Get or create the resource subdictionary
    const resources = this.getResources();
    let subdict = resources.get(resourceType);

    if (!(subdict instanceof PdfDict)) {
      subdict = new PdfDict();
      resources.set(resourceType, subdict);
    }

    // Check if this exact ref is already registered
    for (const [existingName, value] of subdict) {
      if (
        value instanceof PdfRef &&
        value.objectNumber === ref.objectNumber &&
        value.generation === ref.generation
      ) {
        this._resourceCache.set(ref, existingName.value);
        return existingName.value;
      }
    }

    // Generate unique name and register
    const name = this.generateUniqueName(subdict, prefix);
    subdict.set(name, ref);
    this._resourceCache.set(ref, name);

    return name;
  }

  /**
   * Create and register a content stream.
   *
   * Accepts either a string (for ASCII-only content like operator names and numbers)
   * or raw bytes (for content that may contain non-ASCII data).
   */
  private createContentStream(content: string | Uint8Array): PdfRef | PdfStream {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
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
  private prependContent(content: string | Uint8Array): void {
    const existingContents = this.dict.get("Contents");
    const contentWithNewline =
      typeof content === "string" ? `${content}\n` : concatBytes([content, new Uint8Array([0x0a])]);
    const newContent = this.createContentStream(contentWithNewline);

    if (!existingContents) {
      this.dict.set("Contents", newContent);

      return;
    }

    // Mark as modified to prevent double-wrapping in appendContent
    this._contentWrapped = true;

    if (existingContents instanceof PdfRef) {
      const resolved = this.ctx.resolve(existingContents);

      if (resolved instanceof PdfArray) {
        // Reference points to an array - prepend our stream to a new array
        const newArray = new PdfArray([newContent]);

        for (let i = 0; i < resolved.length; i++) {
          const item = resolved.at(i);

          if (item) {
            newArray.push(item);
          }
        }

        this.dict.set("Contents", newArray);

        return;
      }

      // Reference points to a single stream - wrap in array
      this.dict.set("Contents", new PdfArray([newContent, existingContents]));

      return;
    }

    if (existingContents instanceof PdfStream) {
      this.dict.set("Contents", new PdfArray([newContent, existingContents]));

      return;
    }

    if (existingContents instanceof PdfArray) {
      existingContents.insert(0, newContent);
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
  private appendContent(content: string | Uint8Array): void {
    const existingContents = this.dict.get("Contents");
    const contentWithNewline =
      typeof content === "string" ? `\n${content}` : concatBytes([new Uint8Array([0x0a]), content]);
    const newContent = this.createContentStream(contentWithNewline);

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
        // Resolve the reference to check if it's an array or a stream
        const resolved = this.ctx.resolve(existingContents);

        if (resolved instanceof PdfArray) {
          // Reference points to an array of streams - expand it
          const newArray = new PdfArray([qStream]);

          for (let i = 0; i < resolved.length; i++) {
            const item = resolved.at(i);

            if (item) {
              newArray.push(item);
            }
          }

          newArray.push(QStream);
          newArray.push(newContent);

          this.dict.set("Contents", newArray);
        } else {
          // Reference points to a single stream
          this.dict.set("Contents", new PdfArray([qStream, existingContents, QStream, newContent]));
        }

        return;
      }

      if (existingContents instanceof PdfStream) {
        this.dict.set("Contents", new PdfArray([qStream, existingContents, QStream, newContent]));

        return;
      }

      if (existingContents instanceof PdfArray) {
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

        return;
      }
    }

    // Existing content is already wrapped - just append our content
    if (existingContents instanceof PdfArray) {
      existingContents.push(newContent);

      return;
    }

    if (existingContents !== undefined) {
      // Unexpected state - contents should be an array after wrapping
      // Wrap in array now to recover
      this.dict.set("Contents", new PdfArray([existingContents, newContent]));
    }
  }

  /**
   * Get a box (MediaBox, CropBox, etc.) from the page dictionary.
   */
  private getBox(name: string): Rectangle | null {
    const box = this.dict.get(name, this.ctx.resolve.bind(this.ctx));

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
      x: x1.value,
      y: y1.value,
      width: x2.value,
      height: y2.value,
    };
  }

  /**
   * Create and register a graphics state, returning its resource name.
   *
   * This is an internal helper for high-level drawing methods.
   * For the public low-level API, use `pdf.createExtGState()` + `page.registerExtGState()`.
   */
  private registerGraphicsState(options: { fillOpacity?: number; strokeOpacity?: number }): string {
    const dict = PDFExtGState.createDict(options);
    const ref = this.ctx.register(dict);

    return this.registerExtGState({ type: "extgstate", ref });
  }

  /**
   * Append operators to the page content stream (foreground).
   */
  private appendOperators(ops: Operator[]): void {
    this.appendContent(serializeOperators(ops));
  }

  /**
   * Prepend operators to the page content stream (background).
   */
  private prependOperators(ops: Operator[]): void {
    this.prependContent(serializeOperators(ops));
  }

  /**
   * Add a font resource to the page and return its name.
   */
  private addFontResource(font: FontInput): string {
    const resources = this.getResources();

    let fonts = resources.get("Font", this.ctx.resolve.bind(this.ctx));

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
          const baseFont = value.get("BaseFont", this.ctx.resolve.bind(this.ctx));

          if (baseFont instanceof PdfName && baseFont.value === font) {
            return existingName.value;
          }
        }
      }

      // Create new font dict
      // Add /Encoding WinAnsiEncoding for non-Symbol/ZapfDingbats fonts.
      // Symbol and ZapfDingbats use their built-in encoding (no /Encoding entry).
      const fontDict = isWinAnsiStandard14(font)
        ? PdfDict.of({
            Type: PdfName.of("Font"),
            Subtype: PdfName.of("Type1"),
            BaseFont: PdfName.of(font),
            Encoding: PdfName.of("WinAnsiEncoding"),
          })
        : PdfDict.of({
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
   *
   * Standard 14 fonts use WinAnsiEncoding (or SymbolEncoding/ZapfDingbatsEncoding).
   * Unencodable characters are substituted with .notdef (byte 0x00).
   * Embedded fonts use Identity-H encoding with glyph IDs.
   */
  private encodeTextForFont(text: string, font: FontInput): PdfString {
    if (typeof font === "string") {
      // Standard 14 font - use the appropriate encoding
      const encoding = getEncodingForStandard14(font);
      const codes: number[] = [];

      for (const char of text) {
        if (encoding.canEncode(char)) {
          // biome-ignore lint/style/noNonNullAssertion: canEncode guarantees getCode succeeds
          codes.push(encoding.getCode(char.codePointAt(0)!)!);
        } else {
          // Substitute unencodable characters with .notdef (byte 0x00)
          codes.push(0x00);
        }
      }

      const bytes = new Uint8Array(codes);

      // Use hex format for defense-in-depth: hex strings are pure ASCII
      // and immune to any string encoding transformation
      return PdfString.fromBytes(bytes);
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
   * const pageText = page.extractText();
   * console.log(pageText.text); // Plain text
   *
   * // Access structured content
   * for (const line of pageText.lines) {
   *   console.log(`Line at y=${line.baseline}: "${line.text}"`);
   * }
   * ```
   */
  extractText(_options: ExtractTextOptions = {}): PageText {
    // Get content stream bytes
    const contentBytes = this.getContentBytes();

    // Create font resolver
    const resolveFont = this.createFontResolver();

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
   * const matches = page.findText("{{ name }}");
   * for (const match of matches) {
   *   console.log(`Found at:`, match.bbox);
   * }
   *
   * // Regex search
   * const placeholders = page.findText(/\{\{\s*\w+\s*\}\}/g);
   * ```
   */
  findText(query: string | RegExp, options: FindTextOptions = {}): TextMatch[] {
    const pageText = this.extractText();

    return searchPage(pageText, query, options);
  }

  /**
   * Get the concatenated content stream bytes.
   */
  private getContentBytes(): Uint8Array {
    const contents = this.dict.get("Contents", this.ctx.resolve.bind(this.ctx));

    if (!contents) {
      return new Uint8Array(0);
    }

    // Direct stream
    if (contents instanceof PdfStream) {
      return contents.getDecodedData();
    }

    // Array of streams
    if (contents instanceof PdfArray) {
      const chunks: Uint8Array[] = [];

      for (let i = 0; i < contents.length; i++) {
        const item = contents.at(i, this.ctx.resolve.bind(this.ctx));

        if (item instanceof PdfStream) {
          chunks.push(item.getDecodedData());
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
  private resolveInheritedResources(): PdfDict | null {
    // Start with the page dict
    let currentDict: PdfDict | null = this.dict;

    while (currentDict) {
      // Check for Resources on the current node
      const resources = currentDict.get("Resources", this.ctx.resolve.bind(this.ctx));

      if (resources instanceof PdfDict) {
        return resources;
      }

      // Walk up to the Parent node
      const parent = currentDict.get("Parent", this.ctx.resolve.bind(this.ctx));

      if (parent instanceof PdfDict) {
        currentDict = parent;
      } else {
        break;
      }
    }

    return null;
  }

  /**
   * Create a font resolver function for text extraction.
   */
  private createFontResolver(): (name: string) => PdfFont | null {
    // Get the page's Font resources (may be a ref or inherited from parent)
    const resourcesDict = this.resolveInheritedResources();

    if (!resourcesDict) {
      return () => null;
    }

    const font = resourcesDict.getDict("Font", this.ctx.resolve.bind(this.ctx));

    if (!font) {
      return () => null;
    }

    // Preload all font dictionaries and build the cache
    const fontCache = new Map<string, PdfFont>();

    for (const [key, entry] of font) {
      const name = key.value;
      const resolved = entry instanceof PdfRef ? this.ctx.resolve(entry) : entry;

      let entryDict = resolved instanceof PdfDict ? resolved : null;

      if (!entryDict) {
        continue;
      }

      // Parse ToUnicode CMap if present
      let toUnicodeMap = null;

      const toUnicode = entryDict.get("ToUnicode", this.ctx.resolve.bind(this.ctx));
      const toUnicodeStream = toUnicode instanceof PdfStream ? toUnicode : null;

      if (toUnicodeStream) {
        try {
          toUnicodeMap = parseToUnicode(toUnicodeStream.getDecodedData());
        } catch {
          // ToUnicode parsing failed - continue without it
        }
      }

      // Parse the font
      const pdfFont = parseFont(entryDict, {
        resolver: this.ctx.resolve.bind(this.ctx),
        toUnicodeMap,
      });

      fontCache.set(name, pdfFont);
    }

    return (name: string): PdfFont | null => {
      return fontCache.get(name) ?? null;
    };
  }
}
