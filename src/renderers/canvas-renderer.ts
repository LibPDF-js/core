/**
 * Canvas-based PDF renderer.
 *
 * Renders PDF pages to an HTML Canvas element using the 2D rendering context.
 * This is the primary renderer for most use cases, offering good performance
 * and compatibility across browsers.
 */

import { Op, Operator } from "#src/content/operators";
import {
  CoordinateTransformer,
  type Point2D,
  type Rect2D,
  type RotationAngle,
} from "#src/coordinate-transformer";
import type { PdfFont } from "#src/fonts/pdf-font";
import { Matrix } from "#src/helpers/matrix";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfString } from "#src/objects/pdf-string";
import { ContentStreamProcessor } from "#src/viewer/ContentStreamProcessor";
import { FontManager } from "#src/viewer/FontManager";

import type {
  BaseRenderer,
  FontResolver,
  RendererOptions,
  RenderResult,
  RenderTask,
  Viewport,
} from "./base-renderer";

/**
 * Line cap style values (PDF Table 54).
 */
export const LineCap = {
  Butt: 0,
  Round: 1,
  Square: 2,
} as const;

export type LineCap = (typeof LineCap)[keyof typeof LineCap];

/**
 * Line join style values (PDF Table 55).
 */
export const LineJoin = {
  Miter: 0,
  Round: 1,
  Bevel: 2,
} as const;

export type LineJoin = (typeof LineJoin)[keyof typeof LineJoin];

/**
 * Text render mode values (PDF Table 106).
 */
export const TextRenderMode = {
  Fill: 0,
  Stroke: 1,
  FillStroke: 2,
  Invisible: 3,
  FillClip: 4,
  StrokeClip: 5,
  FillStrokeClip: 6,
  Clip: 7,
} as const;

export type TextRenderMode = (typeof TextRenderMode)[keyof typeof TextRenderMode];

/**
 * Graphics state for PDF rendering.
 * Tracks all state that can be saved/restored with q/Q operators.
 */
export interface GraphicsState {
  /** Current transformation matrix */
  ctm: Matrix;

  /** Line width in user units */
  lineWidth: number;

  /** Line cap style */
  lineCap: LineCap;

  /** Line join style */
  lineJoin: LineJoin;

  /** Miter limit */
  miterLimit: number;

  /** Dash pattern: [dash lengths, phase] */
  dashPattern: { array: number[]; phase: number };

  /** Stroking color as CSS color string */
  strokeColor: string;

  /** Non-stroking (fill) color as CSS color string */
  fillColor: string;

  /** Stroking alpha (0-1) */
  strokeAlpha: number;

  /** Non-stroking alpha (0-1) */
  fillAlpha: number;

  /** Current font name */
  fontName: string;

  /** Current font size in user units */
  fontSize: number;

  /** Character spacing */
  charSpacing: number;

  /** Word spacing */
  wordSpacing: number;

  /** Horizontal scaling (percentage, 100 = normal) */
  horizontalScale: number;

  /** Text leading */
  leading: number;

  /** Text render mode */
  textRenderMode: TextRenderMode;

  /** Text rise */
  textRise: number;
}

/**
 * Text state maintained during text object (BT...ET).
 */
export interface TextState {
  /** Text matrix (Tm) */
  textMatrix: Matrix;

  /** Text line matrix (Tlm) - start of current line */
  textLineMatrix: Matrix;
}

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
 * Create a default graphics state.
 */
function createDefaultGraphicsState(): GraphicsState {
  return {
    ctm: Matrix.identity(),
    lineWidth: 1,
    lineCap: LineCap.Butt,
    lineJoin: LineJoin.Miter,
    miterLimit: 10,
    dashPattern: { array: [], phase: 0 },
    strokeColor: "#000000",
    fillColor: "#000000",
    strokeAlpha: 1,
    fillAlpha: 1,
    fontName: "",
    fontSize: 12,
    charSpacing: 0,
    wordSpacing: 0,
    horizontalScale: 100,
    leading: 0,
    textRenderMode: TextRenderMode.Fill,
    textRise: 0,
  };
}

/**
 * Clone a graphics state.
 */
function cloneGraphicsState(state: GraphicsState): GraphicsState {
  return {
    ...state,
    ctm: state.ctm.clone(),
    dashPattern: { array: [...state.dashPattern.array], phase: state.dashPattern.phase },
  };
}

/**
 * Create a default text state.
 */
function createDefaultTextState(): TextState {
  return {
    textMatrix: Matrix.identity(),
    textLineMatrix: Matrix.identity(),
  };
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

  /** Current page height for coordinate transformation (PDF uses bottom-left origin) */
  private _pageHeight = 0;

  /** Graphics state stack for save/restore operations */
  private _graphicsStateStack: GraphicsState[] = [];

  /** Current graphics state */
  private _graphicsState: GraphicsState = createDefaultGraphicsState();

  /** Current text state (only valid between BT and ET) */
  private _textState: TextState = createDefaultTextState();

  /** Whether we're currently in a text object (between BT and ET) */
  private _inTextObject = false;

  /** Current path being constructed */
  private _currentPath: Path2D | null = null;

  /** Font resolver for the current rendering operation */
  private _fontResolver: FontResolver | null = null;

  /** Current font object (resolved from font name) */
  private _currentFont: PdfFont | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Get the current graphics state (read-only snapshot).
   */
  get graphicsState(): Readonly<GraphicsState> {
    return this._graphicsState;
  }

  /**
   * Get the current text state (read-only snapshot).
   */
  get textState(): Readonly<TextState> {
    return this._textState;
  }

  /**
   * Whether we're currently in a text object.
   */
  get inTextObject(): boolean {
    return this._inTextObject;
  }

  /**
   * Get the graphics state stack depth.
   */
  get stateStackDepth(): number {
    return this._graphicsStateStack.length;
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

  render(
    pageIndex: number,
    viewport: Viewport,
    contentBytes?: Uint8Array | null,
    fontResolver?: FontResolver | null,
  ): RenderTask {
    try {
      require("fs").appendFileSync(
        "/Volumes/dvve/Documents/TheZig/core2/core/.raid/debug_564ac3ff-9ce6-451b-83a8-ab68d91f9ac1.log",
        `${new Date().toISOString()} CanvasRenderer.render() pageIndex=${pageIndex}, hasContent=${!!contentBytes}, contentLength=${contentBytes?.length ?? 0}, hasFontResolver=${!!fontResolver}\n`,
      );
    } catch {
      console.log(
        `[DEBUG] CanvasRenderer.render() pageIndex=${pageIndex}, hasContent=${!!contentBytes}, hasFontResolver=${!!fontResolver}`,
      );
    } // [DEBUG_INSTRUMENTATION]

    // Store the font resolver for use during rendering
    this._fontResolver = fontResolver ?? null;

    if (!this._initialized) {
      throw new Error("Renderer must be initialized before rendering");
    }

    let cancelled = false;

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

          // Apply background - default to white if not specified so pages are visible
          context.fillStyle = options.background ?? "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

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

          // Render PDF content if we have content bytes
          if (contentBytes && contentBytes.length > 0) {
            try {
              // Parse content stream to operators
              const operators = this.parseContentToOperators(contentBytes);
              console.log(`[DEBUG] Parsed ${operators.length} operators from content stream`);

              // Store the page height for coordinate transformation
              // PDF uses bottom-left origin, canvas uses top-left
              this._pageHeight = canvas.height / viewport.scale;

              // Apply PDF coordinate system transformation:
              // PDF has origin at bottom-left with Y increasing upward
              // Canvas has origin at top-left with Y increasing downward
              // We need to flip the Y axis by:
              // 1. Translate to move origin to bottom-left
              // 2. Scale Y by -1 to flip the axis
              context.translate(0, this._pageHeight);
              context.scale(1, -1);

              // Reset graphics state before rendering
              this.resetGraphicsState();

              // Execute all operators to render the page
              this.executeOperators(operators);
            } catch (err) {
              console.error(`[DEBUG] Error rendering content:`, err);
              // Fall through to show placeholder on error
            }
          } else {
            // No content bytes - show placeholder
            context.restore();
            context.save();
            context.fillStyle = "#999999";
            context.font = "14px sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(`Page ${pageIndex + 1}`, canvas.width / 2, canvas.height / 2 - 10);
            context.font = "11px sans-serif";
            context.fillText(
              "(No content bytes provided)",
              canvas.width / 2,
              canvas.height / 2 + 10,
            );
          }

          context.restore();

          try {
            require("fs").appendFileSync(
              "/Volumes/dvve/Documents/TheZig/core2/core/.raid/debug_564ac3ff-9ce6-451b-83a8-ab68d91f9ac1.log",
              `${new Date().toISOString()} CanvasRenderer.render() done, canvas ${canvas.width}x${canvas.height}\n`,
            );
          } catch {
            console.log(`[DEBUG] render done, canvas ${canvas.width}x${canvas.height}`);
          } // [DEBUG_INSTRUMENTATION]

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

  // ============================================================================
  // Coordinate Transformation
  // ============================================================================

  /**
   * Create a CoordinateTransformer for the given viewport and page dimensions.
   *
   * This transformer can be used to convert coordinates between PDF space
   * and screen space, which is essential for:
   * - Hit testing (determining which PDF element was clicked)
   * - Text selection positioning
   * - Annotation layer alignment
   * - Interactive element positioning
   *
   * @param viewport - The viewport used for rendering
   * @param pageWidth - Width of the PDF page in points
   * @param pageHeight - Height of the PDF page in points
   * @param pageRotation - Page rotation from the PDF (0, 90, 180, 270)
   * @returns A configured CoordinateTransformer instance
   *
   * @example
   * ```ts
   * const transformer = renderer.createCoordinateTransformer(viewport, 612, 792);
   *
   * // Convert a screen click to PDF coordinates
   * const pdfPoint = transformer.screenToPdf({ x: clickX, y: clickY });
   *
   * // Convert PDF annotation bounds to screen position
   * const screenRect = transformer.pdfRectToScreen(annotationRect);
   * ```
   */
  createCoordinateTransformer(
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
    pageRotation: RotationAngle = 0,
  ): CoordinateTransformer {
    return new CoordinateTransformer({
      pageWidth,
      pageHeight,
      pageRotation,
      viewerRotation: viewport.rotation as RotationAngle,
      scale: viewport.scale,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
      devicePixelRatio: this.getDevicePixelRatio(),
    });
  }

  /**
   * Convert a point from PDF space to screen space using the given viewport.
   *
   * This is a convenience method for quick one-off conversions.
   * For multiple conversions, use createCoordinateTransformer instead.
   *
   * @param pdfPoint - Point in PDF coordinates (origin bottom-left, y up)
   * @param viewport - The viewport for the transformation
   * @param pageWidth - Width of the PDF page in points
   * @param pageHeight - Height of the PDF page in points
   * @returns Point in screen coordinates (origin top-left, y down)
   */
  pdfToScreen(
    pdfPoint: Point2D,
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
  ): Point2D {
    const transformer = this.createCoordinateTransformer(viewport, pageWidth, pageHeight);
    return transformer.pdfToScreen(pdfPoint);
  }

  /**
   * Convert a point from screen space to PDF space using the given viewport.
   *
   * This is a convenience method for quick one-off conversions.
   * For multiple conversions, use createCoordinateTransformer instead.
   *
   * @param screenPoint - Point in screen coordinates (origin top-left, y down)
   * @param viewport - The viewport for the transformation
   * @param pageWidth - Width of the PDF page in points
   * @param pageHeight - Height of the PDF page in points
   * @returns Point in PDF coordinates (origin bottom-left, y up)
   */
  screenToPdf(
    screenPoint: Point2D,
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
  ): Point2D {
    const transformer = this.createCoordinateTransformer(viewport, pageWidth, pageHeight);
    return transformer.screenToPdf(screenPoint);
  }

  /**
   * Convert a rectangle from PDF space to screen space.
   *
   * @param pdfRect - Rectangle in PDF coordinates
   * @param viewport - The viewport for the transformation
   * @param pageWidth - Width of the PDF page in points
   * @param pageHeight - Height of the PDF page in points
   * @returns Rectangle in screen coordinates
   */
  pdfRectToScreen(
    pdfRect: Rect2D,
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
  ): Rect2D {
    const transformer = this.createCoordinateTransformer(viewport, pageWidth, pageHeight);
    return transformer.pdfRectToScreen(pdfRect);
  }

  /**
   * Convert a rectangle from screen space to PDF space.
   *
   * @param screenRect - Rectangle in screen coordinates
   * @param viewport - The viewport for the transformation
   * @param pageWidth - Width of the PDF page in points
   * @param pageHeight - Height of the PDF page in points
   * @returns Rectangle in PDF coordinates
   */
  screenRectToPdf(
    screenRect: Rect2D,
    viewport: Viewport,
    pageWidth: number,
    pageHeight: number,
  ): Rect2D {
    const transformer = this.createCoordinateTransformer(viewport, pageWidth, pageHeight);
    return transformer.screenRectToPdf(screenRect);
  }

  /**
   * Get the device pixel ratio for high-DPI rendering.
   * Returns 1 in headless mode or when window is not available.
   */
  private getDevicePixelRatio(): number {
    if (this._headless || typeof window === "undefined") {
      return 1;
    }
    return window.devicePixelRatio ?? 1;
  }

  // ============================================================================
  // Graphics State Management
  // ============================================================================

  /**
   * Push the current graphics state onto the stack (q operator).
   */
  pushGraphicsState(): void {
    this._graphicsStateStack.push(cloneGraphicsState(this._graphicsState));
    if (this._context) {
      this._context.save();
    }
  }

  /**
   * Pop the graphics state from the stack (Q operator).
   */
  popGraphicsState(): void {
    const state = this._graphicsStateStack.pop();
    if (state) {
      this._graphicsState = state;
      if (this._context) {
        this._context.restore();
      }
    }
  }

  /**
   * Reset graphics state to defaults.
   */
  resetGraphicsState(): void {
    this._graphicsState = createDefaultGraphicsState();
    this._graphicsStateStack = [];
    this._textState = createDefaultTextState();
    this._inTextObject = false;
    this._currentPath = null;
  }

  // ============================================================================
  // Transformation Operations
  // ============================================================================

  /**
   * Concatenate a matrix to the CTM (cm operator).
   */
  concatMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const matrix = new Matrix(a, b, c, d, e, f);
    this._graphicsState.ctm = this._graphicsState.ctm.multiply(matrix);
    if (this._context) {
      this._context.transform(a, b, c, d, e, f);
    }
  }

  // ============================================================================
  // Graphics State Parameters
  // ============================================================================

  /**
   * Set line width (w operator).
   */
  setLineWidth(width: number): void {
    this._graphicsState.lineWidth = width;
    if (this._context) {
      this._context.lineWidth = width;
    }
  }

  /**
   * Set line cap style (J operator).
   */
  setLineCap(cap: LineCap): void {
    this._graphicsState.lineCap = cap;
    if (this._context) {
      const capMap: Record<LineCap, CanvasLineCap> = {
        [LineCap.Butt]: "butt",
        [LineCap.Round]: "round",
        [LineCap.Square]: "square",
      };
      this._context.lineCap = capMap[cap];
    }
  }

  /**
   * Set line join style (j operator).
   */
  setLineJoin(join: LineJoin): void {
    this._graphicsState.lineJoin = join;
    if (this._context) {
      const joinMap: Record<LineJoin, CanvasLineJoin> = {
        [LineJoin.Miter]: "miter",
        [LineJoin.Round]: "round",
        [LineJoin.Bevel]: "bevel",
      };
      this._context.lineJoin = joinMap[join];
    }
  }

  /**
   * Set miter limit (M operator).
   */
  setMiterLimit(limit: number): void {
    this._graphicsState.miterLimit = limit;
    if (this._context) {
      this._context.miterLimit = limit;
    }
  }

  /**
   * Set dash pattern (d operator).
   */
  setDashPattern(array: number[], phase: number): void {
    this._graphicsState.dashPattern = { array, phase };
    if (this._context) {
      this._context.setLineDash(array);
      this._context.lineDashOffset = phase;
    }
  }

  // ============================================================================
  // Color Operations
  // ============================================================================

  /**
   * Set stroking gray color (G operator).
   */
  setStrokingGray(gray: number): void {
    const value = Math.round(gray * 255);
    this._graphicsState.strokeColor = `rgb(${value}, ${value}, ${value})`;
    if (this._context) {
      this._context.strokeStyle = this._graphicsState.strokeColor;
    }
  }

  /**
   * Set non-stroking gray color (g operator).
   */
  setNonStrokingGray(gray: number): void {
    const value = Math.round(gray * 255);
    this._graphicsState.fillColor = `rgb(${value}, ${value}, ${value})`;
    if (this._context) {
      this._context.fillStyle = this._graphicsState.fillColor;
    }
  }

  /**
   * Set stroking RGB color (RG operator).
   */
  setStrokingRGB(r: number, g: number, b: number): void {
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);
    this._graphicsState.strokeColor = `rgb(${red}, ${green}, ${blue})`;
    if (this._context) {
      this._context.strokeStyle = this._graphicsState.strokeColor;
    }
  }

  /**
   * Set non-stroking RGB color (rg operator).
   */
  setNonStrokingRGB(r: number, g: number, b: number): void {
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);
    this._graphicsState.fillColor = `rgb(${red}, ${green}, ${blue})`;
    if (this._context) {
      this._context.fillStyle = this._graphicsState.fillColor;
    }
  }

  /**
   * Set stroking CMYK color (K operator).
   * Converts CMYK to RGB for canvas rendering.
   */
  setStrokingCMYK(c: number, m: number, y: number, k: number): void {
    const [r, g, b] = cmykToRgb(c, m, y, k);
    this._graphicsState.strokeColor = `rgb(${r}, ${g}, ${b})`;
    if (this._context) {
      this._context.strokeStyle = this._graphicsState.strokeColor;
    }
  }

  /**
   * Set non-stroking CMYK color (k operator).
   * Converts CMYK to RGB for canvas rendering.
   */
  setNonStrokingCMYK(c: number, m: number, y: number, k: number): void {
    const [r, g, b] = cmykToRgb(c, m, y, k);
    this._graphicsState.fillColor = `rgb(${r}, ${g}, ${b})`;
    if (this._context) {
      this._context.fillStyle = this._graphicsState.fillColor;
    }
  }

  /**
   * Set stroking alpha.
   */
  setStrokingAlpha(alpha: number): void {
    this._graphicsState.strokeAlpha = alpha;
    // Note: Canvas doesn't support separate stroke/fill alpha directly.
    // This would need to be handled when actually stroking.
  }

  /**
   * Set non-stroking alpha.
   */
  setNonStrokingAlpha(alpha: number): void {
    this._graphicsState.fillAlpha = alpha;
    if (this._context) {
      this._context.globalAlpha = alpha;
    }
  }

  // ============================================================================
  // Path Construction Operations
  // ============================================================================

  /**
   * Begin a new path (implicit when first path operator is used).
   */
  beginPath(): void {
    // Path2D may not be available in headless/Node.js environments
    if (typeof Path2D !== "undefined") {
      this._currentPath = new Path2D();
    }
    if (this._context) {
      this._context.beginPath();
    }
  }

  /**
   * Move to a point (m operator).
   */
  moveTo(x: number, y: number): void {
    if (!this._currentPath) {
      this.beginPath();
    }
    this._currentPath?.moveTo(x, y);
    if (this._context) {
      this._context.moveTo(x, y);
    }
  }

  /**
   * Draw a line to a point (l operator).
   */
  lineTo(x: number, y: number): void {
    if (!this._currentPath) {
      this.beginPath();
    }
    this._currentPath?.lineTo(x, y);
    if (this._context) {
      this._context.lineTo(x, y);
    }
  }

  /**
   * Draw a cubic Bezier curve (c operator).
   */
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    if (!this._currentPath) {
      this.beginPath();
    }
    this._currentPath?.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    if (this._context) {
      this._context.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    }
  }

  /**
   * Draw a cubic Bezier curve with current point as first control (v operator).
   */
  curveToInitial(x2: number, y2: number, x3: number, y3: number): void {
    // For 'v' operator, first control point is the current point
    // Canvas doesn't have this directly, so we'd need to track current point
    // For now, we'll use quadraticCurveTo as an approximation
    if (!this._currentPath) {
      this.beginPath();
    }
    // This is a simplification - proper implementation would track current point
    this._currentPath?.bezierCurveTo(x2, y2, x2, y2, x3, y3);
    if (this._context) {
      this._context.bezierCurveTo(x2, y2, x2, y2, x3, y3);
    }
  }

  /**
   * Draw a cubic Bezier curve with end point as last control (y operator).
   */
  curveToFinal(x1: number, y1: number, x3: number, y3: number): void {
    // For 'y' operator, last control point equals the end point
    if (!this._currentPath) {
      this.beginPath();
    }
    this._currentPath?.bezierCurveTo(x1, y1, x3, y3, x3, y3);
    if (this._context) {
      this._context.bezierCurveTo(x1, y1, x3, y3, x3, y3);
    }
  }

  /**
   * Close the current path (h operator).
   */
  closePath(): void {
    this._currentPath?.closePath();
    if (this._context) {
      this._context.closePath();
    }
  }

  /**
   * Draw a rectangle (re operator).
   */
  rectangle(x: number, y: number, width: number, height: number): void {
    if (!this._currentPath) {
      this.beginPath();
    }
    this._currentPath?.rect(x, y, width, height);
    if (this._context) {
      this._context.rect(x, y, width, height);
    }
  }

  // ============================================================================
  // Path Painting Operations
  // ============================================================================

  /**
   * Stroke the current path (S operator).
   */
  stroke(): void {
    if (this._context && this._currentPath) {
      this._context.stroke(this._currentPath);
    }
    this._currentPath = null;
  }

  /**
   * Close and stroke the current path (s operator).
   */
  closeAndStroke(): void {
    this.closePath();
    this.stroke();
  }

  /**
   * Fill the current path using non-zero winding rule (f operator).
   */
  fill(): void {
    if (this._context && this._currentPath) {
      this._context.fill(this._currentPath, "nonzero");
    }
    this._currentPath = null;
  }

  /**
   * Fill the current path using even-odd rule (f* operator).
   */
  fillEvenOdd(): void {
    if (this._context && this._currentPath) {
      this._context.fill(this._currentPath, "evenodd");
    }
    this._currentPath = null;
  }

  /**
   * Fill and stroke the current path (B operator).
   */
  fillAndStroke(): void {
    if (this._context && this._currentPath) {
      this._context.fill(this._currentPath, "nonzero");
      this._context.stroke(this._currentPath);
    }
    this._currentPath = null;
  }

  /**
   * Fill (even-odd) and stroke the current path (B* operator).
   */
  fillAndStrokeEvenOdd(): void {
    if (this._context && this._currentPath) {
      this._context.fill(this._currentPath, "evenodd");
      this._context.stroke(this._currentPath);
    }
    this._currentPath = null;
  }

  /**
   * Close, fill, and stroke the current path (b operator).
   */
  closeFillAndStroke(): void {
    this.closePath();
    this.fillAndStroke();
  }

  /**
   * Close, fill (even-odd), and stroke the current path (b* operator).
   */
  closeFillAndStrokeEvenOdd(): void {
    this.closePath();
    this.fillAndStrokeEvenOdd();
  }

  /**
   * End the path without painting (n operator).
   */
  endPath(): void {
    this._currentPath = null;
  }

  // ============================================================================
  // Clipping Operations
  // ============================================================================

  /**
   * Set clipping path using non-zero winding rule (W operator).
   */
  clip(): void {
    if (this._context && this._currentPath) {
      this._context.clip(this._currentPath, "nonzero");
    }
  }

  /**
   * Set clipping path using even-odd rule (W* operator).
   */
  clipEvenOdd(): void {
    if (this._context && this._currentPath) {
      this._context.clip(this._currentPath, "evenodd");
    }
  }

  // ============================================================================
  // Text State Operations
  // ============================================================================

  /**
   * Set character spacing (Tc operator).
   */
  setCharSpacing(spacing: number): void {
    this._graphicsState.charSpacing = spacing;
  }

  /**
   * Set word spacing (Tw operator).
   */
  setWordSpacing(spacing: number): void {
    this._graphicsState.wordSpacing = spacing;
  }

  /**
   * Set horizontal scaling (Tz operator).
   */
  setHorizontalScale(scale: number): void {
    this._graphicsState.horizontalScale = scale;
  }

  /**
   * Set text leading (TL operator).
   */
  setLeading(leading: number): void {
    this._graphicsState.leading = leading;
  }

  /**
   * Set font and size (Tf operator).
   */
  setFont(name: string, size: number): void {
    this._graphicsState.fontName = name;
    this._graphicsState.fontSize = size;

    // Resolve the font using the font resolver if available
    if (this._fontResolver) {
      // Font names in content streams are like "/F1", but the resolver expects "F1"
      const fontKey = name.startsWith("/") ? name.slice(1) : name;
      this._currentFont = this._fontResolver(fontKey);
    } else {
      this._currentFont = null;
    }

    if (this._context) {
      // Map PDF font names to canvas-compatible names
      const fontFamily = mapPdfFontToCanvas(name);
      this._context.font = `${size}px ${fontFamily}`;
    }
  }

  /**
   * Set text render mode (Tr operator).
   */
  setTextRenderMode(mode: TextRenderMode): void {
    this._graphicsState.textRenderMode = mode;
  }

  /**
   * Set text rise (Ts operator).
   */
  setTextRise(rise: number): void {
    this._graphicsState.textRise = rise;
  }

  // ============================================================================
  // Text Object Operations
  // ============================================================================

  /**
   * Begin a text object (BT operator).
   */
  beginText(): void {
    this._inTextObject = true;
    this._textState = createDefaultTextState();
  }

  /**
   * End a text object (ET operator).
   */
  endText(): void {
    this._inTextObject = false;
  }

  /**
   * Move text position (Td operator).
   */
  moveText(tx: number, ty: number): void {
    const translation = Matrix.translate(tx, ty);
    this._textState.textLineMatrix = this._textState.textLineMatrix.multiply(translation);
    this._textState.textMatrix = this._textState.textLineMatrix.clone();
  }

  /**
   * Move text position and set leading (TD operator).
   */
  moveTextSetLeading(tx: number, ty: number): void {
    this._graphicsState.leading = -ty;
    this.moveText(tx, ty);
  }

  /**
   * Set text matrix (Tm operator).
   */
  setTextMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const matrix = new Matrix(a, b, c, d, e, f);
    this._textState.textMatrix = matrix;
    this._textState.textLineMatrix = matrix.clone();
  }

  /**
   * Move to start of next line (T* operator).
   */
  nextLine(): void {
    this.moveText(0, -this._graphicsState.leading);
  }

  // ============================================================================
  // Text Showing Operations
  // ============================================================================

  /**
   * Show text from raw character codes using the current font's encoding.
   * This is the core text rendering method that properly handles font encoding.
   */
  showTextFromCodes(codes: Uint8Array | number[]): void {
    if (!this._context || !this._inTextObject) {
      return;
    }

    const { textRenderMode, charSpacing, wordSpacing, horizontalScale, textRise, fontSize } =
      this._graphicsState;

    // Decode character codes to Unicode using the font's encoding
    let decodedText = "";
    for (const code of codes) {
      if (this._currentFont) {
        // Use the font's toUnicode method for proper decoding
        const unicode = this._currentFont.toUnicode(code);
        decodedText += unicode || String.fromCharCode(code);
      } else {
        // Fallback: treat as Latin-1 (direct byte-to-char mapping)
        decodedText += String.fromCharCode(code);
      }
    }

    // Render the decoded text
    this.showTextString(decodedText);
  }

  /**
   * Show text (Tj operator).
   * Note: The input `text` is expected to be already decoded character codes
   * from the PDF string. For proper font encoding support, use showTextFromCodes.
   */
  showText(text: string): void {
    this.showTextString(text);
  }

  /**
   * Internal method to render a decoded Unicode string.
   */
  private showTextString(text: string): void {
    if (!this._context || !this._inTextObject) {
      return;
    }

    const { textRenderMode, charSpacing, wordSpacing, horizontalScale, textRise, fontSize } =
      this._graphicsState;

    // Apply text matrix and CTM
    this._context.save();

    // Get the combined transformation matrix
    const tm = this._textState.textMatrix;
    const ctm = this._graphicsState.ctm;

    // Calculate the position in PDF coordinates
    // The canvas has been transformed to use PDF coordinate system (Y-flipped),
    // so we can use PDF coordinates directly
    const pdfX = ctm.a * tm.e + ctm.c * tm.f + ctm.e;
    const pdfY = ctm.b * tm.e + ctm.d * tm.f + ctm.f;

    // Calculate effective font size considering all transformations
    const effectiveFontSize = Math.abs(fontSize * tm.d * ctm.d);

    // Text needs special handling because the canvas Y-axis is flipped.
    // We need to flip text back so it appears right-side up.
    // Save current transform, flip locally for text, then restore.
    this._context.save();
    this._context.translate(pdfX, pdfY);
    this._context.scale(1, -1); // Flip text back to normal orientation

    // Set up the context for text rendering
    this._context.font = `${effectiveFontSize}px ${mapPdfFontToCanvas(this._graphicsState.fontName)}`;
    this._context.fillStyle = this._graphicsState.fillColor;
    this._context.strokeStyle = this._graphicsState.strokeColor;

    // Apply horizontal scaling
    if (horizontalScale !== 100) {
      this._context.scale(horizontalScale / 100, 1);
    }

    // Apply text rise (vertical offset) - in the flipped coordinate system
    const adjustedY = -textRise * ctm.d;

    // Render based on mode
    // Since we've translated to the text position, draw at local (0, 0)
    let xOffset = 0;
    for (const char of text) {
      if (textRenderMode === TextRenderMode.Fill || textRenderMode === TextRenderMode.FillStroke) {
        this._context.fillText(char, xOffset, adjustedY);
      }
      if (
        textRenderMode === TextRenderMode.Stroke ||
        textRenderMode === TextRenderMode.FillStroke
      ) {
        this._context.strokeText(char, xOffset, adjustedY);
      }

      // Advance position
      const charWidth = this._context.measureText(char).width;
      xOffset += charWidth + charSpacing * ctm.a;
      if (char === " ") {
        xOffset += wordSpacing * ctm.a;
      }
    }

    // Restore the text-local transform (handles both horizontal scaling and the flip)
    this._context.restore();

    this._context.restore();

    // Update text matrix (advance position in text space units)
    // xOffset is in canvas pixels, need to convert back to text space
    const textSpaceAdvance = xOffset / (effectiveFontSize / fontSize);
    this._textState.textMatrix = this._textState.textMatrix.translate(
      textSpaceAdvance / fontSize,
      0,
    );
  }

  /**
   * Show text with individual glyph positioning (TJ operator).
   * @deprecated Use showTextArrayFromCodes for proper font encoding support
   */
  showTextArray(array: Array<string | number>): void {
    for (const item of array) {
      if (typeof item === "string") {
        this.showText(item);
      } else {
        // Negative numbers move text position forward
        const adjustment = -item / 1000;
        this._textState.textMatrix = this._textState.textMatrix.translate(adjustment, 0);
      }
    }
  }

  /**
   * Show text with individual glyph positioning (TJ operator) using raw bytes.
   * Properly handles font encoding for each text segment.
   */
  showTextArrayFromCodes(array: Array<Uint8Array | number>): void {
    for (const item of array) {
      if (item instanceof Uint8Array) {
        this.showTextFromCodes(item);
      } else {
        // Negative numbers move text position forward
        const adjustment = -item / 1000;
        this._textState.textMatrix = this._textState.textMatrix.translate(adjustment, 0);
      }
    }
  }

  /**
   * Move to next line and show text (' operator).
   */
  moveAndShowText(text: string): void {
    this.nextLine();
    this.showText(text);
  }

  /**
   * Set spacing, move to next line, and show text (" operator).
   */
  setSpacingMoveShowText(wordSpace: number, charSpace: number, text: string): void {
    this._graphicsState.wordSpacing = wordSpace;
    this._graphicsState.charSpacing = charSpace;
    this.moveAndShowText(text);
  }

  // ============================================================================
  // Operator Execution
  // ============================================================================

  /**
   * Execute a PDF operator.
   * This is the main entry point for processing content stream operators.
   */
  executeOperator(operator: Operator): void {
    const { op, operands } = operator;

    switch (op) {
      // Graphics state
      case Op.PushGraphicsState:
        this.pushGraphicsState();
        break;
      case Op.PopGraphicsState:
        this.popGraphicsState();
        break;
      case Op.ConcatMatrix:
        this.concatMatrix(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
          operands[4] as number,
          operands[5] as number,
        );
        break;
      case Op.SetLineWidth:
        this.setLineWidth(operands[0] as number);
        break;
      case Op.SetLineCap:
        this.setLineCap(operands[0] as LineCap);
        break;
      case Op.SetLineJoin:
        this.setLineJoin(operands[0] as LineJoin);
        break;
      case Op.SetMiterLimit:
        this.setMiterLimit(operands[0] as number);
        break;

      // Path construction
      case Op.MoveTo:
        this.moveTo(operands[0] as number, operands[1] as number);
        break;
      case Op.LineTo:
        this.lineTo(operands[0] as number, operands[1] as number);
        break;
      case Op.CurveTo:
        this.curveTo(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
          operands[4] as number,
          operands[5] as number,
        );
        break;
      case Op.CurveToInitial:
        this.curveToInitial(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
        );
        break;
      case Op.CurveToFinal:
        this.curveToFinal(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
        );
        break;
      case Op.ClosePath:
        this.closePath();
        break;
      case Op.Rectangle:
        this.rectangle(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
        );
        break;

      // Path painting
      case Op.Stroke:
        this.stroke();
        break;
      case Op.CloseAndStroke:
        this.closeAndStroke();
        break;
      case Op.Fill:
      case Op.FillCompat:
        this.fill();
        break;
      case Op.FillEvenOdd:
        this.fillEvenOdd();
        break;
      case Op.FillAndStroke:
        this.fillAndStroke();
        break;
      case Op.FillAndStrokeEvenOdd:
        this.fillAndStrokeEvenOdd();
        break;
      case Op.CloseFillAndStroke:
        this.closeFillAndStroke();
        break;
      case Op.CloseFillAndStrokeEvenOdd:
        this.closeFillAndStrokeEvenOdd();
        break;
      case Op.EndPath:
        this.endPath();
        break;

      // Clipping
      case Op.Clip:
        this.clip();
        break;
      case Op.ClipEvenOdd:
        this.clipEvenOdd();
        break;

      // Color
      case Op.SetStrokingGray:
        this.setStrokingGray(operands[0] as number);
        break;
      case Op.SetNonStrokingGray:
        this.setNonStrokingGray(operands[0] as number);
        break;
      case Op.SetStrokingRGB:
        this.setStrokingRGB(operands[0] as number, operands[1] as number, operands[2] as number);
        break;
      case Op.SetNonStrokingRGB:
        this.setNonStrokingRGB(operands[0] as number, operands[1] as number, operands[2] as number);
        break;
      case Op.SetStrokingCMYK:
        this.setStrokingCMYK(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
        );
        break;
      case Op.SetNonStrokingCMYK:
        this.setNonStrokingCMYK(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
        );
        break;

      // Text state
      case Op.SetCharSpacing:
        this.setCharSpacing(operands[0] as number);
        break;
      case Op.SetWordSpacing:
        this.setWordSpacing(operands[0] as number);
        break;
      case Op.SetHorizontalScale:
        this.setHorizontalScale(operands[0] as number);
        break;
      case Op.SetLeading:
        this.setLeading(operands[0] as number);
        break;
      case Op.SetFont:
        this.setFont(extractFontName(operands[0]), operands[1] as number);
        break;
      case Op.SetTextRenderMode:
        this.setTextRenderMode(operands[0] as TextRenderMode);
        break;
      case Op.SetTextRise:
        this.setTextRise(operands[0] as number);
        break;

      // Text object
      case Op.BeginText:
        this.beginText();
        break;
      case Op.EndText:
        this.endText();
        break;
      case Op.MoveText:
        this.moveText(operands[0] as number, operands[1] as number);
        break;
      case Op.MoveTextSetLeading:
        this.moveTextSetLeading(operands[0] as number, operands[1] as number);
        break;
      case Op.SetTextMatrix:
        this.setTextMatrix(
          operands[0] as number,
          operands[1] as number,
          operands[2] as number,
          operands[3] as number,
          operands[4] as number,
          operands[5] as number,
        );
        break;
      case Op.NextLine:
        this.nextLine();
        break;

      // Text showing - use byte-based methods for proper font encoding
      case Op.ShowText:
        this.showTextFromCodes(extractTextBytes(operands[0]));
        break;
      case Op.ShowTextArray:
        this.showTextArrayFromCodes(extractTextArrayWithBytes(operands[0] as PdfArray));
        break;
      case Op.MoveAndShowText:
        this.nextLine();
        this.showTextFromCodes(extractTextBytes(operands[0]));
        break;
      case Op.MoveSetSpacingShowText:
        this._graphicsState.wordSpacing = operands[0] as number;
        this._graphicsState.charSpacing = operands[1] as number;
        this.nextLine();
        this.showTextFromCodes(extractTextBytes(operands[2]));
        break;

      default:
        // Unknown or unimplemented operator - silently ignore
        break;
    }
  }

  /**
   * Execute multiple operators in sequence.
   */
  executeOperators(operators: Operator[]): void {
    for (const operator of operators) {
      this.executeOperator(operator);
    }
  }

  /**
   * Parse content stream bytes into Operator objects.
   * This converts raw PDF content stream bytes into executable operators.
   */
  private parseContentToOperators(bytes: Uint8Array): Operator[] {
    return ContentStreamProcessor.parseToOperators(bytes);
  }
}

// ============================================================================
// Helper Functions (delegating to ContentStreamProcessor)
// ============================================================================

/**
 * Convert CMYK to RGB values.
 */
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  return ContentStreamProcessor.cmykToRgb(c, m, y, k);
}

/**
 * Map PDF font names to Canvas-compatible font families.
 * Uses a local FontManager instance for font mapping.
 */
const fontManagerInstance = new FontManager();
function mapPdfFontToCanvas(pdfFontName: string): string {
  return fontManagerInstance.getFontFamily(pdfFontName);
}

/**
 * Extract font name from operand (can be string or PdfName).
 */
function extractFontName(operand: unknown): string {
  return ContentStreamProcessor.extractFontName(operand);
}

/**
 * Extract text string from operand (can be string or PdfString).
 * @deprecated Use extractTextBytes for proper font encoding support
 */
function extractTextString(operand: unknown): string {
  return ContentStreamProcessor.extractTextString(operand);
}

/**
 * Extract raw bytes from a text operand.
 * These bytes are character codes that should be decoded using the font's encoding.
 */
function extractTextBytes(operand: unknown): Uint8Array {
  if (operand && typeof operand === "object") {
    if ("bytes" in operand && operand.bytes instanceof Uint8Array) {
      return operand.bytes;
    }
  }
  // Fallback: convert string to byte array
  if (typeof operand === "string") {
    const bytes = new Uint8Array(operand.length);
    for (let i = 0; i < operand.length; i++) {
      bytes[i] = operand.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  return new Uint8Array(0);
}

/**
 * Extract text array elements as raw bytes or numbers (for TJ arrays).
 * Strings are kept as Uint8Array for proper font encoding support.
 */
function extractTextArrayWithBytes(array: PdfArray): Array<Uint8Array | number> {
  const result: Array<Uint8Array | number> = [];
  for (const item of array) {
    if (item && typeof item === "object") {
      // Check for PdfNumber (has value property as number)
      if ("value" in item && typeof (item as PdfNumber).value === "number") {
        result.push((item as PdfNumber).value);
      }
      // Check for PdfString (has bytes property)
      else if ("bytes" in item && item.bytes instanceof Uint8Array) {
        result.push(item.bytes);
      }
    }
  }
  return result;
}

/**
 * Extract text array elements (strings and numbers).
 * @deprecated Use extractTextArrayWithBytes for proper font encoding support
 */
function extractTextArray(array: PdfArray): Array<string | number> {
  return ContentStreamProcessor.extractTextArray(array);
}

/**
 * Create a new Canvas renderer instance.
 */
export function createCanvasRenderer(options?: CanvasRendererOptions): CanvasRenderer {
  return new CanvasRenderer();
}
