/**
 * AnnotationFactory - Creates annotation objects from PDF dictionaries.
 *
 * Dispatches to the appropriate annotation class based on /Subtype.
 * Handles unknown annotation types gracefully.
 */

import type { ObjectRegistry } from "#src/document/object-registry";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfRef } from "#src/objects/pdf-ref";

import { PDFAnnotation } from "./base";
import { PDFCaretAnnotation } from "./caret";
import { PDFFileAttachmentAnnotation } from "./file-attachment";
import { PDFFreeTextAnnotation } from "./free-text";
import { PDFInkAnnotation } from "./ink";
import { PDFLineAnnotation } from "./line";
import { PDFLinkAnnotation } from "./link";
import { PDFPolygonAnnotation, PDFPolylineAnnotation } from "./polygon";
import { PDFPopupAnnotation } from "./popup";
import { PDFCircleAnnotation, PDFSquareAnnotation } from "./square-circle";
import { PDFStampAnnotation } from "./stamp";
import { PDFTextAnnotation } from "./text";
import {
  PDFHighlightAnnotation,
  PDFSquigglyAnnotation,
  PDFStrikeOutAnnotation,
  PDFUnderlineAnnotation,
} from "./text-markup";
import type { AnnotationSubtype } from "./types";

/**
 * Unknown annotation - fallback for unsupported types.
 */
export class PDFUnknownAnnotation extends PDFAnnotation {}

/**
 * Create an annotation object from a PDF dictionary.
 *
 * @param dict - The annotation dictionary
 * @param ref - The reference to the annotation object
 * @param registry - The object registry for resolving references
 * @returns The appropriate annotation class instance
 */
export function createAnnotation(
  dict: PdfDict,
  ref: PdfRef | null,
  registry: ObjectRegistry,
): PDFAnnotation {
  const subtype = dict.getName("Subtype")?.value as AnnotationSubtype | undefined;

  switch (subtype) {
    case "Text":
      return new PDFTextAnnotation(dict, ref, registry);

    case "Link":
      return new PDFLinkAnnotation(dict, ref, registry);

    case "FreeText":
      return new PDFFreeTextAnnotation(dict, ref, registry);

    case "Line":
      return new PDFLineAnnotation(dict, ref, registry);

    case "Square":
      return new PDFSquareAnnotation(dict, ref, registry);

    case "Circle":
      return new PDFCircleAnnotation(dict, ref, registry);

    case "Polygon":
      return new PDFPolygonAnnotation(dict, ref, registry);

    case "PolyLine":
      return new PDFPolylineAnnotation(dict, ref, registry);

    case "Highlight":
      return new PDFHighlightAnnotation(dict, ref, registry);

    case "Underline":
      return new PDFUnderlineAnnotation(dict, ref, registry);

    case "Squiggly":
      return new PDFSquigglyAnnotation(dict, ref, registry);

    case "StrikeOut":
      return new PDFStrikeOutAnnotation(dict, ref, registry);

    case "Stamp":
      return new PDFStampAnnotation(dict, ref, registry);

    case "Caret":
      return new PDFCaretAnnotation(dict, ref, registry);

    case "Ink":
      return new PDFInkAnnotation(dict, ref, registry);

    case "Popup":
      return new PDFPopupAnnotation(dict, ref, registry);

    case "FileAttachment":
      return new PDFFileAttachmentAnnotation(dict, ref, registry);

    case "Widget":
      // Widget annotations are handled by the forms subsystem
      // Return as unknown annotation if encountered here
      return new PDFUnknownAnnotation(dict, ref, registry);

    default:
      // Unknown annotation type - return generic
      return new PDFUnknownAnnotation(dict, ref, registry);
  }
}

/**
 * Check if an annotation is a Widget (form field).
 */
export function isWidgetAnnotation(dict: PdfDict): boolean {
  return dict.getName("Subtype")?.value === "Widget";
}

/**
 * Check if an annotation is a Popup.
 */
export function isPopupAnnotation(dict: PdfDict): boolean {
  return dict.getName("Subtype")?.value === "Popup";
}
