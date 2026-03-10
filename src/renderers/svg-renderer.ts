/**
 * SVG-based PDF renderer.
 *
 * Renders PDF pages to SVG elements, providing scalable vector output
 * that remains crisp at any zoom level. Useful for high-quality printing
 * and accessibility scenarios.
 */

import type {
  BaseRenderer,
  RendererOptions,
  RenderResult,
  RenderTask,
  Viewport,
} from "./base-renderer";

/**
 * SVG namespace URI.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * SVG-specific renderer options.
 */
export interface SVGRendererOptions extends RendererOptions {
  /**
   * Existing SVG element to render into.
   * If not provided, a new SVG element will be created.
   */
  svg?: SVGSVGElement;

  /**
   * Whether to embed fonts as data URIs.
   * @default true
   */
  embedFonts?: boolean;

  /**
   * Whether to convert text to paths.
   * Ensures exact rendering but removes text selectability.
   * @default false
   */
  textAsPath?: boolean;

  /**
   * Whether to run in headless mode (no actual SVG element).
   * Useful for testing and server-side environments.
   * @default false in browser, true in non-browser environments
   */
  headless?: boolean;
}

/**
 * SVG-based PDF renderer implementation.
 */
export class SVGRenderer implements BaseRenderer {
  readonly type = "svg" as const;

  private _initialized = false;
  private _options: SVGRendererOptions = {};
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  private _svg: SVGSVGElement | null = null;
  private _headless = false;
  private _headlessWidth = 0;
  private _headlessHeight = 0;

  get initialized(): boolean {
    return this._initialized;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async for interface consistency
  async initialize(options?: SVGRendererOptions): Promise<void> {
    if (this._initialized) {
      return;
    }

    this._options = {
      scale: 1,
      textLayer: false,
      annotationLayer: true,
      embedFonts: true,
      textAsPath: false,
      ...options,
    };

    // Determine if we should use headless mode
    const hasDOM = typeof document !== "undefined";
    this._headless = this._options.headless ?? !hasDOM;

    if (this._headless) {
      // Headless mode - no actual SVG element needed
      this._initialized = true;
      return;
    }

    // Create or use provided SVG element
    if (this._options.svg) {
      this._svg = this._options.svg;
    } else if (hasDOM) {
      this._svg = document.createElementNS(SVG_NS, "svg");
      this._svg.setAttribute("xmlns", SVG_NS);
    } else {
      // Fall back to headless mode
      this._headless = true;
      this._initialized = true;
      return;
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

    const svg = this._svg!;
    const options = this._options;

    const promise = new Promise<RenderResult>((resolve, reject) => {
      // Use microtask to allow cancellation check
      queueMicrotask(() => {
        if (cancelled) {
          reject(new Error("Render task cancelled"));
          return;
        }

        try {
          // Configure SVG dimensions
          const width = Math.floor(viewport.width);
          const height = Math.floor(viewport.height);

          svg.setAttribute("width", String(width));
          svg.setAttribute("height", String(height));
          svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

          // Clear existing content
          while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
          }

          // Create defs element for reusable resources (patterns, gradients, etc.)
          const defs = document.createElementNS(SVG_NS, "defs");
          svg.appendChild(defs);

          // Create main group for page content with transformations
          const pageGroup = document.createElementNS(SVG_NS, "g");
          pageGroup.setAttribute("class", "pdf-page");

          // Build transform string
          const transforms: string[] = [];

          // Handle rotation
          if (viewport.rotation !== 0) {
            const cx = width / 2;
            const cy = height / 2;
            transforms.push(`rotate(${viewport.rotation}, ${cx}, ${cy})`);
          }

          // Apply scale
          if (viewport.scale !== 1) {
            transforms.push(`scale(${viewport.scale})`);
          }

          // Apply offset
          if (viewport.offsetX !== 0 || viewport.offsetY !== 0) {
            transforms.push(`translate(${viewport.offsetX}, ${viewport.offsetY})`);
          }

          if (transforms.length > 0) {
            pageGroup.setAttribute("transform", transforms.join(" "));
          }

          // Add background if specified
          if (options.background) {
            const background = document.createElementNS(SVG_NS, "rect");
            background.setAttribute("x", "0");
            background.setAttribute("y", "0");
            background.setAttribute("width", String(width));
            background.setAttribute("height", String(height));
            background.setAttribute("fill", options.background);
            background.setAttribute("class", "pdf-background");
            svg.insertBefore(background, defs);
          }

          svg.appendChild(pageGroup);

          // Note: Actual PDF content rendering will be implemented in future tasks.
          // This foundation sets up the SVG structure and transformation pipeline.
          // The page content stream operators will be converted to SVG elements here.

          resolve({
            width,
            height,
            element: svg,
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
    // Clear SVG content
    if (this._svg) {
      while (this._svg.firstChild) {
        this._svg.removeChild(this._svg.firstChild);
      }

      // Only remove SVG if we created it (not if it was provided)
      if (!this._options.svg && this._svg.parentNode) {
        this._svg.parentNode.removeChild(this._svg);
      }
    }
    this._svg = null;
    this._headless = false;

    this._initialized = false;
  }

  /**
   * Get the underlying SVG element.
   * Useful for attaching to the DOM or further manipulation.
   * Returns null in headless mode.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- DOM types may not be available
  getSVG(): SVGSVGElement | null {
    return this._svg;
  }

  /**
   * Serialize the current SVG to a string.
   * Useful for saving or transferring the rendered output.
   * Throws in headless mode.
   */
  serialize(): string {
    if (this._headless) {
      throw new Error("Cannot serialize in headless mode");
    }

    if (!this._svg) {
      throw new Error("Renderer not initialized or destroyed");
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(this._svg);
  }

  /**
   * Whether the renderer is running in headless mode.
   */
  get isHeadless(): boolean {
    return this._headless;
  }
}

/**
 * Create a new SVG renderer instance.
 */
export function createSVGRenderer(options?: SVGRendererOptions): SVGRenderer {
  return new SVGRenderer();
}
