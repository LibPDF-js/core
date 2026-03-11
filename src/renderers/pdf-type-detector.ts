/**
 * PDF type detection system.
 *
 * Analyzes PDF structure and content to determine how the PDF was created
 * (programmatic, scanned, OCR, etc.) and provides optimized rendering strategies.
 */

import type { RefResolver } from "#src/helpers/types";
import type { PdfDict } from "#src/objects/pdf-dict";

import {
  analyzeContentStream,
  appearsScanned as contentAppearsScanned,
  mergeContentStats,
  type ContentAnalysisResult,
} from "./content-analyzer";
import {
  ContentType,
  createDefaultContentStats,
  createDefaultFontAnalysis,
  createDefaultImageAnalysis,
  DocumentTypeInfo,
  getDefaultRenderingStrategy,
  PageTypeInfo,
  PdfType,
  type ContentStats,
  type FontAnalysis,
  type ImageAnalysis,
  type PdfTypeDetectionResult,
  type RenderingStrategy,
} from "./pdf-types";
import { analyzeFonts, analyzeImages, countFormXObjects } from "./resource-analyzer";

/**
 * Options for PDF type detection.
 */
export interface PdfTypeDetectorOptions {
  /** Maximum number of pages to analyze (for performance) */
  maxPagesToAnalyze?: number;

  /** Whether to perform deep analysis of XObjects */
  deepXObjectAnalysis?: boolean;

  /** Custom page dimensions if known */
  pageWidth?: number;
  pageHeight?: number;
}

/**
 * Input for page-level analysis.
 */
export interface PageAnalysisInput {
  /** Page index (0-based) */
  pageIndex: number;

  /** Content stream bytes */
  contentBytes: Uint8Array;

  /** Page resources dictionary */
  resources?: PdfDict;

  /** Page width in points */
  pageWidth: number;

  /** Page height in points */
  pageHeight: number;
}

/**
 * PDF type detector class.
 *
 * Analyzes PDF pages and resources to determine the document type
 * and provide optimized rendering strategies.
 */
export class PdfTypeDetector {
  private readonly options: Required<PdfTypeDetectorOptions>;
  private readonly resolver?: RefResolver;

  constructor(options?: PdfTypeDetectorOptions, resolver?: RefResolver) {
    this.options = {
      maxPagesToAnalyze: options?.maxPagesToAnalyze ?? 10,
      deepXObjectAnalysis: options?.deepXObjectAnalysis ?? false,
      pageWidth: options?.pageWidth ?? 612, // Default letter width
      pageHeight: options?.pageHeight ?? 792, // Default letter height
    };
    this.resolver = resolver;
  }

  /**
   * Analyze a single page and return its type information.
   */
  analyzePage(input: PageAnalysisInput): PageTypeInfo {
    const contentAnalysis = analyzeContentStream(input.contentBytes);
    const fontAnalysis = analyzeFonts(input.resources, this.resolver);
    const imageAnalysis = analyzeImages(
      input.resources,
      input.pageWidth,
      input.pageHeight,
      this.resolver,
    );

    // Update image count from resource analysis
    const stats = { ...contentAnalysis.stats };
    stats.imageCount = imageAnalysis.imageCount;
    stats.formXObjectCount = countFormXObjects(input.resources, this.resolver);

    // Determine if this page is scanned
    const isScannedPage =
      imageAnalysis.appearsScanned ||
      (contentAppearsScanned(stats) && imageAnalysis.fullPageImageCount > 0);

    // Determine if this page has OCR text layer
    const hasOcrTextLayer =
      isScannedPage && contentAnalysis.appearsOcrText && stats.textOperatorCount > 0;

    return {
      pageIndex: input.pageIndex,
      primaryContentType: contentAnalysis.primaryContentType,
      stats,
      isScannedPage,
      hasOcrTextLayer,
    };
  }

  /**
   * Analyze multiple pages and determine the document type.
   */
  analyzeDocument(pages: PageAnalysisInput[]): DocumentTypeInfo {
    const pageLimit = Math.min(pages.length, this.options.maxPagesToAnalyze);
    const pageInfos: PageTypeInfo[] = [];
    const allStats: ContentStats[] = [];
    let scannedPageCount = 0;
    let ocrPageCount = 0;

    // Analyze each page (up to limit)
    for (let i = 0; i < pageLimit; i++) {
      const pageInfo = this.analyzePage(pages[i]);
      pageInfos.push(pageInfo);
      allStats.push(pageInfo.stats);

      if (pageInfo.isScannedPage) {
        scannedPageCount++;
      }
      if (pageInfo.hasOcrTextLayer) {
        ocrPageCount++;
      }
    }

    // Merge statistics from all analyzed pages
    const mergedStats = mergeContentStats(allStats);

    // Aggregate font and image analysis from first page's resources
    // (typically representative of the document)
    const firstPageResources = pages[0]?.resources;
    const fontAnalysis = analyzeFonts(firstPageResources, this.resolver);
    const imageAnalysis = analyzeImages(
      firstPageResources,
      this.options.pageWidth,
      this.options.pageHeight,
      this.resolver,
    );

    // Determine document type
    const detection = this.detectType(
      mergedStats,
      fontAnalysis,
      imageAnalysis,
      pageInfos,
      scannedPageCount,
      ocrPageCount,
      pageLimit,
    );

    // Get rendering strategy
    const strategy = getDefaultRenderingStrategy(detection.type);

    // Check if document is homogeneous (all pages same type)
    const isHomogeneous = this.checkHomogeneity(pageInfos);

    return {
      type: detection.type,
      detection,
      strategy,
      pages: pageInfos,
      isHomogeneous,
    };
  }

  /**
   * Quick detection from a single page (for fast initial assessment).
   */
  quickDetect(
    contentBytes: Uint8Array,
    resources?: PdfDict,
    pageWidth = 612,
    pageHeight = 792,
  ): PdfTypeDetectionResult {
    const contentAnalysis = analyzeContentStream(contentBytes);
    const fontAnalysis = analyzeFonts(resources, this.resolver);
    const imageAnalysis = analyzeImages(resources, pageWidth, pageHeight, this.resolver);

    const stats = { ...contentAnalysis.stats };
    stats.imageCount = imageAnalysis.imageCount;
    stats.formXObjectCount = countFormXObjects(resources, this.resolver);

    return this.detectType(
      stats,
      fontAnalysis,
      imageAnalysis,
      [],
      imageAnalysis.appearsScanned ? 1 : 0,
      contentAnalysis.appearsOcrText ? 1 : 0,
      1,
    );
  }

  /**
   * Get the recommended rendering strategy for a detected type.
   */
  getStrategy(type: PdfType): RenderingStrategy {
    return getDefaultRenderingStrategy(type);
  }

  /**
   * Core type detection logic.
   */
  private detectType(
    stats: ContentStats,
    fontAnalysis: FontAnalysis,
    imageAnalysis: ImageAnalysis,
    pageInfos: PageTypeInfo[],
    scannedPageCount: number,
    ocrPageCount: number,
    totalPages: number,
  ): PdfTypeDetectionResult {
    const secondaryTypes: PdfType[] = [];
    let type = PdfType.Unknown;
    let confidence = 0.5;
    let description = "Unable to determine PDF type";

    const scannedRatio = scannedPageCount / (totalPages || 1);
    const ocrRatio = ocrPageCount / (totalPages || 1);

    // Calculate content ratios
    const totalOps = stats.totalOperators || 1;
    const textRatio = stats.textOperatorCount / totalOps;
    const vectorRatio = stats.vectorOperatorCount / totalOps;
    const imageRatio =
      (stats.imageCount + stats.inlineImageCount) / Math.max(totalOps, stats.imageCount + 1);

    // Detection logic
    if (scannedRatio > 0.8) {
      // Predominantly scanned
      if (ocrRatio > 0.5) {
        type = PdfType.OcrProcessed;
        confidence = 0.85;
        description = "Scanned document with OCR text layer";
        secondaryTypes.push(PdfType.Scanned);
      } else {
        type = PdfType.Scanned;
        confidence = 0.9;
        description = "Scanned document (image-based)";
      }
    } else if (scannedRatio > 0.3) {
      // Mixed content
      type = PdfType.Mixed;
      confidence = 0.7;
      description = "Mixed document with both scanned and programmatic content";
      if (ocrRatio > 0.3) {
        secondaryTypes.push(PdfType.OcrProcessed);
      }
    } else if (imageAnalysis.imageCount > 0 && textRatio < 0.1 && vectorRatio < 0.1) {
      // Image-heavy
      type = PdfType.ImageHeavy;
      confidence = 0.85;
      description = "Image-heavy document (photo album, portfolio, etc.)";
    } else if (vectorRatio > 0.5 && textRatio < 0.3) {
      // Vector graphics heavy
      type = PdfType.VectorGraphics;
      confidence = 0.8;
      description = "Vector graphics document (CAD, illustration, etc.)";
      if (stats.textOperatorCount > 100) {
        secondaryTypes.push(PdfType.TextHeavy);
      }
    } else if (textRatio > 0.6 || stats.textOperatorCount > 500) {
      // Text-heavy
      type = PdfType.TextHeavy;
      confidence = 0.85;
      description = "Text-heavy document (article, book, etc.)";
      if (fontAnalysis.embeddedFontCount > 0) {
        type = PdfType.Programmatic;
        description = "Programmatically generated document with text focus";
      }
    } else if (fontAnalysis.embeddedFontCount > 0 || fontAnalysis.hasStandard14Fonts) {
      // Programmatic with embedded fonts or standard fonts
      type = PdfType.Programmatic;
      confidence = 0.75;
      description = "Programmatically generated document";
    } else if (stats.textOperatorCount > 0 || stats.vectorOperatorCount > 0) {
      // Has some content, default to programmatic
      type = PdfType.Programmatic;
      confidence = 0.6;
      description = "Appears to be programmatically generated";
    }

    // Boost confidence if multiple indicators align
    if (type === PdfType.Programmatic && fontAnalysis.embeddedFontCount > 2) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }
    if (type === PdfType.Scanned && imageAnalysis.averageResolution > 300) {
      confidence = Math.min(confidence + 0.05, 0.95);
    }

    return {
      type,
      confidence,
      contentStats: stats,
      fontAnalysis,
      imageAnalysis,
      secondaryTypes,
      description,
    };
  }

  /**
   * Check if all pages have the same content type.
   */
  private checkHomogeneity(pageInfos: PageTypeInfo[]): boolean {
    if (pageInfos.length <= 1) {
      return true;
    }

    const firstType = pageInfos[0].primaryContentType;
    const firstScanned = pageInfos[0].isScannedPage;

    return pageInfos.every(
      p => p.primaryContentType === firstType && p.isScannedPage === firstScanned,
    );
  }
}

/**
 * Create a new PDF type detector.
 */
export function createPdfTypeDetector(
  options?: PdfTypeDetectorOptions,
  resolver?: RefResolver,
): PdfTypeDetector {
  return new PdfTypeDetector(options, resolver);
}

/**
 * Quick utility function to detect PDF type from content bytes.
 */
export function detectPdfType(
  contentBytes: Uint8Array,
  resources?: PdfDict,
  resolver?: RefResolver,
): PdfTypeDetectionResult {
  const detector = new PdfTypeDetector(undefined, resolver);
  return detector.quickDetect(contentBytes, resources);
}

/**
 * Get rendering strategy for a PDF type.
 */
export function getRenderingStrategy(type: PdfType): RenderingStrategy {
  return getDefaultRenderingStrategy(type);
}
