/**
 * CompositeFont - Type0 composite font for CJK and Unicode text.
 *
 * Composite fonts (Type0) combine:
 * - A CMap (character code to CID mapping)
 * - One or more CIDFonts (the actual glyph data)
 * - Optional ToUnicode map (for text extraction)
 *
 * Font structure:
 * <<
 *   /Type /Font
 *   /Subtype /Type0
 *   /BaseFont /NotoSansCJK-Regular
 *   /Encoding /Identity-H  (or stream)
 *   /DescendantFonts [12 0 R]
 *   /ToUnicode 13 0 R
 * >>
 */

import type { RefResolver } from "#src/helpers/types.ts";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name.ts";
import type { PdfObject } from "#src/objects/pdf-object.ts";
import { PdfRef } from "#src/objects/pdf-ref.ts";
import { PdfStream } from "#src/objects/pdf-stream.ts";

import { CIDFont, parseCIDFont } from "./cid-font";
import { CMap, parseCMap } from "./cmap";
import type { FontDescriptor } from "./font-descriptor";
import { PdfFont } from "./pdf-font";
import type { ToUnicodeMap } from "./to-unicode";

/**
 * CompositeFont handles Type0 composite fonts (CJK, Unicode).
 */
export class CompositeFont extends PdfFont {
  /** Font subtype is always "Type0" */
  readonly subtype = "Type0" as const;

  /** Base font name */
  readonly baseFontName: string;

  /** CMap for encoding (character code to CID) */
  private readonly cmap: CMap;

  /** Descendant CIDFont (contains actual glyph metrics) */
  private readonly cidFont: CIDFont;

  /** ToUnicode map for text extraction */
  private readonly toUnicodeMap: ToUnicodeMap | null;

  constructor(options: {
    baseFontName: string;
    cmap: CMap;
    cidFont: CIDFont;
    toUnicodeMap?: ToUnicodeMap | null;
  }) {
    super();
    this.baseFontName = options.baseFontName;
    this.cmap = options.cmap;
    this.cidFont = options.cidFont;
    this.toUnicodeMap = options.toUnicodeMap ?? null;
  }

  /**
   * Get the font descriptor from the descendant CIDFont.
   */
  get descriptor(): FontDescriptor | null {
    return this.cidFont.descriptor;
  }

  /**
   * Get the CMap encoding.
   */
  getCMap(): CMap {
    return this.cmap;
  }

  /**
   * Get the descendant CIDFont.
   */
  getCIDFont(): CIDFont {
    return this.cidFont;
  }

  /**
   * Get the width of a character code in glyph units (1000 = 1 em).
   */
  getWidth(code: number): number {
    // Map character code to CID via CMap
    const cid = this.cmap.lookup(code);
    // Get width from CIDFont
    return this.cidFont.getWidth(cid);
  }

  /**
   * Encode text to character codes.
   */
  encodeText(text: string): number[] {
    return this.cmap.encode(text);
  }

  /**
   * Decode character code to Unicode string (for text extraction).
   */
  toUnicode(code: number): string {
    // Try ToUnicode map first (most accurate)
    if (this.toUnicodeMap?.has(code)) {
      // biome-ignore lint/style/noNonNullAssertion: checked with has(...)
      return this.toUnicodeMap.get(code)!;
    }

    // For Identity encoding, code is the Unicode value
    if (this.cmap.isIdentity) {
      // Handle surrogate pairs
      if (code >= 0xd800 && code <= 0xdbff) {
        // High surrogate - return as-is (incomplete)
        return String.fromCharCode(code);
      }

      if (code >= 0xdc00 && code <= 0xdfff) {
        // Low surrogate - return as-is (incomplete)
        return String.fromCharCode(code);
      }

      return String.fromCharCode(code);
    }

    // No mapping available
    return "";
  }

  /**
   * Check if text can be encoded with this font.
   */
  canEncode(text: string): boolean {
    return this.cmap.canEncode(text);
  }
}

/**
 * Parse CMap from encoding value.
 */
function parseCMapFromEncoding(
  encodingValue: PdfObject | undefined,
  options: {
    resolver?: RefResolver;
  },
): CMap {
  let encoding = encodingValue;

  if (encoding instanceof PdfRef && options.resolver) {
    encoding = options.resolver(encoding) ?? undefined;
  }

  // Predefined CMap (e.g., Identity-H)
  if (encoding instanceof PdfName && encoding.value) {
    return CMap.getPredefined(encoding.value) ?? CMap.identityH();
  }

  // Embedded CMap stream
  if (encoding instanceof PdfStream) {
    const data = encoding.getDecodedData();

    return data ? parseCMap(data) : CMap.identityH();
  }

  return CMap.identityH();
}

/**
 * Parse a CompositeFont from a PDF font dictionary.
 */
export function parseCompositeFont(
  dict: PdfDict,
  options: {
    resolver?: RefResolver;
    toUnicodeMap?: ToUnicodeMap | null;
  } = {},
): CompositeFont {
  const baseFontName = dict.getName("BaseFont", options.resolver)?.value ?? "Unknown";

  // Parse encoding (CMap)
  const cmap = parseCMapFromEncoding(dict.get("Encoding", options.resolver), options);

  // Parse DescendantFonts (should be array with one CIDFont)
  // DescendantFonts can be inline array or a ref to an array
  let cidFont: CIDFont;
  const descendants = dict.get("DescendantFonts", options.resolver);
  let descendantsArray: PdfArray | null = null;

  if (descendants instanceof PdfArray) {
    descendantsArray = descendants;
  }

  if (descendantsArray && descendantsArray.length > 0) {
    const firstDescendant = descendantsArray.at(0, options.resolver);

    if (firstDescendant instanceof PdfDict) {
      cidFont = parseCIDFont(firstDescendant, options);
    } else {
      cidFont = createDefaultCIDFont(baseFontName);
    }
  } else {
    cidFont = createDefaultCIDFont(baseFontName);
  }

  return new CompositeFont({
    baseFontName,
    cmap,
    cidFont,
    toUnicodeMap: options.toUnicodeMap,
  });
}

/**
 * Create a default CIDFont when parsing fails.
 */
function createDefaultCIDFont(baseFontName: string): CIDFont {
  return new CIDFont({
    subtype: "CIDFontType2",
    baseFontName,
    defaultWidth: 1000,
  });
}
