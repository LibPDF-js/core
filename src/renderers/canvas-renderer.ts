/**
 * Canvas-based PDF renderer.
 *
 * Renders PDF pages to an HTML Canvas element using the 2D rendering context.
 * This is the primary renderer for most use cases, offering good performance
 * and compatibility across browsers.
 */

import type {
  BaseRenderer,
  RendererOptions,
  RenderResult,
  RenderTask,
  Viewport,
} from "./base-renderer";

/**
 * Canvas-specific renderer options.
 */
export interface CanvasRendererOptions extends RendererOptions {
  /**
   * Canvas element to render into.
   * If not provided, a new canvas will be created.
   */
  canvas?: HTMLCanvasElement;

  /**
   * Whether to use OffscreenCanvas for rendering (if available).
   * Can improve performance by allowing rendering in a worker.
   * @default false
   */
  offscreen?: boolean;

  /**
   * Image smoothing quality.
   * @default "medium"
   */
  imageSmoothingQuality?: ImageSmoothingQuality;

  /**
   * Whether to run in headless mode (no actual canvas).
   * Useful for testing and server-side environments.
   * @default false in browser, true in non-browser environments
   */
  headless?: boolean;
}

/**
 * Canvas-based PDF renderer implementation.
 */
export class CanvasRenderer implements BaseRenderer {
  readonly type = "canvas" as const;

  private _initialized = false;
  private _options: CanvasRendererOptions = {};
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  private _canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  private _context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private _headless = false;
  private _headlessWidth = 0;
  private _headlessHeight = 0;

  get initialized(): boolean {
    return this._initialized;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface consistency
  async initialize(options?: CanvasRendererOptions): Promise<void> {
    if (this._initialized) {
      return;
    }

    this._options = {
      scale: 1,
      textLayer: false,
      annotationLayer: true,
      imageSmoothingQuality: "medium",
      ...options,
    };

    // Determine if we should use headless mode
    const hasDOM = typeof document !== "undefined";
    const hasOffscreen = typeof OffscreenCanvas !== "undefined";
    this._headless = this._options.headless ?? (!hasDOM && !hasOffscreen);

    if (this._headless) {
      // Headless mode - no actual canvas needed
      this._initialized = true;
      return;
    }

    // Create or use provided canvas
    if (this._options.canvas) {
      this._canvas = this._options.canvas;
    } else if (this._options.offscreen && hasOffscreen) {
      // Create with initial size, will be resized when rendering
      this._canvas = new OffscreenCanvas(1, 1);
    } else if (hasDOM) {
      this._canvas = document.createElement("canvas");
    } else {
      // Fall back to headless mode
      this._headless = true;
      this._initialized = true;
      return;
    }

    // Get 2D context
    const context = this._canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D rendering context");
    }
    this._context = context;

    // Configure context
    if ("imageSmoothingQuality" in this._context) {
      this._context.imageSmoothingQuality = this._options.imageSmoothingQuality ?? "medium";
    }

    this._initialized = true;
  }

  createViewport(
    pageWidth: number,
    pageHeight: number,
    pageRotation: number,
    scale = 1,
    rotation = 0,
  ): Viewport {
    if (!this._initialized) {
      throw new Error("Renderer must be initialized before creating viewport");
    }

    // Combine page rotation with additional rotation
    const totalRotation = (pageRotation + rotation) % 360;

    // Calculate dimensions based on rotation
    const isRotated = totalRotation === 90 || totalRotation === 270;
    const width = isRotated ? pageHeight * scale : pageWidth * scale;
    const height = isRotated ? pageWidth * scale : pageHeight * scale;

    return {
      width,
      height,
      scale,
      rotation: totalRotation,
      offsetX: 0,
      offsetY: 0,
    };
  }

  render(pageIndex: number, viewport: Viewport): RenderTask {
    if (!this._initialized) {
      throw new Error("Renderer must be initialized before rendering");
    }

    let cancelled = false;

    // Store pageIndex for potential future use
    void pageIndex;

    if (this._headless) {
      // Headless mode - just return dimensions
      const promise = new Promise<RenderResult>((resolve, reject) => {
        queueMicrotask(() => {
          if (cancelled) {
            reject(new Error("Render task cancelled"));
            return;
          }

          this._headlessWidth = Math.floor(viewport.width);
          this._headlessHeight = Math.floor(viewport.height);

          resolve({
            width: this._headlessWidth,
            height: this._headlessHeight,
            element: null,
          });
        });
      });

      return {
        promise,
        cancel: () => {
          cancelled = true;
        },
        get cancelled() {
          return cancelled;
        },
      };
    }

    const canvas = this._canvas!;
    const context = this._context!;
    const options = this._options;

    const promise = new Promise<RenderResult>((resolve, reject) => {
      // Use microtask to allow cancellation check
      queueMicrotask(() => {
        if (cancelled) {
          reject(new Error("Render task cancelled"));
          return;
        }

        try {
          // Resize canvas to match viewport
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);

          // Apply background if specified
          if (options.background) {
            context.fillStyle = options.background;
            context.fillRect(0, 0, canvas.width, canvas.height);
          }

          // Apply viewport transformation
          context.save();

          // Handle rotation transformation
          if (viewport.rotation !== 0) {
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((viewport.rotation * Math.PI) / 180);
            if (viewport.rotation === 90 || viewport.rotation === 270) {
              context.translate(-canvas.height / 2, -canvas.width / 2);
            } else {
              context.translate(-canvas.width / 2, -canvas.height / 2);
            }
          }

          // Apply scale
          context.scale(viewport.scale, viewport.scale);

          // Apply offset
          context.translate(viewport.offsetX, viewport.offsetY);

          // Note: Actual PDF content rendering will be implemented in future tasks.
          // This foundation sets up the canvas transformation pipeline.
          // The page content stream operators will be executed here.

          context.restore();

          resolve({
            width: canvas.width,
            height: canvas.height,
            element: canvas,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
      },
      get cancelled() {
        return cancelled;
      },
    };
  }

  destroy(): void {
    if (this._context) {
      // Clear any canvas content
      if (this._canvas) {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
      this._context = null;
    }

    // Only remove canvas if we created it (not if it was provided)
    if (this._canvas && !this._options.canvas) {
      if (this._canvas instanceof HTMLCanvasElement && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
    }
    this._canvas = null;
    this._headless = false;

    this._initialized = false;
  }

  /**
   * Get the underlying canvas element.
   * Useful for attaching to the DOM or further manipulation.
   * Returns null in headless mode.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this._canvas;
  }

  /**
   * Get the 2D rendering context.
   * Useful for custom drawing operations.
   * Returns null in headless mode.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  getContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    return this._context;
  }

  /**
   * Whether the renderer is running in headless mode.
   */
  get isHeadless(): boolean {
    return this._headless;
  }
}

/**
 * Create a new Canvas renderer instance.
 */
export function createCanvasRenderer(options?: CanvasRendererOptions): CanvasRenderer {
  return new CanvasRenderer();
}
