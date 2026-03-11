/**
 * Viewport manager for coordinating page lifecycle and rendering.
 *
 * Works with VirtualScroller to determine which pages need to be rendered
 * and manages the lifecycle of page elements (creation, rendering, cleanup).
 * This class bridges the gap between the virtual scrolling system and the
 * actual rendering infrastructure.
 */

import type { BaseRenderer, RenderTask, Viewport } from "./renderers/base-renderer";
import type { PageLayout, VisibleRange, VirtualScroller } from "./virtual-scroller";

/**
 * State of a page in the viewport.
 */
export type PageState = "idle" | "rendering" | "rendered" | "error";

/**
 * Information about a managed page.
 */
export interface ManagedPage {
  /**
   * Page index (0-based).
   */
  pageIndex: number;

  /**
   * Current state of the page.
   */
  state: PageState;

  /**
   * The rendered element (if any).
   */
  element: unknown;

  /**
   * Current render task (if rendering).
   */
  renderTask: RenderTask | null;

  /**
   * Last error during rendering (if state is 'error').
   */
  error: Error | null;

  /**
   * Timestamp when the page was last rendered.
   */
  lastRenderedAt: number;

  /**
   * Viewport used for the current render.
   */
  viewport: Viewport | null;
}

/**
 * Options for configuring the ViewportManager.
 */
export interface ViewportManagerOptions {
  /**
   * Maximum number of pages to keep cached after they leave the visible area.
   * Set to 0 to immediately clean up off-screen pages.
   * @default 5
   */
  cacheSize?: number;

  /**
   * Whether to automatically render pages when they become visible.
   * If false, you must call renderPage manually.
   * @default true
   */
  autoRender?: boolean;

  /**
   * Priority mode for rendering.
   * 'visible' renders visible pages first, then buffer pages.
   * 'sequential' renders in order from start to end.
   * @default 'visible'
   */
  priorityMode?: "visible" | "sequential";

  /**
   * Maximum concurrent render operations.
   * @default 3
   */
  maxConcurrentRenders?: number;
}

/**
 * Event types emitted by ViewportManager.
 */
export type ViewportManagerEventType =
  | "pageStateChange"
  | "pageRendered"
  | "pageError"
  | "pageCleanup";

/**
 * Event data for ViewportManager events.
 */
export interface ViewportManagerEvent {
  /**
   * Event type.
   */
  type: ViewportManagerEventType;

  /**
   * Page index associated with the event.
   */
  pageIndex: number;

  /**
   * New state (for pageStateChange events).
   */
  state?: PageState;

  /**
   * Rendered element (for pageRendered events).
   */
  element?: unknown;

  /**
   * Error (for pageError events).
   */
  error?: Error;
}

/**
 * Listener function for ViewportManager events.
 */
export type ViewportManagerEventListener = (event: ViewportManagerEvent) => void;

/**
 * Page source interface for retrieving page information.
 * This abstracts the document so ViewportManager doesn't depend on PDF class directly.
 */
export interface PageSource {
  /**
   * Get the number of pages.
   */
  getPageCount(): number;

  /**
   * Get the dimensions of a page in points.
   */
  getPageDimensions(pageIndex: number): Promise<{ width: number; height: number }>;

  /**
   * Get the rotation of a page in degrees (0, 90, 180, 270).
   */
  getPageRotation(pageIndex: number): Promise<number>;
}

/**
 * ViewportManager coordinates page rendering with the virtual scrolling system.
 *
 * It subscribes to VirtualScroller events and manages the lifecycle of page
 * elements, ensuring that visible pages are rendered and off-screen pages
 * are cleaned up to maintain constant memory usage.
 *
 * @example
 * ```ts
 * const scroller = new VirtualScroller({ viewportWidth: 800, viewportHeight: 600 });
 * const renderer = new CanvasRenderer();
 * await renderer.initialize();
 *
 * const manager = new ViewportManager({
 *   scroller,
 *   renderer,
 *   pageSource,
 *   cacheSize: 5,
 * });
 *
 * // Initialize with page dimensions
 * await manager.initialize();
 *
 * // Get rendered elements for visible pages
 * const pages = manager.getRenderedPages();
 * ```
 */
export class ViewportManager {
  private _scroller: VirtualScroller;
  private _renderer: BaseRenderer;
  private _pageSource: PageSource;
  private _options: Required<ViewportManagerOptions>;
  private _managedPages: Map<number, ManagedPage> = new Map();
  private _listeners: Map<ViewportManagerEventType, Set<ViewportManagerEventListener>> = new Map();
  private _initialized = false;
  private _pendingRenders: Set<number> = new Set();
  private _activeRenders = 0;
  private _disposed = false;

  constructor(options: {
    scroller: VirtualScroller;
    renderer: BaseRenderer;
    pageSource: PageSource;
    cacheSize?: number;
    autoRender?: boolean;
    priorityMode?: "visible" | "sequential";
    maxConcurrentRenders?: number;
  }) {
    console.log(
      `[DEBUG_INSTRUMENTATION] ViewportManager constructor: scroller=${!!options.scroller}, renderer=${!!options.renderer}, pageSource=${!!options.pageSource}`,
    ); // [DEBUG_INSTRUMENTATION]
    this._scroller = options.scroller;
    this._renderer = options.renderer;
    this._pageSource = options.pageSource;
    this._options = {
      cacheSize: options.cacheSize ?? 5,
      autoRender: options.autoRender ?? true,
      priorityMode: options.priorityMode ?? "visible",
      maxConcurrentRenders: options.maxConcurrentRenders ?? 3,
    };

    // Subscribe to scroller events
    console.log(
      `[DEBUG_INSTRUMENTATION] ViewportManager subscribing to scroller events, scroller.addEventListener=${typeof this._scroller.addEventListener}`,
    ); // [DEBUG_INSTRUMENTATION]
    this._scroller.addEventListener("visibleRangeChange", this.handleVisibleRangeChange);
    this._scroller.addEventListener("scaleChange", this.handleScaleChange);
    console.log(`[DEBUG_INSTRUMENTATION] ViewportManager constructor complete`); // [DEBUG_INSTRUMENTATION]
  }

  // ============================================================================
  // Property Getters
  // ============================================================================

  /**
   * Whether the manager has been initialized.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * The associated virtual scroller.
   */
  get scroller(): VirtualScroller {
    return this._scroller;
  }

  /**
   * The associated renderer.
   */
  get renderer(): BaseRenderer {
    return this._renderer;
  }

  /**
   * Number of currently managed pages.
   */
  get managedPageCount(): number {
    return this._managedPages.size;
  }

  /**
   * Number of pages currently being rendered.
   */
  get activeRenderCount(): number {
    return this._activeRenders;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the viewport manager.
   * This loads page dimensions and sets up the scroller.
   */
  async initialize(): Promise<void> {
    if (this._initialized || this._disposed) {
      return;
    }

    const pageCount = this._pageSource.getPageCount();
    const dimensions: Array<{ width: number; height: number }> = [];

    // Load all page dimensions
    for (let i = 0; i < pageCount; i++) {
      const dim = await this._pageSource.getPageDimensions(i);
      dimensions.push(dim);
    }

    // Set dimensions on scroller
    this._scroller.setPageDimensions(dimensions);

    this._initialized = true;

    // Trigger initial render if auto-render is enabled
    if (this._options.autoRender) {
      this.updateVisiblePages();
    }
  }

  // ============================================================================
  // Page Management
  // ============================================================================

  /**
   * Get the state of a specific page.
   *
   * @param pageIndex - Page index
   * @returns The managed page info or null if not managed
   */
  getPageState(pageIndex: number): ManagedPage | null {
    const page = this._managedPages.get(pageIndex);
    return page ? { ...page } : null;
  }

  /**
   * Get all currently managed pages.
   *
   * @returns Array of managed page information
   */
  getManagedPages(): ManagedPage[] {
    return Array.from(this._managedPages.values()).map(page => ({ ...page }));
  }

  /**
   * Get rendered pages in the visible range.
   *
   * @returns Array of managed pages that are rendered and visible
   */
  getRenderedPages(): ManagedPage[] {
    const range = this._scroller.getVisibleRange();
    const pages: ManagedPage[] = [];

    for (let i = range.start; i <= range.end; i++) {
      const page = this._managedPages.get(i);
      if (page && page.state === "rendered") {
        pages.push({ ...page });
      }
    }

    return pages;
  }

  /**
   * Manually trigger rendering of a specific page.
   * This respects maxConcurrentRenders by queueing the render if necessary.
   *
   * @param pageIndex - Page index to render
   * @returns Promise that resolves when rendering is complete
   */
  async renderPage(pageIndex: number): Promise<void> {
    if (this._disposed) {
      return;
    }

    if (pageIndex < 0 || pageIndex >= this._scroller.pageCount) {
      return;
    }

    const existing = this._managedPages.get(pageIndex);
    if (existing && (existing.state === "rendering" || existing.state === "rendered")) {
      return;
    }

    // Queue the render and wait for completion
    return new Promise(resolve => {
      const checkComplete = () => {
        const page = this._managedPages.get(pageIndex);
        if (page && (page.state === "rendered" || page.state === "error")) {
          resolve();
        } else {
          // Check again soon
          setTimeout(checkComplete, 10);
        }
      };

      this.queuePageRender(pageIndex);
      checkComplete();
    });
  }

  /**
   * Cancel rendering of a specific page.
   *
   * @param pageIndex - Page index to cancel
   */
  cancelRender(pageIndex: number): void {
    const page = this._managedPages.get(pageIndex);
    if (page && page.renderTask) {
      page.renderTask.cancel();
      page.renderTask = null;
      page.state = "idle";
      this._activeRenders--;
      this.emitEvent({ type: "pageStateChange", pageIndex, state: "idle" });
      this.processRenderQueue();
    }
  }

  /**
   * Cancel all pending and active renders.
   */
  cancelAllRenders(): void {
    for (const [pageIndex, page] of this._managedPages) {
      if (page.renderTask) {
        page.renderTask.cancel();
        page.renderTask = null;
        page.state = "idle";
        this.emitEvent({ type: "pageStateChange", pageIndex, state: "idle" });
      }
    }
    this._activeRenders = 0;
    this._pendingRenders.clear();
  }

  /**
   * Force re-render of all visible pages.
   * Useful after scale changes or when quality needs to be updated.
   */
  async invalidateVisiblePages(): Promise<void> {
    const range = this._scroller.getVisibleRange();

    // Cancel current renders
    for (let i = range.start; i <= range.end; i++) {
      this.cancelRender(i);
      const page = this._managedPages.get(i);
      if (page) {
        page.state = "idle";
        page.element = null;
        page.viewport = null;
      }
    }

    // Trigger re-render
    this.updateVisiblePages();
  }

  /**
   * Clean up a specific page's resources.
   *
   * @param pageIndex - Page index to clean up
   */
  cleanupPage(pageIndex: number): void {
    const page = this._managedPages.get(pageIndex);
    if (!page) {
      return;
    }

    // Cancel any pending render
    if (page.renderTask) {
      page.renderTask.cancel();
      this._activeRenders--;
    }

    this._managedPages.delete(pageIndex);
    this._pendingRenders.delete(pageIndex);

    this.emitEvent({ type: "pageCleanup", pageIndex });
  }

  /**
   * Clean up all off-screen pages that exceed the cache size.
   */
  cleanupOffscreenPages(): void {
    const range = this._scroller.getVisibleRange();
    const cachedPages: Array<{ pageIndex: number; lastRenderedAt: number }> = [];

    // Collect off-screen rendered pages
    for (const [pageIndex, page] of this._managedPages) {
      if (pageIndex < range.start || pageIndex > range.end) {
        if (page.state === "rendered") {
          cachedPages.push({ pageIndex, lastRenderedAt: page.lastRenderedAt });
        } else if (page.state === "idle" || page.state === "error") {
          // Clean up idle/error pages immediately
          this.cleanupPage(pageIndex);
        }
      }
    }

    // Sort by last rendered time (oldest first)
    cachedPages.sort((a, b) => a.lastRenderedAt - b.lastRenderedAt);

    // Remove excess cached pages
    const excessCount = cachedPages.length - this._options.cacheSize;
    if (excessCount > 0) {
      for (let i = 0; i < excessCount; i++) {
        this.cleanupPage(cachedPages[i].pageIndex);
      }
    }
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
  addEventListener(type: ViewportManagerEventType, listener: ViewportManagerEventListener): void {
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
    type: ViewportManagerEventType,
    listener: ViewportManagerEventListener,
  ): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the viewport manager and clean up all resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Unsubscribe from scroller events
    this._scroller.removeEventListener("visibleRangeChange", this.handleVisibleRangeChange);
    this._scroller.removeEventListener("scaleChange", this.handleScaleChange);

    // Cancel all renders and clean up pages
    this.cancelAllRenders();
    for (const pageIndex of this._managedPages.keys()) {
      this.cleanupPage(pageIndex);
    }

    this._managedPages.clear();
    this._listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle visible range changes from the scroller.
   */
  private handleVisibleRangeChange = (_event: { visibleRange?: VisibleRange }): void => {
    if (this._options.autoRender) {
      this.updateVisiblePages();
    }
    this.cleanupOffscreenPages();
  };

  /**
   * Handle scale changes from the scroller.
   */
  private handleScaleChange = async (_event: { scale?: number }): Promise<void> => {
    // Invalidate all rendered pages since scale changed
    await this.invalidateVisiblePages();
  };

  /**
   * Update visible pages - queue renders for any visible pages not yet rendered.
   */
  private updateVisiblePages(): void {
    if (!this._initialized || this._disposed) {
      return;
    }

    const range = this._scroller.getVisibleRange();
    const pagesToRender: number[] = [];

    for (let i = range.start; i <= range.end; i++) {
      const page = this._managedPages.get(i);
      if (!page || page.state === "idle" || page.state === "error") {
        pagesToRender.push(i);
      }
    }

    // Sort by priority mode
    if (this._options.priorityMode === "visible") {
      // Prioritize pages closest to the center of the viewport
      const centerPage = Math.floor((range.start + range.end) / 2);
      pagesToRender.sort((a, b) => Math.abs(a - centerPage) - Math.abs(b - centerPage));
    }

    // Queue renders
    for (const pageIndex of pagesToRender) {
      this.queuePageRender(pageIndex);
    }
  }

  /**
   * Queue a page for rendering.
   */
  private queuePageRender(pageIndex: number): void {
    if (this._pendingRenders.has(pageIndex)) {
      return;
    }

    this._pendingRenders.add(pageIndex);
    this.processRenderQueue();
  }

  /**
   * Process the render queue, starting renders up to the max concurrent limit.
   */
  private processRenderQueue(): void {
    if (this._disposed) {
      return;
    }

    while (
      this._activeRenders < this._options.maxConcurrentRenders &&
      this._pendingRenders.size > 0
    ) {
      // Get the first pending page (already sorted by priority)
      const pageIndex = this._pendingRenders.values().next().value;
      if (pageIndex === undefined) {
        break;
      }

      this._pendingRenders.delete(pageIndex);

      // Start the render (don't await - let it run in parallel)
      // Note: startPageRender increments _activeRenders synchronously at the start
      void this.startPageRender(pageIndex);
    }
  }

  /**
   * Start rendering a page.
   * This method increments _activeRenders synchronously at the start and decrements
   * it when complete or on error/cancellation.
   */
  private async startPageRender(pageIndex: number): Promise<void> {
    if (this._disposed) {
      return;
    }

    // Create or get managed page entry
    let page = this._managedPages.get(pageIndex);
    if (!page) {
      page = {
        pageIndex,
        state: "idle",
        element: null,
        renderTask: null,
        error: null,
        lastRenderedAt: 0,
        viewport: null,
      };
      this._managedPages.set(pageIndex, page);
    }

    // Check if already rendering
    if (page.state === "rendering") {
      return;
    }

    // Update state and increment active count SYNCHRONOUSLY before any awaits
    page.state = "rendering";
    page.error = null;
    this._activeRenders++;

    this.emitEvent({ type: "pageStateChange", pageIndex, state: "rendering" });

    try {
      // Get page info
      const layout = this._scroller.getPageLayout(pageIndex);
      if (!layout) {
        throw new Error(`Invalid page index: ${pageIndex}`);
      }

      const rotation = await this._pageSource.getPageRotation(pageIndex);
      const dimensions = await this._pageSource.getPageDimensions(pageIndex);

      // Create viewport for this page
      const viewport = this._renderer.createViewport(
        dimensions.width,
        dimensions.height,
        rotation,
        this._scroller.scale,
      );

      page.viewport = viewport;

      // Start render
      const renderTask = this._renderer.render(pageIndex, viewport);
      page.renderTask = renderTask;

      // Wait for completion
      const result = await renderTask.promise;

      // Check if still valid (not cancelled or disposed)
      if (this._disposed || page.renderTask !== renderTask) {
        return;
      }

      // Update page state
      page.state = "rendered";
      page.element = result.element;
      page.renderTask = null;
      page.lastRenderedAt = Date.now();
      this._activeRenders--;

      this.emitEvent({
        type: "pageRendered",
        pageIndex,
        element: result.element,
      });
      this.emitEvent({ type: "pageStateChange", pageIndex, state: "rendered" });

      // Process next in queue
      this.processRenderQueue();
    } catch (error) {
      if (this._disposed) {
        return;
      }

      // Handle error
      page.state = "error";
      page.error = error instanceof Error ? error : new Error(String(error));
      page.renderTask = null;
      this._activeRenders--;

      this.emitEvent({
        type: "pageError",
        pageIndex,
        error: page.error,
      });
      this.emitEvent({ type: "pageStateChange", pageIndex, state: "error" });

      // Process next in queue
      this.processRenderQueue();
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: ViewportManagerEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new ViewportManager instance.
 */
export function createViewportManager(options: {
  scroller: VirtualScroller;
  renderer: BaseRenderer;
  pageSource: PageSource;
  cacheSize?: number;
  autoRender?: boolean;
  priorityMode?: "visible" | "sequential";
  maxConcurrentRenders?: number;
}): ViewportManager {
  return new ViewportManager(options);
}
