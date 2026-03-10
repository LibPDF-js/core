/**
 * Virtual scroller for PDF viewing with constant memory usage.
 *
 * Handles scroll position tracking, viewport calculations, and smooth scrolling
 * behavior for large documents. Only renders pages that are visible plus a
 * configurable buffer zone, ensuring constant memory usage regardless of
 * document size.
 *
 * This class is renderer-agnostic and works with any rendering backend
 * (Canvas, SVG, etc.) through the ViewportManager.
 */

/**
 * Dimensions of a page in the document.
 */
export interface PageDimensions {
  /**
   * Page width in points.
   */
  width: number;

  /**
   * Page height in points.
   */
  height: number;
}

/**
 * Layout information for a single page in the virtual scroll container.
 */
export interface PageLayout {
  /**
   * Page index (0-based).
   */
  pageIndex: number;

  /**
   * Top position in the virtual container (in scaled pixels).
   */
  top: number;

  /**
   * Left position in the virtual container (in scaled pixels).
   */
  left: number;

  /**
   * Width in scaled pixels.
   */
  width: number;

  /**
   * Height in scaled pixels.
   */
  height: number;
}

/**
 * A range of visible pages.
 */
export interface VisibleRange {
  /**
   * First visible page index (inclusive).
   */
  start: number;

  /**
   * Last visible page index (inclusive).
   */
  end: number;
}

/**
 * Scroll position in the virtual container.
 */
export interface ScrollPosition {
  /**
   * Horizontal scroll offset in pixels.
   */
  scrollLeft: number;

  /**
   * Vertical scroll offset in pixels.
   */
  scrollTop: number;
}

/**
 * Information about the virtual scroll container.
 */
export interface ContainerInfo {
  /**
   * Total width of all content (virtual width).
   */
  totalWidth: number;

  /**
   * Total height of all content (virtual height).
   */
  totalHeight: number;

  /**
   * Visible viewport width.
   */
  viewportWidth: number;

  /**
   * Visible viewport height.
   */
  viewportHeight: number;
}

/**
 * Options for configuring the VirtualScroller.
 */
export interface VirtualScrollerOptions {
  /**
   * Gap between pages in pixels.
   * @default 10
   */
  pageGap?: number;

  /**
   * Number of pages to render above and below the visible area.
   * Higher values reduce flickering during fast scrolling but use more memory.
   * @default 1
   */
  bufferSize?: number;

  /**
   * Initial scale factor (1 = 100%, 2 = 200%, etc.).
   * @default 1
   */
  scale?: number;

  /**
   * Viewport width in pixels.
   * @default 800
   */
  viewportWidth?: number;

  /**
   * Viewport height in pixels.
   * @default 600
   */
  viewportHeight?: number;

  /**
   * Horizontal padding around the document.
   * @default 20
   */
  horizontalPadding?: number;

  /**
   * Vertical padding around the document.
   * @default 20
   */
  verticalPadding?: number;
}

/**
 * Event types emitted by VirtualScroller.
 */
export type VirtualScrollerEventType =
  | "scroll"
  | "scaleChange"
  | "visibleRangeChange"
  | "layoutChange";

/**
 * Event data for VirtualScroller events.
 */
export interface VirtualScrollerEvent {
  /**
   * Event type.
   */
  type: VirtualScrollerEventType;

  /**
   * Current scroll position (for scroll events).
   */
  scrollPosition?: ScrollPosition;

  /**
   * Current scale (for scaleChange events).
   */
  scale?: number;

  /**
   * Current visible page range (for visibleRangeChange events).
   */
  visibleRange?: VisibleRange;
}

/**
 * Listener function for VirtualScroller events.
 */
export type VirtualScrollerEventListener = (event: VirtualScrollerEvent) => void;

/**
 * VirtualScroller manages scroll position and viewport calculations for PDF viewing.
 *
 * It maintains a layout of all pages in the document and efficiently calculates
 * which pages are visible at any given scroll position. The scroller is
 * renderer-agnostic and can be used with any rendering backend.
 *
 * @example
 * ```ts
 * const scroller = new VirtualScroller({
 *   viewportWidth: 800,
 *   viewportHeight: 600,
 *   scale: 1.5,
 *   bufferSize: 2,
 * });
 *
 * // Set page dimensions (call after loading document)
 * scroller.setPageDimensions([
 *   { width: 612, height: 792 },
 *   { width: 612, height: 792 },
 *   // ... more pages
 * ]);
 *
 * // Get visible pages
 * const visible = scroller.getVisiblePages();
 *
 * // Handle scroll
 * scroller.scrollTo(0, 500);
 * ```
 */
export class VirtualScroller {
  private _pageDimensions: PageDimensions[] = [];
  private _pageLayouts: PageLayout[] = [];
  private _scrollLeft = 0;
  private _scrollTop = 0;
  private _scale: number;
  private _viewportWidth: number;
  private _viewportHeight: number;
  private _pageGap: number;
  private _bufferSize: number;
  private _horizontalPadding: number;
  private _verticalPadding: number;
  private _totalWidth = 0;
  private _totalHeight = 0;
  private _listeners: Map<VirtualScrollerEventType, Set<VirtualScrollerEventListener>> = new Map();
  private _lastVisibleRange: VisibleRange | null = null;

  constructor(options: VirtualScrollerOptions = {}) {
    this._scale = options.scale ?? 1;
    this._viewportWidth = options.viewportWidth ?? 800;
    this._viewportHeight = options.viewportHeight ?? 600;
    this._pageGap = options.pageGap ?? 10;
    this._bufferSize = options.bufferSize ?? 1;
    this._horizontalPadding = options.horizontalPadding ?? 20;
    this._verticalPadding = options.verticalPadding ?? 20;
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * Number of pages in the document.
   */
  get pageCount(): number {
    return this._pageDimensions.length;
  }

  /**
   * Current scale factor.
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * Current horizontal scroll position.
   */
  get scrollLeft(): number {
    return this._scrollLeft;
  }

  /**
   * Current vertical scroll position.
   */
  get scrollTop(): number {
    return this._scrollTop;
  }

  /**
   * Viewport width in pixels.
   */
  get viewportWidth(): number {
    return this._viewportWidth;
  }

  /**
   * Viewport height in pixels.
   */
  get viewportHeight(): number {
    return this._viewportHeight;
  }

  /**
   * Total content width (including padding).
   */
  get totalWidth(): number {
    return this._totalWidth;
  }

  /**
   * Total content height (including padding).
   */
  get totalHeight(): number {
    return this._totalHeight;
  }

  /**
   * Gap between pages in pixels.
   */
  get pageGap(): number {
    return this._pageGap;
  }

  /**
   * Number of buffer pages to render outside the visible area.
   */
  get bufferSize(): number {
    return this._bufferSize;
  }

  /**
   * Current scroll position.
   */
  get scrollPosition(): ScrollPosition {
    return {
      scrollLeft: this._scrollLeft,
      scrollTop: this._scrollTop,
    };
  }

  /**
   * Container information including total and viewport dimensions.
   */
  get containerInfo(): ContainerInfo {
    return {
      totalWidth: this._totalWidth,
      totalHeight: this._totalHeight,
      viewportWidth: this._viewportWidth,
      viewportHeight: this._viewportHeight,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set the page dimensions for the document.
   * This must be called after loading a document to calculate layouts.
   *
   * @param dimensions - Array of page dimensions (one per page)
   */
  setPageDimensions(dimensions: PageDimensions[]): void {
    this._pageDimensions = [...dimensions];
    this.calculateLayout();
    this.emitEvent({ type: "layoutChange" });
  }

  /**
   * Set the scale factor.
   *
   * @param scale - New scale factor (1 = 100%)
   * @param centerOnPoint - Optional point to keep centered after scaling
   */
  setScale(scale: number, centerOnPoint?: { x: number; y: number }): void {
    if (scale <= 0) {
      return;
    }

    const oldScale = this._scale;
    if (scale === oldScale) {
      return;
    }

    // Calculate the point to keep centered
    let centerX = this._scrollLeft + this._viewportWidth / 2;
    let centerY = this._scrollTop + this._viewportHeight / 2;

    if (centerOnPoint) {
      centerX = centerOnPoint.x;
      centerY = centerOnPoint.y;
    }

    // Calculate the position in document space
    const docX = centerX / oldScale;
    const docY = centerY / oldScale;

    // Update scale and recalculate layout
    this._scale = scale;
    this.calculateLayout();

    // Calculate new scroll position to keep the same point centered
    const newCenterX = docX * scale;
    const newCenterY = docY * scale;

    const newScrollLeft = newCenterX - this._viewportWidth / 2;
    const newScrollTop = newCenterY - this._viewportHeight / 2;

    this._scrollLeft = this.clampScrollLeft(newScrollLeft);
    this._scrollTop = this.clampScrollTop(newScrollTop);

    this.emitEvent({ type: "scaleChange", scale });
    this.emitEvent({ type: "layoutChange" });
    this.checkVisibleRangeChange();
  }

  /**
   * Set the viewport size.
   *
   * @param width - Viewport width in pixels
   * @param height - Viewport height in pixels
   */
  setViewportSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }

    this._viewportWidth = width;
    this._viewportHeight = height;

    // Clamp scroll position to new bounds
    this._scrollLeft = this.clampScrollLeft(this._scrollLeft);
    this._scrollTop = this.clampScrollTop(this._scrollTop);

    this.checkVisibleRangeChange();
  }

  /**
   * Set the buffer size (number of pages to render outside visible area).
   *
   * @param size - Number of buffer pages (0 or greater)
   */
  setBufferSize(size: number): void {
    if (size < 0) {
      return;
    }
    this._bufferSize = size;
    this.checkVisibleRangeChange();
  }

  /**
   * Set the page gap.
   *
   * @param gap - Gap between pages in pixels
   */
  setPageGap(gap: number): void {
    if (gap < 0) {
      return;
    }
    this._pageGap = gap;
    this.calculateLayout();
    this.emitEvent({ type: "layoutChange" });
  }

  // ============================================================================
  // Scroll Operations
  // ============================================================================

  /**
   * Scroll to a specific position.
   *
   * @param scrollLeft - Horizontal scroll position
   * @param scrollTop - Vertical scroll position
   */
  scrollTo(scrollLeft: number, scrollTop: number): void {
    const newScrollLeft = this.clampScrollLeft(scrollLeft);
    const newScrollTop = this.clampScrollTop(scrollTop);

    if (newScrollLeft === this._scrollLeft && newScrollTop === this._scrollTop) {
      return;
    }

    this._scrollLeft = newScrollLeft;
    this._scrollTop = newScrollTop;

    this.emitEvent({
      type: "scroll",
      scrollPosition: { scrollLeft: newScrollLeft, scrollTop: newScrollTop },
    });
    this.checkVisibleRangeChange();
  }

  /**
   * Scroll by a delta amount.
   *
   * @param deltaX - Horizontal delta
   * @param deltaY - Vertical delta
   */
  scrollBy(deltaX: number, deltaY: number): void {
    this.scrollTo(this._scrollLeft + deltaX, this._scrollTop + deltaY);
  }

  /**
   * Scroll to make a specific page visible.
   *
   * @param pageIndex - The page index to scroll to (0-based)
   * @param alignment - Where to position the page ('start', 'center', 'end')
   */
  scrollToPage(pageIndex: number, alignment: "start" | "center" | "end" = "start"): void {
    if (pageIndex < 0 || pageIndex >= this._pageLayouts.length) {
      return;
    }

    const layout = this._pageLayouts[pageIndex];
    let targetScrollTop: number;

    switch (alignment) {
      case "start":
        targetScrollTop = layout.top - this._verticalPadding;
        break;
      case "center":
        targetScrollTop = layout.top + layout.height / 2 - this._viewportHeight / 2;
        break;
      case "end":
        targetScrollTop = layout.top + layout.height - this._viewportHeight + this._verticalPadding;
        break;
    }

    // Center horizontally
    const targetScrollLeft = layout.left + layout.width / 2 - this._viewportWidth / 2;

    this.scrollTo(targetScrollLeft, targetScrollTop);
  }

  // ============================================================================
  // Visibility Queries
  // ============================================================================

  /**
   * Get the range of visible pages (including buffer).
   *
   * @returns The range of page indices that should be rendered
   */
  getVisibleRange(): VisibleRange {
    if (this._pageLayouts.length === 0) {
      return { start: 0, end: -1 };
    }

    const viewportTop = this._scrollTop;
    const viewportBottom = this._scrollTop + this._viewportHeight;

    // Find first visible page using binary search
    let start = this.findFirstVisiblePage(viewportTop);
    let end = this.findLastVisiblePage(viewportBottom);

    // Apply buffer
    start = Math.max(0, start - this._bufferSize);
    end = Math.min(this._pageLayouts.length - 1, end + this._bufferSize);

    return { start, end };
  }

  /**
   * Get the layouts of all visible pages (including buffer).
   *
   * @returns Array of page layouts for visible pages
   */
  getVisiblePages(): PageLayout[] {
    const range = this.getVisibleRange();
    if (range.end < range.start) {
      return [];
    }
    return this._pageLayouts.slice(range.start, range.end + 1);
  }

  /**
   * Check if a specific page is currently visible.
   *
   * @param pageIndex - Page index to check
   * @returns True if the page is in the visible range (including buffer)
   */
  isPageVisible(pageIndex: number): boolean {
    const range = this.getVisibleRange();
    return pageIndex >= range.start && pageIndex <= range.end;
  }

  /**
   * Get the layout for a specific page.
   *
   * @param pageIndex - Page index
   * @returns The page layout or null if invalid index
   */
  getPageLayout(pageIndex: number): PageLayout | null {
    if (pageIndex < 0 || pageIndex >= this._pageLayouts.length) {
      return null;
    }
    return { ...this._pageLayouts[pageIndex] };
  }

  /**
   * Get all page layouts.
   *
   * @returns Array of all page layouts
   */
  getAllPageLayouts(): PageLayout[] {
    return this._pageLayouts.map(layout => ({ ...layout }));
  }

  /**
   * Find the page at a given point in the viewport.
   *
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   * @returns Page index at the point, or -1 if none
   */
  getPageAtPoint(x: number, y: number): number {
    const docX = x + this._scrollLeft;
    const docY = y + this._scrollTop;

    for (let i = 0; i < this._pageLayouts.length; i++) {
      const layout = this._pageLayouts[i];
      if (
        docX >= layout.left &&
        docX <= layout.left + layout.width &&
        docY >= layout.top &&
        docY <= layout.top + layout.height
      ) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Convert a point from viewport coordinates to page coordinates.
   *
   * @param viewportX - X in viewport pixels
   * @param viewportY - Y in viewport pixels
   * @returns Page coordinates or null if not on a page
   */
  viewportToPage(
    viewportX: number,
    viewportY: number,
  ): { pageIndex: number; x: number; y: number } | null {
    const pageIndex = this.getPageAtPoint(viewportX, viewportY);
    if (pageIndex < 0) {
      return null;
    }

    const layout = this._pageLayouts[pageIndex];
    const docX = viewportX + this._scrollLeft;
    const docY = viewportY + this._scrollTop;

    // Convert to page-local coordinates (scaled)
    const pageX = docX - layout.left;
    const pageY = docY - layout.top;

    // Convert to unscaled page coordinates
    return {
      pageIndex,
      x: pageX / this._scale,
      y: pageY / this._scale,
    };
  }

  /**
   * Convert a point from page coordinates to viewport coordinates.
   *
   * @param pageIndex - Page index
   * @param pageX - X in unscaled page coordinates
   * @param pageY - Y in unscaled page coordinates
   * @returns Viewport coordinates or null if invalid page
   */
  pageToViewport(pageIndex: number, pageX: number, pageY: number): { x: number; y: number } | null {
    if (pageIndex < 0 || pageIndex >= this._pageLayouts.length) {
      return null;
    }

    const layout = this._pageLayouts[pageIndex];

    // Convert to scaled document coordinates
    const docX = layout.left + pageX * this._scale;
    const docY = layout.top + pageY * this._scale;

    // Convert to viewport coordinates
    return {
      x: docX - this._scrollLeft,
      y: docY - this._scrollTop,
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add an event listener.
   *
   * @param type - Event type to listen for
   * @param listener - Callback function
   */
  addEventListener(type: VirtualScrollerEventType, listener: VirtualScrollerEventListener): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   *
   * @param type - Event type
   * @param listener - Callback function to remove
   */
  removeEventListener(
    type: VirtualScrollerEventType,
    listener: VirtualScrollerEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate the layout for all pages.
   */
  private calculateLayout(): void {
    const layouts: PageLayout[] = [];
    let maxWidth = 0;
    let currentTop = this._verticalPadding;

    for (let i = 0; i < this._pageDimensions.length; i++) {
      const dim = this._pageDimensions[i];
      const scaledWidth = dim.width * this._scale;
      const scaledHeight = dim.height * this._scale;

      layouts.push({
        pageIndex: i,
        top: currentTop,
        left: this._horizontalPadding, // Will be adjusted for centering
        width: scaledWidth,
        height: scaledHeight,
      });

      maxWidth = Math.max(maxWidth, scaledWidth);
      currentTop += scaledHeight + this._pageGap;
    }

    // Calculate total dimensions
    this._totalWidth = maxWidth + this._horizontalPadding * 2;
    this._totalHeight = currentTop - this._pageGap + this._verticalPadding;

    // Center pages horizontally
    for (const layout of layouts) {
      layout.left = (this._totalWidth - layout.width) / 2;
    }

    this._pageLayouts = layouts;
  }

  /**
   * Find the first page that intersects with the given Y coordinate.
   */
  private findFirstVisiblePage(y: number): number {
    if (this._pageLayouts.length === 0) {
      return 0;
    }

    // Binary search for the first page that ends after y
    let low = 0;
    let high = this._pageLayouts.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const layout = this._pageLayouts[mid];

      if (layout.top + layout.height < y) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Find the last page that intersects with the given Y coordinate.
   */
  private findLastVisiblePage(y: number): number {
    if (this._pageLayouts.length === 0) {
      return -1;
    }

    // Binary search for the last page that starts before y
    let low = 0;
    let high = this._pageLayouts.length - 1;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const layout = this._pageLayouts[mid];

      if (layout.top > y) {
        high = mid - 1;
      } else {
        low = mid;
      }
    }

    return low;
  }

  /**
   * Clamp scroll left to valid range.
   */
  private clampScrollLeft(value: number): number {
    const maxScroll = Math.max(0, this._totalWidth - this._viewportWidth);
    return Math.max(0, Math.min(value, maxScroll));
  }

  /**
   * Clamp scroll top to valid range.
   */
  private clampScrollTop(value: number): number {
    const maxScroll = Math.max(0, this._totalHeight - this._viewportHeight);
    return Math.max(0, Math.min(value, maxScroll));
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: VirtualScrollerEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Check if visible range has changed and emit event if so.
   */
  private checkVisibleRangeChange(): void {
    const newRange = this.getVisibleRange();

    if (
      !this._lastVisibleRange ||
      newRange.start !== this._lastVisibleRange.start ||
      newRange.end !== this._lastVisibleRange.end
    ) {
      this._lastVisibleRange = newRange;
      this.emitEvent({ type: "visibleRangeChange", visibleRange: newRange });
    }
  }
}

/**
 * Create a new VirtualScroller instance.
 */
export function createVirtualScroller(options?: VirtualScrollerOptions): VirtualScroller {
  return new VirtualScroller(options);
}
