/**
 * Types for text extraction from PDF documents.
 *
 * These types represent text content extracted from PDF pages,
 * including position information for searching and highlighting.
 */

/**
 * Rectangle in PDF coordinates (origin at bottom-left).
 */
export interface BoundingBox {
  /** Left edge (x coordinate) */
  x: number;
  /** Bottom edge (y coordinate) */
  y: number;
  /** Width of the box */
  width: number;
  /** Height of the box */
  height: number;
}

/**
 * A single extracted character with its position and style information.
 */
export interface ExtractedChar {
  /** The Unicode character(s) */
  char: string;
  /** Bounding box of the character */
  bbox: BoundingBox;
  /** Font size in points */
  fontSize: number;
  /** Font name (e.g., "Helvetica", "Arial-BoldMT") */
  fontName: string;
  /** Y coordinate of the text baseline */
  baseline: number;
  /** Index in the content stream extraction order (0-based) */
  sequenceIndex?: number;
}

/**
 * A span of text with the same font and size on the same line.
 */
export interface TextSpan {
  /** The text content */
  text: string;
  /** Bounding box around the entire span */
  bbox: BoundingBox;
  /** Individual characters (for precise positioning) */
  chars: ExtractedChar[];
  /** Font size in points */
  fontSize: number;
  /** Font name */
  fontName: string;
}

/**
 * A line of text (multiple spans on the same baseline).
 */
export interface TextLine {
  /** Combined text from all spans */
  text: string;
  /** Bounding box around the entire line */
  bbox: BoundingBox;
  /** Individual spans within the line */
  spans: TextSpan[];
  /** Y coordinate of the baseline */
  baseline: number;
}

/**
 * Full page text extraction result.
 */
export interface PageText {
  /** Page index (0-based) */
  pageIndex: number;
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
  /** All text lines on the page */
  lines: TextLine[];
  /** Plain text content (lines joined with newlines) */
  text: string;
}

/**
 * A search match result.
 */
export interface TextMatch {
  /** The matched text */
  text: string;
  /** Bounding box around the entire match */
  bbox: BoundingBox;
  /** Page index where the match was found */
  pageIndex: number;
  /** Individual character bounding boxes (useful for multi-line matches or highlighting) */
  charBoxes: BoundingBox[];
}

/**
 * Options for text extraction.
 */
export interface ExtractTextOptions {
  /**
   * Include individual character positions.
   * Default: true (needed for search support)
   */
  includeChars?: boolean;
}

/**
 * Options for text search.
 */
export interface FindTextOptions {
  /** Page indices to search (default: all pages) */
  pages?: number[];
  /** Case-sensitive matching (default: true) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
}

/**
 * Merge multiple bounding boxes into one that encompasses all of them.
 */
export function mergeBboxes(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...boxes.map(b => b.x));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxX = Math.max(...boxes.map(b => b.x + b.width));
  const maxY = Math.max(...boxes.map(b => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
