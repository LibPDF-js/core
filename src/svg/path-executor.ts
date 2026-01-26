/**
 * SVG Path Executor
 *
 * Executes parsed SVG path commands via a callback interface.
 * Handles:
 * - Relative to absolute coordinate conversion
 * - Smooth curve control point reflection
 * - Arc to bezier conversion
 * - Y-axis flipping for PDF coordinate system (optional, default: true)
 */

import { arcToBezier } from "./arc-to-bezier";
import type { SvgPathCommand } from "./path-parser";
import { parseSvgPath } from "./path-parser";

/**
 * Options for SVG path execution.
 */
export interface SvgPathExecutorOptions {
  /**
   * Flip Y coordinates (negate Y values).
   *
   * SVG uses a top-left origin with Y increasing downward.
   * PDF uses a bottom-left origin with Y increasing upward.
   *
   * When true (default), Y coordinates are negated to convert
   * SVG paths to PDF coordinate space.
   *
   * @default true
   */
  flipY?: boolean;

  /**
   * Scale factor to apply to all coordinates.
   * @default 1
   */
  scale?: number;

  /**
   * X offset to add after scaling and flipping.
   * @default 0
   */
  translateX?: number;

  /**
   * Y offset to add after scaling and flipping.
   * @default 0
   */
  translateY?: number;
}

/**
 * Callback interface for path execution.
 * Each method corresponds to a path operation.
 */
export interface PathSink {
  /**
   * Move to a point (start a new subpath).
   */
  moveTo(x: number, y: number): void;

  /**
   * Draw a line to a point.
   */
  lineTo(x: number, y: number): void;

  /**
   * Draw a cubic bezier curve.
   */
  curveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;

  /**
   * Draw a quadratic bezier curve.
   */
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;

  /**
   * Close the current subpath.
   */
  close(): void;
}

/**
 * State tracked during path execution.
 */
interface ExecutorState {
  /** Current X position (in output space) */
  currentX: number;
  /** Current Y position (in output space) */
  currentY: number;
  /** Start X of current subpath (for Z command, in output space) */
  subpathStartX: number;
  /** Start Y of current subpath (for Z command, in output space) */
  subpathStartY: number;
  /** Last control point X (for S/T smooth curves, in output space) */
  lastControlX: number;
  /** Last control point Y (for S/T smooth curves, in output space) */
  lastControlY: number;
  /** Last command type (to determine if reflection is valid) */
  lastCommand: string | null;
  /** Y-axis flip factor: -1 to flip, 1 for no flip */
  yFlip: 1 | -1;
  /** Scale factor */
  scale: number;
  /** X translation (applied after scale and flip) */
  translateX: number;
  /** Y translation (applied after scale and flip) */
  translateY: number;
}

/**
 * Execute SVG path commands via a callback interface.
 *
 * The executor handles all coordinate transformations and command
 * normalization, so the sink receives only absolute coordinates
 * and standard path operations.
 *
 * @param options - Execution options
 * @param options.commands - Parsed SVG path commands
 * @param options.sink - Callback interface for path operations
 * @param options.initialX - Initial X coordinate (default: 0)
 * @param options.initialY - Initial Y coordinate (default: 0)
 * @param options.flipY - Flip Y coordinates for PDF (default: true)
 * @param options.scale - Scale factor (default: 1)
 * @param options.translateX - X offset after transform (default: 0)
 * @param options.translateY - Y offset after transform (default: 0)
 * @returns Final position {x, y} after executing all commands
 */
export function executeSvgPath(
  options: {
    commands: SvgPathCommand[];
    sink: PathSink;
    initialX?: number;
    initialY?: number;
  } & SvgPathExecutorOptions,
): { x: number; y: number } {
  const {
    commands,
    sink,
    initialX = 0,
    initialY = 0,
    flipY = true,
    scale = 1,
    translateX = 0,
    translateY = 0,
  } = options;

  const yFlip = flipY ? -1 : 1;

  const initialOutputX = initialX + translateX;
  const initialOutputY = initialY + translateY;

  const state: ExecutorState = {
    currentX: initialOutputX,
    currentY: initialOutputY,
    subpathStartX: initialOutputX,
    subpathStartY: initialOutputY,
    lastControlX: initialOutputX,
    lastControlY: initialOutputY,
    lastCommand: null,
    yFlip,
    scale,
    translateX,
    translateY,
  };

  for (const cmd of commands) {
    executeCommand(cmd, state, sink);
  }

  return { x: state.currentX, y: state.currentY };
}

/**
 * Transform an SVG coordinate to output space.
 * Applies: scale, Y-flip, then translate.
 */
function transformX(x: number, state: ExecutorState): number {
  return x * state.scale + state.translateX;
}

function transformY(y: number, state: ExecutorState): number {
  return y * state.yFlip * state.scale + state.translateY;
}

/**
 * Execute a single SVG path command.
 */
function executeCommand(cmd: SvgPathCommand, state: ExecutorState, sink: PathSink): void {
  switch (cmd.type) {
    case "M":
      executeMoveTo({ x: cmd.x, y: cmd.y, relative: false, state, sink });
      break;
    case "m":
      executeMoveTo({ x: cmd.x, y: cmd.y, relative: true, state, sink });
      break;

    case "L":
      executeLineTo({ x: cmd.x, y: cmd.y, relative: false, state, sink });
      break;
    case "l":
      executeLineTo({ x: cmd.x, y: cmd.y, relative: true, state, sink });
      break;

    case "H":
      executeHorizontalLine({ x: cmd.x, relative: false, state, sink });
      break;
    case "h":
      executeHorizontalLine({ x: cmd.x, relative: true, state, sink });
      break;

    case "V":
      executeVerticalLine({ y: cmd.y, relative: false, state, sink });
      break;
    case "v":
      executeVerticalLine({ y: cmd.y, relative: true, state, sink });
      break;

    case "C":
      executeCubicCurve({
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
        x: cmd.x,
        y: cmd.y,
        relative: false,
        state,
        sink,
      });
      break;
    case "c":
      executeCubicCurve({
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
        x: cmd.x,
        y: cmd.y,
        relative: true,
        state,
        sink,
      });
      break;

    case "S":
      executeSmoothCubic({
        x2: cmd.x2,
        y2: cmd.y2,
        x: cmd.x,
        y: cmd.y,
        relative: false,
        state,
        sink,
      });
      break;
    case "s":
      executeSmoothCubic({
        x2: cmd.x2,
        y2: cmd.y2,
        x: cmd.x,
        y: cmd.y,
        relative: true,
        state,
        sink,
      });
      break;

    case "Q":
      executeQuadratic({
        x1: cmd.x1,
        y1: cmd.y1,
        x: cmd.x,
        y: cmd.y,
        relative: false,
        state,
        sink,
      });
      break;
    case "q":
      executeQuadratic({ x1: cmd.x1, y1: cmd.y1, x: cmd.x, y: cmd.y, relative: true, state, sink });
      break;

    case "T":
      executeSmoothQuadratic({ x: cmd.x, y: cmd.y, relative: false, state, sink });
      break;
    case "t":
      executeSmoothQuadratic({ x: cmd.x, y: cmd.y, relative: true, state, sink });
      break;

    case "A":
      executeArc({
        rx: cmd.rx,
        ry: cmd.ry,
        xAxisRotation: cmd.xAxisRotation,
        largeArcFlag: cmd.largeArcFlag,
        sweepFlag: cmd.sweepFlag,
        x: cmd.x,
        y: cmd.y,
        relative: false,
        state,
        sink,
      });
      break;
    case "a":
      executeArc({
        rx: cmd.rx,
        ry: cmd.ry,
        xAxisRotation: cmd.xAxisRotation,
        largeArcFlag: cmd.largeArcFlag,
        sweepFlag: cmd.sweepFlag,
        x: cmd.x,
        y: cmd.y,
        relative: true,
        state,
        sink,
      });
      break;

    case "Z":
    case "z":
      executeClose({ state, sink });
      break;
  }

  state.lastCommand = cmd.type;
}

function executeMoveTo(options: {
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x, y, relative, state, sink } = options;

  // For relative: add delta to current position (in SVG space, before transform)
  // For absolute: use the coordinate directly (in SVG space)
  // We track position in OUTPUT space, so we need to work backwards for relative
  // Relative movement: apply scale and flip to the delta only
  // Absolute: transform the full coordinate
  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.moveTo(outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  state.subpathStartX = outX;
  state.subpathStartY = outY;
  state.lastControlX = outX;
  state.lastControlY = outY;
}

function executeLineTo(options: {
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x, y, relative, state, sink } = options;

  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.lineTo(outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  state.lastControlX = outX;
  state.lastControlY = outY;
}

function executeHorizontalLine(options: {
  x: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x, relative, state, sink } = options;

  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);

  // Y stays the same (already in output space)
  sink.lineTo(outX, state.currentY);

  state.currentX = outX;
  state.lastControlX = outX;
  state.lastControlY = state.currentY;
}

function executeVerticalLine(options: {
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { y, relative, state, sink } = options;

  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  // X stays the same (already in output space)
  sink.lineTo(state.currentX, outY);

  state.currentY = outY;
  state.lastControlX = state.currentX;
  state.lastControlY = outY;
}

function executeCubicCurve(options: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x1, y1, x2, y2, x, y, relative, state, sink } = options;

  const outX1 = relative ? state.currentX + x1 * state.scale : transformX(x1, state);
  const outY1 = relative ? state.currentY + y1 * state.yFlip * state.scale : transformY(y1, state);
  const outX2 = relative ? state.currentX + x2 * state.scale : transformX(x2, state);
  const outY2 = relative ? state.currentY + y2 * state.yFlip * state.scale : transformY(y2, state);
  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.curveTo(outX1, outY1, outX2, outY2, outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  // Store second control point for smooth curve reflection
  state.lastControlX = outX2;
  state.lastControlY = outY2;
}

function executeSmoothCubic(options: {
  x2: number;
  y2: number;
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x2, y2, x, y, relative, state, sink } = options;

  // Reflect the last control point across current point to get first control point
  // (already in output space)
  let cp1x: number;
  let cp1y: number;

  // Only reflect if previous command was a cubic curve
  if (
    state.lastCommand === "C" ||
    state.lastCommand === "c" ||
    state.lastCommand === "S" ||
    state.lastCommand === "s"
  ) {
    cp1x = 2 * state.currentX - state.lastControlX;
    cp1y = 2 * state.currentY - state.lastControlY;
  } else {
    // Otherwise, use current point as first control point
    cp1x = state.currentX;
    cp1y = state.currentY;
  }

  const outX2 = relative ? state.currentX + x2 * state.scale : transformX(x2, state);
  const outY2 = relative ? state.currentY + y2 * state.yFlip * state.scale : transformY(y2, state);
  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.curveTo(cp1x, cp1y, outX2, outY2, outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  state.lastControlX = outX2;
  state.lastControlY = outY2;
}

function executeQuadratic(options: {
  x1: number;
  y1: number;
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x1, y1, x, y, relative, state, sink } = options;

  const outCpX = relative ? state.currentX + x1 * state.scale : transformX(x1, state);
  const outCpY = relative ? state.currentY + y1 * state.yFlip * state.scale : transformY(y1, state);
  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.quadraticCurveTo(outCpX, outCpY, outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  // Store control point for smooth quadratic reflection
  state.lastControlX = outCpX;
  state.lastControlY = outCpY;
}

function executeSmoothQuadratic(options: {
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { x, y, relative, state, sink } = options;

  // Reflect the last control point across current point (already in output space)
  let cpx: number;
  let cpy: number;

  // Only reflect if previous command was a quadratic curve
  if (
    state.lastCommand === "Q" ||
    state.lastCommand === "q" ||
    state.lastCommand === "T" ||
    state.lastCommand === "t"
  ) {
    cpx = 2 * state.currentX - state.lastControlX;
    cpy = 2 * state.currentY - state.lastControlY;
  } else {
    // Otherwise, use current point as control point
    cpx = state.currentX;
    cpy = state.currentY;
  }

  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  sink.quadraticCurveTo(cpx, cpy, outX, outY);

  state.currentX = outX;
  state.currentY = outY;
  state.lastControlX = cpx;
  state.lastControlY = cpy;
}

function executeArc(options: {
  rx: number;
  ry: number;
  xAxisRotation: number;
  largeArcFlag: boolean;
  sweepFlag: boolean;
  x: number;
  y: number;
  relative: boolean;
  state: ExecutorState;
  sink: PathSink;
}): void {
  const { rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y, relative, state, sink } = options;

  const outX = relative ? state.currentX + x * state.scale : transformX(x, state);
  const outY = relative ? state.currentY + y * state.yFlip * state.scale : transformY(y, state);

  // Scale the radii
  const scaledRx = rx * state.scale;
  const scaledRy = ry * state.scale;

  // When Y is flipped, we also need to flip the sweep direction
  // because the arc sweeps in the opposite direction visually
  const effectiveSweepFlag = state.yFlip === -1 ? !sweepFlag : sweepFlag;

  // Convert arc to bezier curves (in output space)
  const curves = arcToBezier({
    x1: state.currentX,
    y1: state.currentY,
    rx: scaledRx,
    ry: scaledRy,
    xAxisRotation,
    largeArcFlag,
    sweepFlag: effectiveSweepFlag,
    x2: outX,
    y2: outY,
  });

  for (const curve of curves) {
    sink.curveTo(curve.cp1x, curve.cp1y, curve.cp2x, curve.cp2y, curve.x, curve.y);
  }

  state.currentX = outX;
  state.currentY = outY;
  state.lastControlX = outX;
  state.lastControlY = outY;
}

function executeClose(options: { state: ExecutorState; sink: PathSink }): void {
  const { state, sink } = options;

  sink.close();

  // After close, current point returns to subpath start
  state.currentX = state.subpathStartX;
  state.currentY = state.subpathStartY;
  state.lastControlX = state.subpathStartX;
  state.lastControlY = state.subpathStartY;
}

/**
 * Parse and execute an SVG path string.
 *
 * This is a convenience function that combines parsing and execution.
 *
 * By default, Y coordinates are flipped (negated) to convert from SVG's
 * top-left origin to PDF's bottom-left origin. Set `flipY: false` in
 * options to disable this behavior.
 *
 * @param options - Execution options
 * @param options.pathData - SVG path d string
 * @param options.sink - Callback interface for path operations
 * @param options.initialX - Initial X coordinate (default: 0)
 * @param options.initialY - Initial Y coordinate (default: 0)
 * @param options.flipY - Flip Y coordinates for PDF (default: true)
 * @param options.scale - Scale factor (default: 1)
 * @param options.translateX - X offset after transform (default: 0)
 * @param options.translateY - Y offset after transform (default: 0)
 * @returns Final position {x, y} after executing all commands
 *
 * @example
 * ```typescript
 * const sink = {
 *   moveTo: (x, y) => console.log(`M ${x} ${y}`),
 *   lineTo: (x, y) => console.log(`L ${x} ${y}`),
 *   curveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => console.log(`C ...`),
 *   quadraticCurveTo: (cpx, cpy, x, y) => console.log(`Q ...`),
 *   close: () => console.log(`Z`),
 * };
 *
 * executeSvgPathString({ pathData: "M 10 10 L 100 10 L 100 100 Z", sink });
 * ```
 */
export function executeSvgPathString(
  options: {
    pathData: string;
    sink: PathSink;
    initialX?: number;
    initialY?: number;
  } & SvgPathExecutorOptions,
): { x: number; y: number } {
  const { pathData, sink, initialX, initialY, ...executorOptions } = options;
  const commands = parseSvgPath(pathData);

  return executeSvgPath({ commands, sink, initialX, initialY, ...executorOptions });
}
