/**
 * PDF renderers module.
 *
 * Provides implementations for rendering PDF pages to various output formats.
 */

export type {
  BaseRenderer,
  RendererFactory,
  RendererOptions,
  RendererType,
  RenderResult,
  RenderTask,
  Viewport,
} from "./base-renderer";

export {
  CanvasRenderer,
  createCanvasRenderer,
  LineCap,
  LineJoin,
  TextRenderMode,
  type CanvasRendererOptions,
  type GraphicsState,
  type TextState,
} from "./canvas-renderer";

export { SVGRenderer, createSVGRenderer, type SVGRendererOptions } from "./svg-renderer";

export {
  createTextLayerBuilder,
  TextLayerBuilder,
  type TextLayerBuilderOptions,
  type TextLayerResult,
} from "./text-layer-builder";
