/**
 * Resource analyzer for PDF type detection.
 *
 * Analyzes PDF resources (fonts, images, XObjects) to determine
 * document characteristics and type classification.
 */

import type { RefResolver } from "#src/helpers/types";
import type { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfName } from "#src/objects/pdf-name";
import type { PdfNumber } from "#src/objects/pdf-number";
import type { PdfStream } from "#src/objects/pdf-stream";

import {
  createDefaultFontAnalysis,
  createDefaultImageAnalysis,
  type FontAnalysis,
  type ImageAnalysis,
} from "./pdf-types";

/**
 * Standard 14 PDF font base names.
 */
const STANDARD_14_FONTS = new Set([
  "Courier",
  "Courier-Bold",
  "Courier-BoldOblique",
  "Courier-Oblique",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-BoldOblique",
  "Helvetica-Oblique",
  "Times-Roman",
  "Times-Bold",
  "Times-BoldItalic",
  "Times-Italic",
  "Symbol",
  "ZapfDingbats",
]);

/**
 * Image filter types that indicate compressed image data.
 */
const IMAGE_FILTER_TYPES = new Set([
  "DCTDecode", // JPEG
  "JPXDecode", // JPEG 2000
  "CCITTFaxDecode", // Fax/TIFF compression
  "JBIG2Decode", // JBIG2
  "FlateDecode", // ZIP compression (can be images)
  "LZWDecode", // LZW compression
  "RunLengthDecode", // RLE compression
]);

/**
 * Analyze fonts from a Resources dictionary.
 */
export function analyzeFonts(resources: PdfDict | undefined, resolver?: RefResolver): FontAnalysis {
  const analysis = createDefaultFontAnalysis();

  if (!resources) {
    return analysis;
  }

  const fonts = resources.getDict("Font", resolver);
  if (!fonts) {
    return analysis;
  }

  for (const [fontKey] of fonts) {
    const fontName = fontKey.name;
    analysis.fontNames.push(fontName);
    analysis.fontCount++;

    // Get the font dictionary
    const fontObj = fonts.get(fontKey, resolver);
    if (!fontObj || fontObj.type !== "dict") {
      continue;
    }

    const fontDict = fontObj as PdfDict;
    const fontType = fontDict.getName("Subtype", resolver)?.name;
    const baseFont = fontDict.getName("BaseFont", resolver)?.name;

    // Check for Type 3 (bitmap) fonts
    if (fontType === "Type3") {
      analysis.type3FontCount++;
    }

    // Check for CID fonts (used for CJK text)
    if (fontType === "Type0" || fontType === "CIDFontType0" || fontType === "CIDFontType2") {
      analysis.hasCIDFonts = true;
    }

    // Check for standard 14 fonts
    if (baseFont && isStandard14Font(baseFont)) {
      analysis.hasStandard14Fonts = true;
    }

    // Check for embedded fonts
    const fontDescriptor = fontDict.getDict("FontDescriptor", resolver);
    if (fontDescriptor) {
      // FontFile, FontFile2, or FontFile3 indicate embedded font data
      if (
        fontDescriptor.has("FontFile") ||
        fontDescriptor.has("FontFile2") ||
        fontDescriptor.has("FontFile3")
      ) {
        analysis.embeddedFontCount++;
      }
    }
  }

  return analysis;
}

/**
 * Analyze images (XObjects) from a Resources dictionary.
 */
export function analyzeImages(
  resources: PdfDict | undefined,
  pageWidth: number,
  pageHeight: number,
  resolver?: RefResolver,
): ImageAnalysis {
  const analysis = createDefaultImageAnalysis();

  if (!resources) {
    return analysis;
  }

  const xobjects = resources.getDict("XObject", resolver);
  if (!xobjects) {
    return analysis;
  }

  const pageArea = pageWidth * pageHeight;
  let totalResolution = 0;
  let resolutionCount = 0;

  for (const [xobjKey] of xobjects) {
    const xobj = xobjects.get(xobjKey, resolver);
    if (!xobj) {
      continue;
    }

    // XObjects are streams with a Subtype
    if (xobj.type !== "stream") {
      continue;
    }

    const stream = xobj as PdfStream;
    const dict = stream.dict;
    const subtype = dict.getName("Subtype", resolver)?.name;

    if (subtype !== "Image") {
      continue;
    }

    analysis.imageCount++;

    // Get image dimensions
    const width = dict.getNumber("Width", resolver)?.value ?? 0;
    const height = dict.getNumber("Height", resolver)?.value ?? 0;
    const imageArea = width * height;

    // Get filter type
    const filter = dict.get("Filter", resolver);
    if (filter) {
      const filterNames = extractFilterNames(filter);
      for (const name of filterNames) {
        analysis.filterTypes.add(name);
      }
    }

    // Check if this is a full-page image
    // Consider it full-page if it covers more than 90% of the page area
    // This requires knowing how the image is placed, which we estimate
    // by comparing the image dimensions to page dimensions
    if (imageArea > 0 && pageArea > 0) {
      // Calculate effective DPI if the image filled the page
      const effectiveDpiWidth = (width / pageWidth) * 72;
      const effectiveDpiHeight = (height / pageHeight) * 72;
      const avgDpi = (effectiveDpiWidth + effectiveDpiHeight) / 2;

      totalResolution += avgDpi;
      resolutionCount++;

      // If image dimensions are close to or larger than page dimensions
      // and resolution is high (>150 DPI), it's likely a full-page scan
      const widthRatio = width / pageWidth;
      const heightRatio = height / pageHeight;
      if (widthRatio > 0.9 && heightRatio > 0.9 && avgDpi > 150) {
        analysis.fullPageImageCount++;
      }
    }
  }

  // Calculate average resolution
  if (resolutionCount > 0) {
    analysis.averageResolution = totalResolution / resolutionCount;
  }

  // Determine if this appears to be scanned content
  // Scanned documents typically have:
  // - At least one full-page image
  // - High resolution images (>200 DPI)
  // - Use of DCTDecode (JPEG) or JBIG2Decode
  analysis.appearsScanned =
    analysis.fullPageImageCount > 0 &&
    analysis.averageResolution > 200 &&
    (analysis.filterTypes.has("DCTDecode") ||
      analysis.filterTypes.has("JBIG2Decode") ||
      analysis.filterTypes.has("CCITTFaxDecode"));

  return analysis;
}

/**
 * Count form XObjects in a Resources dictionary.
 */
export function countFormXObjects(resources: PdfDict | undefined, resolver?: RefResolver): number {
  if (!resources) {
    return 0;
  }

  const xobjects = resources.getDict("XObject", resolver);
  if (!xobjects) {
    return 0;
  }

  let count = 0;
  for (const [xobjKey] of xobjects) {
    const xobj = xobjects.get(xobjKey, resolver);
    if (!xobj || xobj.type !== "stream") {
      continue;
    }

    const stream = xobj as PdfStream;
    const subtype = stream.dict.getName("Subtype", resolver)?.name;

    if (subtype === "Form") {
      count++;
    }
  }

  return count;
}

/**
 * Check if a font name is a standard 14 font.
 */
function isStandard14Font(fontName: string): boolean {
  // Standard 14 fonts can have various suffixes
  const baseName = fontName.split(",")[0].split("-")[0];

  // Also check the full name for exact matches
  if (STANDARD_14_FONTS.has(fontName)) {
    return true;
  }

  // Check common variations
  const normalizedName = fontName
    .replace(/,.*$/, "")
    .replace(/-?(Bold|Italic|Oblique|Roman).*$/i, "");
  return (
    STANDARD_14_FONTS.has(normalizedName) ||
    normalizedName === "Courier" ||
    normalizedName === "Helvetica" ||
    normalizedName === "Times" ||
    normalizedName === "Symbol" ||
    normalizedName === "ZapfDingbats"
  );
}

/**
 * Extract filter names from a Filter entry (can be name or array).
 */
function extractFilterNames(filter: unknown): string[] {
  if (!filter) {
    return [];
  }

  // Single filter (PdfName)
  if (typeof filter === "object" && "type" in filter) {
    const typed = filter as { type: string; name?: string };
    if (typed.type === "name" && typed.name) {
      return [typed.name];
    }

    // Array of filters
    if (typed.type === "array" && Symbol.iterator in filter) {
      const names: string[] = [];
      for (const item of filter as Iterable<unknown>) {
        if (typeof item === "object" && item && "type" in item) {
          const itemTyped = item as { type: string; name?: string };
          if (itemTyped.type === "name" && itemTyped.name) {
            names.push(itemTyped.name);
          }
        }
      }
      return names;
    }
  }

  return [];
}

/**
 * Get XObject dimensions if it's an image.
 */
export function getImageDimensions(
  xobjName: string,
  resources: PdfDict | undefined,
  resolver?: RefResolver,
): { width: number; height: number } | null {
  if (!resources) {
    return null;
  }

  const xobjects = resources.getDict("XObject", resolver);
  if (!xobjects) {
    return null;
  }

  const xobj = xobjects.get(xobjName, resolver);
  if (!xobj || xobj.type !== "stream") {
    return null;
  }

  const stream = xobj as PdfStream;
  const dict = stream.dict;
  const subtype = dict.getName("Subtype", resolver)?.name;

  if (subtype !== "Image") {
    return null;
  }

  const width = dict.getNumber("Width", resolver)?.value;
  const height = dict.getNumber("Height", resolver)?.value;

  if (width !== undefined && height !== undefined) {
    return { width, height };
  }

  return null;
}

/**
 * Check if an XObject is a Form XObject.
 */
export function isFormXObject(
  xobjName: string,
  resources: PdfDict | undefined,
  resolver?: RefResolver,
): boolean {
  if (!resources) {
    return false;
  }

  const xobjects = resources.getDict("XObject", resolver);
  if (!xobjects) {
    return false;
  }

  const xobj = xobjects.get(xobjName, resolver);
  if (!xobj || xobj.type !== "stream") {
    return false;
  }

  const stream = xobj as PdfStream;
  const subtype = stream.dict.getName("Subtype", resolver)?.name;

  return subtype === "Form";
}
