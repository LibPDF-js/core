/**
 * Annotation module - PDF annotation support.
 *
 * This module provides classes for reading, creating, and manipulating
 * PDF annotations including text markup, links, shapes, stamps, and more.
 */

// Base classes
export { PDFAnnotation, parseColorArray, rectToArray } from "./base";
// Annotation types
export { type CaretSymbol, PDFCaretAnnotation } from "./caret";
// Factory
export {
  createAnnotation,
  isPopupAnnotation,
  isWidgetAnnotation,
  PDFUnknownAnnotation,
} from "./factory";
export { PDFFileAttachmentAnnotation } from "./file-attachment";
export { type FreeTextJustification, PDFFreeTextAnnotation } from "./free-text";
export { PDFInkAnnotation } from "./ink";
export { PDFLineAnnotation } from "./line";
export { type HighlightMode, type LinkAction, PDFLinkAnnotation } from "./link";
export { PDFMarkupAnnotation } from "./markup";
export { PDFPolygonAnnotation, PDFPolylineAnnotation } from "./polygon";
export { PDFPopupAnnotation } from "./popup";
export { PDFCircleAnnotation, PDFSquareAnnotation } from "./square-circle";
export { PDFStampAnnotation, STANDARD_STAMPS } from "./stamp";
export { PDFTextAnnotation, type TextAnnotationState, type TextAnnotationStateModel } from "./text";
export {
  PDFHighlightAnnotation,
  PDFSquigglyAnnotation,
  PDFStrikeOutAnnotation,
  PDFTextMarkupAnnotation,
  PDFUnderlineAnnotation,
  rectsToQuadPoints,
  rectToQuadPoints,
} from "./text-markup";

// Types
export {
  AnnotationFlags,
  type AnnotationSubtype,
  type BorderStyle,
  type BorderStyleType,
  type CaretAnnotationOptions,
  type CircleAnnotationOptions,
  type DestinationType,
  type FileAttachmentIcon,
  type FlattenAnnotationsOptions,
  type FreeTextAnnotationOptions,
  type InkAnnotationOptions,
  type LineAnnotationOptions,
  type LineEndingStyle,
  type LinkAnnotationOptions,
  type LinkDestination,
  type Point,
  type PolygonAnnotationOptions,
  type PolylineAnnotationOptions,
  type PopupOptions,
  type Rect,
  type RemoveAnnotationsOptions,
  type SquareAnnotationOptions,
  type StampAnnotationOptions,
  type StampName,
  type TextAnnotationIcon,
  type TextAnnotationOptions,
  type TextMarkupAnnotationOptions,
} from "./types";
