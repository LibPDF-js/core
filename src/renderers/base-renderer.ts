/**
 * Base renderer interface for PDF rendering.
 *
 * Defines the contract that all renderer implementations (Canvas, SVG, etc.) must follow.
 * Renderers are responsible for converting PDF page content to visual output.
 */

/**
 * Renderer type identifier.
 */
export type RendererType = "canvas" | "svg";

/**
 * Options for initializing a renderer.
 */
export interface RendererOptions {
  /**
   * Scale factor for rendering (1 = 72 DPI, 2 = 144 DPI, etc.).
   * @default 1
   */
  scale?: number;

  /**
   * Background color for the rendered output.
   * If not specified, the page background is transparent.
   */
  background?: string;

  /**
   * Whether to enable text selection layer (for canvas renderer).
   * @default false
   */
  textLayer?: boolean;

  /**
   * Whether to enable annotation layer.
   * @default true
   */
  annotationLayer?: boolean;
}

/**
 * Result of rendering a page.
 */
export interface RenderResult {
  /**
   * Width of the rendered output in pixels.
   */
  width: number;

  /**
   * Height of the rendered output in pixels.
   */
  height: number;

  /**
   * The rendered output element (HTMLCanvasElement for canvas, SVGElement for SVG).
   */
  element: unknown;
}

/**
 * Viewport representing the visible area and transformation.
 */
export interface Viewport {
  /**
   * Width in CSS pixels.
   */
  width: number;

  /**
   * Height in CSS pixels.
   */
  height: number;

  /**
   * Scale factor applied.
   */
  scale: number;

  /**
   * Rotation in degrees (0, 90, 180, 270).
   */
  rotation: number;

  /**
   * X offset for the viewport.
   */
  offsetX: number;

  /**
   * Y offset for the viewport.
   */
  offsetY: number;
}

/**
 * Render task that can be cancelled.
 */
export interface RenderTask {
  /**
   * Promise that resolves when rendering is complete.
   */
  promise: Promise<RenderResult>;

  /**
   * Cancel the rendering operation.
   */
  cancel(): void;

  /**
   * Whether the task has been cancelled.
   */
  readonly cancelled: boolean;
}

/**
 * Base interface for PDF renderers.
 *
 * All renderer implementations must implement this interface to be usable
 * with the PDFViewer and rendering pipeline.
 */
export interface BaseRenderer {
  /**
   * The type of this renderer.
   */
  readonly type: RendererType;

  /**
   * Whether the renderer has been initialized.
   */
  readonly initialized: boolean;

  /**
   * Initialize the renderer with the given options.
   * Must be called before any rendering operations.
   *
   * @param options - Renderer configuration options
   */
  initialize(options?: RendererOptions): Promise<void>;

  /**
   * Create a viewport for the given page.
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
    scale?: number,
    rotation?: number,
  ): Viewport;

  /**
   * Render a PDF page.
   *
   * @param pageIndex - The 0-indexed page number
   * @param viewport - The viewport to render into
   * @returns A render task that can be awaited or cancelled
   */
  render(pageIndex: number, viewport: Viewport): RenderTask;

  /**
   * Clean up resources used by the renderer.
   * Should be called when the renderer is no longer needed.
   */
  destroy(): void;
}

/**
 * Factory function type for creating renderers.
 */
export type RendererFactory = (options?: RendererOptions) => BaseRenderer;
