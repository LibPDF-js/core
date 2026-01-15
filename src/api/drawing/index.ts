/**
 * Drawing API exports.
 *
 * Re-exports all public drawing types and utilities for use
 * by consumers of the library.
 */

// Operations (for advanced users building custom content streams)
export { drawCircleOps, drawEllipseOps, drawLineOps, drawRectangleOps } from "./operations";
// Path builder
export { PathBuilder } from "./path-builder";
export type { LayoutResult, PositionedWord, TextLine } from "./text-layout";

// Text layout utilities
export { layoutJustifiedLine, layoutText, measureText } from "./text-layout";
// Types
export type {
  DrawCircleOptions,
  DrawEllipseOptions,
  DrawImageOptions,
  DrawLineOptions,
  DrawRectangleOptions,
  DrawTextOptions,
  FontInput,
  LineCap,
  LineJoin,
  PathOptions,
  Rotation,
  TextAlignment,
} from "./types";
export { lineCapToNumber, lineJoinToNumber } from "./types";
