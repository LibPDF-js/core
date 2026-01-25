/**
 * SVG Path Support
 *
 * Provides utilities for parsing SVG path `d` attribute strings
 * and executing them via a callback interface.
 */

// Parser
export {
  parseSvgPath,
  type ArcCommand,
  type ClosePathCommand,
  type CubicCurveCommand,
  type HorizontalLineCommand,
  type LineToCommand,
  type MoveToCommand,
  type QuadraticCurveCommand,
  type SmoothCubicCurveCommand,
  type SmoothQuadraticCurveCommand,
  type SvgPathCommand,
  type SvgPathCommandType,
  type VerticalLineCommand,
} from "./path-parser";

// Executor
export {
  executeSvgPath,
  executeSvgPathString,
  type PathSink,
  type SvgPathExecutorOptions,
} from "./path-executor";

// Arc to Bezier (for advanced users)
export { arcToBezier, type ArcEndpoint, type BezierCurve } from "./arc-to-bezier";
