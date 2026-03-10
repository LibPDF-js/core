/**
 * PDFAnnotation - Base class for all PDF annotations.
 *
 * Provides common properties and methods shared by all annotation types.
 * Wraps a PdfDict annotation dictionary with convenient accessors.
 *
 * PDF Reference: Section 12.5 "Annotations"
 */

import type { ObjectRegistry } from "#src/document/object-registry";
import { type Color, cmyk, colorToArray, grayscale, rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";

import {
  AnnotationFlags,
  isAnnotationSubtype,
  type AnnotationSubtype,
  type BorderStyle,
  type BorderStyleType,
  type Rect,
} from "./types";

/**
 * Map PDF border style codes to our type.
 */
const BORDER_STYLE_MAP: Record<string, BorderStyleType> = {
  S: "solid",
  D: "dashed",
  B: "beveled",
  I: "inset",
  U: "underline",
};

/**
 * Map our border style type to PDF codes.
 */
const BORDER_STYLE_REVERSE_MAP: Record<BorderStyleType, string> = {
  solid: "S",
  dashed: "D",
  beveled: "B",
  inset: "I",
  underline: "U",
};

/**
 * Base class for PDF annotations.
 */
export class PDFAnnotation {
  /** The underlying annotation dictionary */
  readonly dict: PdfDict;

  /** Reference to this annotation object */
  readonly ref: PdfRef | null;

  /** Object registry for change tracking */
  protected readonly registry: ObjectRegistry;

  /** Track if annotation has been modified */
  private _modified = false;

  constructor(dict: PdfDict, ref: PdfRef | null, registry: ObjectRegistry) {
    this.dict = dict;
    this.ref = ref;
    this.registry = registry;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Common Properties
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Annotation subtype (e.g., "Text", "Highlight", "Link").
   */
  get type(): AnnotationSubtype {
    const subtype = this.dict.getName("Subtype", this.registry.resolve.bind(this.registry))?.value;

    return isAnnotationSubtype(subtype) ? subtype : "Text";
  }

  /**
   * Annotation rectangle in page coordinates.
   */
  get rect(): Rect {
    const arr = this.dict.getArray("Rect", this.registry.resolve.bind(this.registry));

    if (!arr || arr.length < 4) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const [x1, y1, x2, y2] = arr
      .toArray()
      .map(item => (item instanceof PdfNumber ? item.value : 0));

    return {
      x: Math.min(x1 ?? 0, x2 ?? 0),
      y: Math.min(y1 ?? 0, y2 ?? 0),
      width: Math.abs((x2 ?? 0) - (x1 ?? 0)),
      height: Math.abs((y2 ?? 0) - (y1 ?? 0)),
    };
  }

  /**
   * Set the annotation rectangle.
   */
  setRect(rect: Rect): void {
    const arr = this.dict.getArray("Rect", this.registry.resolve.bind(this.registry));

    if (arr && arr.length >= 4) {
      arr.set(0, PdfNumber.of(rect.x));
      arr.set(1, PdfNumber.of(rect.y));
      arr.set(2, PdfNumber.of(rect.x + rect.width));
      arr.set(3, PdfNumber.of(rect.y + rect.height));
    } else {
      this.dict.set(
        "Rect",
        new PdfArray([
          PdfNumber.of(rect.x),
          PdfNumber.of(rect.y),
          PdfNumber.of(rect.x + rect.width),
          PdfNumber.of(rect.y + rect.height),
        ]),
      );
    }

    this.markModified();
  }

  /**
   * Text content or description of the annotation.
   */
  get contents(): string | null {
    const str = this.dict.getString("Contents", this.registry.resolve.bind(this.registry));

    return str?.asString() ?? null;
  }

  /**
   * Set the annotation contents.
   */
  setContents(contents: string): void {
    this.dict.set("Contents", PdfString.fromString(contents));
    this.markModified();
  }

  /**
   * Annotation name (unique identifier within page).
   */
  get name(): string | null {
    const name = this.dict.getString("NM", this.registry.resolve.bind(this.registry));

    return name?.asString() ?? null;
  }

  /**
   * Set the annotation name.
   */
  setName(name: string): void {
    this.dict.set("NM", PdfString.fromString(name));
    this.markModified();
  }

  /**
   * Modification date.
   */
  get modificationDate(): string | null {
    const m = this.dict.getString("M", this.registry.resolve.bind(this.registry));

    return m?.asString() ?? null;
  }

  /**
   * Set the modification date (PDF date format).
   */
  setModificationDate(date: string): void {
    this.dict.set("M", PdfString.fromString(date));
    this.markModified();
  }

  /**
   * Annotation flags.
   */
  get flags(): number {
    return this.dict.getNumber("F", this.registry.resolve.bind(this.registry))?.value ?? 0;
  }

  /**
   * Check if the annotation has a specific flag set.
   */
  hasFlag(flag: AnnotationFlags): boolean {
    return (this.flags & flag) !== 0;
  }

  /**
   * Set or clear a specific flag.
   */
  setFlag(flag: AnnotationFlags, value: boolean): void {
    let flags = this.flags;

    if (value) {
      flags |= flag;
    } else {
      flags &= ~flag;
    }

    this.dict.set("F", PdfNumber.of(flags));
    this.markModified();
  }

  /**
   * Whether the annotation is hidden.
   */
  get isHidden(): boolean {
    return this.hasFlag(AnnotationFlags.Hidden);
  }

  /**
   * Set whether the annotation is hidden.
   */
  setHidden(hidden: boolean): void {
    this.setFlag(AnnotationFlags.Hidden, hidden);
  }

  /**
   * Whether the annotation is printable.
   */
  get isPrintable(): boolean {
    return this.hasFlag(AnnotationFlags.Print);
  }

  /**
   * Set whether the annotation is printable.
   */
  setPrintable(printable: boolean): void {
    this.setFlag(AnnotationFlags.Print, printable);
  }

  /**
   * Annotation color.
   */
  get color(): Color | null {
    const arr = this.dict.getArray("C", this.registry.resolve.bind(this.registry));

    return parseColorArray(arr);
  }

  /**
   * Set the annotation color.
   */
  setColor(color: Color): void {
    const components = colorToArray(color);
    this.dict.set("C", new PdfArray(components.map(n => PdfNumber.of(n))));
    this.markModified();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Border Style
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the border style.
   */
  getBorderStyle(): BorderStyle | null {
    const bs = this.dict.getDict("BS", this.registry.resolve.bind(this.registry));

    if (!bs) {
      return null;
    }

    const width = bs.getNumber("W", this.registry.resolve.bind(this.registry))?.value ?? 1;
    const styleCode = bs.getName("S", this.registry.resolve.bind(this.registry))?.value ?? "S";
    const style = BORDER_STYLE_MAP[styleCode] ?? "solid";

    const result: BorderStyle = { width, style };

    const dashArr = bs.getArray("D", this.registry.resolve.bind(this.registry));

    if (dashArr) {
      result.dashArray = [];

      for (let i = 0; i < dashArr.length; i++) {
        const val = dashArr.at(i);

        if (val instanceof PdfNumber) {
          result.dashArray.push(val.value);
        }
      }
    }

    return result;
  }

  /**
   * Set the border style.
   */
  setBorderStyle(style: BorderStyle): void {
    const bs = new PdfDict();

    bs.set("W", PdfNumber.of(style.width ?? 1));
    bs.set("S", PdfName.of(BORDER_STYLE_REVERSE_MAP[style.style ?? "solid"]));

    if (style.dashArray && style.dashArray.length > 0) {
      bs.set("D", new PdfArray(style.dashArray.map(n => PdfNumber.of(n))));
    }

    this.dict.set("BS", bs);
    this.markModified();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Appearance Streams
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the annotation has a normal appearance stream.
   */
  hasNormalAppearance(): boolean {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (ap) {
      return ap.has("N");
    }

    return false;
  }

  /**
   * Get the normal appearance stream.
   */
  getNormalAppearance(): PdfStream | null {
    return this.getAppearance("N");
  }

  /**
   * Get the rollover appearance stream.
   */
  getRolloverAppearance(): PdfStream | null {
    return this.getAppearance("R");
  }

  /**
   * Get the down appearance stream.
   */
  getDownAppearance(): PdfStream | null {
    return this.getAppearance("D");
  }

  /**
   * Set the normal appearance stream.
   */
  setNormalAppearance(stream: PdfStream): void {
    this.setAppearance("N", stream);
  }

  /**
   * Set the rollover appearance stream.
   */
  setRolloverAppearance(stream: PdfStream): void {
    this.setAppearance("R", stream);
  }

  /**
   * Set the down appearance stream.
   */
  setDownAppearance(stream: PdfStream): void {
    this.setAppearance("D", stream);
  }

  /**
   * Get an appearance stream by type.
   */
  private getAppearance(type: "N" | "R" | "D"): PdfStream | null {
    const ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (!ap) {
      return null;
    }

    const entry = ap.get(type, this.registry.resolve.bind(this.registry));

    if (entry instanceof PdfStream) {
      return entry;
    }

    // It could be a dict of appearance states (for Widget annotations)
    // For most annotations, it's a direct stream
    return null;
  }

  /**
   * Set an appearance stream by type.
   */
  private setAppearance(type: "N" | "R" | "D", stream: PdfStream): void {
    let ap = this.dict.getDict("AP", this.registry.resolve.bind(this.registry));

    if (ap instanceof PdfDict) {
      // Register the stream and store the reference
      const streamRef = this.registry.register(stream);

      ap.set(type, streamRef);

      this.markModified();

      return;
    }

    ap = new PdfDict();
    this.dict.set("AP", ap);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Change Tracking
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Mark the annotation as modified.
   * Called automatically by setters.
   * Note: The dict's dirty flag is set automatically by PdfDict operations.
   */
  protected markModified(): void {
    this._modified = true;
  }

  /**
   * Check if the annotation has been modified.
   */
  get isModified(): boolean {
    return this._modified;
  }
}

/**
 * Parse a PDF color array into a Color object.
 */
export function parseColorArray(arr: PdfArray | undefined): Color | null {
  if (!arr || arr.length === 0) {
    return null;
  }

  const values: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    const val = arr.at(i);

    if (val instanceof PdfNumber) {
      values.push(val.value);
    }
  }

  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return grayscale(values[0]);
  }

  if (values.length === 3) {
    return rgb(values[0], values[1], values[2]);
  }

  if (values.length === 4) {
    return cmyk(values[0], values[1], values[2], values[3]);
  }

  return null;
}

/**
 * Create a Rect PDF array from a Rect object.
 */
export function rectToArray(rect: Rect): PdfNumber[] {
  return [
    PdfNumber.of(rect.x),
    PdfNumber.of(rect.y),
    PdfNumber.of(rect.x + rect.width),
    PdfNumber.of(rect.y + rect.height),
  ];
}
