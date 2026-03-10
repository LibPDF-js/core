/**
 * SVG-based PDF renderer.
 *
 * Renders PDF pages to SVG elements, providing scalable vector output
 * that remains crisp at any zoom level. Useful for high-quality printing,
 * accessibility scenarios, and high-DPI displays.
 */

import { Op, type Operator } from "#src/content/operators";
import {
  CoordinateTransformer,
  type Point2D,
  type Rect2D,
  type RotationAngle,
} from "#src/coordinate-transformer";
import { Matrix } from "#src/helpers/matrix";
import type { PdfArray } from "#src/objects/pdf-array";
import type { PdfName } from "#src/objects/pdf-name";
import type { PdfNumber } from "#src/objects/pdf-number";
import type { PdfString } from "#src/objects/pdf-string";

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
 * SVG-based PDF renderer implementation.
 */
export class SVGRenderer implements BaseRenderer {
  readonly type = "svg" as const;

  private _initialized = false;
  private _options: SVGRendererOptions = {};
  private _svg: SVGSVGElement | null = null;
  private _defs: SVGDefsElement | null = null;
  private _pageGroup: SVGGElement | null = null;
  private _headless = false;
  private _headlessWidth = 0;
  private _headlessHeight = 0;

  /** Graphics state stack for save/restore operations */
  private _graphicsStateStack: GraphicsState[] = [];

  /** Current graphics state */
  private _graphicsState: GraphicsState = createDefaultGraphicsState();

  /** Current text state (only valid between BT and ET) */
  private _textState: TextState = createDefaultTextState();

  /** Whether we're currently in a text object (between BT and ET) */
  private _inTextObject = false;

  /** Current path data being constructed */
  private _currentPath: string[] = [];

  /** Current position for path construction */
  private _currentX = 0;
  private _currentY = 0;

  /** Counter for generating unique IDs */
  private _idCounter = 0;

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

          // Create defs element for reusable resources (patterns, gradients, clips)
          this._defs = document.createElementNS(SVG_NS, "defs");
          svg.appendChild(this._defs);

          // Add background if specified
          if (options.background) {
            const background = document.createElementNS(SVG_NS, "rect");
            background.setAttribute("x", "0");
            background.setAttribute("y", "0");
            background.setAttribute("width", String(width));
            background.setAttribute("height", String(height));
            background.setAttribute("fill", options.background);
            background.setAttribute("class", "pdf-background");
            svg.appendChild(background);
          }

          // Create main group for page content with transformations
          this._pageGroup = document.createElementNS(SVG_NS, "g");
          this._pageGroup.setAttribute("class", "pdf-page");

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
            this._pageGroup.setAttribute("transform", transforms.join(" "));
          }

          svg.appendChild(this._pageGroup);

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
    this._defs = null;
    this._pageGroup = null;
    this._headless = false;

    // Reset state
    this._graphicsStateStack = [];
    this._graphicsState = createDefaultGraphicsState();
    this._textState = createDefaultTextState();
    this._inTextObject = false;
    this._currentPath = [];
    this._idCounter = 0;

    this._initialized = false;
  }

  /**
   * Get the underlying SVG element.
   * Useful for attaching to the DOM or further manipulation.
   * Returns null in headless mode.
   */
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

  // ============================================================================
  // Coordinate Transformation
  // ============================================================================

  /**
   * Create a CoordinateTransformer for the given viewport and page dimensions.
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
      devicePixelRatio: 1, // SVG is resolution-independent
    });
  }

  /**
   * Convert a point from PDF space to screen space using the given viewport.
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

  // ============================================================================
  // Graphics State Management
  // ============================================================================

  /**
   * Push the current graphics state onto the stack (q operator).
   */
  pushGraphicsState(): void {
    this._graphicsStateStack.push(cloneGraphicsState(this._graphicsState));
  }

  /**
   * Pop the graphics state from the stack (Q operator).
   */
  popGraphicsState(): void {
    const state = this._graphicsStateStack.pop();
    if (state) {
      this._graphicsState = state;
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
    this._currentPath = [];
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
  }

  // ============================================================================
  // Graphics State Parameters
  // ============================================================================

  /**
   * Set line width (w operator).
   */
  setLineWidth(width: number): void {
    this._graphicsState.lineWidth = width;
  }

  /**
   * Set line cap style (J operator).
   */
  setLineCap(cap: LineCap): void {
    this._graphicsState.lineCap = cap;
  }

  /**
   * Set line join style (j operator).
   */
  setLineJoin(join: LineJoin): void {
    this._graphicsState.lineJoin = join;
  }

  /**
   * Set miter limit (M operator).
   */
  setMiterLimit(limit: number): void {
    this._graphicsState.miterLimit = limit;
  }

  /**
   * Set dash pattern (d operator).
   */
  setDashPattern(array: number[], phase: number): void {
    this._graphicsState.dashPattern = { array, phase };
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
  }

  /**
   * Set non-stroking gray color (g operator).
   */
  setNonStrokingGray(gray: number): void {
    const value = Math.round(gray * 255);
    this._graphicsState.fillColor = `rgb(${value}, ${value}, ${value})`;
  }

  /**
   * Set stroking RGB color (RG operator).
   */
  setStrokingRGB(r: number, g: number, b: number): void {
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);
    this._graphicsState.strokeColor = `rgb(${red}, ${green}, ${blue})`;
  }

  /**
   * Set non-stroking RGB color (rg operator).
   */
  setNonStrokingRGB(r: number, g: number, b: number): void {
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);
    this._graphicsState.fillColor = `rgb(${red}, ${green}, ${blue})`;
  }

  /**
   * Set stroking CMYK color (K operator).
   * Converts CMYK to RGB for SVG rendering.
   */
  setStrokingCMYK(c: number, m: number, y: number, k: number): void {
    const [r, g, b] = cmykToRgb(c, m, y, k);
    this._graphicsState.strokeColor = `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Set non-stroking CMYK color (k operator).
   * Converts CMYK to RGB for SVG rendering.
   */
  setNonStrokingCMYK(c: number, m: number, y: number, k: number): void {
    const [r, g, b] = cmykToRgb(c, m, y, k);
    this._graphicsState.fillColor = `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Set stroking alpha.
   */
  setStrokingAlpha(alpha: number): void {
    this._graphicsState.strokeAlpha = alpha;
  }

  /**
   * Set non-stroking alpha.
   */
  setNonStrokingAlpha(alpha: number): void {
    this._graphicsState.fillAlpha = alpha;
  }

  // ============================================================================
  // Path Construction Operations
  // ============================================================================

  /**
   * Begin a new path (implicit when first path operator is used).
   */
  beginPath(): void {
    this._currentPath = [];
  }

  /**
   * Move to a point (m operator).
   */
  moveTo(x: number, y: number): void {
    this._currentPath.push(`M ${x} ${y}`);
    this._currentX = x;
    this._currentY = y;
  }

  /**
   * Draw a line to a point (l operator).
   */
  lineTo(x: number, y: number): void {
    this._currentPath.push(`L ${x} ${y}`);
    this._currentX = x;
    this._currentY = y;
  }

  /**
   * Draw a cubic Bezier curve (c operator).
   */
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this._currentPath.push(`C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`);
    this._currentX = x3;
    this._currentY = y3;
  }

  /**
   * Draw a cubic Bezier curve with current point as first control (v operator).
   */
  curveToInitial(x2: number, y2: number, x3: number, y3: number): void {
    // For 'v' operator, first control point is the current point
    this._currentPath.push(`C ${this._currentX} ${this._currentY}, ${x2} ${y2}, ${x3} ${y3}`);
    this._currentX = x3;
    this._currentY = y3;
  }

  /**
   * Draw a cubic Bezier curve with end point as last control (y operator).
   */
  curveToFinal(x1: number, y1: number, x3: number, y3: number): void {
    // For 'y' operator, last control point equals the end point
    this._currentPath.push(`C ${x1} ${y1}, ${x3} ${y3}, ${x3} ${y3}`);
    this._currentX = x3;
    this._currentY = y3;
  }

  /**
   * Close the current path (h operator).
   */
  closePath(): void {
    this._currentPath.push("Z");
  }

  /**
   * Draw a rectangle (re operator).
   */
  rectangle(x: number, y: number, width: number, height: number): void {
    this._currentPath.push(`M ${x} ${y}`);
    this._currentPath.push(`L ${x + width} ${y}`);
    this._currentPath.push(`L ${x + width} ${y + height}`);
    this._currentPath.push(`L ${x} ${y + height}`);
    this._currentPath.push("Z");
    this._currentX = x;
    this._currentY = y;
  }

  // ============================================================================
  // Path Painting Operations
  // ============================================================================

  /**
   * Create a path element with current styles.
   */
  private createPathElement(
    fill: boolean,
    stroke: boolean,
    evenOdd = false,
  ): SVGPathElement | null {
    if (this._headless || !this._pageGroup || this._currentPath.length === 0) {
      return null;
    }

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", this._currentPath.join(" "));

    // Apply transformation matrix
    const ctm = this._graphicsState.ctm;
    if (!ctm.isIdentity()) {
      path.setAttribute(
        "transform",
        `matrix(${ctm.a} ${ctm.b} ${ctm.c} ${ctm.d} ${ctm.e} ${ctm.f})`,
      );
    }

    // Apply fill
    if (fill) {
      path.setAttribute("fill", this._graphicsState.fillColor);
      if (this._graphicsState.fillAlpha < 1) {
        path.setAttribute("fill-opacity", String(this._graphicsState.fillAlpha));
      }
      if (evenOdd) {
        path.setAttribute("fill-rule", "evenodd");
      }
    } else {
      path.setAttribute("fill", "none");
    }

    // Apply stroke
    if (stroke) {
      path.setAttribute("stroke", this._graphicsState.strokeColor);
      path.setAttribute("stroke-width", String(this._graphicsState.lineWidth));

      if (this._graphicsState.strokeAlpha < 1) {
        path.setAttribute("stroke-opacity", String(this._graphicsState.strokeAlpha));
      }

      // Line cap
      const capMap: Record<LineCap, string> = {
        [LineCap.Butt]: "butt",
        [LineCap.Round]: "round",
        [LineCap.Square]: "square",
      };
      path.setAttribute("stroke-linecap", capMap[this._graphicsState.lineCap]);

      // Line join
      const joinMap: Record<LineJoin, string> = {
        [LineJoin.Miter]: "miter",
        [LineJoin.Round]: "round",
        [LineJoin.Bevel]: "bevel",
      };
      path.setAttribute("stroke-linejoin", joinMap[this._graphicsState.lineJoin]);

      // Miter limit
      if (this._graphicsState.lineJoin === LineJoin.Miter) {
        path.setAttribute("stroke-miterlimit", String(this._graphicsState.miterLimit));
      }

      // Dash pattern
      if (this._graphicsState.dashPattern.array.length > 0) {
        path.setAttribute("stroke-dasharray", this._graphicsState.dashPattern.array.join(" "));
        if (this._graphicsState.dashPattern.phase !== 0) {
          path.setAttribute("stroke-dashoffset", String(this._graphicsState.dashPattern.phase));
        }
      }
    } else {
      path.setAttribute("stroke", "none");
    }

    this._pageGroup.appendChild(path);
    return path;
  }

  /**
   * Stroke the current path (S operator).
   */
  stroke(): void {
    this.createPathElement(false, true);
    this._currentPath = [];
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
    this.createPathElement(true, false, false);
    this._currentPath = [];
  }

  /**
   * Fill the current path using even-odd rule (f* operator).
   */
  fillEvenOdd(): void {
    this.createPathElement(true, false, true);
    this._currentPath = [];
  }

  /**
   * Fill and stroke the current path (B operator).
   */
  fillAndStroke(): void {
    this.createPathElement(true, true, false);
    this._currentPath = [];
  }

  /**
   * Fill (even-odd) and stroke the current path (B* operator).
   */
  fillAndStrokeEvenOdd(): void {
    this.createPathElement(true, true, true);
    this._currentPath = [];
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
    this._currentPath = [];
  }

  // ============================================================================
  // Clipping Operations
  // ============================================================================

  /**
   * Generate a unique ID for clip paths.
   */
  private generateId(prefix: string): string {
    return `${prefix}-${++this._idCounter}`;
  }

  /**
   * Set clipping path using non-zero winding rule (W operator).
   */
  clip(): void {
    if (this._headless || !this._defs || !this._pageGroup || this._currentPath.length === 0) {
      return;
    }

    const clipId = this.generateId("clip");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", this._currentPath.join(" "));
    path.setAttribute("clip-rule", "nonzero");

    clipPath.appendChild(path);
    this._defs.appendChild(clipPath);

    // Apply to a group that will contain subsequent content
    const clipGroup = document.createElementNS(SVG_NS, "g");
    clipGroup.setAttribute("clip-path", `url(#${clipId})`);
    this._pageGroup.appendChild(clipGroup);

    // Update page group to render into clipped area
    this._pageGroup = clipGroup;
  }

  /**
   * Set clipping path using even-odd rule (W* operator).
   */
  clipEvenOdd(): void {
    if (this._headless || !this._defs || !this._pageGroup || this._currentPath.length === 0) {
      return;
    }

    const clipId = this.generateId("clip");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", this._currentPath.join(" "));
    path.setAttribute("clip-rule", "evenodd");

    clipPath.appendChild(path);
    this._defs.appendChild(clipPath);

    const clipGroup = document.createElementNS(SVG_NS, "g");
    clipGroup.setAttribute("clip-path", `url(#${clipId})`);
    this._pageGroup.appendChild(clipGroup);

    this._pageGroup = clipGroup;
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
   * Show text (Tj operator).
   */
  showText(text: string): void {
    if (this._headless || !this._pageGroup || !this._inTextObject) {
      return;
    }

    const {
      textRenderMode,
      charSpacing,
      wordSpacing,
      horizontalScale,
      textRise,
      fontSize,
      fontName,
    } = this._graphicsState;

    // Create text element
    const textEl = document.createElementNS(SVG_NS, "text");

    // Calculate position from combined matrices
    const combinedMatrix = this._graphicsState.ctm.multiply(this._textState.textMatrix);

    // Apply text rise as y offset
    const x = combinedMatrix.e;
    const y = combinedMatrix.f - textRise;

    textEl.setAttribute("x", String(x));
    textEl.setAttribute("y", String(y));

    // Apply font
    const fontFamily = mapPdfFontToSvg(fontName);
    textEl.setAttribute("font-family", fontFamily);
    textEl.setAttribute("font-size", String(fontSize));

    // Apply transformation (excluding translation which is handled by x/y)
    if (
      combinedMatrix.a !== 1 ||
      combinedMatrix.b !== 0 ||
      combinedMatrix.c !== 0 ||
      combinedMatrix.d !== 1
    ) {
      // For SVG, we need to handle the scale and rotation separately
      // Apply horizontal scaling
      const scaleX = (horizontalScale / 100) * combinedMatrix.a;
      const scaleY = combinedMatrix.d;
      if (scaleX !== 1 || scaleY !== 1 || combinedMatrix.b !== 0 || combinedMatrix.c !== 0) {
        textEl.setAttribute(
          "transform",
          `matrix(${scaleX} ${combinedMatrix.b} ${combinedMatrix.c} ${scaleY} 0 0)`,
        );
      }
    } else if (horizontalScale !== 100) {
      textEl.setAttribute("transform", `scale(${horizontalScale / 100}, 1)`);
    }

    // Apply letter spacing (character spacing)
    if (charSpacing !== 0) {
      textEl.setAttribute("letter-spacing", String(charSpacing));
    }

    // Apply word spacing
    if (wordSpacing !== 0) {
      textEl.setAttribute("word-spacing", String(wordSpacing));
    }

    // Apply fill/stroke based on render mode
    switch (textRenderMode) {
      case TextRenderMode.Fill:
        textEl.setAttribute("fill", this._graphicsState.fillColor);
        textEl.setAttribute("stroke", "none");
        break;
      case TextRenderMode.Stroke:
        textEl.setAttribute("fill", "none");
        textEl.setAttribute("stroke", this._graphicsState.strokeColor);
        textEl.setAttribute("stroke-width", String(this._graphicsState.lineWidth));
        break;
      case TextRenderMode.FillStroke:
        textEl.setAttribute("fill", this._graphicsState.fillColor);
        textEl.setAttribute("stroke", this._graphicsState.strokeColor);
        textEl.setAttribute("stroke-width", String(this._graphicsState.lineWidth));
        break;
      case TextRenderMode.Invisible:
        textEl.setAttribute("fill", "none");
        textEl.setAttribute("stroke", "none");
        break;
      default:
        // Handle clip modes - for now just fill
        textEl.setAttribute("fill", this._graphicsState.fillColor);
        textEl.setAttribute("stroke", "none");
        break;
    }

    // Apply alpha
    if (this._graphicsState.fillAlpha < 1 && textRenderMode !== TextRenderMode.Stroke) {
      textEl.setAttribute("fill-opacity", String(this._graphicsState.fillAlpha));
    }
    if (this._graphicsState.strokeAlpha < 1 && textRenderMode !== TextRenderMode.Fill) {
      textEl.setAttribute("stroke-opacity", String(this._graphicsState.strokeAlpha));
    }

    // Set text content
    textEl.textContent = text;

    this._pageGroup.appendChild(textEl);

    // Update text matrix (advance position)
    // Estimate text width - in a real implementation this would use font metrics
    const estimatedWidth = text.length * fontSize * 0.5 * (horizontalScale / 100);
    this._textState.textMatrix = this._textState.textMatrix.translate(estimatedWidth / fontSize, 0);
  }

  /**
   * Show text with individual glyph positioning (TJ operator).
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

      // Text showing
      case Op.ShowText:
        this.showText(extractTextString(operands[0]));
        break;
      case Op.ShowTextArray:
        this.showTextArray(extractTextArray(operands[0] as PdfArray));
        break;
      case Op.MoveAndShowText:
        this.moveAndShowText(extractTextString(operands[0]));
        break;
      case Op.MoveSetSpacingShowText:
        this.setSpacingMoveShowText(
          operands[0] as number,
          operands[1] as number,
          extractTextString(operands[2]),
        );
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
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert CMYK to RGB values.
 */
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  return [r, g, b];
}

/**
 * Map PDF font names to SVG-compatible font families.
 */
function mapPdfFontToSvg(pdfFontName: string): string {
  // Remove leading slash if present
  const name = pdfFontName.startsWith("/") ? pdfFontName.slice(1) : pdfFontName;

  // Common PDF base fonts to web fonts
  const fontMap: Record<string, string> = {
    Helvetica: "Helvetica, Arial, sans-serif",
    "Helvetica-Bold": "Helvetica, Arial, sans-serif",
    "Helvetica-Oblique": "Helvetica, Arial, sans-serif",
    "Helvetica-BoldOblique": "Helvetica, Arial, sans-serif",
    "Times-Roman": "'Times New Roman', Times, serif",
    "Times-Bold": "'Times New Roman', Times, serif",
    "Times-Italic": "'Times New Roman', Times, serif",
    "Times-BoldItalic": "'Times New Roman', Times, serif",
    Courier: "'Courier New', Courier, monospace",
    "Courier-Bold": "'Courier New', Courier, monospace",
    "Courier-Oblique": "'Courier New', Courier, monospace",
    "Courier-BoldOblique": "'Courier New', Courier, monospace",
    Symbol: "Symbol, serif",
    ZapfDingbats: "ZapfDingbats, serif",
  };

  return fontMap[name] ?? "sans-serif";
}

/**
 * Extract font name from operand (can be string or PdfName).
 */
function extractFontName(operand: unknown): string {
  if (typeof operand === "string") {
    return operand;
  }
  if (operand && typeof operand === "object" && "value" in operand) {
    return String((operand as PdfName).value);
  }
  return "";
}

/**
 * Decode bytes as Latin-1 (ISO-8859-1) string.
 * This is the PDF default encoding for string bytes.
 */
function decodeLatin1(bytes: Uint8Array): string {
  // Latin-1 is a direct mapping of byte values 0-255 to Unicode code points
  let result = "";
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
}

/**
 * Extract text string from operand (can be string or PdfString).
 */
function extractTextString(operand: unknown): string {
  if (typeof operand === "string") {
    return operand;
  }
  if (operand && typeof operand === "object") {
    // PdfString has asString() method
    if ("asString" in operand && typeof operand.asString === "function") {
      return (operand as PdfString).asString();
    }
    // Fallback for bytes property
    if ("bytes" in operand && operand.bytes instanceof Uint8Array) {
      return decodeLatin1(operand.bytes);
    }
  }
  return "";
}

/**
 * Extract text array elements (strings and numbers).
 */
function extractTextArray(array: PdfArray): Array<string | number> {
  const result: Array<string | number> = [];
  // Use iterator since items is private
  for (const item of array) {
    if (item && typeof item === "object") {
      // Check for PdfNumber (has value property as number)
      if ("value" in item && typeof (item as PdfNumber).value === "number") {
        result.push((item as PdfNumber).value);
      }
      // Check for PdfString (has asString method)
      else if ("asString" in item && typeof item.asString === "function") {
        result.push(item.asString());
      }
      // Fallback for bytes property
      else if ("bytes" in item && item.bytes instanceof Uint8Array) {
        result.push(decodeLatin1(item.bytes));
      }
    }
  }
  return result;
}

/**
 * Create a new SVG renderer instance.
 */
export function createSVGRenderer(options?: SVGRendererOptions): SVGRenderer {
  return new SVGRenderer();
}
