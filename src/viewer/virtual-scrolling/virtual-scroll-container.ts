/**
 * Virtual scroll container that integrates DOM recycling and page estimation.
 *
 * Combines VirtualScroller, DOMRecycler, and PageEstimator to provide a complete
 * virtual scrolling solution for PDF viewing with constant memory usage. Manages
 * the lifecycle of page elements, recycling DOM nodes as pages enter and leave
 * the viewport, while maintaining accurate scroll positions through height
 * estimation and correction.
 */

import type {
  PageDimensions,
  PageLayout,
  VisibleRange,
  VirtualScroller,
} from "../../virtual-scroller";
import {
  createDefaultPoolConfigs,
  DOMRecycler,
  type DOMRecyclerOptions,
  type RecyclableElementType,
} from "./dom-recycler";
import { PageEstimator, type PageEstimatorOptions } from "./page-estimator";

/**
 * Options for configuring the VirtualScrollContainer.
 */
export interface VirtualScrollContainerOptions {
  /**
   * The VirtualScroller instance to use for viewport calculations.
   */
  scroller: VirtualScroller;

  /**
   * Options for the DOM recycler.
   */
  recyclerOptions?: DOMRecyclerOptions;

  /**
   * Options for the page estimator.
   */
  estimatorOptions?: PageEstimatorOptions;

  /**
   * Whether to use default pool configurations.
   * @default true
   */
  useDefaultPools?: boolean;

  /**
   * Whether to automatically acquire/release elements on visibility change.
   * @default true
   */
  autoManageElements?: boolean;

  /**
   * Whether to sync estimated heights with the scroller.
   * @default true
   */
  syncHeights?: boolean;
}

/**
 * Event types emitted by VirtualScrollContainer.
 */
export type VirtualScrollContainerEventType =
  | "pageVisible"
  | "pageHidden"
  | "scrollCorrected"
  | "layoutUpdated";

/**
 * Event data for VirtualScrollContainer events.
 */
export interface VirtualScrollContainerEvent {
  /**
   * Event type.
   */
  type: VirtualScrollContainerEventType;

  /**
   * Page index (for page events).
   */
  pageIndex?: number;

  /**
   * Visible range (for visibility events).
   */
  visibleRange?: VisibleRange;

  /**
   * Scroll correction amount (for scrollCorrected events).
   */
  scrollCorrection?: number;

  /**
   * Elements acquired for a page (for pageVisible events).
   */
  elements?: Map<RecyclableElementType, HTMLElement>;
}

/**
 * Listener function for VirtualScrollContainer events.
 */
export type VirtualScrollContainerEventListener = (event: VirtualScrollContainerEvent) => void;

/**
 * VirtualScrollContainer provides integrated DOM recycling and page height
 * estimation for virtual scrolling.
 *
 * It coordinates between:
 * - VirtualScroller: Handles scroll position and visible page calculation
 * - DOMRecycler: Manages pools of reusable DOM elements
 * - PageEstimator: Tracks page heights and scroll corrections
 *
 * @example
 * ```ts
 * const scroller = new VirtualScroller({ viewportWidth: 800, viewportHeight: 600 });
 * const container = new VirtualScrollContainer({ scroller });
 *
 * // Set page dimensions
 * container.setPageDimensions([
 *   { width: 612, height: 792 },
 *   { width: 612, height: 792 },
 * ]);
 *
 * // Get elements for visible pages
 * const visibleElements = container.getVisiblePageElements();
 *
 * // Update actual height after rendering
 * container.setActualPageHeight(0, 800);
 * ```
 */
export class VirtualScrollContainer {
  private _scroller: VirtualScroller;
  private _recycler: DOMRecycler;
  private _estimator: PageEstimator;
  private _options: {
    autoManageElements: boolean;
    syncHeights: boolean;
  };
  private _listeners: Map<
    VirtualScrollContainerEventType,
    Set<VirtualScrollContainerEventListener>
  > = new Map();
  private _lastVisibleRange: VisibleRange | null = null;
  private _disposed = false;

  constructor(options: VirtualScrollContainerOptions) {
    this._scroller = options.scroller;
    this._recycler = new DOMRecycler(options.recyclerOptions);
    this._estimator = new PageEstimator({
      scale: options.scroller.scale,
      pageGap: options.scroller.pageGap,
      ...options.estimatorOptions,
    });

    this._options = {
      autoManageElements: options.autoManageElements ?? true,
      syncHeights: options.syncHeights ?? true,
    };

    // Register default pools if requested
    if (options.useDefaultPools !== false) {
      const defaultConfigs = createDefaultPoolConfigs();
      for (const [type, config] of defaultConfigs) {
        this._recycler.registerPool(type as RecyclableElementType, config);
      }
    }

    // Subscribe to scroller events
    this._scroller.addEventListener("visibleRangeChange", this.handleVisibleRangeChange);
    this._scroller.addEventListener("scaleChange", this.handleScaleChange);

    // Subscribe to estimator events
    this._estimator.addEventListener("heightUpdated", this.handleHeightUpdated);
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * The VirtualScroller instance.
   */
  get scroller(): VirtualScroller {
    return this._scroller;
  }

  /**
   * The DOMRecycler instance.
   */
  get recycler(): DOMRecycler {
    return this._recycler;
  }

  /**
   * The PageEstimator instance.
   */
  get estimator(): PageEstimator {
    return this._estimator;
  }

  /**
   * Number of pages in the document.
   */
  get pageCount(): number {
    return this._estimator.pageCount;
  }

  /**
   * Current scale factor.
   */
  get scale(): number {
    return this._scroller.scale;
  }

  /**
   * Current visible page range.
   */
  get visibleRange(): VisibleRange {
    return this._scroller.getVisibleRange();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set the page dimensions for the document.
   * This initializes both the scroller and estimator with page information.
   *
   * @param dimensions - Array of page dimensions (one per page)
   */
  setPageDimensions(dimensions: PageDimensions[]): void {
    if (this._disposed) {
      return;
    }

    // Update estimator first
    this._estimator.setPageDimensions(dimensions);

    // Sync to scroller if enabled
    if (this._options.syncHeights) {
      this._scroller.setPageDimensions(dimensions);
    }

    // Update visible elements
    if (this._options.autoManageElements) {
      this.updateVisibleElements();
    }

    this.emitEvent({ type: "layoutUpdated" });
  }

  /**
   * Set the actual rendered height for a page.
   * This updates the estimator and optionally adjusts scroll position.
   *
   * @param pageIndex - Page index
   * @param actualHeight - Actual rendered height in scaled pixels
   * @param actualWidth - Optional actual rendered width
   */
  setActualPageHeight(pageIndex: number, actualHeight: number, actualWidth?: number): void {
    if (this._disposed) {
      return;
    }

    const oldCorrection = this._estimator.getScrollCorrection(this._scroller.scrollTop);
    this._estimator.setActualHeight(pageIndex, actualHeight, actualWidth);
    const newCorrection = this._estimator.getScrollCorrection(this._scroller.scrollTop);

    // Apply scroll correction if needed
    const correction = newCorrection - oldCorrection;
    if (correction !== 0 && Math.abs(correction) > 1) {
      this._scroller.scrollBy(0, correction);
      this.emitEvent({ type: "scrollCorrected", scrollCorrection: correction });
    }
  }

  /**
   * Register a custom element pool.
   *
   * @param type - Element type
   * @param config - Pool configuration
   */
  registerPool(
    type: RecyclableElementType,
    config: {
      maxSize?: number;
      factory: () => HTMLElement;
      reset?: (element: HTMLElement) => void;
      prepare?: (element: HTMLElement) => void;
    },
  ): void {
    this._recycler.registerPool(type, config);
  }

  // ============================================================================
  // Element Management
  // ============================================================================

  /**
   * Acquire an element for a specific page.
   *
   * @param type - Type of element to acquire
   * @param pageIndex - Page index
   * @returns The acquired element
   */
  acquireElement(type: RecyclableElementType, pageIndex: number): HTMLElement {
    return this._recycler.acquire(type, pageIndex);
  }

  /**
   * Release an element back to the pool.
   *
   * @param type - Type of element
   * @param pageIndex - Page index
   */
  releaseElement(type: RecyclableElementType, pageIndex: number): void {
    this._recycler.release(type, pageIndex);
  }

  /**
   * Release all elements for a page.
   *
   * @param pageIndex - Page index
   */
  releaseAllElements(pageIndex: number): void {
    this._recycler.releaseAllForPage(pageIndex);
  }

  /**
   * Get element for a page.
   *
   * @param type - Element type
   * @param pageIndex - Page index
   * @returns The element or null
   */
  getElement(type: RecyclableElementType, pageIndex: number): HTMLElement | null {
    return this._recycler.getElement(type, pageIndex);
  }

  /**
   * Get all elements for a page.
   *
   * @param pageIndex - Page index
   * @returns Map of element types to elements
   */
  getElementsForPage(pageIndex: number): Map<RecyclableElementType, HTMLElement> {
    return this._recycler.getElementsForPage(pageIndex);
  }

  /**
   * Get all elements for visible pages.
   *
   * @returns Map of page indices to their elements
   */
  getVisiblePageElements(): Map<number, Map<RecyclableElementType, HTMLElement>> {
    const result = new Map<number, Map<RecyclableElementType, HTMLElement>>();
    const range = this._scroller.getVisibleRange();

    for (let i = range.start; i <= range.end; i++) {
      const elements = this._recycler.getElementsForPage(i);
      if (elements.size > 0) {
        result.set(i, elements);
      }
    }

    return result;
  }

  // ============================================================================
  // Layout Information
  // ============================================================================

  /**
   * Get the layout for a specific page.
   *
   * @param pageIndex - Page index
   * @returns Page layout or null
   */
  getPageLayout(pageIndex: number): PageLayout | null {
    return this._estimator.getPageLayout(pageIndex);
  }

  /**
   * Get the estimated height for a page.
   *
   * @param pageIndex - Page index
   * @returns Estimated height in scaled pixels
   */
  getEstimatedHeight(pageIndex: number): number {
    return this._estimator.getEstimatedHeight(pageIndex);
  }

  /**
   * Check if a page has actual (rendered) height.
   *
   * @param pageIndex - Page index
   * @returns True if actual height is known
   */
  hasActualHeight(pageIndex: number): boolean {
    return this._estimator.hasActualHeight(pageIndex);
  }

  /**
   * Get the page at a vertical position.
   *
   * @param y - Vertical position in scaled pixels
   * @returns Page index or -1
   */
  getPageAtPosition(y: number): number {
    return this._estimator.getPageAtPosition(y);
  }

  // ============================================================================
  // Visibility Queries
  // ============================================================================

  /**
   * Check if a page is currently visible.
   *
   * @param pageIndex - Page index
   * @returns True if visible
   */
  isPageVisible(pageIndex: number): boolean {
    return this._scroller.isPageVisible(pageIndex);
  }

  /**
   * Get array of visible page indices.
   *
   * @returns Array of visible page indices
   */
  getVisiblePageIndices(): number[] {
    const range = this._scroller.getVisibleRange();
    const indices: number[] = [];

    for (let i = range.start; i <= range.end; i++) {
      indices.push(i);
    }

    return indices;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get recycler statistics.
   */
  getRecyclerStats() {
    return this._recycler.getStats();
  }

  /**
   * Get page height estimates.
   */
  getHeightEstimates() {
    return this._estimator.getAllEstimates();
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add an event listener.
   *
   * @param type - Event type
   * @param listener - Callback function
   */
  addEventListener(
    type: VirtualScrollContainerEventType,
    listener: VirtualScrollContainerEventListener,
  ): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  /**
   * Remove an event listener.
   *
   * @param type - Event type
   * @param listener - Callback function
   */
  removeEventListener(
    type: VirtualScrollContainerEventType,
    listener: VirtualScrollContainerEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the container and all resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Unsubscribe from events
    this._scroller.removeEventListener("visibleRangeChange", this.handleVisibleRangeChange);
    this._scroller.removeEventListener("scaleChange", this.handleScaleChange);
    this._estimator.removeEventListener("heightUpdated", this.handleHeightUpdated);

    // Dispose components
    this._recycler.dispose();
    this._estimator.dispose();

    // Clear listeners
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle visible range changes.
   */
  private handleVisibleRangeChange = (event: { visibleRange?: VisibleRange }): void => {
    if (!this._options.autoManageElements || !event.visibleRange) {
      return;
    }

    const newRange = event.visibleRange;
    const oldRange = this._lastVisibleRange;

    // Find pages that became hidden
    if (oldRange) {
      for (let i = oldRange.start; i <= oldRange.end; i++) {
        if (i < newRange.start || i > newRange.end) {
          this._recycler.releaseAllForPage(i);
          this.emitEvent({ type: "pageHidden", pageIndex: i });
        }
      }
    }

    // Find pages that became visible and acquire elements
    for (let i = newRange.start; i <= newRange.end; i++) {
      if (!oldRange || i < oldRange.start || i > oldRange.end) {
        // Acquire default elements for new visible pages
        const elements = new Map<RecyclableElementType, HTMLElement>();

        if (this._recycler.hasPool("pageContainer")) {
          elements.set("pageContainer", this._recycler.acquire("pageContainer", i));
        }

        this.emitEvent({
          type: "pageVisible",
          pageIndex: i,
          visibleRange: newRange,
          elements,
        });
      }
    }

    this._lastVisibleRange = newRange;
  };

  /**
   * Handle scale changes.
   */
  private handleScaleChange = (event: { scale?: number }): void => {
    if (event.scale !== undefined) {
      this._estimator.setScale(event.scale);
    }
  };

  /**
   * Handle height updates from the estimator.
   */
  private handleHeightUpdated = (_event: { pageIndex?: number; heightDelta?: number }): void => {
    this.emitEvent({ type: "layoutUpdated" });
  };

  /**
   * Update visible elements based on current range.
   */
  private updateVisibleElements(): void {
    if (!this._options.autoManageElements) {
      return;
    }

    const range = this._scroller.getVisibleRange();

    // Release elements for pages outside the range
    for (let i = 0; i < this._estimator.pageCount; i++) {
      if (i < range.start || i > range.end) {
        if (this._recycler.hasElement("pageContainer", i)) {
          this._recycler.releaseAllForPage(i);
        }
      }
    }

    // Acquire elements for visible pages
    for (let i = range.start; i <= range.end; i++) {
      if (
        this._recycler.hasPool("pageContainer") &&
        !this._recycler.hasElement("pageContainer", i)
      ) {
        this._recycler.acquire("pageContainer", i);
      }
    }

    this._lastVisibleRange = range;
  }

  /**
   * Emit an event to listeners.
   */
  private emitEvent(event: VirtualScrollContainerEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new VirtualScrollContainer instance.
 */
export function createVirtualScrollContainer(
  options: VirtualScrollContainerOptions,
): VirtualScrollContainer {
  return new VirtualScrollContainer(options);
}
