/**
 * Shared types for PDF annotations.
 *
 * PDF Reference: Section 12.5 "Annotations"
 */

import type { PDFPage } from "#src/api/pdf-page";
import type { Color } from "#src/helpers/colors";
import type { PdfRef } from "#src/objects/pdf-ref";

/**
 * Annotation subtype values as defined in PDF spec Table 169.
 */
export type AnnotationSubtype =
  | "Text"
  | "Link"
  | "FreeText"
  | "Line"
  | "Square"
  | "Circle"
  | "Polygon"
  | "PolyLine"
  | "Highlight"
  | "Underline"
  | "Squiggly"
  | "StrikeOut"
  | "Stamp"
  | "Caret"
  | "Ink"
  | "Popup"
  | "FileAttachment"
  | "Widget"; // Widget is handled separately by forms subsystem

export const isAnnotationSubtype = (subtype: unknown): subtype is AnnotationSubtype => {
  return (
    subtype === "Text" ||
    subtype === "Link" ||
    subtype === "FreeText" ||
    subtype === "Line" ||
    subtype === "Square" ||
    subtype === "Circle" ||
    subtype === "Polygon" ||
    subtype === "PolyLine" ||
    subtype === "Highlight" ||
    subtype === "Underline" ||
    subtype === "Squiggly" ||
    subtype === "StrikeOut" ||
    subtype === "Stamp" ||
    subtype === "Caret" ||
    subtype === "Ink" ||
    subtype === "Popup" ||
    subtype === "FileAttachment" ||
    subtype === "Widget"
  );
};

/**
 * Annotation flags (PDF spec Table 165).
 */
export enum AnnotationFlags {
  /** Don't display unknown types */
  Invisible = 1 << 0,
  /** Don't display or print */
  Hidden = 1 << 1,
  /** Print when page is printed */
  Print = 1 << 2,
  /** Don't scale with page zoom */
  NoZoom = 1 << 3,
  /** Don't rotate with page */
  NoRotate = 1 << 4,
  /** Don't display on screen */
  NoView = 1 << 5,
  /** Don't allow interaction */
  ReadOnly = 1 << 6,
  /** Don't allow deletion/modification */
  Locked = 1 << 7,
  /** Invert NoView for certain events */
  ToggleNoView = 1 << 8,
  /** Don't allow content modification */
  LockedContents = 1 << 9,
}

/**
 * A rectangle defined by x, y (bottom-left origin), width, and height.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A point in 2D space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Border style types.
 */
export type BorderStyleType = "solid" | "dashed" | "beveled" | "inset" | "underline";

/**
 * Border style configuration.
 */
export interface BorderStyle {
  /** Border width in points (default: 1) */
  width?: number;
  /** Border style (default: "solid") */
  style?: BorderStyleType;
  /** Dash array for dashed style (default: [3]) */
  dashArray?: number[];
}

/**
 * Line ending styles (PDF spec Table 176).
 */
export type LineEndingStyle =
  | "None"
  | "Square"
  | "Circle"
  | "Diamond"
  | "OpenArrow"
  | "ClosedArrow"
  | "Butt"
  | "ROpenArrow"
  | "RClosedArrow"
  | "Slash";

/**
 * Text annotation icon names (PDF spec Table 172).
 */
export type TextAnnotationIcon =
  | "Comment"
  | "Key"
  | "Note"
  | "Help"
  | "NewParagraph"
  | "Paragraph"
  | "Insert";

export const isTextAnnotationIcon = (icon: unknown): icon is TextAnnotationIcon => {
  return (
    icon === "Comment" ||
    icon === "Key" ||
    icon === "Note" ||
    icon === "Help" ||
    icon === "NewParagraph" ||
    icon === "Paragraph" ||
    icon === "Insert"
  );
};

/**
 * Stamp annotation standard names (PDF spec Table 181).
 */
export type StampName =
  | "Approved"
  | "Experimental"
  | "NotApproved"
  | "AsIs"
  | "Expired"
  | "NotForPublicRelease"
  | "Confidential"
  | "Final"
  | "Sold"
  | "Departmental"
  | "ForComment"
  | "TopSecret"
  | "Draft"
  | "ForPublicRelease";

export const isStampName = (name: unknown): name is StampName => {
  return (
    name === "Approved" ||
    name === "Experimental" ||
    name === "NotApproved" ||
    name === "AsIs" ||
    name === "Expired" ||
    name === "NotForPublicRelease" ||
    name === "Confidential" ||
    name === "Final" ||
    name === "Sold" ||
    name === "Departmental" ||
    name === "ForComment" ||
    name === "TopSecret" ||
    name === "Draft" ||
    name === "ForPublicRelease"
  );
};

/**
 * File attachment icon names.
 */
export type FileAttachmentIcon = "Graph" | "Paperclip" | "PushPin" | "Tag";

export const isFileAttachmentIcon = (icon: unknown): icon is FileAttachmentIcon => {
  return icon === "Graph" || icon === "Paperclip" || icon === "PushPin" || icon === "Tag";
};

/**
 * Options for creating a Text annotation (sticky note).
 */
export interface TextAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** Text content */
  contents?: string;
  /** Author/title */
  title?: string;
  /** Background color */
  color?: Color;
  /** Icon to display */
  icon?: TextAnnotationIcon;
  /** Whether the popup is initially open */
  open?: boolean;
}

/**
 * Options for creating a text markup annotation (Highlight, Underline, StrikeOut, Squiggly).
 */
export interface TextMarkupAnnotationOptions {
  /** Single rectangle for simple horizontal text */
  rect?: Rect;
  /** Multiple rectangles for multi-line selections */
  rects?: Rect[];
  /** Raw quadPoints for rotated/skewed text (advanced) */
  quadPoints?: number[][];
  /** Annotation color */
  color?: Color;
  /** Opacity (0-1, default: 1) */
  opacity?: number;
  /** Text content/comment */
  contents?: string;
  /** Author/title */
  title?: string;
}

/**
 * Destination types for links.
 */
export type DestinationType = "Fit" | "FitH" | "FitV" | "FitB" | "FitBH" | "FitBV" | "XYZ" | "FitR";

export const isDestinationType = (type: unknown): type is DestinationType => {
  return (
    type === "Fit" ||
    type === "FitH" ||
    type === "FitV" ||
    type === "FitB" ||
    type === "FitBH" ||
    type === "FitBV" ||
    type === "XYZ" ||
    type === "FitR"
  );
};

/**
 * A link destination.
 *
 * For internal destinations, the page is typically a page reference.
 * For remote destinations (GoToR), the page can be a 0-based page index.
 */
export interface LinkDestination {
  /**
   * Target page for the destination.
   *
   * - Internal `GoTo` destinations: a `PdfRef` to a page object.
   * - Remote `GoToR` destinations: a 0-based page index (`number`).
   */
  page: PdfRef | number;

  /** Destination type */
  type: DestinationType;
  /** Top coordinate for FitH, FitBH, XYZ */
  top?: number;
  /** Left coordinate for FitV, FitBV, XYZ */
  left?: number;
  /** Zoom level for XYZ (null means no change) */
  zoom?: number | null;
  /** Bounds for FitR: [left, bottom, right, top] */
  rect?: [number, number, number, number];
}

/**
 * A link destination for internal links created in this document.
 */
export type InternalLinkDestination = Omit<LinkDestination, "page"> & {
  /** Target page in the current document. */
  page: PdfRef | PDFPage;
};

/**
 * Options for creating a Link annotation.
 */
export interface LinkAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** External URI */
  uri?: string;
  /**
   * Internal destination within this document.
   *
   * Pass a `PDFPage` (recommended) or a `PdfRef` to the target page.
   */
  destination?: InternalLinkDestination;
  /** Border width (default: 0 for invisible border) */
  borderWidth?: number;
  /** Border color */
  borderColor?: Color;
}

/**
 * Options for creating a FreeText annotation.
 */
export interface FreeTextAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** Text content */
  contents: string;
  /** Font size (default: 12) */
  fontSize?: number;
  /** Text color (default: black) */
  color?: Color;
  /** Background color */
  backgroundColor?: Color;
  /** Border color */
  borderColor?: Color;
  /** Border width */
  borderWidth?: number;
  /** Text alignment: 0=left, 1=center, 2=right */
  justification?: 0 | 1 | 2;
}

/**
 * Options for creating a Line annotation.
 */
export interface LineAnnotationOptions {
  /** Start point */
  start: Point;
  /** End point */
  end: Point;
  /** Line color */
  color?: Color;
  /** Line width (default: 1) */
  width?: number;
  /** Line ending style at start */
  startStyle?: LineEndingStyle;
  /** Line ending style at end */
  endStyle?: LineEndingStyle;
  /** Fill color for closed arrows */
  interiorColor?: Color;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a Square annotation.
 */
export interface SquareAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** Stroke color */
  color?: Color;
  /** Fill color */
  fillColor?: Color;
  /** Border width (default: 1) */
  borderWidth?: number;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a Circle annotation.
 */
export interface CircleAnnotationOptions {
  /** Annotation rectangle (bounding box of ellipse) */
  rect: Rect;
  /** Stroke color */
  color?: Color;
  /** Fill color */
  fillColor?: Color;
  /** Border width (default: 1) */
  borderWidth?: number;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a Polygon annotation.
 */
export interface PolygonAnnotationOptions {
  /** Vertices of the polygon */
  vertices: Point[];
  /** Stroke color */
  color?: Color;
  /** Fill color */
  fillColor?: Color;
  /** Border width (default: 1) */
  borderWidth?: number;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a PolyLine annotation.
 */
export interface PolylineAnnotationOptions {
  /** Vertices of the polyline */
  vertices: Point[];
  /** Line color */
  color?: Color;
  /** Line width (default: 1) */
  width?: number;
  /** Line ending style at start */
  startStyle?: LineEndingStyle;
  /** Line ending style at end */
  endStyle?: LineEndingStyle;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a Stamp annotation.
 */
export interface StampAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** Stamp name (use StampName constants for standard stamps, or any string for custom) */
  name?: StampName | (string & {});
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating an Ink annotation.
 */
export interface InkAnnotationOptions {
  /** Paths (array of point arrays) */
  paths: Point[][];
  /** Stroke color */
  color?: Color;
  /** Stroke width (default: 1) */
  width?: number;
  /** Text content/comment */
  contents?: string;
}

/**
 * Options for creating a Caret annotation.
 */
export interface CaretAnnotationOptions {
  /** Annotation rectangle */
  rect: Rect;
  /** Symbol: "P" for paragraph, "None" */
  symbol?: "P" | "None";
  /** Text content/comment */
  contents?: string;
  /** Annotation color */
  color?: Color;
}

/**
 * Options for creating a Popup annotation (linked to another annotation).
 */
export interface PopupOptions {
  /** Popup rectangle */
  rect: Rect;
  /** Initially open */
  open?: boolean;
}

/**
 * Options for removing annotations.
 */
export interface RemoveAnnotationsOptions {
  /** Filter by annotation type */
  type?: AnnotationSubtype;
}

/**
 * Options for flattening annotations.
 */
export interface FlattenAnnotationsOptions {
  /** Annotation types to exclude from flattening */
  exclude?: AnnotationSubtype[];

  /**
   * Remove Link annotations instead of keeping them.
   *
   * Link annotations contain URI or other actions that Adobe considers
   * "hidden behavior" which can cause signature validation warnings.
   * Enable this option when preparing documents for signing.
   *
   * @default false
   */
  removeLinks?: boolean;
}
