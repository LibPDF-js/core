/**
 * Content stream analyzer for PDF type detection.
 *
 * Parses PDF content streams and analyzes operator usage patterns
 * to determine the type and composition of PDF content.
 */

import { Op, Operator } from "#src/content/operators";
import { ContentStreamProcessor } from "#src/viewer/ContentStreamProcessor";

import { ContentType, createDefaultContentStats, type ContentStats } from "./pdf-types";

/**
 * Operators that indicate text content.
 */
const TEXT_OPERATORS = new Set<string>([
  Op.ShowText, // Tj
  Op.ShowTextArray, // TJ
  Op.MoveAndShowText, // '
  Op.MoveSetSpacingShowText, // "
]);

/**
 * Operators that indicate text state/positioning (support for text).
 */
const TEXT_STATE_OPERATORS = new Set<string>([
  Op.BeginText, // BT
  Op.EndText, // ET
  Op.SetFont, // Tf
  Op.MoveText, // Td
  Op.MoveTextSetLeading, // TD
  Op.SetTextMatrix, // Tm
  Op.NextLine, // T*
  Op.SetCharSpacing, // Tc
  Op.SetWordSpacing, // Tw
  Op.SetHorizontalScale, // Tz
  Op.SetLeading, // TL
  Op.SetTextRenderMode, // Tr
  Op.SetTextRise, // Ts
]);

/**
 * Operators that indicate path/vector operations.
 */
const VECTOR_OPERATORS = new Set<string>([
  // Path construction
  Op.MoveTo, // m
  Op.LineTo, // l
  Op.CurveTo, // c
  Op.CurveToInitial, // v
  Op.CurveToFinal, // y
  Op.ClosePath, // h
  Op.Rectangle, // re
  // Path painting
  Op.Stroke, // S
  Op.CloseAndStroke, // s
  Op.Fill, // f
  Op.FillCompat, // F
  Op.FillEvenOdd, // f*
  Op.FillAndStroke, // B
  Op.FillAndStrokeEvenOdd, // B*
  Op.CloseFillAndStroke, // b
  Op.CloseFillAndStrokeEvenOdd, // b*
  Op.EndPath, // n
]);

/**
 * Operators that indicate image content.
 */
const IMAGE_OPERATORS = new Set<string>([
  Op.DrawXObject, // Do (can be image or form)
  Op.BeginInlineImage, // BI
  Op.BeginInlineImageData, // ID
  Op.EndInlineImage, // EI
]);

/**
 * Operators that indicate shading/pattern content.
 */
const SHADING_OPERATORS = new Set<string>([
  Op.PaintShading, // sh
]);

/**
 * Result of analyzing a content stream.
 */
export interface ContentAnalysisResult {
  /** Content statistics */
  stats: ContentStats;

  /** Primary content type based on operator distribution */
  primaryContentType: ContentType;

  /** Whether the content appears to be OCR text */
  appearsOcrText: boolean;

  /** Operator type distribution (normalized 0-1) */
  operatorDistribution: {
    text: number;
    vector: number;
    image: number;
    other: number;
  };

  /** XObject names referenced in the content */
  xobjectNames: string[];

  /** Font names used in the content */
  fontNames: string[];
}

/**
 * Analyze a content stream to determine its composition.
 */
export function analyzeContentStream(bytes: Uint8Array): ContentAnalysisResult {
  const stats = createDefaultContentStats();
  const xobjectNames: string[] = [];
  const fontNames: string[] = [];

  let textOps = 0;
  let vectorOps = 0;
  let imageOps = 0;
  let otherOps = 0;

  // Track text positioning for OCR detection
  let textMatrixSetCount = 0;
  let textShowCount = 0;
  let inTextObject = false;

  try {
    const operators = ContentStreamProcessor.parseToOperators(bytes);
    stats.totalOperators = operators.length;

    for (const operator of operators) {
      const opName = operator.op;

      if (TEXT_OPERATORS.has(opName)) {
        stats.textOperatorCount++;
        textOps++;
        textShowCount++;
      } else if (TEXT_STATE_OPERATORS.has(opName)) {
        if (opName === Op.BeginText) {
          inTextObject = true;
        } else if (opName === Op.EndText) {
          inTextObject = false;
        } else if (opName === Op.SetTextMatrix) {
          textMatrixSetCount++;
        } else if (opName === Op.SetFont) {
          const fontName = extractFontNameFromOperand(operator.operands[0]);
          if (fontName && !fontNames.includes(fontName)) {
            fontNames.push(fontName);
          }
        }
        textOps++;
      } else if (VECTOR_OPERATORS.has(opName)) {
        stats.vectorOperatorCount++;
        vectorOps++;
      } else if (IMAGE_OPERATORS.has(opName)) {
        imageOps++;
        if (opName === Op.DrawXObject) {
          const xobjName = extractXObjectName(operator.operands[0]);
          if (xobjName) {
            xobjectNames.push(xobjName);
          }
          // Count as image for now; resource analyzer will refine
          stats.imageCount++;
        } else if (opName === Op.BeginInlineImage || opName === Op.BeginInlineImageData) {
          stats.inlineImageCount++;
        }
      } else if (SHADING_OPERATORS.has(opName)) {
        stats.shadingCount++;
        otherOps++;
      } else {
        otherOps++;
      }
    }
  } catch {
    // Failed to parse content stream - return empty stats
  }

  const total = textOps + vectorOps + imageOps + otherOps || 1;

  // Determine primary content type
  let primaryContentType = ContentType.Text;
  const textRatio = textOps / total;
  const vectorRatio = vectorOps / total;
  const imageRatio = imageOps / total;

  if (imageRatio > 0.5 || (stats.imageCount > 0 && textOps === 0 && vectorOps < 10)) {
    primaryContentType = ContentType.Image;
  } else if (vectorRatio > textRatio && vectorRatio > 0.3) {
    primaryContentType = ContentType.Vector;
  } else if (textOps > 0) {
    primaryContentType = ContentType.Text;
  }

  // OCR detection heuristic:
  // OCR text typically has many individual text matrix sets
  // (one per character or word) with minimal text between them
  const appearsOcrText =
    textShowCount > 0 && textMatrixSetCount > textShowCount * 0.8 && textMatrixSetCount > 10;

  return {
    stats,
    primaryContentType,
    appearsOcrText,
    operatorDistribution: {
      text: textOps / total,
      vector: vectorOps / total,
      image: imageOps / total,
      other: otherOps / total,
    },
    xobjectNames,
    fontNames,
  };
}

/**
 * Merge content statistics from multiple analyses.
 */
export function mergeContentStats(statsArray: ContentStats[]): ContentStats {
  const merged = createDefaultContentStats();

  for (const stats of statsArray) {
    merged.textOperatorCount += stats.textOperatorCount;
    merged.vectorOperatorCount += stats.vectorOperatorCount;
    merged.imageCount += stats.imageCount;
    merged.inlineImageCount += stats.inlineImageCount;
    merged.formXObjectCount += stats.formXObjectCount;
    merged.shadingCount += stats.shadingCount;
    merged.totalOperators += stats.totalOperators;
  }

  // Average coverage values
  if (statsArray.length > 0) {
    merged.textCoverage =
      statsArray.reduce((sum, s) => sum + s.textCoverage, 0) / statsArray.length;
    merged.imageCoverage =
      statsArray.reduce((sum, s) => sum + s.imageCoverage, 0) / statsArray.length;
    merged.vectorCoverage =
      statsArray.reduce((sum, s) => sum + s.vectorCoverage, 0) / statsArray.length;
  }

  return merged;
}

/**
 * Determine if content statistics indicate a scanned document.
 */
export function appearsScanned(stats: ContentStats): boolean {
  // High image count with low text/vector operations suggests scanned
  const totalDrawing = stats.textOperatorCount + stats.vectorOperatorCount;
  const hasSignificantImages = stats.imageCount > 0 || stats.inlineImageCount > 0;

  return hasSignificantImages && totalDrawing < 50;
}

/**
 * Calculate the primary content type from statistics.
 */
export function getPrimaryContentType(stats: ContentStats): ContentType {
  const total =
    stats.textOperatorCount + stats.vectorOperatorCount + stats.imageCount + stats.inlineImageCount;

  if (total === 0) {
    return ContentType.Text; // Default
  }

  const textRatio = stats.textOperatorCount / total;
  const imageRatio = (stats.imageCount + stats.inlineImageCount) / total;
  const vectorRatio = stats.vectorOperatorCount / total;

  if (imageRatio > textRatio && imageRatio > vectorRatio) {
    return ContentType.Image;
  } else if (vectorRatio > textRatio) {
    return ContentType.Vector;
  }

  return ContentType.Text;
}

/**
 * Extract font name from operator operand.
 */
function extractFontNameFromOperand(operand: unknown): string | null {
  if (!operand) {
    return null;
  }

  if (typeof operand === "string") {
    return operand.startsWith("/") ? operand.slice(1) : operand;
  }

  if (
    typeof operand === "object" &&
    "name" in operand &&
    typeof (operand as { name: string }).name === "string"
  ) {
    return (operand as { name: string }).name;
  }

  return null;
}

/**
 * Extract XObject name from Do operator operand.
 */
function extractXObjectName(operand: unknown): string | null {
  if (!operand) {
    return null;
  }

  if (typeof operand === "string") {
    return operand.startsWith("/") ? operand.slice(1) : operand;
  }

  if (
    typeof operand === "object" &&
    "name" in operand &&
    typeof (operand as { name: string }).name === "string"
  ) {
    return (operand as { name: string }).name;
  }

  return null;
}
