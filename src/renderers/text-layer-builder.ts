/**
 * DOM-based text layer builder for PDF viewing.
 *
 * Creates a transparent DOM overlay that positions span elements precisely
 * over rendered text in the canvas. This enables native browser text selection
 * while the text remains visually rendered on the canvas beneath.
 */

import { CoordinateTransformer, type Rect2D } from "#src/coordinate-transformer";
import type { ExtractedChar } from "#src/text/types";

/**
 * Options for building the text layer.
 */
export interface TextLayerBuilderOptions {
  /**
   * The container element to render the text layer into.
   * This element will be populated with positioned span elements.
   */
  container: HTMLElement;

  /**
   * The coordinate transformer for converting PDF coordinates to screen coordinates.
   */
  transformer: CoordinateTransformer;
}

/**
 * Result of building the text layer.
 */
export interface TextLayerResult {
  /**
   * The number of text spans created.
   */
  spanCount: number;

  /**
   * The container element with the text layer.
   */
  container: HTMLElement;
}

/**
 * TextLayerBuilder creates a DOM overlay for text selection.
 *
 * It takes extracted character data from PDF pages and positions transparent
 * span elements over the canvas rendering, enabling native browser text
 * selection while keeping the visual rendering on the canvas.
 *
 * @example
 * ```ts
 * const builder = new TextLayerBuilder({
 *   container: textLayerDiv,
 *   transformer: coordinateTransformer,
 * });
 *
 * // Extract text from PDF page
 * const chars = textExtractor.extract(contentBytes);
 *
 * // Build the text layer
 * const result = builder.buildTextLayer(chars);
 * console.log(`Created ${result.spanCount} text spans`);
 * ```
 */
export class TextLayerBuilder {
  private readonly _container: HTMLElement;
  private readonly _transformer: CoordinateTransformer;

  constructor(options: TextLayerBuilderOptions) {
    this._container = options.container;
    this._transformer = options.transformer;
  }

  /**
   * Get the container element.
   */
  get container(): HTMLElement {
    return this._container;
  }

  /**
   * Get the coordinate transformer.
   */
  get transformer(): CoordinateTransformer {
    return this._transformer;
  }

  /**
   * Build the text layer from extracted characters.
   *
   * Creates transparent span elements positioned over the text locations.
   * Each span enables text selection for the corresponding character.
   *
   * @param chars - Array of extracted characters with position data
   * @returns Result containing span count and container reference
   */
  buildTextLayer(chars: ExtractedChar[]): TextLayerResult {
    // Clear any existing content
    this.clear();

    // Set up the container for text layer rendering
    this.setupContainer();

    let spanCount = 0;

    for (const char of chars) {
      // Skip whitespace characters that don't need visual spans
      if (char.char === " " || char.char === "\t") {
        // Still create spans for spaces to maintain selection continuity
        const span = this.createSpan(char);
        if (span) {
          this._container.appendChild(span);
          spanCount++;
        }
        continue;
      }

      const span = this.createSpan(char);
      if (span) {
        this._container.appendChild(span);
        spanCount++;
      }
    }

    return {
      spanCount,
      container: this._container,
    };
  }

  /**
   * Clear the text layer content.
   */
  clear(): void {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  }

  /**
   * Set up the container element for text layer rendering.
   */
  private setupContainer(): void {
    // Position absolutely within the parent (should be relative to canvas)
    this._container.style.position = "absolute";
    this._container.style.left = "0";
    this._container.style.top = "0";
    this._container.style.right = "0";
    this._container.style.bottom = "0";

    // Allow text selection while being transparent
    this._container.style.overflow = "hidden";
    this._container.style.opacity = "1";
    this._container.style.lineHeight = "1";

    // Disable pointer events on container but enable on children
    this._container.style.pointerEvents = "none";
  }

  /**
   * Create a span element for a character.
   *
   * @param char - The extracted character data
   * @returns The span element or null if creation failed
   */
  private createSpan(char: ExtractedChar): HTMLSpanElement | null {
    // Convert PDF bounding box to screen coordinates
    const pdfRect: Rect2D = {
      x: char.bbox.x,
      y: char.bbox.y,
      width: char.bbox.width,
      height: char.bbox.height,
    };

    const screenRect = this._transformer.pdfRectToScreen(pdfRect);

    // Skip if the rect has invalid dimensions
    if (screenRect.width <= 0 || screenRect.height <= 0) {
      return null;
    }

    const span = document.createElement("span");

    // Set the text content
    span.textContent = char.char;

    // Position the span absolutely
    span.style.position = "absolute";
    span.style.left = `${screenRect.x}px`;
    span.style.top = `${screenRect.y}px`;
    span.style.width = `${screenRect.width}px`;
    span.style.height = `${screenRect.height}px`;

    // Make the text transparent but selectable
    span.style.color = "transparent";
    span.style.pointerEvents = "auto";

    // Match font size to fill the span (approximate)
    const scaledFontSize = this._transformer.pdfDistanceToScreen(char.fontSize);
    span.style.fontSize = `${scaledFontSize}px`;
    span.style.fontFamily = this.mapFontName(char.fontName);

    // Prevent text from affecting layout
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";

    // Critical CSS properties to prevent character overlap:
    // 1. Set transform origin to top-left for consistent positioning
    span.style.transformOrigin = "0 0";

    // 2. Use scaleX to fit character exactly within its bounding box width
    // The browser's native character width may differ from PDF's calculated width
    // We estimate the natural rendered width and scale to match the target width
    // Average character width is roughly 0.55 * fontSize for most fonts
    const estimatedCharWidth = scaledFontSize * 0.55;
    if (estimatedCharWidth > 0 && screenRect.width > 0) {
      const scaleX = screenRect.width / estimatedCharWidth;
      span.style.transform = `scaleX(${scaleX})`;
    }

    // 3. Reset spacing that could cause overlap between adjacent characters
    span.style.letterSpacing = "0";
    span.style.wordSpacing = "0";

    // 4. Set line-height to control vertical positioning
    span.style.lineHeight = `${screenRect.height}px`;

    // Add data attributes for debugging/accessibility
    span.setAttribute("data-char", char.char);
    if (char.sequenceIndex !== undefined) {
      span.setAttribute("data-index", String(char.sequenceIndex));
    }

    return span;
  }

  /**
   * Map PDF font name to CSS font family.
   *
   * @param fontName - The PDF font name
   * @returns The CSS font family string
   */
  private mapFontName(fontName: string): string {
    // Remove leading slash if present
    const name = fontName.startsWith("/") ? fontName.slice(1) : fontName;

    // Common PDF base fonts to web fonts
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
    };

    return fontMap[name] ?? "sans-serif";
  }
}

/**
 * Create a new TextLayerBuilder instance.
 *
 * @param options - Configuration options for the text layer builder
 * @returns A new TextLayerBuilder instance
 */
export function createTextLayerBuilder(options: TextLayerBuilderOptions): TextLayerBuilder {
  return new TextLayerBuilder(options);
}
