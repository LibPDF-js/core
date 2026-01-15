/**
 * FontEmbedder - Creates PDF objects for embedding fonts.
 *
 * Generates the complete PDF structure for an embedded font:
 * - Type0 (composite font) dictionary
 * - CIDFont dictionary (CIDFontType2)
 * - FontDescriptor dictionary
 * - Font file stream (subsetted TTF)
 * - ToUnicode CMap stream
 */

import { CFFSubsetter } from "#src/fontbox/cff/subsetter.ts";
import { TTFSubsetter } from "#src/fontbox/ttf/subsetter.ts";
import { PdfArray } from "#src/objects/pdf-array.ts";
import { PdfDict } from "#src/objects/pdf-dict.ts";
import { PdfName } from "#src/objects/pdf-name.ts";
import { PdfNumber } from "#src/objects/pdf-number.ts";
import type { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";
import { PdfString } from "#src/objects/pdf-string.ts";

import type { EmbeddedFont } from "./embedded-font.ts";
import type {
  CFFCIDFontProgram,
  CFFType1FontProgram,
  FontProgram,
  TrueTypeFontProgram,
} from "./font-program/index.ts";
import { buildToUnicodeCMapFromGids } from "./to-unicode-builder.ts";
import {
  buildWidthsArrayFromGids,
  optimizeWidthsArray,
  widthEntriesToPdfArray,
} from "./widths-builder.ts";

/**
 * Unicode ranges for full font embedding.
 *
 * We enumerate these ranges to find which glyphs the font supports.
 * Ranges are kept small to avoid performance issues. For fonts with
 * CJK/Hangul support, consider using subset embedding instead.
 */
const FULL_EMBED_UNICODE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x007f], // Basic Latin (includes control chars for completeness)
  [0x0080, 0x00ff], // Latin-1 Supplement
  [0x0100, 0x017f], // Latin Extended-A
  [0x0180, 0x024f], // Latin Extended-B
  [0x0250, 0x02af], // IPA Extensions
  [0x02b0, 0x02ff], // Spacing Modifier Letters
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x0370, 0x03ff], // Greek and Coptic
  [0x0400, 0x04ff], // Cyrillic
  [0x0500, 0x052f], // Cyrillic Supplement
  [0x1e00, 0x1eff], // Latin Extended Additional
  [0x2000, 0x206f], // General Punctuation
  [0x2070, 0x209f], // Superscripts and Subscripts
  [0x20a0, 0x20cf], // Currency Symbols
  [0x2100, 0x214f], // Letterlike Symbols
  [0x2150, 0x218f], // Number Forms
  [0x2190, 0x21ff], // Arrows
  [0x2200, 0x22ff], // Mathematical Operators
  [0x2300, 0x23ff], // Miscellaneous Technical
  [0x2500, 0x257f], // Box Drawing
  [0x25a0, 0x25ff], // Geometric Shapes
  [0x2600, 0x26ff], // Miscellaneous Symbols
  [0xfb00, 0xfb06], // Alphabetic Presentation Forms (ligatures only)
  [0xfeff, 0xfeff], // BOM
  [0xfffd, 0xfffd], // Replacement character
];

/**
 * Result of font embedding - all PDF objects that need to be registered.
 */
export interface FontEmbedResult {
  /** The main Type0 font dictionary (reference this from page resources) */
  type0Dict: PdfDict;

  /** The CIDFont dictionary */
  cidFontDict: PdfDict;

  /** The FontDescriptor dictionary */
  descriptorDict: PdfDict;

  /** The font file stream (subsetted font data) */
  fontStream: PdfStream;

  /** The ToUnicode CMap stream */
  toUnicodeStream: PdfStream;

  /** Key to use for font file reference in FontDescriptor (FontFile2 for TTF, FontFile3 for CFF) */
  fontFileKey: "FontFile2" | "FontFile3";

  /** CIDToGIDMap stream (only for subsetted TrueType fonts) */
  cidToGidMapStream?: PdfStream;
}

/**
 * Options for embedding.
 */
export interface EmbedOptions {
  /** Subset tag (6 uppercase letters). If not provided, a random one is generated. */
  subsetTag?: string;
}

/**
 * Generate a random 6-character subset tag (uppercase letters).
 */
export function generateSubsetTag(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let tag = "";

  for (let i = 0; i < 6; i++) {
    tag += chars[Math.floor(Math.random() * chars.length)];
  }

  return tag;
}

/**
 * Create PDF objects for embedding a font with subsetting.
 *
 * This function takes an EmbeddedFont that has been used to encode text
 * (tracking glyph usage) and creates all the PDF objects needed to embed it.
 * Only the glyphs that were actually used are included in the font.
 *
 * @param font - The EmbeddedFont with tracked glyph usage
 * @param options - Embedding options
 * @returns All PDF objects that need to be registered
 */
export async function createFontObjects(
  font: EmbeddedFont,
  options: EmbedOptions = {},
): Promise<FontEmbedResult> {
  const program = font.program;

  // Generate or use provided subset tag
  const subsetTag = options.subsetTag ?? generateSubsetTag();
  font.setSubsetTag(subsetTag);

  const fontName = `${subsetTag}+${program.postScriptName ?? "Unknown"}`;

  // Get GID to code point mapping
  // Content stream contains original GIDs (before subsetting)
  // - /W array must be keyed by original GID
  // - ToUnicode must map original GID → Unicode
  const gidToCodePoint = font.getGidToCodePointMap();

  // 1. Subset the font
  const subsetResult = await subsetFont(
    program,
    font.getUsedGlyphIds(),
    font.getCodePointToGidMap(),
  );

  // 2. Build ToUnicode CMap (maps original GID → Unicode for text extraction)
  const toUnicodeData = buildToUnicodeCMapFromGids(gidToCodePoint);

  // 3. Build /W widths array (keyed by original GID)
  const widthsArray = widthEntriesToPdfArray(buildWidthsArrayFromGids(gidToCodePoint, program));

  // 4. Create font stream
  const fontStreamDict = new PdfDict();

  if (subsetResult.fontFileKey === "FontFile2") {
    // TrueType: Length1 = uncompressed length
    fontStreamDict.set("Length1", PdfNumber.of(subsetResult.data.length));
  } else if (subsetResult.fontFileSubtype) {
    // CFF: Subtype indicates format
    fontStreamDict.set("Subtype", PdfName.of(subsetResult.fontFileSubtype));
  }

  const fontStream = new PdfStream(fontStreamDict, subsetResult.data);

  // 5. Create ToUnicode stream
  const toUnicodeStream = new PdfStream(new PdfDict(), toUnicodeData);

  // 6. Create FontDescriptor
  const descriptorDict = createFontDescriptor(fontName, program);

  // 7. Create CIDToGIDMap stream if we have a GID mapping (subsetted TTF)
  let cidToGidMapStream: PdfStream | undefined;

  if (subsetResult.oldToNewGidMap && subsetResult.fontFileKey === "FontFile2") {
    cidToGidMapStream = buildCidToGidMapStream(subsetResult.oldToNewGidMap);
  }

  // 8. Create CIDFont dictionary
  const cidFontSubtype = subsetResult.fontFileKey === "FontFile2" ? "CIDFontType2" : "CIDFontType0";
  // Pass flag to indicate we'll use a CIDToGIDMap stream instead of /Identity
  const cidFontDict = createCIDFontDict(fontName, widthsArray, cidFontSubtype, !!cidToGidMapStream);

  // 9. Create Type0 dictionary
  const type0Dict = createType0Dict(fontName);

  return {
    type0Dict,
    cidFontDict,
    descriptorDict,
    fontStream,
    toUnicodeStream,
    fontFileKey: subsetResult.fontFileKey,
    cidToGidMapStream,
  };
}

/**
 * Create PDF objects for embedding a font without subsetting.
 *
 * Embeds the complete font program. Use this when:
 * - The font is used in form fields (users may type any character)
 * - You want the full font for maximum compatibility
 *
 * @param font - The EmbeddedFont
 * @returns All PDF objects that need to be registered
 */
export async function createFontObjectsFull(font: EmbeddedFont): Promise<FontEmbedResult> {
  const program = font.program;

  // Full embedding - no subset tag
  const fontName = program.postScriptName ?? "Unknown";

  // Get font data type for the correct embedding approach
  const fontTypeResult = getFontFileType(program);

  // For full embedding, build a complete width array for all glyphs
  // We need to enumerate all code points the font supports
  const widthsArray = buildFullWidthsArray(program);

  // Build ToUnicode CMap for the full font
  const toUnicodeData = buildFullToUnicodeCMap(program);

  // Create font stream with full font data
  const fontStreamDict = new PdfDict();

  if (fontTypeResult.fontFileKey === "FontFile2") {
    fontStreamDict.set("Length1", PdfNumber.of(program.getData().length));
  } else if (fontTypeResult.fontFileSubtype) {
    fontStreamDict.set("Subtype", PdfName.of(fontTypeResult.fontFileSubtype));
  }

  const fontStream = new PdfStream(fontStreamDict, program.getData());

  // Create ToUnicode stream
  const toUnicodeStream = new PdfStream(new PdfDict(), toUnicodeData);

  // Create FontDescriptor
  const descriptorDict = createFontDescriptor(fontName, program);

  // Create CIDFont dictionary
  const cidFontSubtype =
    fontTypeResult.fontFileKey === "FontFile2" ? "CIDFontType2" : "CIDFontType0";
  const cidFontDict = createCIDFontDict(fontName, widthsArray, cidFontSubtype);

  // Create Type0 dictionary
  const type0Dict = createType0Dict(fontName);

  return {
    type0Dict,
    cidFontDict,
    descriptorDict,
    fontStream,
    toUnicodeStream,
    fontFileKey: fontTypeResult.fontFileKey,
  };
}

/**
 * Function to register an object, returning its reference.
 */
export type RegisterFunction = (obj: PdfDict | PdfStream) => PdfRef;

/**
 * Function to register an object at a pre-allocated reference.
 */
export type RegisterAtFunction = (ref: PdfRef, obj: PdfDict | PdfStream) => void;

/**
 * Register all font objects with the PDF and link them together.
 *
 * @param result - The font embedding result
 * @param register - Function to register objects (from PDF.register)
 * @param preAllocatedRef - Optional pre-allocated ref for the Type0 font
 * @param registerAt - Optional function to register at pre-allocated ref
 * @returns The reference to the Type0 font dictionary
 */
export function registerFontObjects(
  result: FontEmbedResult,
  register: RegisterFunction,
  preAllocatedRef?: PdfRef,
  registerAt?: RegisterAtFunction,
): PdfRef {
  // Register in dependency order (bottom-up)

  // 1. Font stream
  const fontStreamRef = register(result.fontStream);

  // 2. ToUnicode stream
  const toUnicodeRef = register(result.toUnicodeStream);

  // 3. CIDToGIDMap stream (if present, for subsetted TTF)
  let cidToGidMapRef: PdfRef | undefined;

  if (result.cidToGidMapStream) {
    cidToGidMapRef = register(result.cidToGidMapStream);
  }

  // 4. FontDescriptor (references font stream)
  // Use FontFile2 for TrueType, FontFile3 for CFF
  result.descriptorDict.set(result.fontFileKey, fontStreamRef);
  const descriptorRef = register(result.descriptorDict);

  // 5. CIDFont (references descriptor and optionally CIDToGIDMap)
  result.cidFontDict.set("FontDescriptor", descriptorRef);

  if (cidToGidMapRef) {
    result.cidFontDict.set("CIDToGIDMap", cidToGidMapRef);
  }

  const cidFontRef = register(result.cidFontDict);

  // 6. Type0 font (references CIDFont and ToUnicode)
  result.type0Dict.set("DescendantFonts", new PdfArray([cidFontRef]));
  result.type0Dict.set("ToUnicode", toUnicodeRef);

  // If we have a pre-allocated ref, register at that ref
  if (preAllocatedRef && registerAt) {
    registerAt(preAllocatedRef, result.type0Dict);

    return preAllocatedRef;
  }

  // Otherwise register normally
  return register(result.type0Dict);
}

/**
 * Result of font subsetting.
 */
interface SubsetResult {
  data: Uint8Array;
  /** Font file key: FontFile2 for TTF, FontFile3 for CFF */
  fontFileKey: "FontFile2" | "FontFile3";
  /** Subtype for FontFile3 (CIDFontType0C) */
  fontFileSubtype?: string;
  /** Mapping from old GID to new GID (for CIDToGIDMap stream) */
  oldToNewGidMap?: Map<number, number>;
}

/**
 * Subset the font to only include the used glyphs.
 *
 * @param program - The font program
 * @param usedGlyphIds - GIDs to include
 * @param usedCodePoints - Code points that were used (for TTF subsetter)
 */
async function subsetFont(
  program: FontProgram,
  usedGlyphIds: number[],
  usedCodePoints: Map<number, number>,
): Promise<SubsetResult> {
  // CFF fonts (standalone or OTF with CFF outlines)
  if (program.type === "cff" || program.type === "cff-cid") {
    const cffProgram = program as CFFType1FontProgram | CFFCIDFontProgram;
    const subsetter = new CFFSubsetter(cffProgram.font);

    for (const gid of usedGlyphIds) {
      subsetter.addGlyph(gid);
    }

    return {
      data: subsetter.write(),
      fontFileKey: "FontFile3",
      fontFileSubtype: "CIDFontType0C",
    };
  }

  // TrueType fonts
  if (program.type === "truetype") {
    const ttf = (program as TrueTypeFontProgram).font;

    // Check if the font has a glyf table (CFF-based OTF fonts don't have one)
    if (!ttf.getTableBytes("glyf")) {
      // This is an OTF font with CFF outlines - need CFF subsetter
      // But we parsed it as TrueType, so we don't have the CFF data easily
      // Return the original font data for now
      return {
        data: program.getData(),
        fontFileKey: "FontFile3",
        fontFileSubtype: "OpenType",
      };
    }

    // Create TTF subsetter with explicit table filter
    // Exclude variable font tables (gvar, fvar, avar, STAT, HVAR, etc.)
    // as PDF doesn't support variable fonts - we embed a single instance
    const essentialTables = [
      "cmap",
      "glyf",
      "head",
      "hhea",
      "hmtx",
      "loca",
      "maxp",
      "name",
      "post",
      "OS/2",
      "cvt ",
      "fpgm",
      "prep",
      "gasp",
    ];
    const subsetter = new TTFSubsetter(ttf, { keepTables: essentialTables });

    // Add used code points directly (much faster than reverse GID lookup)
    for (const codePoint of usedCodePoints.keys()) {
      subsetter.add(codePoint);
    }

    // Get the GID mapping before writing (write() may modify internal state)
    const oldToNewGidMap = subsetter.getOldToNewGIDMap();

    return {
      data: await subsetter.write(),
      fontFileKey: "FontFile2",
      oldToNewGidMap,
    };
  }

  // Type1 fonts - no subsetting implemented yet
  return {
    data: program.getData(),
    fontFileKey: "FontFile3",
    fontFileSubtype: "Type1C",
  };
}

/**
 * Get font file type without subsetting.
 */
function getFontFileType(program: FontProgram): {
  fontFileKey: "FontFile2" | "FontFile3";
  fontFileSubtype?: string;
} {
  if (program.type === "cff" || program.type === "cff-cid") {
    return { fontFileKey: "FontFile3", fontFileSubtype: "CIDFontType0C" };
  }

  if (program.type === "truetype") {
    const ttf = (program as TrueTypeFontProgram).font;

    if (!ttf.getTableBytes("glyf")) {
      return { fontFileKey: "FontFile3", fontFileSubtype: "OpenType" };
    }

    return { fontFileKey: "FontFile2" };
  }

  return { fontFileKey: "FontFile3", fontFileSubtype: "Type1C" };
}

/**
 * Build a complete /W widths array for full font embedding.
 *
 * With CIDToGIDMap /Identity, the content stream contains GIDs.
 * Therefore the /W array must be keyed by GID.
 *
 * We enumerate common Unicode ranges to find which GIDs are supported,
 * then build the widths array keyed by GID.
 */
function buildFullWidthsArray(program: FontProgram): PdfArray {
  const scale = 1000 / program.unitsPerEm;

  // Collect all GIDs and their widths
  // Use a Map to handle multiple code points mapping to the same GID
  const gidWidths = new Map<number, number>();

  // Enumerate common Unicode ranges
  const ranges = FULL_EMBED_UNICODE_RANGES;

  for (const [start, end] of ranges) {
    for (let cp = start; cp <= end; cp++) {
      const gid = program.getGlyphId(cp);

      // Skip unmapped code points (gid === 0 is .notdef, except for cp 0)
      if (gid === 0 && cp !== 0) {
        continue;
      }

      // Skip if we already have this GID
      if (gidWidths.has(gid)) {
        continue;
      }

      const width = program.getAdvanceWidth(gid);

      // Skip if width is invalid (NaN or negative)
      if (!Number.isFinite(width) || width < 0) {
        continue;
      }

      const scaledWidth = Math.round(width * scale);
      gidWidths.set(gid, scaledWidth);
    }
  }

  // Use optimizeWidthsArray to build efficient representation, then convert to PdfArray
  const entries = optimizeWidthsArray(gidWidths);

  return widthEntriesToPdfArray(entries);
}

/**
 * Build a ToUnicode CMap covering all glyphs in the font.
 */
function buildFullToUnicodeCMap(program: FontProgram): Uint8Array {
  // Build a gidToCodePoint map for all supported code points
  // With CIDToGIDMap /Identity, content stream contains GIDs
  // ToUnicode maps GID → Unicode code point
  const gidToCodePoint = new Map<number, number>();

  for (const [start, end] of FULL_EMBED_UNICODE_RANGES) {
    for (let cp = start; cp <= end; cp++) {
      const gid = program.getGlyphId(cp);

      if (gid !== 0 || cp === 0) {
        // Map GID → code point (first code point wins if multiple map to same GID)
        if (!gidToCodePoint.has(gid)) {
          gidToCodePoint.set(gid, cp);
        }
      }
    }
  }

  return buildToUnicodeCMapFromGids(gidToCodePoint);
}

/**
 * Build a CIDToGIDMap stream for subsetted TrueType fonts.
 *
 * The CIDToGIDMap maps CIDs (which are the original GIDs in the content stream)
 * to the new GIDs in the subsetted font.
 *
 * Format: Array of 2-byte big-endian integers, one per CID from 0 to maxCID.
 * Each entry is the new GID for that CID.
 */
function buildCidToGidMapStream(oldToNewGidMap: Map<number, number>): PdfStream {
  // Find the maximum old GID (CID) we need to map
  const maxOldGid = Math.max(...oldToNewGidMap.keys());

  // Create array of 2-byte entries (one per CID from 0 to maxOldGid)
  const data = new Uint8Array((maxOldGid + 1) * 2);
  const view = new DataView(data.buffer);

  // Initialize all entries to 0 (maps to .notdef)
  // Then fill in the actual mappings
  for (const [oldGid, newGid] of oldToNewGidMap) {
    view.setUint16(oldGid * 2, newGid);
  }

  return new PdfStream(new PdfDict(), data);
}

/**
 * Create the FontDescriptor dictionary.
 *
 * Note: FontFile2/FontFile3 is set during registration, not here.
 */
function createFontDescriptor(fontName: string, program: FontProgram): PdfDict {
  const scale = 1000 / program.unitsPerEm;
  const bbox = program.bbox;

  return PdfDict.of({
    Type: PdfName.of("FontDescriptor"),
    FontName: PdfName.of(fontName),
    Flags: PdfNumber.of(computeFlags(program)),
    FontBBox: new PdfArray([
      PdfNumber.of(Math.round(bbox[0] * scale)),
      PdfNumber.of(Math.round(bbox[1] * scale)),
      PdfNumber.of(Math.round(bbox[2] * scale)),
      PdfNumber.of(Math.round(bbox[3] * scale)),
    ]),
    ItalicAngle: PdfNumber.of(program.italicAngle),
    Ascent: PdfNumber.of(Math.round(program.ascent * scale)),
    Descent: PdfNumber.of(Math.round(program.descent * scale)),
    CapHeight: PdfNumber.of(Math.round(program.capHeight * scale)),
    StemV: PdfNumber.of(program.stemV),
    // FontFile2 or FontFile3 will be set when registering
  });
}

/**
 * Create the CIDFont dictionary.
 *
 * @param fontName - The font name
 * @param widthsArray - The /W array
 * @param subtype - CIDFontType0 or CIDFontType2
 * @param hasCidToGidMapStream - If true, CIDToGIDMap will be set to a stream reference during registration
 */
function createCIDFontDict(
  fontName: string,
  widthsArray: PdfArray,
  subtype: "CIDFontType0" | "CIDFontType2" = "CIDFontType2",
  hasCidToGidMapStream = false,
): PdfDict {
  const dict = PdfDict.of({
    Type: PdfName.of("Font"),
    Subtype: PdfName.of(subtype),
    BaseFont: PdfName.of(fontName),
    CIDSystemInfo: PdfDict.of({
      Registry: PdfString.fromString("Adobe"),
      Ordering: PdfString.fromString("Identity"),
      Supplement: PdfNumber.of(0),
    }),
    // FontDescriptor will be set when registering
  });

  // CIDToGIDMap only applies to CIDFontType2 (TrueType-based)
  // If we have a CIDToGIDMap stream, it will be set during registration
  if (subtype === "CIDFontType2" && !hasCidToGidMapStream) {
    dict.set("CIDToGIDMap", PdfName.of("Identity"));
  }

  // Set the /W widths array
  dict.set("W", widthsArray);

  return dict;
}

/**
 * Create the Type0 font dictionary.
 */
function createType0Dict(fontName: string): PdfDict {
  return PdfDict.of({
    Type: PdfName.of("Font"),
    Subtype: PdfName.of("Type0"),
    BaseFont: PdfName.of(fontName),
    Encoding: PdfName.of("Identity-H"),
    // DescendantFonts and ToUnicode will be set when registering
  });
}

/**
 * Compute font flags for the descriptor.
 */
function computeFlags(program: FontProgram): number {
  let flags = 0;

  // Flag 1: FixedPitch
  if (program.isFixedPitch) {
    flags |= 1 << 0;
  }

  // Flag 3: Symbolic (use if not Latin)
  // For embedded fonts, mark as symbolic (safer)
  flags |= 1 << 2;

  // Flag 7: Italic
  if (program.italicAngle !== 0) {
    flags |= 1 << 6;
  }

  return flags;
}
