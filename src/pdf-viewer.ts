/**
 * PDFViewer - Main orchestrator for PDF viewing functionality.
 *
 * Provides a high-level API for rendering and interacting with PDF documents.
 * Manages the rendering pipeline, handles page navigation, and coordinates
 * between different renderer implementations.
 */

import type { PDF } from "./api/pdf";
import type { PDFPage } from "./api/pdf-page";
import type {
  RendererOptions,
  RendererType,
  RenderResult,
  RenderTask,
  Viewport,
} from "./renderers/base-renderer";
import { RenderingPipeline, type RenderingPipelineOptions } from "./rendering-pipeline";

/**
 * Scroll mode for the viewer.
 */
export type ScrollMode = "vertical" | "horizontal" | "wrapped" | "single";

/**
 * Spread mode for displaying pages.
 */
export type SpreadMode = "none" | "odd" | "even";

/**
 * PDFViewer configuration options.
 */
export interface PDFViewerOptions {
  /**
   * The PDF document to view.
   */
  document?: PDF;

  /**
   * Renderer type to use.
   * @default "canvas"
   */
  renderer?: RendererType;

  /**
   * Options to pass to the renderer.
   */
  rendererOptions?: RendererOptions;

  /**
   * Initial scale factor.
   * @default 1
   */
  scale?: number;

  /**
   * Initial rotation in degrees (0, 90, 180, 270).
   * @default 0
   */
  rotation?: number;

  /**
   * Scroll mode.
   * @default "vertical"
   */
  scrollMode?: ScrollMode;

  /**
   * Spread mode.
   * @default "none"
   */
  spreadMode?: SpreadMode;

  /**
   * Maximum concurrent page renders.
   * @default 4
   */
  maxConcurrent?: number;

  /**
   * Whether to cache rendered pages.
   * @default true
   */
  cacheEnabled?: boolean;

  /**
   * Maximum number of pages to cache.
   * @default 10
   */
  cacheSize?: number;
}

/**
 * Event types emitted by PDFViewer.
 */
export type PDFViewerEventType =
  | "pagechange"
  | "scalechange"
  | "rotationchange"
  | "renderstart"
  | "rendercomplete"
  | "error";

/**
 * Event data for viewer events.
 */
export interface PDFViewerEvent {
  type: PDFViewerEventType;
  pageNumber?: number;
  scale?: number;
  rotation?: number;
  error?: Error;
}

/**
 * Event listener callback type.
 */
export type PDFViewerEventListener = (event: PDFViewerEvent) => void;

/**
 * PDFViewer provides high-level PDF viewing functionality.
 *
 * It orchestrates the rendering pipeline, manages page state,
 * and provides a clean API for common viewing operations.
 *
 * @example
 * ```ts
 * const pdf = await PDF.load(bytes);
 * const viewer = new PDFViewer({ document: pdf });
 * await viewer.initialize();
 *
 * // Render a page
 * const result = await viewer.renderPage(1);
 * document.body.appendChild(result.element);
 *
 * // Navigate
 * viewer.goToPage(5);
 * viewer.setScale(1.5);
 * ```
 */
export class PDFViewer {
  private _options: Required<Omit<PDFViewerOptions, "document">> & { document?: PDF };
  private _pipeline: RenderingPipeline | null = null;
  private _initialized = false;
  private _currentPage = 1;
  private _scale: number;
  private _rotation: number;
  private _listeners: Map<PDFViewerEventType, Set<PDFViewerEventListener>> = new Map();

  constructor(options?: PDFViewerOptions) {
    this._scale = options?.scale ?? 1;
    this._rotation = options?.rotation ?? 0;

    this._options = {
      document: options?.document,
      renderer: options?.renderer ?? "canvas",
      rendererOptions: options?.rendererOptions ?? {},
      scale: this._scale,
      rotation: this._rotation,
      scrollMode: options?.scrollMode ?? "vertical",
      spreadMode: options?.spreadMode ?? "none",
      maxConcurrent: options?.maxConcurrent ?? 4,
      cacheEnabled: options?.cacheEnabled ?? true,
      cacheSize: options?.cacheSize ?? 10,
    };
  }

  /**
   * Whether the viewer has been initialized.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * The PDF document being viewed.
   */
  get document(): PDF | undefined {
    return this._options.document;
  }

  /**
   * The current page number (1-indexed).
   */
  get currentPage(): number {
    return this._currentPage;
  }

  /**
   * Total number of pages in the document.
   */
  get pageCount(): number {
    return this._options.document?.getPageCount() ?? 0;
  }

  /**
   * Current scale factor.
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * Current rotation in degrees.
   */
  get rotation(): number {
    return this._rotation;
  }

  /**
   * Current scroll mode.
   */
  get scrollMode(): ScrollMode {
    return this._options.scrollMode;
  }

  /**
   * Current spread mode.
   */
  get spreadMode(): SpreadMode {
    return this._options.spreadMode;
  }

  /**
   * The underlying rendering pipeline.
   */
  get pipeline(): RenderingPipeline | null {
    return this._pipeline;
  }

  /**
   * Initialize the viewer.
   * Must be called before any rendering operations.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Create rendering pipeline
    const pipelineOptions: RenderingPipelineOptions = {
      renderer: this._options.renderer,
      rendererOptions: this._options.rendererOptions,
      maxConcurrent: this._options.maxConcurrent,
      cacheEnabled: this._options.cacheEnabled,
      cacheSize: this._options.cacheSize,
    };

    this._pipeline = new RenderingPipeline(pipelineOptions);
    await this._pipeline.initialize();

    this._initialized = true;
  }

  /**
   * Set the PDF document to view.
   * Can be called before or after initialization.
   */
  setDocument(document: PDF): void {
    this._options.document = document;
    this._currentPage = 1;

    // Clear cache when document changes
    if (this._pipeline) {
      this._pipeline.clearCache();
    }
  }

  /**
   * Get a page from the document.
   *
   * @param pageNumber - 1-indexed page number
   */
  getPage(pageNumber: number): PDFPage {
    if (!this._options.document) {
      throw new Error("No document loaded");
    }

    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${this.pageCount} pages.`);
    }

    return this._options.document.getPage(pageNumber - 1);
  }

  /**
   * Create a viewport for a page.
   *
   * @param pageNumber - 1-indexed page number
   * @param scale - Scale factor (uses viewer scale if not specified)
   * @param rotation - Additional rotation (uses viewer rotation if not specified)
   */
  createViewport(pageNumber: number, scale?: number, rotation?: number): Viewport {
    if (!this._initialized || !this._pipeline) {
      throw new Error("Viewer must be initialized before creating viewport");
    }

    const page = this.getPage(pageNumber);
    return this._pipeline.createViewport(
      page.width,
      page.height,
      page.rotation,
      scale ?? this._scale,
      rotation ?? this._rotation,
    );
  }

  /**
   * Render a page.
   *
   * @param pageNumber - 1-indexed page number
   * @param viewport - Optional custom viewport (creates default if not provided)
   */
  renderPage(pageNumber: number, viewport?: Viewport): RenderTask {
    if (!this._initialized || !this._pipeline) {
      throw new Error("Viewer must be initialized before rendering");
    }

    const page = this.getPage(pageNumber);
    const targetViewport = viewport ?? this.createViewport(pageNumber);

    this.emit({
      type: "renderstart",
      pageNumber,
      scale: targetViewport.scale,
      rotation: targetViewport.rotation,
    });

    const task = this._pipeline.render(pageNumber - 1, targetViewport);

    // Wrap promise to emit events
    const wrappedPromise = task.promise
      .then(result => {
        this.emit({
          type: "rendercomplete",
          pageNumber,
          scale: targetViewport.scale,
          rotation: targetViewport.rotation,
        });
        return result;
      })
      .catch(error => {
        this.emit({
          type: "error",
          pageNumber,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
      });

    return {
      promise: wrappedPromise,
      cancel: () => task.cancel(),
      get cancelled() {
        return task.cancelled;
      },
    };
  }

  /**
   * Render multiple pages concurrently.
   *
   * @param pageNumbers - Array of 1-indexed page numbers
   */
  renderPages(pageNumbers: number[]): Map<number, RenderTask> {
    const tasks = new Map<number, RenderTask>();

    for (const pageNumber of pageNumbers) {
      tasks.set(pageNumber, this.renderPage(pageNumber));
    }

    return tasks;
  }

  /**
   * Navigate to a specific page.
   *
   * @param pageNumber - 1-indexed page number
   */
  goToPage(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${this.pageCount} pages.`);
    }

    if (pageNumber !== this._currentPage) {
      this._currentPage = pageNumber;
      this.emit({ type: "pagechange", pageNumber });
    }
  }

  /**
   * Navigate to the next page.
   */
  nextPage(): void {
    if (this._currentPage < this.pageCount) {
      this.goToPage(this._currentPage + 1);
    }
  }

  /**
   * Navigate to the previous page.
   */
  previousPage(): void {
    if (this._currentPage > 1) {
      this.goToPage(this._currentPage - 1);
    }
  }

  /**
   * Navigate to the first page.
   */
  firstPage(): void {
    this.goToPage(1);
  }

  /**
   * Navigate to the last page.
   */
  lastPage(): void {
    if (this.pageCount > 0) {
      this.goToPage(this.pageCount);
    }
  }

  /**
   * Set the scale factor.
   *
   * @param scale - New scale factor
   */
  setScale(scale: number): void {
    if (scale <= 0) {
      throw new Error("Scale must be positive");
    }

    if (scale !== this._scale) {
      this._scale = scale;

      // Clear cache when scale changes
      if (this._pipeline) {
        this._pipeline.clearCache();
      }

      this.emit({ type: "scalechange", scale });
    }
  }

  /**
   * Set the rotation.
   *
   * @param rotation - Rotation in degrees (0, 90, 180, 270)
   */
  setRotation(rotation: number): void {
    const normalizedRotation = ((rotation % 360) + 360) % 360;

    if (normalizedRotation !== this._rotation) {
      this._rotation = normalizedRotation;

      // Clear cache when rotation changes
      if (this._pipeline) {
        this._pipeline.clearCache();
      }

      this.emit({ type: "rotationchange", rotation: normalizedRotation });
    }
  }

  /**
   * Set the scroll mode.
   */
  setScrollMode(mode: ScrollMode): void {
    this._options.scrollMode = mode;
  }

  /**
   * Set the spread mode.
   */
  setSpreadMode(mode: SpreadMode): void {
    this._options.spreadMode = mode;
  }

  /**
   * Add an event listener.
   */
  addEventListener(type: PDFViewerEventType, listener: PDFViewerEventListener): void {
    let listeners = this._listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(type: PDFViewerEventType, listener: PDFViewerEventListener): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(event: PDFViewerEvent): void {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Cancel all pending render operations.
   */
  cancelAllRenders(): void {
    if (this._pipeline) {
      this._pipeline.cancelAll();
    }
  }

  /**
   * Clear the render cache.
   */
  clearCache(): void {
    if (this._pipeline) {
      this._pipeline.clearCache();
    }
  }

  /**
   * Clean up resources and destroy the viewer.
   */
  destroy(): void {
    // Cancel all renders
    this.cancelAllRenders();

    // Clear listeners
    this._listeners.clear();

    // Destroy pipeline
    if (this._pipeline) {
      this._pipeline.destroy();
      this._pipeline = null;
    }

    this._initialized = false;
  }
}

/**
 * Create a new PDFViewer instance.
 */
export function createPDFViewer(options?: PDFViewerOptions): PDFViewer {
  return new PDFViewer(options);
}
