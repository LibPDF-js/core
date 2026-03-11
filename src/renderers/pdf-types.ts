/**
 * PDF type definitions for rendering optimization.
 *
 * This module defines enums and interfaces for classifying PDF content types
 * to enable rendering strategy optimization based on how the PDF was created.
 */

/**
 * Primary classification of PDF document type based on creation method.
 */
export enum PdfType {
  /** Programmatically generated PDF (e.g., from LaTeX, Word, browsers) */
  Programmatic = "programmatic",

  /** Scanned document consisting primarily of images */
  Scanned = "scanned",

  /** OCR-processed scanned document with text layer */
  OcrProcessed = "ocr-processed",

  /** Mixed content with both programmatic and scanned elements */
  Mixed = "mixed",

  /** Vector graphics-heavy PDF (e.g., CAD drawings, illustrations) */
  VectorGraphics = "vector-graphics",

  /** Image-heavy PDF (e.g., photo albums, portfolios) */
  ImageHeavy = "image-heavy",

  /** Text-heavy PDF with minimal graphics */
  TextHeavy = "text-heavy",

  /** Unknown or unclassifiable PDF type */
  Unknown = "unknown",
}

/**
 * Content type classification for individual page elements.
 */
export enum ContentType {
  /** Text content rendered with fonts */
  Text = "text",

  /** Vector graphics (paths, shapes) */
  Vector = "vector",

  /** Raster images */
  Image = "image",

  /** Form XObjects (reusable content) */
  FormXObject = "form-xobject",

  /** Inline images within content streams */
  InlineImage = "inline-image",

  /** Shading patterns */
  Shading = "shading",

  /** Tiling patterns */
  Pattern = "pattern",
}

/**
 * Statistics about content composition for a page or document.
 */
export interface ContentStats {
  /** Number of text-showing operators */
  textOperatorCount: number;

  /** Number of path construction/painting operators */
  vectorOperatorCount: number;

  /** Number of image XObject references */
  imageCount: number;

  /** Number of inline images */
  inlineImageCount: number;

  /** Number of form XObject references */
  formXObjectCount: number;

  /** Number of shading operations */
  shadingCount: number;

  /** Estimated text coverage area (0-1) */
  textCoverage: number;

  /** Estimated image coverage area (0-1) */
  imageCoverage: number;

  /** Estimated vector coverage area (0-1) */
  vectorCoverage: number;

  /** Total operators processed */
  totalOperators: number;
}

/**
 * Font analysis information for determining PDF type.
 */
export interface FontAnalysis {
  /** Number of fonts used */
  fontCount: number;

  /** Number of embedded fonts */
  embeddedFontCount: number;

  /** Number of Type 3 (bitmap) fonts */
  type3FontCount: number;

  /** Whether CID fonts (for CJK text) are present */
  hasCIDFonts: boolean;

  /** Whether standard 14 fonts are used */
  hasStandard14Fonts: boolean;

  /** Font names found in the document */
  fontNames: string[];
}

/**
 * Image analysis information for determining PDF type.
 */
export interface ImageAnalysis {
  /** Total number of images */
  imageCount: number;

  /** Number of full-page or near-full-page images */
  fullPageImageCount: number;

  /** Average image resolution (DPI) */
  averageResolution: number;

  /** Whether images appear to be scanned (high-res, full-page) */
  appearsScanned: boolean;

  /** Image filter types used (e.g., DCTDecode for JPEG) */
  filterTypes: Set<string>;
}

/**
 * Result of PDF type detection analysis.
 */
export interface PdfTypeDetectionResult {
  /** Primary detected PDF type */
  type: PdfType;

  /** Confidence level of the detection (0-1) */
  confidence: number;

  /** Content statistics used for detection */
  contentStats: ContentStats;

  /** Font analysis results */
  fontAnalysis: FontAnalysis;

  /** Image analysis results */
  imageAnalysis: ImageAnalysis;

  /** Secondary type classifications that may also apply */
  secondaryTypes: PdfType[];

  /** Human-readable description of the detection */
  description: string;
}

/**
 * Rendering strategy hints based on PDF type.
 */
export interface RenderingStrategy {
  /** Whether to prioritize text clarity */
  prioritizeTextClarity: boolean;

  /** Whether to enable image smoothing */
  enableImageSmoothing: boolean;

  /** Suggested DPI multiplier for rendering */
  dpiMultiplier: number;

  /** Whether to enable subpixel text rendering */
  subpixelTextRendering: boolean;

  /** Whether to use simplified path rendering */
  simplifiedPathRendering: boolean;

  /** Whether to cache rendered images */
  cacheImages: boolean;

  /** Whether to preload images during idle time */
  preloadImages: boolean;

  /** Whether text layer extraction will be useful */
  textLayerUseful: boolean;
}

/**
 * Page-level type information.
 */
export interface PageTypeInfo {
  /** Page index (0-based) */
  pageIndex: number;

  /** Detected content type for this page */
  primaryContentType: ContentType;

  /** Content statistics for this page */
  stats: ContentStats;

  /** Whether this page appears to be a scanned image */
  isScannedPage: boolean;

  /** Whether this page has an OCR text layer */
  hasOcrTextLayer: boolean;
}

/**
 * Document-level type information aggregating all pages.
 */
export interface DocumentTypeInfo {
  /** Overall detected PDF type */
  type: PdfType;

  /** Detection result with full analysis */
  detection: PdfTypeDetectionResult;

  /** Recommended rendering strategy */
  strategy: RenderingStrategy;

  /** Per-page type information */
  pages: PageTypeInfo[];

  /** Whether the document has consistent page types */
  isHomogeneous: boolean;
}

/**
 * Create default content statistics.
 */
export function createDefaultContentStats(): ContentStats {
  return {
    textOperatorCount: 0,
    vectorOperatorCount: 0,
    imageCount: 0,
    inlineImageCount: 0,
    formXObjectCount: 0,
    shadingCount: 0,
    textCoverage: 0,
    imageCoverage: 0,
    vectorCoverage: 0,
    totalOperators: 0,
  };
}

/**
 * Create default font analysis.
 */
export function createDefaultFontAnalysis(): FontAnalysis {
  return {
    fontCount: 0,
    embeddedFontCount: 0,
    type3FontCount: 0,
    hasCIDFonts: false,
    hasStandard14Fonts: false,
    fontNames: [],
  };
}

/**
 * Create default image analysis.
 */
export function createDefaultImageAnalysis(): ImageAnalysis {
  return {
    imageCount: 0,
    fullPageImageCount: 0,
    averageResolution: 0,
    appearsScanned: false,
    filterTypes: new Set(),
  };
}

/**
 * Get recommended rendering strategy for a given PDF type.
 */
export function getDefaultRenderingStrategy(type: PdfType): RenderingStrategy {
  switch (type) {
    case PdfType.Programmatic:
    case PdfType.TextHeavy:
      return {
        prioritizeTextClarity: true,
        enableImageSmoothing: true,
        dpiMultiplier: 1,
        subpixelTextRendering: true,
        simplifiedPathRendering: false,
        cacheImages: true,
        preloadImages: false,
        textLayerUseful: true,
      };

    case PdfType.Scanned:
      return {
        prioritizeTextClarity: false,
        enableImageSmoothing: true,
        dpiMultiplier: 1.5,
        subpixelTextRendering: false,
        simplifiedPathRendering: true,
        cacheImages: true,
        preloadImages: true,
        textLayerUseful: false,
      };

    case PdfType.OcrProcessed:
      return {
        prioritizeTextClarity: false,
        enableImageSmoothing: true,
        dpiMultiplier: 1.5,
        subpixelTextRendering: false,
        simplifiedPathRendering: true,
        cacheImages: true,
        preloadImages: true,
        textLayerUseful: true,
      };

    case PdfType.VectorGraphics:
      return {
        prioritizeTextClarity: true,
        enableImageSmoothing: false,
        dpiMultiplier: 1,
        subpixelTextRendering: true,
        simplifiedPathRendering: false,
        cacheImages: false,
        preloadImages: false,
        textLayerUseful: true,
      };

    case PdfType.ImageHeavy:
      return {
        prioritizeTextClarity: false,
        enableImageSmoothing: true,
        dpiMultiplier: 1,
        subpixelTextRendering: false,
        simplifiedPathRendering: true,
        cacheImages: true,
        preloadImages: true,
        textLayerUseful: false,
      };

    case PdfType.Mixed:
    case PdfType.Unknown:
    default:
      return {
        prioritizeTextClarity: true,
        enableImageSmoothing: true,
        dpiMultiplier: 1,
        subpixelTextRendering: true,
        simplifiedPathRendering: false,
        cacheImages: true,
        preloadImages: false,
        textLayerUseful: true,
      };
  }
}
