/**
 * PDF.js-based renderer implementation.
 *
 * This renderer uses PDF.js for actual PDF rendering, providing high-quality
 * and accurate rendering that matches PDF.js's battle-tested implementation.
 */

import type {
  BaseRenderer,
  FontResolver,
  RenderResult,
  RenderTask,
  Viewport,
} from "../../renderers/base-renderer";
import {
  createPageViewport,
  getPage,
  getPDFJS,
  initializePDFJS,
  isPDFJSInitialized,
  loadDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PDFJSWrapperOptions,
} from "./pdfjs-wrapper";

/**
 * Options for the PDF.js renderer.
 */
export interface PDFJSRendererOptions extends PDFJSWrapperOptions {
  /**
   * Canvas element to render into.
   * If not provided, a new canvas will be created.
   */
  canvas?: HTMLCanvasElement;

  /**
   * Whether to use OffscreenCanvas for rendering (if available).
   * @default false
   */
  offscreen?: boolean;

  /**
   * Image smoothing quality.
   * @default "medium"
   */
  imageSmoothingQuality?: ImageSmoothingQuality;

  /**
   * Background color for rendered pages.
   * @default "#ffffff"
   */
  background?: string;

  /**
   * Whether to run in headless mode (no actual canvas).
   * @default false in browser, true in non-browser environments
   */
  headless?: boolean;
}

/**
 * PDF.js-based renderer.
 *
 * This renderer uses PDF.js for actual PDF rendering, providing accurate
 * and high-quality PDF rendering with full support for PDF features.
 */
export class PDFJSRenderer implements BaseRenderer {
  readonly type = "canvas" as const;

  private _initialized = false;
  private _options: PDFJSRendererOptions = {};
  private _canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private _context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private _headless = false;
  private _headlessWidth = 0;
  private _headlessHeight = 0;
  private _document: PDFDocumentProxy | null = null;
  private _pageCache: Map<number, PDFPageProxy> = new Map();
  private _activeRenderTask: { pageIndex: number; task: any } | null = null;
  private _renderQueue: Array<{
    pageIndex: number;
    viewport: Viewport;
    resolve: (result: RenderResult) => void;
    reject: (error: Error) => void;
    cancelled: { value: boolean };
  }> = [];
  private _isProcessingQueue = false;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Set the PDF document to render from.
   * This should be called after loading a PDF using the PDF.js wrapper.
   */
  setDocument(document: PDFDocumentProxy): void {
    this._document = document;
    this._pageCache.clear();
  }

  /**
   * Load a PDF document from bytes.
   */
  async loadDocument(data: Uint8Array): Promise<void> {
    if (!isPDFJSInitialized()) {
      await initializePDFJS(this._options);
    }
    this._document = await loadDocument(data);
    this._pageCache.clear();
  }

  async initialize(options?: PDFJSRendererOptions): Promise<void> {
    if (this._initialized) {
      return;
    }

    this._options = {
      imageSmoothingQuality: "medium",
      background: "#ffffff",
      ...options,
    };

    // Initialize PDF.js if not already done
    if (!isPDFJSInitialized()) {
      await initializePDFJS(this._options);
    }

    // Determine if we should use headless mode
    const hasDOM = typeof document !== "undefined";
    const hasOffscreen = typeof OffscreenCanvas !== "undefined";
    this._headless = this._options.headless ?? (!hasDOM && !hasOffscreen);

    if (this._headless) {
      this._initialized = true;
      return;
    }

    // Create or use provided canvas
    if (this._options.canvas) {
      this._canvas = this._options.canvas;
    } else if (this._options.offscreen && hasOffscreen) {
      this._canvas = new OffscreenCanvas(1, 1);
    } else if (hasDOM) {
      this._canvas = document.createElement("canvas");
    } else {
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

  render(
    pageIndex: number,
    viewport: Viewport,
    contentBytes?: Uint8Array | null,
    fontResolver?: FontResolver | null,
  ): RenderTask {
    // Note: contentBytes and fontResolver are ignored when using PDF.js
    // PDF.js handles all content parsing and font resolution internally
    void contentBytes;
    void fontResolver;

    if (!this._initialized) {
      throw new Error("Renderer must be initialized before rendering");
    }

    const cancelled = { value: false };

    if (this._headless) {
      const promise = new Promise<RenderResult>((resolve, reject) => {
        queueMicrotask(() => {
          if (cancelled.value) {
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
          cancelled.value = true;
        },
        get cancelled() {
          return cancelled.value;
        },
      };
    }

    // Queue-based rendering to prevent canvas conflicts
    const promise = new Promise<RenderResult>((resolve, reject) => {
      // Add to queue
      this._renderQueue.push({
        pageIndex,
        viewport,
        resolve,
        reject,
        cancelled,
      });

      // Start processing if not already
      if (!this._isProcessingQueue) {
        void this.processRenderQueue();
      }
    });

    return {
      promise,
      cancel: () => {
        cancelled.value = true;
        // If this is the active render, cancel the PDF.js task
        if (this._activeRenderTask?.pageIndex === pageIndex) {
          try {
            this._activeRenderTask.task?.cancel();
          } catch {
            // Ignore cancellation errors
          }
        }
      },
      get cancelled() {
        return cancelled.value;
      },
    };
  }

  /**
   * Process the render queue one item at a time.
   */
  private async processRenderQueue(): Promise<void> {
    if (this._isProcessingQueue) {
      return;
    }

    this._isProcessingQueue = true;

    while (this._renderQueue.length > 0) {
      const item = this._renderQueue.shift()!;

      if (item.cancelled.value) {
        item.reject(new Error("Render task cancelled"));
        continue;
      }

      try {
        const result = await this.renderPage(item.pageIndex, item.viewport, item.cancelled);
        if (!item.cancelled.value) {
          item.resolve(result);
        } else {
          item.reject(new Error("Render task cancelled"));
        }
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this._isProcessingQueue = false;
  }

  /**
   * Actually render a single page.
   */
  private async renderPage(
    pageIndex: number,
    viewport: Viewport,
    cancelled: { value: boolean },
  ): Promise<RenderResult> {
    const canvas = this._canvas!;
    const context = this._context!;
    const options = this._options;

    if (cancelled.value) {
      throw new Error("Render task cancelled");
    }

    // Wait for any active render to complete (defensive, should not happen with queue)
    while (this._activeRenderTask) {
      try {
        this._activeRenderTask.task?.cancel();
      } catch {
        // Ignore cancellation errors
      }
      // Brief wait for PDF.js to release the canvas
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Use devicePixelRatio for high-DPI rendering
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    // Resize canvas to match viewport at high-DPI resolution
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Apply background
    context.fillStyle = options.background ?? "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Get the PDF.js page
    let pdfPage: PDFPageProxy;
    if (this._document) {
      // Use the loaded document
      pdfPage = this._pageCache.get(pageIndex) ?? (await this._document.getPage(pageIndex + 1));
      this._pageCache.set(pageIndex, pdfPage);
    } else {
      // Try to get page from global wrapper state
      pdfPage = await getPage(pageIndex);
    }

    if (cancelled.value) {
      throw new Error("Render task cancelled");
    }

    // Create PDF.js viewport at high-DPI scale
    const pdfViewport = createPageViewport(pdfPage, viewport.scale * dpr, viewport.rotation);

    // Render using PDF.js
    const renderContext = {
      canvasContext: context as CanvasRenderingContext2D,
      viewport: pdfViewport,
      background: options.background,
    };

    const renderTask = pdfPage.render(renderContext);
    this._activeRenderTask = { pageIndex, task: renderTask };

    try {
      // Wait for rendering to complete
      await renderTask.promise;
    } catch (error) {
      // Ignore render cancelled errors from PDF.js
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Rendering cancelled") && !cancelled.value) {
        throw error;
      }
    } finally {
      this._activeRenderTask = null;
    }

    if (cancelled.value) {
      throw new Error("Render task cancelled");
    }

    return {
      width: canvas.width,
      height: canvas.height,
      element: canvas,
    };
  }

  /**
   * Cancel all pending and active renders.
   */
  cancelAllRenders(): void {
    // Cancel active render
    if (this._activeRenderTask) {
      try {
        this._activeRenderTask.task?.cancel();
      } catch {
        // Ignore cancellation errors
      }
      this._activeRenderTask = null;
    }

    // Cancel all queued renders
    for (const item of this._renderQueue) {
      item.cancelled.value = true;
      item.reject(new Error("Render task cancelled"));
    }
    this._renderQueue = [];
  }

  destroy(): void {
    // Cancel any pending renders first
    this.cancelAllRenders();

    if (this._context) {
      if (this._canvas) {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
      this._context = null;
    }

    if (this._canvas && !this._options.canvas) {
      if (this._canvas instanceof HTMLCanvasElement && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
    }
    this._canvas = null;
    this._headless = false;
    this._document = null;
    this._pageCache.clear();

    this._initialized = false;
  }

  /**
   * Get the underlying canvas element.
   */
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this._canvas;
  }

  /**
   * Get the 2D rendering context.
   */
  getContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    return this._context;
  }

  /**
   * Whether the renderer is running in headless mode.
   */
  get isHeadless(): boolean {
    return this._headless;
  }

  /**
   * Get the loaded document.
   */
  get document(): PDFDocumentProxy | null {
    return this._document;
  }
}

/**
 * Create a new PDF.js renderer instance.
 */
export function createPDFJSRenderer(options?: PDFJSRendererOptions): PDFJSRenderer {
  return new PDFJSRenderer();
}
