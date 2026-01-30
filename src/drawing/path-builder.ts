/**
 * PathBuilder - Fluent API for building custom paths.
 *
 * Provides a chainable interface for constructing PDF paths with
 * lines, curves, and basic shapes, then painting them with fill/stroke.
 */

import type { Operator } from "#src/content/operators";
import { clip, clipEvenOdd, closePath, curveTo, lineTo, moveTo } from "#src/helpers/operators";
import { executeSvgPathString, type SvgPathExecutorOptions } from "#src/svg/path-executor";

import { wrapPathOps } from "./operations";
import type { PathOptions } from "./types";

/**
 * Magic number for circular Bezier approximation.
 */
const KAPPA = 0.5522847498307936;

/**
 * Callback type for appending content to a page.
 * Accepts a string (for ASCII-only content) or raw bytes.
 */
export type ContentAppender = (content: string | Uint8Array) => void;

/**
 * Callback type for registering a graphics state and returning its name.
 */
export type GraphicsStateRegistrar = (
  fillOpacity?: number,
  strokeOpacity?: number,
) => string | null;

/**
 * PathBuilder provides a fluent interface for constructing PDF paths.
 *
 * @example
 * ```typescript
 * // Triangle
 * page.drawPath()
 *   .moveTo(300, 200)
 *   .lineTo(350, 300)
 *   .lineTo(250, 300)
 *   .close()
 *   .fill({ color: rgb(0, 0, 1) });
 * ```
 */
export class PathBuilder {
  private readonly pathOps: Operator[] = [];
  private readonly appendContent: ContentAppender;
  private readonly registerGraphicsState: GraphicsStateRegistrar;

  /** Current point for quadratic-to-cubic conversion */
  private currentX = 0;
  private currentY = 0;

  /** Start point of current subpath (for close operations) */
  private subpathStartX = 0;
  private subpathStartY = 0;

  constructor(appendContent: ContentAppender, registerGraphicsState: GraphicsStateRegistrar) {
    this.appendContent = appendContent;
    this.registerGraphicsState = registerGraphicsState;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Path Construction
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Move to a point (start a new subpath).
   */
  moveTo(x: number, y: number): this {
    this.pathOps.push(moveTo(x, y));

    this.currentX = x;
    this.currentY = y;
    this.subpathStartX = x;
    this.subpathStartY = y;

    return this;
  }

  /**
   * Draw a line from the current point to (x, y).
   */
  lineTo(x: number, y: number): this {
    this.pathOps.push(lineTo(x, y));

    this.currentX = x;
    this.currentY = y;

    return this;
  }

  /**
   * Draw a cubic Bezier curve from the current point to (x, y).
   *
   * @param cp1x - First control point X
   * @param cp1y - First control point Y
   * @param cp2x - Second control point X
   * @param cp2y - Second control point Y
   * @param x - End point X
   * @param y - End point Y
   */
  curveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this {
    this.pathOps.push(curveTo(cp1x, cp1y, cp2x, cp2y, x, y));

    this.currentX = x;
    this.currentY = y;

    return this;
  }

  /**
   * Draw a quadratic Bezier curve from the current point to (x, y).
   *
   * Converted internally to a cubic Bezier curve using the standard
   * quadratic-to-cubic conversion formula:
   * - CP1 = P0 + 2/3 * (QCP - P0)
   * - CP2 = P  + 2/3 * (QCP - P)
   *
   * Where P0 is the current point, QCP is the quadratic control point,
   * and P is the end point.
   *
   * @param cpx - Control point X
   * @param cpy - Control point Y
   * @param x - End point X
   * @param y - End point Y
   */
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    // Quadratic to cubic conversion:
    // CP1 = P0 + 2/3 * (QCP - P0) = P0 * 1/3 + QCP * 2/3
    // CP2 = P  + 2/3 * (QCP - P)  = P  * 1/3 + QCP * 2/3
    const cp1x = this.currentX + (2 / 3) * (cpx - this.currentX);
    const cp1y = this.currentY + (2 / 3) * (cpy - this.currentY);
    const cp2x = x + (2 / 3) * (cpx - x);
    const cp2y = y + (2 / 3) * (cpy - y);

    this.pathOps.push(curveTo(cp1x, cp1y, cp2x, cp2y, x, y));

    this.currentX = x;
    this.currentY = y;

    return this;
  }

  /**
   * Close the current subpath with a straight line back to the start.
   */
  close(): this {
    this.pathOps.push(closePath());
    // After close, the current point returns to the subpath start
    this.currentX = this.subpathStartX;
    this.currentY = this.subpathStartY;

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Convenience Shapes
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a rectangle to the current path.
   */
  rectangle(x: number, y: number, width: number, height: number): this {
    // Use fluent methods to ensure current point is tracked
    return this.moveTo(x, y)
      .lineTo(x + width, y)
      .lineTo(x + width, y + height)
      .lineTo(x, y + height)
      .close();
  }

  /**
   * Add a circle to the current path.
   */
  circle(x: number, y: number, radius: number): this {
    return this.ellipse(x, y, radius, radius);
  }

  /**
   * Add an ellipse to the current path.
   */
  ellipse(cx: number, cy: number, rx: number, ry: number): this {
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;

    // Use fluent methods to ensure current point is tracked
    return this.moveTo(cx - rx, cy)
      .curveTo(cx - rx, cy + ky, cx - kx, cy + ry, cx, cy + ry)
      .curveTo(cx + kx, cy + ry, cx + rx, cy + ky, cx + rx, cy)
      .curveTo(cx + rx, cy - ky, cx + kx, cy - ry, cx, cy - ry)
      .curveTo(cx - kx, cy - ry, cx - rx, cy - ky, cx - rx, cy)
      .close();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SVG Path Support
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Append an SVG path string to the current path.
   *
   * Parses the SVG path `d` attribute string and adds all commands to this path.
   * Relative commands (lowercase) are converted to absolute coordinates based on
   * the current point. Smooth curves (S, T) and arcs (A) are converted to
   * cubic bezier curves.
   *
   * By default, this method does NOT transform coordinates (flipY: false).
   * Use the options to apply scale, translation, and Y-flip for SVG paths.
   *
   * @param pathData - SVG path `d` attribute string
   * @param options - Execution options (flipY, scale, translate)
   * @returns This PathBuilder for chaining
   *
   * @example
   * ```typescript
   * // Simple path (no transform)
   * page.drawPath()
   *   .appendSvgPath("M 10 10 L 100 10 L 55 90 Z")
   *   .fill({ color: rgb(1, 0, 0) });
   *
   * // SVG icon with full transform
   * page.drawPath()
   *   .appendSvgPath(iconPath, {
   *     flipY: true,
   *     scale: 0.1,
   *     translateX: 100,
   *     translateY: 500,
   *   })
   *   .fill({ color: rgb(0, 0, 0) });
   * ```
   */
  appendSvgPath(pathData: string, options: SvgPathExecutorOptions = {}): this {
    // Default flipY to false for PathBuilder (caller must opt-in to transform)
    const executorOptions: SvgPathExecutorOptions = {
      flipY: options.flipY ?? false,
      scale: options.scale,
      translateX: options.translateX,
      translateY: options.translateY,
    };

    executeSvgPathString({
      pathData,
      sink: {
        moveTo: (x: number, y: number) => {
          this.moveTo(x, y);
        },
        lineTo: (x: number, y: number) => {
          this.lineTo(x, y);
        },
        curveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => {
          this.curveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        },
        quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => {
          this.quadraticCurveTo(cpx, cpy, x, y);
        },
        close: () => {
          this.close();
        },
      },
      initialX: this.currentX,
      initialY: this.currentY,
      ...executorOptions,
    });

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Painting (Terminates Path)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Stroke the path with the given options.
   */
  stroke(options: PathOptions = {}): void {
    const effectiveOptions: PathOptions = {
      ...options,
      borderColor: options.borderColor ?? options.color,
      color: undefined, // Don't fill
    };

    this.paint(effectiveOptions);
  }

  /**
   * Fill the path with the given options.
   */
  fill(options: PathOptions = {}): void {
    const effectiveOptions: PathOptions = {
      ...options,
      borderColor: undefined, // Don't stroke
    };

    this.paint(effectiveOptions);
  }

  /**
   * Fill and stroke the path with the given options.
   */
  fillAndStroke(options: PathOptions = {}): void {
    this.paint(options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Clipping
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Use the current path as a clipping path (nonzero winding rule).
   */
  clip(): void {
    this.pathOps.push(clip());
    this.emitOps(this.pathOps);
  }

  /**
   * Use the current path as a clipping path (even-odd rule).
   */
  clipEvenOdd(): void {
    this.pathOps.push(clipEvenOdd());
    this.emitOps(this.pathOps);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Paint the path with the given options.
   */
  private paint(options: PathOptions): void {
    // Register graphics state for opacity if needed
    let gsName: string | null = null;

    if (options.opacity !== undefined || options.borderOpacity !== undefined) {
      gsName = this.registerGraphicsState(options.opacity, options.borderOpacity);
    }

    // Map PathOptions to PathOpsOptions
    const ops = wrapPathOps(this.pathOps, {
      fillColor: options.color,
      strokeColor: options.borderColor,
      strokeWidth: options.borderWidth,
      lineCap: options.lineCap,
      lineJoin: options.lineJoin,
      miterLimit: options.miterLimit,
      dashArray: options.dashArray,
      dashPhase: options.dashPhase,
      windingRule: options.windingRule,
      graphicsStateName: gsName ? `/${gsName}` : undefined,
    });

    this.emitOps(ops);
  }

  /**
   * Emit operators to the page content.
   */
  private emitOps(ops: Operator[]): void {
    const content = ops.map(op => op.toString()).join("\n");

    this.appendContent(content);
  }
}
