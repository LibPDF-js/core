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
  RenderOptionsWithTypeDetection,
  RenderResult,
  RenderTask,
  TypeAwareRenderer,
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
// PDF Type Detection
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Type detection
  ContentType,
  createDefaultContentStats,
  createDefaultFontAnalysis,
  createDefaultImageAnalysis,
  createPdfTypeDetector,
  detectPdfType,
  getDefaultRenderingStrategy,
  getRenderingStrategy,
  PdfType,
  PdfTypeDetector,
  // Content analysis
  analyzeContentStream,
  appearsScanned,
  getPrimaryContentType,
  mergeContentStats,
  // Resource analysis
  analyzeFonts,
  analyzeImages,
  countFormXObjects,
  getImageDimensions,
  isFormXObject,
  // Types
  type ContentAnalysisResult,
  type ContentStats,
  type DocumentTypeInfo,
  type FontAnalysis,
  type ImageAnalysis,
  type PageAnalysisInput,
  type PageTypeInfo,
  type PdfTypeDetectionResult,
  type PdfTypeDetectorOptions,
  type RenderingStrategy,
} from "./renderers";

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
// Authentication and Retry
// ─────────────────────────────────────────────────────────────────────────────

export {
  AuthHandler,
  AuthenticationError as AuthHandlerAuthenticationError,
  createTokenProvider,
  type AuthenticatedResponse,
  type AuthHandlerOptions,
  type TokenProvider,
} from "./auth-handler";

export {
  HttpError,
  RetryExhaustedError,
  RetryLogic,
  RetryPresets,
  type RetryOptions,
  type RetryResult,
} from "./retry-logic";

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

// ─────────────────────────────────────────────────────────────────────────────
// Text Extraction and CMap Support
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Text extraction (core functions)
  getPlainText,
  groupCharsIntoLines,
  TextExtractor,
  searchPage,
  searchPages,
  TextState,
  type LineGrouperOptions,
  type TextExtractorOptions,
  type BoundingBox,
  type ExtractedChar,
  type PageText,
  type TextMatch,
  type TextSpan,
  // Note: ExtractTextOptions, FindTextOptions, and TextLine are already
  // exported from other modules (worker, drawing) with the same names
  // CMap support for international text
  CMap,
  parseCMapData,
  parseCMapText,
  CJKCMapLoader,
  BundledCMapProvider,
  CMapLoadError,
  createCJKCMapLoader,
  PREDEFINED_CMAPS,
  LegacyCMapSupport,
  createLegacyCMapSupport,
  createLegacyEncodingCMap,
  decodeLegacyByte,
  decodeLegacyBytes,
  glyphNameToUnicode,
  CMapRegistry,
  createCMapRegistry,
  getDefaultRegistry,
  setDefaultRegistry,
  type ICMap,
  type CMapOptions,
  type CMapType,
  type CIDSystemInfo,
  type CharacterMapping,
  type CharacterRangeMapping,
  type CIDMapping,
  type CIDRangeMapping,
  type CodespaceRange,
  type DecodeResult,
  type WritingMode,
  type CJKScript,
  type CMapDataProvider,
  type CMapLoadOptions,
  type PredefinedCMapInfo,
  type DifferenceEntry,
  type LegacyEncodingOptions,
  type LegacyEncodingType,
  type CMapRegistryEntry,
  type CMapRegistryOptions,
  type CMapRegistryStats,
  // Hierarchical text extraction
  HierarchicalTextExtractor,
  createHierarchicalTextExtractor,
  TextContentStreamParser,
  TextPositionCalculator,
  createDefaultTextParams,
  cloneTextParams,
  groupCharactersIntoPage,
  mergeBoundingBoxes,
  boxesOverlap,
  horizontalGap,
  verticalGap,
  type Character,
  type Word,
  type Line,
  type Paragraph,
  type TextPage,
  type ExtractionOptions,
  type DocumentText,
  type HierarchicalTextExtractorOptions,
  type RawExtractionResult,
  type TextOperation,
  type TextStateChange,
  type TextMatrixSet,
  type TextPositionChange,
  type TextShow,
  type TextShowItem,
  type FontChange,
  type GraphicsStateChange,
  type TextObjectBoundary,
  type TextParseResult,
  type TextStateOperator,
  type TextPositionOperator,
  type TextShowOperator,
  type GraphicsOperator,
  type GraphicsState,
  type TextParams,
  type CharacterBBox,
} from "./text";

// ─────────────────────────────────────────────────────────────────────────────
// Resource Loading
// ─────────────────────────────────────────────────────────────────────────────

export {
  // ResourceLoader
  AuthenticationError as ResourceLoaderAuthenticationError,
  createResourceLoader,
  FileReadError,
  InvalidFileTypeError,
  loadResource,
  NetworkError,
  ResourceLoader,
  ResourceLoaderError,
  type AuthConfig,
  type LoadResourceOptions,
  type LoadResourceResult,
  type ResourceInput,
} from "./resource-loader";

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────

export {
  // UIStateManager
  createUIStateManager,
  UIStateManager,
  type PartialUIState,
  type UIState,
  type UIStateEvent,
  type UIStateEventListener,
  type UIStateEventType,
  type UIStateManagerOptions,
  type ZoomFitMode,
  // ToolbarController
  createToolbarController,
  ToolbarController,
  type ToolbarButtonId,
  type ToolbarControllerOptions,
  type ToolbarEvent,
  type ToolbarEventListener,
  type ToolbarEventType,
  // OverlayManager
  createOverlayManager,
  OverlayManager,
  type OverlayConfig,
  type OverlayEvent,
  type OverlayEventListener,
  type OverlayEventType,
  type OverlayManagerOptions,
  type OverlayType,
} from "./ui";

// ─────────────────────────────────────────────────────────────────────────────
// Frontend (Search)
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Search engine
  SearchEngine,
  createSearchEngine,
  type SearchEngineOptions,
  // State manager
  SearchStateManager,
  createSearchStateManager,
  type SearchStateManagerOptions,
  type SearchHistoryEntry,
  // Types
  type SearchResult,
  type SearchOptions,
  type SearchState,
  type SearchStatus,
  type SearchEventType,
  type SearchEvent,
  type SearchEventListener,
  type BaseSearchEvent,
  type SearchStartEvent,
  type SearchProgressEvent,
  type SearchCompleteEvent,
  type SearchErrorEvent,
  type ResultChangeEvent,
  type StateChangeEvent,
  type TextProvider,
  // Helpers
  createInitialSearchState,
  createSearchEvent,
} from "./frontend";

// ─────────────────────────────────────────────────────────────────────────────
// Bounding Box Visualization
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Overlay component
  BoundingBoxOverlay,
  createBoundingBoxOverlay,
  DEFAULT_BOUNDING_BOX_COLORS,
  DEFAULT_BOUNDING_BOX_BORDER_COLORS,
  // Controls component
  BoundingBoxControls,
  createBoundingBoxControls,
  DEFAULT_TOGGLE_CONFIGS,
  // Types
  type OverlayBoundingBox,
  type BoundingBoxType,
  type BoundingBoxColors,
  type BoundingBoxVisibility,
  type BoundingBoxOverlayOptions,
  type BoundingBoxOverlayEventType,
  type BoundingBoxOverlayEvent,
  type BoundingBoxOverlayEventListener,
  type BoundingBoxToggleConfig,
  type BoundingBoxControlsOptions,
  type BoundingBoxControlsEventType,
  type BoundingBoxControlsEvent,
  type BoundingBoxControlsEventListener,
} from "./frontend";

// ─────────────────────────────────────────────────────────────────────────────
// Frontend Coordinate Transformation
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Frontend-specific coordinate utilities
  getMousePdfCoordinates,
  getTouchPdfCoordinates,
  transformBoundingBoxes,
  transformScreenRectToPdf,
  createTransformerForPageContainer,
  calculateCenteredOffset,
  hitTestBoundingBoxes,
  findAllBoxesAtPoint,
  createSelectionRect,
  findBoxesInSelection,
  // Frontend types
  type MouseCoordinateOptions,
  type MousePdfCoordinateResult,
  type PdfBoundingBox,
  type ScreenBoundingBox,
  type PageContainerTransformerOptions,
} from "./frontend";

// ─────────────────────────────────────────────────────────────────────────────
// Content Stream Processing
// ─────────────────────────────────────────────────────────────────────────────

export {
  ContentStreamProcessor,
  createContentStreamProcessor,
  type TextArrayElement,
} from "./viewer/ContentStreamProcessor";

// ─────────────────────────────────────────────────────────────────────────────
// Font Management
// ─────────────────────────────────────────────────────────────────────────────

export {
  FontManager,
  createFontManager,
  getGlobalFontManager,
  type FontMetrics,
  type LoadedFont,
  type FontStyle,
} from "./viewer/FontManager";

// ─────────────────────────────────────────────────────────────────────────────
// PDF.js Integration
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Initialization
  initializePDFJS,
  isPDFJSInitialized,
  getPDFJS,
  // Document loading
  loadPDFJSDocument,
  loadPDFJSDocumentFromUrl,
  getCurrentPDFJSDocument,
  closePDFJSDocument,
  // Page operations
  getPDFJSPage,
  getPDFJSPageCount,
  createPDFJSPageViewport,
  // Text content
  getPDFJSTextContent,
  isPDFJSTextItem,
  // Renderer
  PDFJSRenderer,
  createPDFJSRenderer,
  // Text layer
  buildPDFJSTextLayer,
  PDFJSTextLayerBuilder,
  createPDFJSTextLayerBuilder,
  // Search
  searchPDFJSDocument,
  PDFJSSearchEngine,
  createPDFJSSearchEngine,
  // Resource Loader
  PDFResourceLoader,
  createPDFResourceLoader,
  loadPDFFromUrl,
  loadPDFFromBytes,
  PDFLoadError,
  // Types
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type PDFJSTextContent,
  type PDFJSTextItem,
  type PDFJSTextMarkedContent,
  type PDFJSWrapperOptions,
  type PDFJSLoadDocumentOptions,
  type PDFJSRendererOptions,
  type PDFJSTextLayerOptions,
  type PDFJSTextLayerResult,
  type PDFJSSearchResult,
  type PDFJSSearchOptions,
  type PDFJSSearchState,
  type PDFSource,
  type PDFResourceLoaderOptions,
  type PDFLoadResult,
  type AuthConfig as PDFAuthConfig,
  type AuthRefreshCallback,
  type UrlRefreshCallback,
  type ProgressCallback as PDFProgressCallback,
} from "./viewer";
