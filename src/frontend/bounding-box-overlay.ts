/**
 * Bounding box overlay component for visualizing text extraction results.
 *
 * Renders colored rectangles over PDF content to show character, word,
 * line, and paragraph boundaries. Integrates with the viewport manager
 * to properly position overlays based on current scale and scroll position.
 */

/**
 * Types of bounding boxes that can be displayed.
 */
export type BoundingBoxType = "character" | "word" | "line" | "paragraph";

/**
 * A single bounding box with its position and dimensions.
 * Coordinates are in PDF points (unscaled).
 */
export interface OverlayBoundingBox {
  /**
   * Type of text element this box represents.
   */
  type: BoundingBoxType;

  /**
   * Page index (0-based).
   */
  pageIndex: number;

  /**
   * Left position in PDF points.
   */
  x: number;

  /**
   * Top position in PDF points (from top of page).
   */
  y: number;

  /**
   * Width in PDF points.
   */
  width: number;

  /**
   * Height in PDF points.
   */
  height: number;

  /**
   * Optional text content within this box.
   */
  text?: string;
}

/**
 * Configuration for bounding box colors.
 */
export interface BoundingBoxColors {
  character: string;
  word: string;
  line: string;
  paragraph: string;
}

/**
 * Default colors for each bounding box type.
 */
export const DEFAULT_BOUNDING_BOX_COLORS: BoundingBoxColors = {
  character: "rgba(239, 68, 68, 0.3)", // red
  word: "rgba(59, 130, 246, 0.3)", // blue
  line: "rgba(34, 197, 94, 0.3)", // green
  paragraph: "rgba(168, 85, 247, 0.3)", // purple
};

/**
 * Border colors (more saturated) for each type.
 */
export const DEFAULT_BOUNDING_BOX_BORDER_COLORS: BoundingBoxColors = {
  character: "rgba(239, 68, 68, 0.8)", // red
  word: "rgba(59, 130, 246, 0.8)", // blue
  line: "rgba(34, 197, 94, 0.8)", // green
  paragraph: "rgba(168, 85, 247, 0.8)", // purple
};

/**
 * Visibility state for each bounding box type.
 */
export interface BoundingBoxVisibility {
  character: boolean;
  word: boolean;
  line: boolean;
  paragraph: boolean;
}

/**
 * Options for creating a BoundingBoxOverlay.
 */
export interface BoundingBoxOverlayOptions {
  /**
   * Custom colors for bounding boxes.
   */
  colors?: Partial<BoundingBoxColors>;

  /**
   * Custom border colors for bounding boxes.
   */
  borderColors?: Partial<BoundingBoxColors>;

  /**
   * Initial visibility state for each type.
   * Defaults to all hidden.
   */
  initialVisibility?: Partial<BoundingBoxVisibility>;

  /**
   * Border width in pixels.
   * @default 1
   */
  borderWidth?: number;
}

/**
 * Event types emitted by BoundingBoxOverlay.
 */
export type BoundingBoxOverlayEventType = "visibilityChange" | "boxesChange";

/**
 * Event data for BoundingBoxOverlay events.
 */
export interface BoundingBoxOverlayEvent {
  type: BoundingBoxOverlayEventType;
  visibility?: BoundingBoxVisibility;
  pageIndex?: number;
}

/**
 * Listener function for BoundingBoxOverlay events.
 */
export type BoundingBoxOverlayEventListener = (event: BoundingBoxOverlayEvent) => void;

/**
 * Manages bounding box overlay rendering for PDF pages.
 *
 * This component creates overlay layers on top of PDF page containers
 * and renders colored rectangles representing text boundaries at
 * different levels (characters, words, lines, paragraphs).
 *
 * @example
 * ```ts
 * const overlay = new BoundingBoxOverlay({
 *   colors: {
 *     character: 'rgba(255, 0, 0, 0.3)',
 *     word: 'rgba(0, 0, 255, 0.3)',
 *   },
 * });
 *
 * // Set bounding boxes for a page
 * overlay.setBoundingBoxes(0, boxes);
 *
 * // Show word boxes
 * overlay.setVisibility('word', true);
 *
 * // Render to a page container
 * overlay.renderToPage(0, pageContainer, scale);
 * ```
 */
export class BoundingBoxOverlay {
  private _colors: BoundingBoxColors;
  private _borderColors: BoundingBoxColors;
  private _visibility: BoundingBoxVisibility;
  private _borderWidth: number;
  private _boundingBoxes: Map<number, OverlayBoundingBox[]> = new Map();
  private _overlayElements: Map<number, HTMLElement> = new Map();
  private _listeners: Map<BoundingBoxOverlayEventType, Set<BoundingBoxOverlayEventListener>> =
    new Map();

  constructor(options: BoundingBoxOverlayOptions = {}) {
    this._colors = {
      ...DEFAULT_BOUNDING_BOX_COLORS,
      ...options.colors,
    };
    this._borderColors = {
      ...DEFAULT_BOUNDING_BOX_BORDER_COLORS,
      ...options.borderColors,
    };
    this._visibility = {
      character: false,
      word: false,
      line: false,
      paragraph: false,
      ...options.initialVisibility,
    };
    this._borderWidth = options.borderWidth ?? 1;
  }

  /**
   * Get the current visibility state.
   */
  get visibility(): BoundingBoxVisibility {
    return { ...this._visibility };
  }

  /**
   * Get the current colors.
   */
  get colors(): BoundingBoxColors {
    return { ...this._colors };
  }

  /**
   * Set the visibility of a specific bounding box type.
   */
  setVisibility(type: BoundingBoxType, visible: boolean): void {
    if (this._visibility[type] === visible) {
      return;
    }

    this._visibility[type] = visible;
    this.emitEvent({ type: "visibilityChange", visibility: this.visibility });

    // Re-render all overlays
    this.updateAllOverlays();
  }

  /**
   * Toggle the visibility of a specific bounding box type.
   */
  toggleVisibility(type: BoundingBoxType): void {
    this.setVisibility(type, !this._visibility[type]);
  }

  /**
   * Set visibility for all types at once.
   */
  setAllVisibility(visibility: Partial<BoundingBoxVisibility>): void {
    let changed = false;

    for (const type of Object.keys(visibility) as BoundingBoxType[]) {
      if (visibility[type] !== undefined && this._visibility[type] !== visibility[type]) {
        this._visibility[type] = visibility[type]!;
        changed = true;
      }
    }

    if (changed) {
      this.emitEvent({ type: "visibilityChange", visibility: this.visibility });
      this.updateAllOverlays();
    }
  }

  /**
   * Set bounding boxes for a specific page.
   */
  setBoundingBoxes(pageIndex: number, boxes: OverlayBoundingBox[]): void {
    this._boundingBoxes.set(pageIndex, boxes);
    this.emitEvent({ type: "boxesChange", pageIndex });

    // Re-render overlay for this page if it exists
    const overlay = this._overlayElements.get(pageIndex);
    if (overlay) {
      this.renderOverlayContent(pageIndex, overlay);
    }
  }

  /**
   * Get bounding boxes for a specific page.
   */
  getBoundingBoxes(pageIndex: number): OverlayBoundingBox[] {
    return this._boundingBoxes.get(pageIndex) ?? [];
  }

  /**
   * Clear bounding boxes for a specific page.
   */
  clearBoundingBoxes(pageIndex: number): void {
    this._boundingBoxes.delete(pageIndex);
    this.emitEvent({ type: "boxesChange", pageIndex });

    const overlay = this._overlayElements.get(pageIndex);
    if (overlay) {
      overlay.innerHTML = "";
    }
  }

  /**
   * Clear all bounding boxes.
   */
  clearAllBoundingBoxes(): void {
    this._boundingBoxes.clear();

    for (const overlay of this._overlayElements.values()) {
      overlay.innerHTML = "";
    }
  }

  /**
   * Create or update the overlay layer for a page.
   * Call this when a page is rendered or when the scale changes.
   *
   * @param pageIndex - Page index (0-based)
   * @param container - The page container element
   * @param scale - Current zoom scale
   * @param pageHeight - Height of the page in PDF points (for coordinate conversion)
   */
  renderToPage(
    pageIndex: number,
    container: HTMLElement,
    scale: number,
    pageHeight: number,
  ): HTMLElement {
    // Get or create overlay element
    let overlay = this._overlayElements.get(pageIndex);

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "bounding-box-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.right = "0";
      overlay.style.bottom = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.overflow = "hidden";
      this._overlayElements.set(pageIndex, overlay);
    }

    // Store scale and page height as data attributes for rendering
    overlay.dataset.scale = String(scale);
    overlay.dataset.pageHeight = String(pageHeight);

    // Append to container if not already there
    if (overlay.parentElement !== container) {
      container.appendChild(overlay);
    }

    // Render the content
    this.renderOverlayContent(pageIndex, overlay);

    return overlay;
  }

  /**
   * Remove the overlay for a specific page.
   */
  removeFromPage(pageIndex: number): void {
    const overlay = this._overlayElements.get(pageIndex);
    if (overlay) {
      overlay.remove();
      this._overlayElements.delete(pageIndex);
    }
  }

  /**
   * Remove all overlays.
   */
  removeAllOverlays(): void {
    for (const overlay of this._overlayElements.values()) {
      overlay.remove();
    }
    this._overlayElements.clear();
  }

  /**
   * Update the scale for all existing overlays.
   * Call this after zoom changes.
   */
  updateScale(scale: number): void {
    for (const [pageIndex, overlay] of this._overlayElements) {
      overlay.dataset.scale = String(scale);
      this.renderOverlayContent(pageIndex, overlay);
    }
  }

  /**
   * Add an event listener.
   */
  addEventListener(
    type: BoundingBoxOverlayEventType,
    listener: BoundingBoxOverlayEventListener,
  ): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(
    type: BoundingBoxOverlayEventType,
    listener: BoundingBoxOverlayEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  /**
   * Dispose of the overlay and clean up resources.
   */
  dispose(): void {
    this.removeAllOverlays();
    this._boundingBoxes.clear();
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private renderOverlayContent(pageIndex: number, overlay: HTMLElement): void {
    // Clear existing content
    overlay.innerHTML = "";

    const boxes = this._boundingBoxes.get(pageIndex);
    if (!boxes || boxes.length === 0) {
      return;
    }

    const scale = parseFloat(overlay.dataset.scale ?? "1");
    const pageHeight = parseFloat(overlay.dataset.pageHeight ?? "0");

    // Filter visible boxes and sort by type (larger boxes first, so smaller ones render on top)
    const typeOrder: Record<BoundingBoxType, number> = {
      paragraph: 0,
      line: 1,
      word: 2,
      character: 3,
    };

    const visibleBoxes = boxes
      .filter(box => this._visibility[box.type])
      .sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    // Create a document fragment for efficiency
    const fragment = document.createDocumentFragment();

    for (const box of visibleBoxes) {
      const rect = document.createElement("div");
      rect.className = `bounding-box bounding-box-${box.type}`;

      // Convert PDF coordinates to screen coordinates
      // PDF coordinates have origin at bottom-left, screen at top-left
      const screenY = pageHeight - box.y - box.height;

      rect.style.position = "absolute";
      rect.style.left = `${box.x * scale}px`;
      rect.style.top = `${screenY * scale}px`;
      rect.style.width = `${box.width * scale}px`;
      rect.style.height = `${box.height * scale}px`;
      rect.style.backgroundColor = this._colors[box.type];
      rect.style.border = `${this._borderWidth}px solid ${this._borderColors[box.type]}`;
      rect.style.boxSizing = "border-box";

      if (box.text) {
        rect.title = box.text;
      }

      fragment.appendChild(rect);
    }

    overlay.appendChild(fragment);
  }

  private updateAllOverlays(): void {
    for (const [pageIndex, overlay] of this._overlayElements) {
      this.renderOverlayContent(pageIndex, overlay);
    }
  }

  private emitEvent(event: BoundingBoxOverlayEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new BoundingBoxOverlay instance.
 */
export function createBoundingBoxOverlay(options?: BoundingBoxOverlayOptions): BoundingBoxOverlay {
  return new BoundingBoxOverlay(options);
}
