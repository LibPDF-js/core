/**
 * Page height estimation system for virtual scrolling.
 *
 * Calculates and caches estimated heights for non-rendered pages using
 * PDF page dimensions and current zoom level. Maintains scroll position
 * accuracy by tracking height differences between estimated and actual
 * rendered heights, enabling smooth scrolling through large documents.
 */

import type { PageDimensions, PageLayout } from "../../virtual-scroller";

/**
 * Height estimation source type.
 */
export type EstimationSource = "pdf" | "actual" | "default";

/**
 * Information about an estimated page height.
 */
export interface PageHeightEstimate {
  /**
   * Page index (0-based).
   */
  pageIndex: number;

  /**
   * Estimated or actual height in scaled pixels.
   */
  height: number;

  /**
   * Width in scaled pixels.
   */
  width: number;

  /**
   * Source of the height value.
   */
  source: EstimationSource;

  /**
   * Confidence level (0-1). Higher values indicate more accurate estimates.
   * 'actual' sources have confidence of 1.
   */
  confidence: number;

  /**
   * Timestamp when this estimate was last updated.
   */
  updatedAt: number;
}

/**
 * Options for configuring the PageEstimator.
 */
export interface PageEstimatorOptions {
  /**
   * Default page width when no PDF dimensions are available.
   * @default 612 (US Letter width in points)
   */
  defaultWidth?: number;

  /**
   * Default page height when no PDF dimensions are available.
   * @default 792 (US Letter height in points)
   */
  defaultHeight?: number;

  /**
   * Initial scale factor.
   * @default 1
   */
  scale?: number;

  /**
   * Gap between pages in pixels.
   * @default 10
   */
  pageGap?: number;

  /**
   * Vertical padding around the document.
   * @default 20
   */
  verticalPadding?: number;

  /**
   * Horizontal padding around the document.
   * @default 20
   */
  horizontalPadding?: number;

  /**
   * Whether to track height corrections for scroll adjustment.
   * @default true
   */
  trackCorrections?: boolean;
}

/**
 * Event types emitted by PageEstimator.
 */
export type PageEstimatorEventType = "heightUpdated" | "scaleChanged" | "layoutRecalculated";

/**
 * Event data for PageEstimator events.
 */
export interface PageEstimatorEvent {
  /**
   * Event type.
   */
  type: PageEstimatorEventType;

  /**
   * Page index (for heightUpdated events).
   */
  pageIndex?: number;

  /**
   * Old height (for heightUpdated events).
   */
  oldHeight?: number;

  /**
   * New height (for heightUpdated events).
   */
  newHeight?: number;

  /**
   * Height difference (for heightUpdated events).
   */
  heightDelta?: number;

  /**
   * New scale (for scaleChanged events).
   */
  scale?: number;
}

/**
 * Listener function for PageEstimator events.
 */
export type PageEstimatorEventListener = (event: PageEstimatorEvent) => void;

/**
 * Height correction record for scroll adjustment.
 */
export interface HeightCorrection {
  /**
   * Page index.
   */
  pageIndex: number;

  /**
   * Height difference (actual - estimated).
   */
  delta: number;

  /**
   * Cumulative correction from page 0 to this page.
   */
  cumulativeDelta: number;
}

/**
 * PageEstimator calculates and tracks page heights for virtual scrolling.
 *
 * For large PDF documents, rendering all pages to determine exact heights
 * would be prohibitively expensive. This class provides height estimates
 * based on PDF page dimensions and scale, then tracks corrections when
 * pages are actually rendered to maintain accurate scroll positions.
 *
 * @example
 * ```ts
 * const estimator = new PageEstimator({ scale: 1.5 });
 *
 * // Set page dimensions from PDF metadata
 * estimator.setPageDimensions([
 *   { width: 612, height: 792 },
 *   { width: 612, height: 792 },
 *   // ... more pages
 * ]);
 *
 * // Get estimated height for a page
 * const estimate = estimator.getPageEstimate(5);
 *
 * // Update with actual rendered height
 * estimator.setActualHeight(5, 1188);
 *
 * // Get scroll correction for viewport adjustment
 * const correction = estimator.getScrollCorrection(currentScrollTop);
 * ```
 */
export class PageEstimator {
  private _pageDimensions: PageDimensions[] = [];
  private _estimates: Map<number, PageHeightEstimate> = new Map();
  private _corrections: HeightCorrection[] = [];
  private _options: Required<PageEstimatorOptions>;
  private _listeners: Map<PageEstimatorEventType, Set<PageEstimatorEventListener>> = new Map();
  private _totalHeight = 0;
  private _totalWidth = 0;
  private _layoutCache: PageLayout[] = [];
  private _layoutDirty = true;
  private _disposed = false;

  constructor(options: PageEstimatorOptions = {}) {
    this._options = {
      defaultWidth: options.defaultWidth ?? 612,
      defaultHeight: options.defaultHeight ?? 792,
      scale: options.scale ?? 1,
      pageGap: options.pageGap ?? 10,
      verticalPadding: options.verticalPadding ?? 20,
      horizontalPadding: options.horizontalPadding ?? 20,
      trackCorrections: options.trackCorrections ?? true,
    };
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * Number of pages being tracked.
   */
  get pageCount(): number {
    return this._pageDimensions.length;
  }

  /**
   * Current scale factor.
   */
  get scale(): number {
    return this._options.scale;
  }

  /**
   * Total estimated document height (in scaled pixels).
   */
  get totalHeight(): number {
    this.ensureLayoutCalculated();
    return this._totalHeight;
  }

  /**
   * Total document width (in scaled pixels).
   */
  get totalWidth(): number {
    this.ensureLayoutCalculated();
    return this._totalWidth;
  }

  /**
   * Gap between pages in pixels.
   */
  get pageGap(): number {
    return this._options.pageGap;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set the page dimensions from PDF metadata.
   *
   * @param dimensions - Array of page dimensions (one per page)
   */
  setPageDimensions(dimensions: PageDimensions[]): void {
    if (this._disposed) {
      return;
    }

    this._pageDimensions = [...dimensions];
    this._estimates.clear();
    this._corrections = [];
    this._layoutDirty = true;

    // Initialize estimates for all pages
    const now = Date.now();
    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      const scaledWidth = dim.width * this._options.scale;
      const scaledHeight = dim.height * this._options.scale;

      this._estimates.set(i, {
        pageIndex: i,
        width: scaledWidth,
        height: scaledHeight,
        source: "pdf",
        confidence: 0.95, // High confidence from PDF dimensions
        updatedAt: now,
      });
    }

    this.emitEvent({ type: "layoutRecalculated" });
  }

  /**
   * Set the scale factor.
   *
   * @param scale - New scale factor (1 = 100%)
   */
  setScale(scale: number): void {
    if (this._disposed || scale <= 0 || scale === this._options.scale) {
      return;
    }

    const oldScale = this._options.scale;
    this._options.scale = scale;
    this._layoutDirty = true;

    // Update all estimates for new scale
    const now = Date.now();
    for (let i = 0; i < this._pageDimensions.length; i++) {
      const estimate = this._estimates.get(i);
      const dim = this._pageDimensions[i];

      if (estimate && estimate.source === "actual") {
        // Preserve actual measurements, just scale them
        const ratio = scale / oldScale;
        estimate.width = estimate.width * ratio;
        estimate.height = estimate.height * ratio;
        estimate.updatedAt = now;
      } else {
        // Recalculate from PDF dimensions
        this._estimates.set(i, {
          pageIndex: i,
          width: dim.width * scale,
          height: dim.height * scale,
          source: "pdf",
          confidence: 0.95,
          updatedAt: now,
        });
      }
    }

    // Recalculate corrections
    if (this._options.trackCorrections) {
      this.recalculateCorrections();
    }

    this.emitEvent({ type: "scaleChanged", scale });
    this.emitEvent({ type: "layoutRecalculated" });
  }

  /**
   * Set the page gap.
   *
   * @param gap - Gap between pages in pixels
   */
  setPageGap(gap: number): void {
    if (this._disposed || gap < 0) {
      return;
    }

    this._options.pageGap = gap;
    this._layoutDirty = true;
    this.emitEvent({ type: "layoutRecalculated" });
  }

  // ============================================================================
  // Height Estimation
  // ============================================================================

  /**
   * Get the height estimate for a specific page.
   *
   * @param pageIndex - Page index
   * @returns The height estimate or null if invalid index
   */
  getPageEstimate(pageIndex: number): PageHeightEstimate | null {
    if (pageIndex < 0 || pageIndex >= this._pageDimensions.length) {
      return null;
    }

    const estimate = this._estimates.get(pageIndex);
    return estimate ? { ...estimate } : null;
  }

  /**
   * Get the estimated height for a page.
   *
   * @param pageIndex - Page index
   * @returns Estimated height in scaled pixels, or default height if invalid
   */
  getEstimatedHeight(pageIndex: number): number {
    const estimate = this._estimates.get(pageIndex);
    return estimate?.height ?? this._options.defaultHeight * this._options.scale;
  }

  /**
   * Get the estimated width for a page.
   *
   * @param pageIndex - Page index
   * @returns Estimated width in scaled pixels, or default width if invalid
   */
  getEstimatedWidth(pageIndex: number): number {
    const estimate = this._estimates.get(pageIndex);
    return estimate?.width ?? this._options.defaultWidth * this._options.scale;
  }

  /**
   * Set the actual rendered height for a page.
   * This updates the estimate and recalculates corrections for scroll adjustment.
   *
   * @param pageIndex - Page index
   * @param actualHeight - Actual rendered height in scaled pixels
   * @param actualWidth - Optional actual rendered width in scaled pixels
   */
  setActualHeight(pageIndex: number, actualHeight: number, actualWidth?: number): void {
    if (this._disposed || pageIndex < 0 || pageIndex >= this._pageDimensions.length) {
      return;
    }

    const oldEstimate = this._estimates.get(pageIndex);
    const oldHeight = oldEstimate?.height ?? this._options.defaultHeight * this._options.scale;
    const heightDelta = actualHeight - oldHeight;

    const estimate: PageHeightEstimate = {
      pageIndex,
      height: actualHeight,
      width: actualWidth ?? oldEstimate?.width ?? this._options.defaultWidth * this._options.scale,
      source: "actual",
      confidence: 1,
      updatedAt: Date.now(),
    };

    this._estimates.set(pageIndex, estimate);
    this._layoutDirty = true;

    if (this._options.trackCorrections && heightDelta !== 0) {
      this.updateCorrection(pageIndex, heightDelta);
    }

    this.emitEvent({
      type: "heightUpdated",
      pageIndex,
      oldHeight,
      newHeight: actualHeight,
      heightDelta,
    });
  }

  /**
   * Check if a page has actual (rendered) height.
   *
   * @param pageIndex - Page index
   * @returns True if the page height is from actual rendering
   */
  hasActualHeight(pageIndex: number): boolean {
    const estimate = this._estimates.get(pageIndex);
    return estimate?.source === "actual";
  }

  /**
   * Get all estimates.
   *
   * @returns Array of all page height estimates
   */
  getAllEstimates(): PageHeightEstimate[] {
    return Array.from(this._estimates.values()).map(est => ({ ...est }));
  }

  // ============================================================================
  // Layout Calculation
  // ============================================================================

  /**
   * Get the layout for a specific page.
   *
   * @param pageIndex - Page index
   * @returns The page layout or null if invalid index
   */
  getPageLayout(pageIndex: number): PageLayout | null {
    this.ensureLayoutCalculated();

    if (pageIndex < 0 || pageIndex >= this._layoutCache.length) {
      return null;
    }

    return { ...this._layoutCache[pageIndex] };
  }

  /**
   * Get all page layouts.
   *
   * @returns Array of all page layouts
   */
  getAllPageLayouts(): PageLayout[] {
    this.ensureLayoutCalculated();
    return this._layoutCache.map(layout => ({ ...layout }));
  }

  /**
   * Find the page at a given vertical position.
   *
   * @param y - Vertical position in scaled pixels
   * @returns Page index at the position, or -1 if none
   */
  getPageAtPosition(y: number): number {
    this.ensureLayoutCalculated();

    if (this._layoutCache.length === 0) {
      return -1;
    }

    // Binary search for the page
    let low = 0;
    let high = this._layoutCache.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const layout = this._layoutCache[mid];

      if (y < layout.top) {
        high = mid - 1;
      } else if (y > layout.top + layout.height) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    // If not within a page, return the closest page
    if (low >= this._layoutCache.length) {
      return this._layoutCache.length - 1;
    }
    if (high < 0) {
      return 0;
    }

    return low;
  }

  // ============================================================================
  // Scroll Correction
  // ============================================================================

  /**
   * Get the cumulative height correction for pages before a given scroll position.
   * This can be used to adjust scroll position when heights change.
   *
   * @param scrollTop - Current scroll position
   * @returns Correction amount to add to scroll position
   */
  getScrollCorrection(scrollTop: number): number {
    if (!this._options.trackCorrections || this._corrections.length === 0) {
      return 0;
    }

    // Find the page at the scroll position
    const pageIndex = this.getPageAtPosition(scrollTop + this._options.verticalPadding);
    if (pageIndex < 0) {
      return 0;
    }

    // Find the correction for this page or earlier
    for (let i = this._corrections.length - 1; i >= 0; i--) {
      if (this._corrections[i].pageIndex <= pageIndex) {
        return this._corrections[i].cumulativeDelta;
      }
    }

    return 0;
  }

  /**
   * Get all height corrections.
   *
   * @returns Array of height corrections
   */
  getCorrections(): HeightCorrection[] {
    return this._corrections.map(c => ({ ...c }));
  }

  /**
   * Clear all height corrections.
   */
  clearCorrections(): void {
    this._corrections = [];
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
  addEventListener(type: PageEstimatorEventType, listener: PageEstimatorEventListener): void {
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
  removeEventListener(type: PageEstimatorEventType, listener: PageEstimatorEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the estimator and clean up resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._estimates.clear();
    this._corrections = [];
    this._layoutCache = [];
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensure the layout cache is up to date.
   */
  private ensureLayoutCalculated(): void {
    if (!this._layoutDirty) {
      return;
    }

    this.calculateLayout();
    this._layoutDirty = false;
  }

  /**
   * Calculate the layout for all pages.
   */
  private calculateLayout(): void {
    const layouts: PageLayout[] = [];
    let maxWidth = 0;
    let currentTop = this._options.verticalPadding;

    for (let i = 0; i < this._pageDimensions.length; i++) {
      const estimate = this._estimates.get(i);
      const width = estimate?.width ?? this._options.defaultWidth * this._options.scale;
      const height = estimate?.height ?? this._options.defaultHeight * this._options.scale;

      layouts.push({
        pageIndex: i,
        top: currentTop,
        left: this._options.horizontalPadding, // Will be adjusted for centering
        width,
        height,
      });

      maxWidth = Math.max(maxWidth, width);
      currentTop += height + this._options.pageGap;
    }

    // Calculate total dimensions
    this._totalWidth = maxWidth + this._options.horizontalPadding * 2;
    this._totalHeight = currentTop - this._options.pageGap + this._options.verticalPadding;

    // Center pages horizontally
    for (const layout of layouts) {
      layout.left = (this._totalWidth - layout.width) / 2;
    }

    this._layoutCache = layouts;
  }

  /**
   * Update the correction for a specific page.
   */
  private updateCorrection(pageIndex: number, delta: number): void {
    // Find or create the correction entry
    let correctionIndex = this._corrections.findIndex(c => c.pageIndex === pageIndex);

    if (correctionIndex === -1) {
      // Insert in sorted order
      correctionIndex = this._corrections.findIndex(c => c.pageIndex > pageIndex);
      if (correctionIndex === -1) {
        correctionIndex = this._corrections.length;
      }
      this._corrections.splice(correctionIndex, 0, {
        pageIndex,
        delta,
        cumulativeDelta: 0,
      });
    } else {
      this._corrections[correctionIndex].delta = delta;
    }

    // Recalculate cumulative deltas
    this.recalculateCumulativeDeltas();
  }

  /**
   * Recalculate all corrections after a scale change.
   */
  private recalculateCorrections(): void {
    // Clear corrections since they're no longer valid after scale change
    this._corrections = [];
  }

  /**
   * Recalculate cumulative deltas for all corrections.
   */
  private recalculateCumulativeDeltas(): void {
    let cumulative = 0;
    for (const correction of this._corrections) {
      cumulative += correction.delta;
      correction.cumulativeDelta = cumulative;
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: PageEstimatorEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new PageEstimator instance.
 */
export function createPageEstimator(options?: PageEstimatorOptions): PageEstimator {
  return new PageEstimator(options);
}
