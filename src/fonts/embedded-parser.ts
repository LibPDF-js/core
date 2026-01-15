/**
 * EmbeddedParser - Parse embedded font programs from PDF FontDescriptor.
 *
 * PDFs can embed font programs in three locations:
 * - /FontFile: Type 1 font program (PFB format)
 * - /FontFile2: TrueType font program
 * - /FontFile3: CFF or OpenType font program (with /Subtype)
 */

import { parseCFF } from "#src/fontbox/cff/parser.ts";
import { parseTTF } from "#src/fontbox/ttf/parser.ts";
import { parsePfb } from "#src/fontbox/type1/pfb-parser.ts";
import type { PdfDict } from "#src/objects/pdf-dict.ts";
import type { PdfName } from "#src/objects/pdf-name.ts";
import { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";

import {
  CFFCIDFontProgram,
  CFFType1FontProgram,
  type FontProgram,
  TrueTypeFontProgram,
  Type1FontProgram,
} from "./font-program/index.ts";

/**
 * Options for parsing embedded font programs.
 */
export interface EmbeddedParserOptions {
  /**
   * Decode a stream object to its raw bytes.
   * The stream should be fully decoded (all filters applied).
   */
  decodeStream: (stream: unknown) => Uint8Array | null;

  /**
   * Resolve an indirect reference to its object.
   */
  resolveRef?: (ref: unknown) => unknown;
}

/**
 * Parse an embedded font program from a FontDescriptor dictionary.
 *
 * Tries FontFile2 (TrueType), FontFile3 (CFF/OpenType), then FontFile (Type1)
 * in that order, returning the first successfully parsed program.
 *
 * @param descriptor - The FontDescriptor dictionary
 * @param options - Options for decoding streams and resolving refs
 * @returns The parsed FontProgram, or null if no embedded font found
 */
export function parseEmbeddedProgram(
  descriptor: PdfDict,
  options: EmbeddedParserOptions,
): FontProgram | null {
  // Try FontFile2 first (TrueType) - most common
  const fontFile2Result = tryParseFontFile2(descriptor, options);

  if (fontFile2Result) {
    return fontFile2Result;
  }

  // Try FontFile3 (CFF or OpenType)
  const fontFile3Result = tryParseFontFile3(descriptor, options);

  if (fontFile3Result) {
    return fontFile3Result;
  }

  // Try FontFile (Type1)
  const fontFileResult = tryParseFontFile(descriptor, options);

  if (fontFileResult) {
    return fontFileResult;
  }

  return null;
}

/**
 * Try to parse a TrueType font from /FontFile2.
 */
function tryParseFontFile2(
  descriptor: PdfDict,
  options: EmbeddedParserOptions,
): FontProgram | null {
  const fontFile2 = resolveValue(descriptor.get("FontFile2"), options);

  if (!fontFile2) {
    return null;
  }

  const data = options.decodeStream(fontFile2);

  if (!data || data.length === 0) {
    return null;
  }

  try {
    const ttf = parseTTF(data, { isEmbedded: true });

    return new TrueTypeFontProgram(ttf, data);
  } catch (e) {
    // Log but don't throw - embedded fonts can be malformed
    console.warn("Failed to parse FontFile2 (TrueType):", e);

    return null;
  }
}

/**
 * Try to parse a CFF or OpenType font from /FontFile3.
 */
function tryParseFontFile3(
  descriptor: PdfDict,
  options: EmbeddedParserOptions,
): FontProgram | null {
  const fontFile3 = resolveValue(descriptor.get("FontFile3"), options);

  if (!fontFile3) {
    return null;
  }

  // FontFile3 should be a stream with a /Subtype
  const subtype = getStreamSubtype(fontFile3);
  const data = options.decodeStream(fontFile3);

  if (!data || data.length === 0) {
    return null;
  }

  try {
    if (subtype === "OpenType") {
      // OpenType font - parse as TTF (the CFF data is in the 'CFF ' table)
      const ttf = parseTTF(data, { isEmbedded: true });

      return new TrueTypeFontProgram(ttf, data);
    }

    if (subtype === "CIDFontType0C" || subtype === "Type1C") {
      // CFF font data
      const cffFonts = parseCFF(data);

      if (cffFonts.length === 0) {
        return null;
      }

      const cff = cffFonts[0];

      if (cff.isCIDFont) {
        return new CFFCIDFontProgram(cff, data);
      }

      return new CFFType1FontProgram(cff, data);
    }

    // Unknown subtype - try to auto-detect
    return tryAutoDetectFontFile3(data);
  } catch (e) {
    console.warn(`Failed to parse FontFile3 (${subtype}):`, e);

    return null;
  }
}

/**
 * Try to parse a Type1 font from /FontFile.
 */
function tryParseFontFile(descriptor: PdfDict, options: EmbeddedParserOptions): FontProgram | null {
  const fontFile = resolveValue(descriptor.get("FontFile"), options);

  if (!fontFile) {
    return null;
  }

  const data = options.decodeStream(fontFile);

  if (!data || data.length === 0) {
    return null;
  }

  try {
    const type1 = parsePfb(data);

    return new Type1FontProgram(type1, data);
  } catch (e) {
    console.warn("Failed to parse FontFile (Type1):", e);

    return null;
  }
}

/**
 * Try to auto-detect and parse FontFile3 when subtype is unknown.
 */
function tryAutoDetectFontFile3(data: Uint8Array): FontProgram | null {
  // Check for OpenType signature 'OTTO' (0x4F54544F)

  if (
    data.length >= 4 &&
    data[0] === 0x4f &&
    data[1] === 0x54 &&
    data[2] === 0x54 &&
    data[3] === 0x4f
  ) {
    try {
      const ttf = parseTTF(data, { isEmbedded: true });

      return new TrueTypeFontProgram(ttf, data);
    } catch {
      // Fall through to CFF
    }
  }

  // Check for TrueType signature (0x00010000)
  if (
    data.length >= 4 &&
    data[0] === 0x00 &&
    data[1] === 0x01 &&
    data[2] === 0x00 &&
    data[3] === 0x00
  ) {
    try {
      const ttf = parseTTF(data, { isEmbedded: true });

      return new TrueTypeFontProgram(ttf, data);
    } catch {
      // Not a TTF, fall through
    }
  }

  // Try CFF (starts with major version, minor version, header size, offset size)
  if (data.length >= 4 && data[0] === 1 && data[1] === 0) {
    try {
      const cffFonts = parseCFF(data);

      if (cffFonts.length > 0) {
        const cff = cffFonts[0];

        if (cff.isCIDFont) {
          return new CFFCIDFontProgram(cff, data);
        }

        return new CFFType1FontProgram(cff, data);
      }
    } catch {
      // Not a CFF
    }
  }

  return null;
}

/**
 * Get the /Subtype from a stream dictionary.
 */
function getStreamSubtype(stream: unknown): string | undefined {
  if (stream && stream instanceof PdfStream) {
    const subtype = stream.get("Subtype") as PdfName | undefined;

    return subtype?.value;
  }

  return undefined;
}

/**
 * Resolve a value through indirect references.
 */
function resolveValue(value: unknown, options: EmbeddedParserOptions): unknown {
  if (!value) {
    return null;
  }

  // If it's a reference and we have a resolver, resolve it
  if (options.resolveRef && value instanceof PdfRef) {
    return options.resolveRef(value);
  }

  return value;
}

/**
 * Parse a font program directly from bytes.
 *
 * This is useful when you have raw font data (e.g., from a file)
 * rather than from an embedded PDF stream.
 *
 * @param data - Raw font data (TTF, OTF, CFF, or PFB)
 * @returns The parsed FontProgram
 * @throws {Error} if the font format is not recognized
 */
export function parseFontProgram(data: Uint8Array): FontProgram {
  if (data.length < 4) {
    throw new Error("Font data too short");
  }

  // Check for OpenType/TrueType signatures
  const sig = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];

  // 'OTTO' = OpenType with CFF
  if (sig === 0x4f54544f) {
    const ttf = parseTTF(data);

    return new TrueTypeFontProgram(ttf, data);
  }

  // TrueType signature (0x00010000 or 'true')
  if (sig === 0x00010000 || sig === 0x74727565) {
    const ttf = parseTTF(data);

    return new TrueTypeFontProgram(ttf, data);
  }

  // TTC (TrueType Collection) - not supported yet
  if (sig === 0x74746366) {
    throw new Error("TrueType Collection (.ttc) files are not supported");
  }

  // PFB (Type1 binary)
  if (data[0] === 0x80 && data[1] === 0x01) {
    const type1 = parsePfb(data);

    return new Type1FontProgram(type1, data);
  }

  // CFF (major version 1)
  if (data[0] === 1 && data[1] === 0) {
    const cffFonts = parseCFF(data);

    if (cffFonts.length === 0) {
      throw new Error("CFF font contains no fonts");
    }

    const cff = cffFonts[0];

    if (cff.isCIDFont) {
      return new CFFCIDFontProgram(cff, data);
    }

    return new CFFType1FontProgram(cff, data);
  }

  // PFA (Type1 ASCII) - starts with '%!'
  // Note: PFA files need to be converted to segment format first
  // This is a simplified handling - proper implementation would parse PFA

  if (data[0] === 0x25 && data[1] === 0x21) {
    // Try to parse as PFB anyway - some "PFA" files are actually PFB
    try {
      const type1 = parsePfb(data);

      return new Type1FontProgram(type1, data);
    } catch {
      throw new Error("PFA format Type 1 fonts are not directly supported. Convert to PFB first.");
    }
  }

  throw new Error("Unrecognized font format");
}
