/**
 * PDF.js-based text layer builder.
 *
 * This module provides text layer functionality using PDF.js's text content
 * extraction and positioning. It creates a transparent DOM overlay that enables
 * native browser text selection over rendered PDF pages.
 */

import type {
  PageViewport,
  PDFPageProxy,
  TextContent,
  TextItem,
  TextMarkedContent,
} from "./pdfjs-wrapper";
import { getTextContent, isTextItem } from "./pdfjs-wrapper";

/**
 * Options for building the text layer.
 */
export interface PDFJSTextLayerOptions {
  /**
   * The container element to render the text layer into.
   */
  container: HTMLElement;

  /**
   * The PDF.js viewport for positioning text.
   */
  viewport: PageViewport;

  /**
   * Whether to enhance text readability for screen readers.
   * @default true
   */
  enhanceTextAccessibility?: boolean;
}

/**
 * Result of building the text layer.
 */
export interface PDFJSTextLayerResult {
  /**
   * The number of text divs created.
   */
  divCount: number;

  /**
   * The container element with the text layer.
   */
  container: HTMLElement;

  /**
   * The text content used to build the layer.
   */
  textContent: TextContent;

  /**
   * Array of text spans with their character offsets for highlighting.
   */
  textSpans: Array<{
    element: HTMLElement;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
}

/**
 * Build a text layer from PDF.js text content.
 *
 * Creates transparent div elements positioned over the rendered text,
 * enabling native browser text selection.
 *
 * @param page - The PDF.js page proxy
 * @param options - Configuration options for the text layer
 * @returns The result containing the built text layer
 */
export async function buildPDFJSTextLayer(
  page: PDFPageProxy,
  options: PDFJSTextLayerOptions,
): Promise<PDFJSTextLayerResult> {
  const { container, viewport, enhanceTextAccessibility = true } = options;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Setup container styles
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.overflow = "hidden";
  container.style.opacity = "1";
  container.style.lineHeight = "1";
  container.style.pointerEvents = "none";

  // Get text content from PDF.js
  const textContent = await getTextContent(page);

  let divCount = 0;
  let charOffset = 0;
  const textSpans: PDFJSTextLayerResult["textSpans"] = [];

  // Create a reusable measurement element for text width calculations
  const measureSpan = document.createElement("span");
  measureSpan.style.position = "absolute";
  measureSpan.style.visibility = "hidden";
  measureSpan.style.whiteSpace = "pre";
  document.body.appendChild(measureSpan);

  try {
    // Process each text item
    for (const item of textContent.items) {
      if (!isTextItem(item)) {
        // Skip marked content
        continue;
      }

      const textItem = item as TextItem;

      // Skip empty strings
      if (!textItem.str) {
        continue;
      }

      const span = createTextSpan(textItem, viewport, enhanceTextAccessibility, measureSpan);
      container.appendChild(span);

      // Store span info for highlighting
      textSpans.push({
        element: span,
        text: textItem.str,
        startOffset: charOffset,
        endOffset: charOffset + textItem.str.length,
      });

      charOffset += textItem.str.length;
      divCount++;
    }
  } finally {
    // Clean up measurement element
    document.body.removeChild(measureSpan);
  }

  return {
    divCount,
    container,
    textContent,
    textSpans,
  };
}

/**
 * Create a text span element for a text item.
 */
function createTextSpan(
  item: TextItem,
  viewport: PageViewport,
  enhanceAccessibility: boolean,
  measureSpan: HTMLSpanElement,
): HTMLSpanElement {
  const span = document.createElement("span");

  // Set text content
  span.textContent = item.str;

  // Calculate position
  // PDF.js text items have transform property: [scaleX, skewX, skewY, scaleY, x, y]
  const tx = item.transform;
  const angle = Math.atan2(tx[1], tx[0]);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const fontAscent = fontHeight;

  // Convert to viewport coordinates
  const [x, y] = viewport.convertToViewportPoint(tx[4], tx[5]);

  // Calculate font size in pixels
  const fontSize = fontHeight * viewport.scale;
  const fontFamily = item.fontName ? mapFontName(item.fontName) : "sans-serif";

  // Apply styles
  span.style.position = "absolute";
  span.style.left = `${x}px`;
  span.style.top = `${y - fontAscent * viewport.scale}px`;
  span.style.fontSize = `${fontSize}px`;
  span.style.fontFamily = fontFamily;

  // Make text transparent but selectable
  span.style.color = "transparent";
  span.style.whiteSpace = "pre";
  span.style.pointerEvents = "auto";

  // Calculate horizontal scale to match PDF text width
  // This is critical for accurate text selection alignment
  if (item.width && item.str.length > 0) {
    const targetWidth = item.width * viewport.scale;

    // Measure the actual rendered width using the reusable measurement span
    measureSpan.style.fontSize = `${fontSize}px`;
    measureSpan.style.fontFamily = fontFamily;
    measureSpan.textContent = item.str;

    const actualWidth = measureSpan.getBoundingClientRect().width;

    if (actualWidth > 0) {
      const scaleX = targetWidth / actualWidth;
      // Apply horizontal scaling to stretch text to match PDF width
      if (angle !== 0) {
        span.style.transform = `rotate(${angle}rad) scaleX(${scaleX})`;
      } else {
        span.style.transform = `scaleX(${scaleX})`;
      }
      span.style.transformOrigin = "left top";
    }
  } else if (angle !== 0) {
    // Apply rotation only if no width scaling needed
    span.style.transform = `rotate(${angle}rad)`;
    span.style.transformOrigin = "left bottom";
  }

  // Accessibility enhancements
  if (enhanceAccessibility) {
    span.setAttribute("role", "presentation");
    span.setAttribute("dir", "ltr");
  }

  return span;
}

/**
 * Map PDF font names to CSS font families.
 */
function mapFontName(fontName: string): string {
  // Remove subset prefix (e.g., "ABCDEF+Arial" -> "Arial")
  const name = fontName.replace(/^[A-Z]{6}\+/, "");

  const fontMap: Record<string, string> = {
    Helvetica: "Helvetica, Arial, sans-serif",
    "Helvetica-Bold": "Helvetica, Arial, sans-serif",
    "Helvetica-Oblique": "Helvetica, Arial, sans-serif",
    "Helvetica-BoldOblique": "Helvetica, Arial, sans-serif",
    "Times-Roman": "'Times New Roman', Times, serif",
    "Times-Bold": "'Times New Roman', Times, serif",
    "Times-Italic": "'Times New Roman', Times, serif",
    "Times-BoldItalic": "'Times New Roman', Times, serif",
    Courier: "'Courier New', Courier, monospace",
    "Courier-Bold": "'Courier New', Courier, monospace",
    "Courier-Oblique": "'Courier New', Courier, monospace",
    "Courier-BoldOblique": "'Courier New', Courier, monospace",
    Symbol: "Symbol, serif",
    ZapfDingbats: "ZapfDingbats, serif",
    Arial: "Arial, Helvetica, sans-serif",
    ArialMT: "Arial, Helvetica, sans-serif",
    "Arial-BoldMT": "Arial, Helvetica, sans-serif",
    "Arial-ItalicMT": "Arial, Helvetica, sans-serif",
  };

  // Check for exact match first
  if (fontMap[name]) {
    return fontMap[name];
  }

  // Check for partial matches
  const lowerName = name.toLowerCase();
  if (lowerName.includes("arial") || lowerName.includes("helvetica")) {
    return "Helvetica, Arial, sans-serif";
  }
  if (lowerName.includes("times")) {
    return "'Times New Roman', Times, serif";
  }
  if (lowerName.includes("courier")) {
    return "'Courier New', Courier, monospace";
  }

  return "sans-serif";
}

/**
 * Class-based text layer builder for more control.
 */
export class PDFJSTextLayerBuilder {
  private readonly _container: HTMLElement;
  private readonly _viewport: PageViewport;
  private readonly _enhanceAccessibility: boolean;

  constructor(options: PDFJSTextLayerOptions) {
    this._container = options.container;
    this._viewport = options.viewport;
    this._enhanceAccessibility = options.enhanceTextAccessibility ?? true;
  }

  /**
   * Build the text layer from a PDF page.
   */
  async build(page: PDFPageProxy): Promise<PDFJSTextLayerResult> {
    return buildPDFJSTextLayer(page, {
      container: this._container,
      viewport: this._viewport,
      enhanceTextAccessibility: this._enhanceAccessibility,
    });
  }

  /**
   * Clear the text layer.
   */
  clear(): void {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  /**
   * Get the container element.
   */
  get container(): HTMLElement {
    return this._container;
  }

  /**
   * Get the viewport.
   */
  get viewport(): PageViewport {
    return this._viewport;
  }
}

/**
 * Create a new text layer builder.
 */
export function createPDFJSTextLayerBuilder(options: PDFJSTextLayerOptions): PDFJSTextLayerBuilder {
  return new PDFJSTextLayerBuilder(options);
}
