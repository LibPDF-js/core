/**
 * PDF renderers module.
 *
 * Provides implementations for rendering PDF pages to various output formats.
 */

export type {
  BaseRenderer,
  FontResolver,
  RendererFactory,
  RendererOptions,
  RendererType,
  RenderOptionsWithTypeDetection,
  RenderResult,
  RenderTask,
  TypeAwareRenderer,
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

// PDF type detection
export {
  ContentType,
  createDefaultContentStats,
  createDefaultFontAnalysis,
  createDefaultImageAnalysis,
  getDefaultRenderingStrategy,
  PdfType,
  type ContentStats,
  type DocumentTypeInfo,
  type FontAnalysis,
  type ImageAnalysis,
  type PageTypeInfo,
  type PdfTypeDetectionResult,
  type RenderingStrategy,
} from "./pdf-types";

export {
  createPdfTypeDetector,
  detectPdfType,
  getRenderingStrategy,
  PdfTypeDetector,
  type PageAnalysisInput,
  type PdfTypeDetectorOptions,
} from "./pdf-type-detector";

export {
  analyzeContentStream,
  appearsScanned,
  getPrimaryContentType,
  mergeContentStats,
  type ContentAnalysisResult,
} from "./content-analyzer";

export {
  analyzeFonts,
  analyzeImages,
  countFormXObjects,
  getImageDimensions,
  isFormXObject,
} from "./resource-analyzer";
