/**
 * @libpdf/core
 *
 * A modern PDF library for TypeScript — parsing and generation.
 */

export { version } from "../package.json";

// ─────────────────────────────────────────────────────────────────────────────
// High-level API
// ─────────────────────────────────────────────────────────────────────────────

export {
  type CopyPagesOptions,
  type DocumentMetadata,
  type ExtractPagesOptions,
  type FlattenAllOptions,
  type FlattenAllResult,
  type LoadOptions,
  type MergeOptions,
  PDF,
  type SaveOptions,
  type SetTitleOptions,
  type TrappedStatus,
} from "./api/pdf";
export { PDFEmbeddedPage } from "./api/pdf-embedded-page";
export {
  type CheckboxOptions,
  type CheckboxSymbol,
  type DropdownOptions,
  type FieldOptions,
  type FieldValue,
  type FormProperties,
  type ListboxOptions,
  PDFForm,
  type RadioGroupOptions,
  type RadioSymbol,
  type SignatureFieldOptions,
  type TextAlignment,
  type TextFieldOptions,
} from "./api/pdf-form";
export {
  type DrawFieldOptions,
  type DrawPageOptions,
  PDFPage,
  type Rectangle,
} from "./api/pdf-page";

// ─────────────────────────────────────────────────────────────────────────────
// Color and Rotation Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ButtonField,
  CheckboxField,
  DropdownField,
  FieldType,
  FormField,
  ListBoxField,
  RadioField,
  SignatureField,
  TextField,
} from "./document/forms/fields";
export type { FlattenOptions } from "./document/forms/form-flattener";
export {
  // Color presets
  black,
  blue,
  type CMYK,
  type Color,
  cmyk,
  type Grayscale,
  grayscale,
  green,
  type RGB,
  red,
  rgb,
  white,
} from "./helpers/colors";
export { type Degrees, degrees } from "./helpers/rotations";

// ─────────────────────────────────────────────────────────────────────────────
// Layers (Optional Content Groups)
// ─────────────────────────────────────────────────────────────────────────────

export type { FlattenLayersResult, LayerInfo } from "./layers/types";

// ─────────────────────────────────────────────────────────────────────────────
// Security
// ─────────────────────────────────────────────────────────────────────────────

export type {
  AuthenticationResult,
  EncryptionAlgorithmOption,
  PermissionOptions,
  Permissions,
  ProtectionOptions,
  SecurityInfo,
} from "./api/pdf-security";
export { PermissionDeniedError, SecurityError } from "./security/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Digital Signatures
// ─────────────────────────────────────────────────────────────────────────────

export type {
  DigestAlgorithm,
  HttpTimestampAuthorityOptions,
  KeyType,
  PAdESLevel,
  RevocationProvider,
  SignatureAlgorithm,
  Signer,
  SignOptions,
  SignResult,
  SignWarning,
  SubFilter,
  TimestampAuthority,
} from "./signatures";
export {
  CertificateChainError,
  CryptoKeySigner,
  GoogleKmsSigner,
  HttpTimestampAuthority,
  KmsSignerError,
  P12Signer,
  PlaceholderError,
  RevocationError,
  SignatureError,
  SignerError,
  TimestampError,
} from "./signatures";

// ─────────────────────────────────────────────────────────────────────────────
// PDF Objects
// ─────────────────────────────────────────────────────────────────────────────

export { PdfArray } from "./objects/pdf-array";
export { PdfBool } from "./objects/pdf-bool";
export { PdfDict } from "./objects/pdf-dict";
export { PdfName } from "./objects/pdf-name";
export { PdfNull } from "./objects/pdf-null";
export { PdfNumber } from "./objects/pdf-number";
export type { PdfObject } from "./objects/pdf-object";
export { PdfRef } from "./objects/pdf-ref";
export { PdfStream } from "./objects/pdf-stream";
export { PdfString } from "./objects/pdf-string";

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

export type { EmbeddedFont, EmbedFontOptions } from "./fonts/embedded-font";
export { type Standard14FontName, StandardFonts } from "./fonts/standard-14";
export { Standard14Font } from "./fonts/standard-14-font";

// ─────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────

export { PDFImage } from "./images/pdf-image";

// ─────────────────────────────────────────────────────────────────────────────
// Drawing API
// ─────────────────────────────────────────────────────────────────────────────

export {
  type DrawCircleOptions,
  type DrawEllipseOptions,
  type DrawImageOptions,
  type DrawLineOptions,
  type DrawRectangleOptions,
  type DrawSvgPathOptions,
  type DrawTextOptions,
  type FontInput,
  type LayoutResult,
  // Types
  type LineCap,
  type LineJoin,
  layoutJustifiedLine,
  layoutText,
  // Utilities
  lineCapToNumber,
  lineJoinToNumber,
  // Text layout
  measureText,
  // Path builder
  PathBuilder,
  type PathOptions,
  type PositionedWord,
  type Rotation,
  type RotationOrigin,
  type RotationOriginName,
  type TextLine,
} from "#src/drawing";

// ─────────────────────────────────────────────────────────────────────────────
// Low-Level Drawing API
// ─────────────────────────────────────────────────────────────────────────────

export { Matrix } from "./helpers/matrix";
export * as ops from "./helpers/operators";
export { ColorSpace } from "./helpers/colorspace";

// Low-level types and resource interfaces
export type {
  AxialCoords,
  AxialShadingOptions,
  BBox,
  BlendMode,
  ColorStop,
  ExtGStateOptions,
  FormXObjectOptions,
  ImagePatternOptions,
  LinearGradientOptions,
  PatternMatrix,
  PDFExtGState,
  PDFFormXObject,
  PDFPattern,
  PDFShading,
  PDFShadingPattern,
  PDFTilingPattern,
  RadialCoords,
  RadialShadingOptions,
  ShadingPatternOptions,
  TilingPatternOptions,
} from "./drawing/resources/index";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export { parsePem, type PemBlock } from "./helpers/pem";

// ─────────────────────────────────────────────────────────────────────────────
// Annotations
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Types
  AnnotationFlags,
  type AnnotationSubtype,
  type BorderStyle,
  type BorderStyleType,
  type CaretAnnotationOptions,
  type CaretSymbol,
  type CircleAnnotationOptions,
  // Helpers
  createAnnotation,
  type DestinationType,
  type FileAttachmentIcon,
  type FlattenAnnotationsOptions,
  type FreeTextAnnotationOptions,
  type FreeTextJustification,
  type HighlightMode,
  type InkAnnotationOptions,
  isPopupAnnotation,
  isWidgetAnnotation,
  type LineAnnotationOptions,
  type LineEndingStyle,
  type LinkAction,
  type LinkAnnotationOptions,
  type LinkDestination,
  // Base classes
  PDFAnnotation,
  // Annotation types
  PDFCaretAnnotation,
  PDFCircleAnnotation,
  PDFFileAttachmentAnnotation,
  PDFFreeTextAnnotation,
  PDFHighlightAnnotation,
  PDFInkAnnotation,
  PDFLineAnnotation,
  PDFLinkAnnotation,
  PDFMarkupAnnotation,
  PDFPolygonAnnotation,
  PDFPolylineAnnotation,
  PDFPopupAnnotation,
  PDFSquareAnnotation,
  PDFSquigglyAnnotation,
  PDFStampAnnotation,
  PDFStrikeOutAnnotation,
  PDFTextAnnotation,
  PDFTextMarkupAnnotation,
  PDFUnderlineAnnotation,
  PDFUnknownAnnotation,
  type Point,
  type PolygonAnnotationOptions,
  type PolylineAnnotationOptions,
  type PopupOptions,
  type Rect,
  type RemoveAnnotationsOptions,
  rectsToQuadPoints,
  rectToQuadPoints,
  type SquareAnnotationOptions,
  STANDARD_STAMPS,
  type StampAnnotationOptions,
  type StampName,
  type TextAnnotationIcon,
  type TextAnnotationOptions,
  type TextAnnotationState,
  type TextAnnotationStateModel,
  type TextMarkupAnnotationOptions,
} from "./annotations";

// ─────────────────────────────────────────────────────────────────────────────
// PDF Viewer
// ─────────────────────────────────────────────────────────────────────────────

export {
  createPDFViewer,
  PDFViewer,
  type PDFViewerEvent,
  type PDFViewerEventListener,
  type PDFViewerEventType,
  type PDFViewerOptions,
  type ScrollMode,
  type SpreadMode,
} from "./pdf-viewer";

export {
  CoordinateTransformer,
  createCoordinateTransformer,
  MAX_ZOOM,
  MIN_ZOOM,
  type CoordinateTransformerOptions,
  type Point2D,
  type Rect2D,
  type RotationAngle,
} from "./coordinate-transformer";

export {
  createRenderingPipeline,
  RenderingPipeline,
  type RenderingPipelineOptions,
} from "./rendering-pipeline";

export type {
  BaseRenderer,
  RendererFactory,
  RendererOptions,
  RendererType,
  RenderResult,
  RenderTask,
  Viewport,
} from "./renderers/base-renderer";

export {
  CanvasRenderer,
  type CanvasRendererOptions,
  createCanvasRenderer,
} from "./renderers/canvas-renderer";

export {
  createSVGRenderer,
  SVGRenderer,
  type SVGRendererOptions,
  type GraphicsState as SVGGraphicsState,
  type TextState as SVGTextState,
  LineCap as SVGLineCap,
  LineJoin as SVGLineJoin,
  TextRenderMode as SVGTextRenderMode,
} from "./renderers/svg-renderer";

export {
  createTextLayerBuilder,
  TextLayerBuilder,
  type TextLayerBuilderOptions,
  type TextLayerResult,
} from "./renderers/text-layer-builder";

// ─────────────────────────────────────────────────────────────────────────────
// Virtual Scrolling
// ─────────────────────────────────────────────────────────────────────────────

export {
  createVirtualScroller,
  VirtualScroller,
  type ContainerInfo,
  type PageDimensions,
  type PageLayout,
  type ScrollPosition,
  type VisibleRange,
  type VirtualScrollerEvent,
  type VirtualScrollerEventListener,
  type VirtualScrollerEventType,
  type VirtualScrollerOptions,
} from "./virtual-scroller";

export {
  createViewportManager,
  ViewportManager,
  type ManagedPage,
  type PageSource,
  type PageState,
  type ViewportManagerEvent,
  type ViewportManagerEventListener,
  type ViewportManagerEventType,
  type ViewportManagerOptions,
} from "./viewport-manager";

// ─────────────────────────────────────────────────────────────────────────────
// Web Worker Support
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Low-level worker management
  createPDFWorker,
  PDFWorker,
  type PDFWorkerOptions,
  type WorkerState,
  type WorkerTask,
  // High-level proxy API
  createWorkerProxy,
  WorkerProxy,
  type WorkerProxyOptions,
  type ProxyLoadOptions,
  type ProxySaveOptions,
  type ExtractTextOptions,
  type FindTextOptions,
  type LoadedDocument,
  type CancellableOperation,
  // Message protocol types
  type MessageId,
  type TaskId,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerError,
  type ProgressMessage,
} from "./worker";

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Worker Support
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Parsing worker host
  createParsingWorkerHost,
  isWorkerSupported,
  ParsingWorkerHost,
  type CancellableParseOperation,
  type ExtractOptions,
  type ExtractTextResult,
  type ParseOptions as ParsingWorkerParseOptions,
  type ParseResult,
  type ParsingWorkerHostOptions,
  type ParsingWorkerState,
} from "./worker/parsing-worker-host";

export {
  // Progress tracking
  createProgressTracker,
  DEFAULT_PROGRESS_INTERVAL,
  ProgressTracker,
  type ProgressTrackerOptions,
} from "./worker/progress-tracker";

export type {
  // Parsing types
  DocumentMetadata as ParsingDocumentMetadata,
  ExtractedPageText,
  ParsedDocumentInfo,
  ParsingErrorCode,
  ParsingPhase,
  ParsingProgress,
  ParsingProgressCallback,
  ParsingWorkerError,
  TextItem,
  WorkerParseOptions,
} from "./worker/parsing-types";

export {
  // Parsing utilities
  calculateParsingTimeout,
  createDeferred,
  DEFAULT_PARSING_TIMEOUTS,
  detectEnvironment,
  extractTransferables,
  generateParsingMessageId,
  generateParsingTaskId,
  isWorkerContext,
  type Deferred,
  type ParsingWorkerCreationOptions,
  type RuntimeEnvironment,
} from "./worker/parsing-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Parser Module
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Synchronous parsing
  DocumentParser,
  parseDocument,
  parseDocumentAsync,
  type ParsedDocument,
  type ParseOptions,
  // Errors
  ObjectParseError,
  RecoverableParseError,
  StreamDecodeError,
  StructureError,
  UnrecoverableParseError,
  XRefParseError,
  // XRef types
  type XRefData,
  type XRefEntry,
} from "./parser";
