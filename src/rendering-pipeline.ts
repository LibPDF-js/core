/**
 * Rendering pipeline coordinator.
 *
 * Manages renderer lifecycle, coordinates rendering operations,
 * and provides the foundation for coordinate transformations between
 * PDF space and screen space.
 */

import type {
  BaseRenderer,
  RendererOptions,
  RendererType,
  RenderResult,
  RenderTask,
  Viewport,
} from "./renderers/base-renderer";
import { CanvasRenderer } from "./renderers/canvas-renderer";
import { SVGRenderer } from "./renderers/svg-renderer";

/**
 * Rendering pipeline configuration options.
 */
export interface RenderingPipelineOptions {
  /**
   * Preferred renderer type.
   * @default "canvas"
   */
  renderer?: RendererType;

  /**
   * Options to pass to the renderer.
   */
  rendererOptions?: RendererOptions;

  /**
   * Maximum number of concurrent render operations.
   * @default 4
   */
  maxConcurrent?: number;

  /**
   * Whether to cache rendered pages.
   * @default true
   */
  cacheEnabled?: boolean;

  /**
   * Maximum number of pages to keep in cache.
   * @default 10
   */
  cacheSize?: number;
}

/**
 * Cached render result with metadata.
 */
interface CachedRender {
  result: RenderResult;
  viewport: Viewport;
  timestamp: number;
}

/**
 * Pending render operation.
 */
interface PendingRender {
  pageIndex: number;
  viewport: Viewport;
  task: RenderTask;
}

/**
 * Rendering pipeline coordinates rendering operations for PDF pages.
 *
 * It manages renderer lifecycle, handles concurrent rendering limits,
 * and provides caching for improved performance.
 */
export class RenderingPipeline {
  private _options: Required<RenderingPipelineOptions>;
  private _renderer: BaseRenderer | null = null;
  private _initialized = false;
  private _cache: Map<string, CachedRender> = new Map();
  private _pendingRenders: Map<string, PendingRender> = new Map();
  private _activeRenderCount = 0;

  constructor(options?: RenderingPipelineOptions) {
    this._options = {
      renderer: options?.renderer ?? "canvas",
      rendererOptions: options?.rendererOptions ?? {},
      maxConcurrent: options?.maxConcurrent ?? 4,
      cacheEnabled: options?.cacheEnabled ?? true,
      cacheSize: options?.cacheSize ?? 10,
    };
  }

  /**
   * Whether the pipeline has been initialized.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * The current renderer instance.
   */
  get renderer(): BaseRenderer | null {
    return this._renderer;
  }

  /**
   * The type of renderer being used.
   */
  get rendererType(): RendererType {
    return this._options.renderer;
  }

  /**
   * Number of currently active render operations.
   */
  get activeRenderCount(): number {
    return this._activeRenderCount;
  }

  /**
   * Initialize the rendering pipeline.
   * Creates and initializes the renderer based on configuration.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Create renderer based on type
    this._renderer = this.createRenderer(this._options.renderer);

    // Initialize renderer
    await this._renderer.initialize(this._options.rendererOptions);

    this._initialized = true;
  }

  /**
   * Create a renderer instance based on type.
   */
  private createRenderer(type: RendererType): BaseRenderer {
    switch (type) {
      case "canvas":
        return new CanvasRenderer();
      case "svg":
        return new SVGRenderer();
      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- exhaustive check
        throw new Error(`Unknown renderer type: ${type}`);
    }
  }

  /**
   * Create a viewport for a page.
   *
   * @param pageWidth - Width of the page in points
   * @param pageHeight - Height of the page in points
   * @param pageRotation - Page rotation in degrees (0, 90, 180, 270)
   * @param scale - Scale factor (default: 1)
   * @param rotation - Additional rotation in degrees (default: 0)
   */
  createViewport(
    pageWidth: number,
    pageHeight: number,
    pageRotation: number,
    scale = 1,
    rotation = 0,
  ): Viewport {
    if (!this._initialized || !this._renderer) {
      throw new Error("Pipeline must be initialized before creating viewport");
    }

    return this._renderer.createViewport(pageWidth, pageHeight, pageRotation, scale, rotation);
  }

  /**
   * Generate a cache key for a page render.
   */
  private getCacheKey(pageIndex: number, viewport: Viewport): string {
    return `page-${pageIndex}-s${viewport.scale}-r${viewport.rotation}`;
  }

  /**
   * Check if a render result is cached.
   */
  isCached(pageIndex: number, viewport: Viewport): boolean {
    if (!this._options.cacheEnabled) {
      return false;
    }

    const key = this.getCacheKey(pageIndex, viewport);
    return this._cache.has(key);
  }

  /**
   * Get a cached render result if available.
   */
  getCached(pageIndex: number, viewport: Viewport): RenderResult | null {
    if (!this._options.cacheEnabled) {
      return null;
    }

    const key = this.getCacheKey(pageIndex, viewport);
    const cached = this._cache.get(key);

    return cached?.result ?? null;
  }

  /**
   * Add a render result to the cache.
   */
  private addToCache(pageIndex: number, viewport: Viewport, result: RenderResult): void {
    if (!this._options.cacheEnabled) {
      return;
    }

    const key = this.getCacheKey(pageIndex, viewport);

    // Evict oldest entries if cache is full
    while (this._cache.size >= this._options.cacheSize) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this._cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this._cache.set(key, {
      result,
      viewport,
      timestamp: Date.now(),
    });
  }

  /**
   * Find the oldest cache entry key.
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this._cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Render a page with the configured renderer.
   *
   * @param pageIndex - 0-indexed page number
   * @param viewport - The viewport to render into
   */
  render(pageIndex: number, viewport: Viewport): RenderTask {
    if (!this._initialized || !this._renderer) {
      throw new Error("Pipeline must be initialized before rendering");
    }

    const cacheKey = this.getCacheKey(pageIndex, viewport);

    // Check cache first
    const cached = this.getCached(pageIndex, viewport);
    if (cached) {
      return {
        promise: Promise.resolve(cached),
        cancel: () => {},
        cancelled: false,
      };
    }

    // Check if this render is already pending
    const pending = this._pendingRenders.get(cacheKey);
    if (pending) {
      return pending.task;
    }

    // Create new render task
    const rendererTask = this._renderer.render(pageIndex, viewport);

    // Wrap the task to handle caching and concurrency
    let cancelled = false;
    const wrappedPromise = (async () => {
      // Wait if we're at max concurrent renders
      while (this._activeRenderCount >= this._options.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (cancelled) {
          throw new Error("Render task cancelled");
        }
      }

      this._activeRenderCount++;

      try {
        const result = await rendererTask.promise;

        // Cache the result
        if (!cancelled) {
          this.addToCache(pageIndex, viewport, result);
        }

        return result;
      } finally {
        this._activeRenderCount--;
        this._pendingRenders.delete(cacheKey);
      }
    })();

    const wrappedTask: RenderTask = {
      promise: wrappedPromise,
      cancel: () => {
        cancelled = true;
        rendererTask.cancel();
      },
      get cancelled() {
        return cancelled;
      },
    };

    // Track pending render
    this._pendingRenders.set(cacheKey, {
      pageIndex,
      viewport,
      task: wrappedTask,
    });

    return wrappedTask;
  }

  /**
   * Cancel all pending render operations.
   */
  cancelAll(): void {
    for (const pending of this._pendingRenders.values()) {
      pending.task.cancel();
    }
    this._pendingRenders.clear();
  }

  /**
   * Clear the render cache.
   */
  clearCache(): void {
    this._cache.clear();
  }

  /**
   * Clean up resources and destroy the pipeline.
   */
  destroy(): void {
    // Cancel all pending renders
    this.cancelAll();

    // Clear cache
    this.clearCache();

    // Destroy renderer
    if (this._renderer) {
      this._renderer.destroy();
      this._renderer = null;
    }

    this._initialized = false;
  }

  /**
   * Convert a point from PDF space to screen space.
   *
   * @param x - X coordinate in PDF space (points)
   * @param y - Y coordinate in PDF space (points)
   * @param viewport - The viewport for the transformation
   * @returns Coordinates in screen space (pixels)
   */
  pdfToScreen(x: number, y: number, viewport: Viewport): { x: number; y: number } {
    // Apply scale
    let screenX = x * viewport.scale;
    let screenY = y * viewport.scale;

    // PDF coordinate system has origin at bottom-left, screen at top-left
    // Flip Y coordinate
    screenY = viewport.height - screenY;

    // Apply offset
    screenX += viewport.offsetX;
    screenY += viewport.offsetY;

    // Apply rotation (around center)
    if (viewport.rotation !== 0) {
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      const rad = (viewport.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const dx = screenX - cx;
      const dy = screenY - cy;

      screenX = cx + dx * cos - dy * sin;
      screenY = cy + dx * sin + dy * cos;
    }

    return { x: screenX, y: screenY };
  }

  /**
   * Convert a point from screen space to PDF space.
   *
   * @param x - X coordinate in screen space (pixels)
   * @param y - Y coordinate in screen space (pixels)
   * @param viewport - The viewport for the transformation
   * @returns Coordinates in PDF space (points)
   */
  screenToPdf(x: number, y: number, viewport: Viewport): { x: number; y: number } {
    let pdfX = x;
    let pdfY = y;

    // Reverse rotation (around center)
    if (viewport.rotation !== 0) {
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      const rad = (-viewport.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const dx = pdfX - cx;
      const dy = pdfY - cy;

      pdfX = cx + dx * cos - dy * sin;
      pdfY = cy + dx * sin + dy * cos;
    }

    // Reverse offset
    pdfX -= viewport.offsetX;
    pdfY -= viewport.offsetY;

    // Flip Y coordinate (screen to PDF)
    pdfY = viewport.height - pdfY;

    // Reverse scale
    pdfX /= viewport.scale;
    pdfY /= viewport.scale;

    return { x: pdfX, y: pdfY };
  }
}

/**
 * Create a new rendering pipeline instance.
 */
export function createRenderingPipeline(options?: RenderingPipelineOptions): RenderingPipeline {
  return new RenderingPipeline(options);
}
