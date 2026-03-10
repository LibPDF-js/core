/**
 * DOM element recycling system for virtual scrolling.
 *
 * Manages pools of reusable DOM elements (page containers and text layers)
 * to minimize DOM operations and memory allocation during scrolling.
 * Elements are acquired from pools when pages become visible and returned
 * when pages leave the viewport, enabling efficient rendering of large
 * documents with constant memory usage.
 */

/**
 * Type of recyclable DOM element.
 */
export type RecyclableElementType =
  | "pageContainer"
  | "textLayer"
  | "canvasLayer"
  | "annotationLayer";

/**
 * A recyclable DOM element with metadata.
 */
export interface RecyclableElement {
  /**
   * The DOM element.
   */
  element: HTMLElement;

  /**
   * The type of element.
   */
  type: RecyclableElementType;

  /**
   * Whether the element is currently in use.
   */
  inUse: boolean;

  /**
   * Page index currently using this element (-1 if not in use).
   */
  pageIndex: number;

  /**
   * Timestamp when the element was last used.
   */
  lastUsedAt: number;

  /**
   * Unique identifier for this recyclable element.
   */
  id: string;
}

/**
 * Configuration for a specific element type pool.
 */
export interface PoolConfig {
  /**
   * Maximum number of elements to keep in the pool.
   * @default 10
   */
  maxSize?: number;

  /**
   * Factory function to create new elements.
   */
  factory: () => HTMLElement;

  /**
   * Function to reset an element before recycling.
   * Called when an element is returned to the pool.
   */
  reset?: (element: HTMLElement) => void;

  /**
   * Function to prepare an element for use.
   * Called when an element is acquired from the pool.
   */
  prepare?: (element: HTMLElement) => void;
}

/**
 * Options for configuring the DOMRecycler.
 */
export interface DOMRecyclerOptions {
  /**
   * Default maximum pool size for each element type.
   * @default 10
   */
  defaultMaxPoolSize?: number;

  /**
   * Whether to automatically clean up unused elements periodically.
   * @default false
   */
  autoCleanup?: boolean;

  /**
   * Interval in milliseconds for auto-cleanup.
   * @default 30000
   */
  cleanupInterval?: number;

  /**
   * Maximum age in milliseconds for unused elements before cleanup.
   * @default 60000
   */
  maxElementAge?: number;
}

/**
 * Statistics about the DOM recycler pools.
 */
export interface RecyclerStats {
  /**
   * Total number of elements across all pools.
   */
  totalElements: number;

  /**
   * Number of elements currently in use.
   */
  inUseCount: number;

  /**
   * Number of elements available in pools.
   */
  availableCount: number;

  /**
   * Breakdown by element type.
   */
  byType: Map<RecyclableElementType, { total: number; inUse: number; available: number }>;

  /**
   * Number of times elements were recycled instead of created.
   */
  recycleCount: number;

  /**
   * Number of new elements created.
   */
  createCount: number;
}

/**
 * Event types emitted by DOMRecycler.
 */
export type DOMRecyclerEventType = "elementAcquired" | "elementReleased" | "poolCleanup";

/**
 * Event data for DOMRecycler events.
 */
export interface DOMRecyclerEvent {
  /**
   * Event type.
   */
  type: DOMRecyclerEventType;

  /**
   * Element type involved.
   */
  elementType: RecyclableElementType;

  /**
   * Page index (for acquire/release events).
   */
  pageIndex?: number;

  /**
   * Element ID.
   */
  elementId?: string;

  /**
   * Number of elements cleaned up (for cleanup events).
   */
  cleanedUpCount?: number;
}

/**
 * Listener function for DOMRecycler events.
 */
export type DOMRecyclerEventListener = (event: DOMRecyclerEvent) => void;

/**
 * DOMRecycler manages pools of reusable DOM elements for virtual scrolling.
 *
 * Instead of creating and destroying DOM elements as pages enter and leave
 * the viewport, the recycler maintains pools of elements that can be reused.
 * This significantly reduces DOM manipulation overhead and memory churn,
 * especially when scrolling through large documents.
 *
 * @example
 * ```ts
 * const recycler = new DOMRecycler();
 *
 * // Register element types with factories
 * recycler.registerPool('pageContainer', {
 *   factory: () => {
 *     const div = document.createElement('div');
 *     div.className = 'pdf-page-container';
 *     return div;
 *   },
 *   reset: (el) => {
 *     el.innerHTML = '';
 *     el.style.cssText = '';
 *   },
 * });
 *
 * // Acquire an element for a page
 * const element = recycler.acquire('pageContainer', 5);
 *
 * // Release when page leaves viewport
 * recycler.release('pageContainer', 5);
 * ```
 */
export class DOMRecycler {
  private _pools: Map<RecyclableElementType, PoolConfig> = new Map();
  private _elements: Map<RecyclableElementType, RecyclableElement[]> = new Map();
  private _pageElements: Map<number, Map<RecyclableElementType, RecyclableElement>> = new Map();
  private _options: Required<DOMRecyclerOptions>;
  private _listeners: Map<DOMRecyclerEventType, Set<DOMRecyclerEventListener>> = new Map();
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private _idCounter = 0;
  private _stats = {
    recycleCount: 0,
    createCount: 0,
  };
  private _disposed = false;

  constructor(options: DOMRecyclerOptions = {}) {
    this._options = {
      defaultMaxPoolSize: options.defaultMaxPoolSize ?? 10,
      autoCleanup: options.autoCleanup ?? false,
      cleanupInterval: options.cleanupInterval ?? 30000,
      maxElementAge: options.maxElementAge ?? 60000,
    };

    if (this._options.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  // ============================================================================
  // Pool Registration
  // ============================================================================

  /**
   * Register a pool for a specific element type.
   *
   * @param type - The type of element this pool manages
   * @param config - Configuration for the pool
   */
  registerPool(type: RecyclableElementType, config: PoolConfig): void {
    if (this._disposed) {
      return;
    }

    this._pools.set(type, {
      maxSize: config.maxSize ?? this._options.defaultMaxPoolSize,
      factory: config.factory,
      reset: config.reset,
      prepare: config.prepare,
    });

    if (!this._elements.has(type)) {
      this._elements.set(type, []);
    }
  }

  /**
   * Check if a pool is registered for the given type.
   *
   * @param type - Element type to check
   * @returns True if pool exists
   */
  hasPool(type: RecyclableElementType): boolean {
    return this._pools.has(type);
  }

  /**
   * Get the configuration for a pool.
   *
   * @param type - Element type
   * @returns Pool configuration or null
   */
  getPoolConfig(type: RecyclableElementType): PoolConfig | null {
    const config = this._pools.get(type);
    return config ? { ...config } : null;
  }

  // ============================================================================
  // Element Acquisition and Release
  // ============================================================================

  /**
   * Acquire an element for a specific page.
   *
   * If the page already has an element of this type, returns it.
   * Otherwise, tries to recycle an unused element or creates a new one.
   *
   * @param type - Type of element to acquire
   * @param pageIndex - Page index that will use the element
   * @returns The acquired element
   * @throws Error if no pool is registered for the type
   */
  acquire(type: RecyclableElementType, pageIndex: number): HTMLElement {
    if (this._disposed) {
      throw new Error("DOMRecycler has been disposed");
    }

    const config = this._pools.get(type);
    if (!config) {
      throw new Error(`No pool registered for element type: ${type}`);
    }

    // Check if page already has this element type
    const pageElements = this._pageElements.get(pageIndex);
    if (pageElements) {
      const existing = pageElements.get(type);
      if (existing) {
        existing.lastUsedAt = Date.now();
        return existing.element;
      }
    }

    // Try to get an unused element from the pool
    const pool = this._elements.get(type)!;
    let recyclable = pool.find(el => !el.inUse);

    if (recyclable) {
      // Recycle existing element
      this._stats.recycleCount++;
    } else {
      // Create new element
      const element = config.factory();
      recyclable = {
        element,
        type,
        inUse: false,
        pageIndex: -1,
        lastUsedAt: Date.now(),
        id: this.generateId(),
      };
      pool.push(recyclable);
      this._stats.createCount++;
    }

    // Mark as in use
    recyclable.inUse = true;
    recyclable.pageIndex = pageIndex;
    recyclable.lastUsedAt = Date.now();

    // Prepare the element if a prepare function is provided
    if (config.prepare) {
      config.prepare(recyclable.element);
    }

    // Track page -> element mapping
    if (!this._pageElements.has(pageIndex)) {
      this._pageElements.set(pageIndex, new Map());
    }
    this._pageElements.get(pageIndex)!.set(type, recyclable);

    this.emitEvent({
      type: "elementAcquired",
      elementType: type,
      pageIndex,
      elementId: recyclable.id,
    });

    return recyclable.element;
  }

  /**
   * Release an element back to the pool.
   *
   * @param type - Type of element to release
   * @param pageIndex - Page index that was using the element
   */
  release(type: RecyclableElementType, pageIndex: number): void {
    if (this._disposed) {
      return;
    }

    const pageElements = this._pageElements.get(pageIndex);
    if (!pageElements) {
      return;
    }

    const recyclable = pageElements.get(type);
    if (!recyclable) {
      return;
    }

    // Reset the element
    const config = this._pools.get(type);
    if (config?.reset) {
      config.reset(recyclable.element);
    }

    // Mark as not in use
    recyclable.inUse = false;
    recyclable.pageIndex = -1;
    recyclable.lastUsedAt = Date.now();

    // Remove from page mapping
    pageElements.delete(type);
    if (pageElements.size === 0) {
      this._pageElements.delete(pageIndex);
    }

    this.emitEvent({
      type: "elementReleased",
      elementType: type,
      pageIndex,
      elementId: recyclable.id,
    });

    // Enforce pool size limit
    this.enforcePoolLimit(type);
  }

  /**
   * Release all elements for a specific page.
   *
   * @param pageIndex - Page index to release elements for
   */
  releaseAllForPage(pageIndex: number): void {
    const pageElements = this._pageElements.get(pageIndex);
    if (!pageElements) {
      return;
    }

    // Get all types for this page and release them
    const types = Array.from(pageElements.keys());
    for (const type of types) {
      this.release(type, pageIndex);
    }
  }

  /**
   * Get the element currently assigned to a page.
   *
   * @param type - Type of element
   * @param pageIndex - Page index
   * @returns The element or null if not found
   */
  getElement(type: RecyclableElementType, pageIndex: number): HTMLElement | null {
    const pageElements = this._pageElements.get(pageIndex);
    if (!pageElements) {
      return null;
    }

    const recyclable = pageElements.get(type);
    return recyclable ? recyclable.element : null;
  }

  /**
   * Check if a page has an element of the given type.
   *
   * @param type - Type of element
   * @param pageIndex - Page index
   * @returns True if the page has an element of this type
   */
  hasElement(type: RecyclableElementType, pageIndex: number): boolean {
    return this.getElement(type, pageIndex) !== null;
  }

  /**
   * Get all elements currently assigned to a page.
   *
   * @param pageIndex - Page index
   * @returns Map of element types to elements
   */
  getElementsForPage(pageIndex: number): Map<RecyclableElementType, HTMLElement> {
    const result = new Map<RecyclableElementType, HTMLElement>();
    const pageElements = this._pageElements.get(pageIndex);

    if (pageElements) {
      for (const [type, recyclable] of pageElements) {
        result.set(type, recyclable.element);
      }
    }

    return result;
  }

  // ============================================================================
  // Pool Management
  // ============================================================================

  /**
   * Get statistics about the recycler pools.
   *
   * @returns Current statistics
   */
  getStats(): RecyclerStats {
    const byType = new Map<
      RecyclableElementType,
      { total: number; inUse: number; available: number }
    >();
    let totalElements = 0;
    let inUseCount = 0;

    for (const [type, elements] of this._elements) {
      const total = elements.length;
      const inUse = elements.filter(el => el.inUse).length;
      const available = total - inUse;

      byType.set(type, { total, inUse, available });
      totalElements += total;
      inUseCount += inUse;
    }

    return {
      totalElements,
      inUseCount,
      availableCount: totalElements - inUseCount,
      byType,
      recycleCount: this._stats.recycleCount,
      createCount: this._stats.createCount,
    };
  }

  /**
   * Clean up unused elements that are older than maxElementAge.
   *
   * @returns Number of elements cleaned up
   */
  cleanup(): number {
    if (this._disposed) {
      return 0;
    }

    const now = Date.now();
    const maxAge = this._options.maxElementAge;
    let cleanedUp = 0;

    for (const [type, elements] of this._elements) {
      const config = this._pools.get(type);
      const maxSize = config?.maxSize ?? this._options.defaultMaxPoolSize;

      // Find unused elements older than maxAge
      const toRemove: RecyclableElement[] = [];
      for (const el of elements) {
        if (!el.inUse && now - el.lastUsedAt > maxAge) {
          toRemove.push(el);
        }
      }

      // Keep at least some elements in the pool for reuse
      const availableCount = elements.filter(el => !el.inUse).length;
      const minToKeep = Math.floor(maxSize / 2);
      const canRemove = Math.max(0, availableCount - minToKeep);
      const actualRemove = toRemove.slice(0, canRemove);

      for (const el of actualRemove) {
        const index = elements.indexOf(el);
        if (index !== -1) {
          elements.splice(index, 1);
          cleanedUp++;
        }
      }

      if (actualRemove.length > 0) {
        this.emitEvent({
          type: "poolCleanup",
          elementType: type,
          cleanedUpCount: actualRemove.length,
        });
      }
    }

    return cleanedUp;
  }

  /**
   * Clear all pools and release all elements.
   */
  clear(): void {
    // Release all page elements
    for (const pageIndex of this._pageElements.keys()) {
      this.releaseAllForPage(pageIndex);
    }

    // Clear all pools
    for (const [_type, elements] of this._elements) {
      elements.length = 0;
    }

    this._pageElements.clear();
    this._stats.recycleCount = 0;
    this._stats.createCount = 0;
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
  addEventListener(type: DOMRecyclerEventType, listener: DOMRecyclerEventListener): void {
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
  removeEventListener(type: DOMRecyclerEventType, listener: DOMRecyclerEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the recycler and clean up all resources.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Stop auto-cleanup
    this.stopAutoCleanup();

    // Clear all pools
    this.clear();

    // Clear listeners
    this._listeners.clear();
    this._pools.clear();
    this._elements.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate a unique ID for an element.
   */
  private generateId(): string {
    return `recycled-${++this._idCounter}`;
  }

  /**
   * Enforce the pool size limit by removing excess unused elements.
   */
  private enforcePoolLimit(type: RecyclableElementType): void {
    const config = this._pools.get(type);
    const maxSize = config?.maxSize ?? this._options.defaultMaxPoolSize;
    const elements = this._elements.get(type);

    if (!elements) {
      return;
    }

    // Sort unused elements by last used time (oldest first)
    const unused = elements.filter(el => !el.inUse).sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    // Remove excess elements
    const excess = elements.length - maxSize;
    if (excess > 0) {
      const toRemove = unused.slice(0, excess);
      for (const el of toRemove) {
        const index = elements.indexOf(el);
        if (index !== -1) {
          elements.splice(index, 1);
        }
      }
    }
  }

  /**
   * Start the auto-cleanup timer.
   */
  private startAutoCleanup(): void {
    if (this._cleanupTimer) {
      return;
    }

    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this._options.cleanupInterval);
  }

  /**
   * Stop the auto-cleanup timer.
   */
  private stopAutoCleanup(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Emit an event to all registered listeners.
   */
  private emitEvent(event: DOMRecyclerEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Create a new DOMRecycler instance.
 */
export function createDOMRecycler(options?: DOMRecyclerOptions): DOMRecycler {
  return new DOMRecycler(options);
}

/**
 * Create default pool configurations for PDF viewer elements.
 *
 * @returns Map of element types to pool configurations
 */
export function createDefaultPoolConfigs(): Map<RecyclableElementType, PoolConfig> {
  const configs = new Map<RecyclableElementType, PoolConfig>();

  configs.set("pageContainer", {
    maxSize: 10,
    factory: () => {
      const div = document.createElement("div");
      div.className = "pdf-page-container";
      div.style.position = "absolute";
      div.style.overflow = "hidden";
      return div;
    },
    reset: el => {
      el.innerHTML = "";
      el.style.width = "";
      el.style.height = "";
      el.style.top = "";
      el.style.left = "";
      el.style.transform = "";
    },
    prepare: el => {
      el.style.display = "block";
    },
  });

  configs.set("textLayer", {
    maxSize: 10,
    factory: () => {
      const div = document.createElement("div");
      div.className = "pdf-text-layer";
      div.style.position = "absolute";
      div.style.top = "0";
      div.style.left = "0";
      div.style.right = "0";
      div.style.bottom = "0";
      div.style.overflow = "hidden";
      div.style.lineHeight = "1";
      return div;
    },
    reset: el => {
      el.innerHTML = "";
      el.style.transform = "";
    },
  });

  configs.set("canvasLayer", {
    maxSize: 10,
    factory: () => {
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-canvas-layer";
      canvas.style.display = "block";
      return canvas;
    },
    reset: el => {
      const canvas = el as HTMLCanvasElement;
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = "";
      canvas.style.height = "";
    },
  });

  configs.set("annotationLayer", {
    maxSize: 10,
    factory: () => {
      const div = document.createElement("div");
      div.className = "pdf-annotation-layer";
      div.style.position = "absolute";
      div.style.top = "0";
      div.style.left = "0";
      div.style.right = "0";
      div.style.bottom = "0";
      div.style.pointerEvents = "none";
      return div;
    },
    reset: el => {
      el.innerHTML = "";
    },
  });

  return configs;
}
