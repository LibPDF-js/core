/**
 * PDFMarkupAnnotation - Base class for markup annotations.
 *
 * Markup annotations include Text, FreeText, Line, Square, Circle,
 * Polygon, PolyLine, Highlight, Underline, Squiggly, StrikeOut,
 * Stamp, Caret, Ink, and FileAttachment.
 *
 * They share common properties like title, popup, opacity, and dates.
 *
 * PDF Reference: Section 12.5.6.2 "Markup Annotations"
 */

import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import type { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";

import { PDFAnnotation, rectToArray } from "./base";
import { PDFPopupAnnotation } from "./popup";
import type { PopupOptions } from "./types";

/**
 * Base class for markup annotations.
 */
export class PDFMarkupAnnotation extends PDFAnnotation {
  /** Cached popup annotation */
  private _popup: PDFPopupAnnotation | null | undefined = undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  // Markup-Specific Properties
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Text label for the annotation (often the author name).
   */
  get title(): string | null {
    const t = this.dict.getString("T");

    return t?.asString() ?? null;
  }

  /**
   * Set the title/author.
   */
  setTitle(title: string): void {
    this.dict.set("T", PdfString.fromString(title));
    this.markModified();
  }

  /**
   * Opacity (CA) - constant opacity value for the annotation.
   * Range 0-1, where 0 is fully transparent and 1 is fully opaque.
   */
  get opacity(): number {
    const ca = this.dict.getNumber("CA");

    return ca?.value ?? 1;
  }

  /**
   * Set the opacity.
   */
  setOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(1, opacity));
    this.dict.set("CA", PdfNumber.of(clamped));
    this.markModified();
  }

  /**
   * Creation date (CreationDate).
   */
  get creationDate(): string | null {
    const cd = this.dict.getString("CreationDate");

    return cd?.asString() ?? null;
  }

  /**
   * Set the creation date.
   */
  setCreationDate(date: string): void {
    this.dict.set("CreationDate", PdfString.fromString(date));
    this.markModified();
  }

  /**
   * Subject - the subject of the annotation.
   */
  get subject(): string | null {
    const subj = this.dict.getString("Subj");

    return subj?.asString() ?? null;
  }

  /**
   * Set the subject.
   */
  setSubject(subject: string): void {
    this.dict.set("Subj", PdfString.fromString(subject));
    this.markModified();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Popup Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Reference to an associated popup annotation.
   */
  get popupRef(): PdfRef | null {
    const popup = this.dict.get("Popup");

    return popup?.type === "ref" ? popup : null;
  }

  /**
   * Get the associated popup annotation, if any.
   */
  async getPopup(): Promise<PDFPopupAnnotation | null> {
    if (this._popup !== undefined) {
      return this._popup;
    }

    const popupRef = this.popupRef;

    if (!popupRef) {
      this._popup = null;

      return null;
    }

    const popupDict = await this.registry.resolve(popupRef);

    if (popupDict && popupDict.type === "dict") {
      this._popup = new PDFPopupAnnotation(popupDict as PdfDict, popupRef, this.registry);

      return this._popup;
    }

    this._popup = null;

    return null;
  }

  /**
   * Create a popup annotation associated with this annotation.
   * The popup is added to the parent annotation and registered.
   */
  createPopup(options: PopupOptions): PDFPopupAnnotation {
    if (!this.ref) {
      throw new Error("Cannot create popup for annotation without reference");
    }

    const popupDict = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Popup"),
      Rect: new PdfArray(rectToArray(options.rect)),
      Parent: this.ref,
    });

    if (options.open) {
      popupDict.set("Open", PdfBool.of(true));
    }

    // Register the popup
    const popupRef = this.registry.register(popupDict);

    // Link this annotation to the popup
    this.dict.set("Popup", popupRef);
    this.markModified();

    const popup = new PDFPopupAnnotation(popupDict, popupRef, this.registry);
    this._popup = popup;

    return popup;
  }

  /**
   * Get the reply-to annotation reference (for replies).
   */
  get inReplyToRef(): PdfRef | null {
    const irt = this.dict.get("IRT");

    return irt?.type === "ref" ? irt : null;
  }

  /**
   * Intent (IT) - the intent of the markup annotation.
   */
  get intent(): string | null {
    const it = this.dict.getName("IT");

    return it?.value ?? null;
  }
}
