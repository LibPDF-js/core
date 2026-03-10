/**
 * Form font types for use in form fields.
 *
 * Supports two font types:
 * - EmbeddedFont: Full font with metrics and subsetting
 * - ExistingFont: Lightweight wrapper for fonts already in the PDF
 *
 * PDF Reference: Section 12.7.3.3 "Variable Text"
 */

import { type CIDFont, parseCIDFont } from "#src/fonts/cid-font";
import { EmbeddedFont } from "#src/fonts/embedded-font";
import { parseSimpleFont, type SimpleFont } from "#src/fonts/simple-font";
import {
  FONT_BASIC_METRICS,
  getStandard14DefaultWidth,
  getStandard14GlyphWidth,
  isStandard14Font,
} from "#src/fonts/standard-14";
import { parseToUnicode, type ToUnicodeMap } from "#src/fonts/to-unicode";
import type { RefResolver } from "#src/helpers/types";
import { unicodeToGlyphName } from "#src/helpers/unicode";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";

import type { ObjectRegistry } from "../object-registry";

function* iterateCodePoints(text: string): Generator<{ char: string; codePoint: number }> {
  for (const char of text) {
    const codePoint = char.codePointAt(0);

    if (codePoint !== undefined) {
      yield { char, codePoint };
    }
  }
}

/**
 * Union type for fonts usable in form fields.
 */
export type FormFont = EmbeddedFont | ExistingFont;

/**
 * Existing font from PDF's default resources.
 *
 * This is a lightweight wrapper for fonts already present in the PDF,
 * typically from the AcroForm's /DR (Default Resources) dictionary.
 *
 * Supports both simple fonts (Type1, TrueType) and CID fonts (Type0).
 * CID fonts use 2-byte character codes and are commonly used with
 * Identity-H/Identity-V encoding for CJK and Unicode text.
 */
export class ExistingFont {
  /** Font name as it appears in the PDF (e.g., "Helv", "ZaDb", "F0") */
  readonly name: string;

  /** Reference to font object in PDF (may be null for inline Standard 14 fonts) */
  readonly ref: PdfRef | null;

  /** Whether this is a CID-keyed font (Type0 with Identity-H/V encoding) */
  readonly isCIDFont: boolean;

  /** Underlying SimpleFont if resolved from PDF (for non-CID fonts) */
  private readonly simpleFont: SimpleFont | null;

  /** Underlying CIDFont if resolved from PDF (for CID fonts) */
  private readonly cidFont: CIDFont | null;

  /** Standard 14 font name if this maps to one (e.g., "Helvetica" for "Helv") */
  private readonly standardFontName: string | null;

  constructor(
    name: string,
    ref: PdfRef | null,
    simpleFont: SimpleFont | null = null,
    isCIDFont = false,
    cidFont: CIDFont | null = null,
  ) {
    this.name = name;
    this.ref = ref;
    this.simpleFont = simpleFont;
    this.isCIDFont = isCIDFont;
    this.cidFont = cidFont;

    // Map common form font names to Standard 14 fonts
    this.standardFontName = mapToStandardFont(name);
  }

  /**
   * Check whether this font can be safely used to generate an appearance for
   * the given text.
   */
  canUseForAppearance(text: string): boolean {
    if (this.isCIDFont) {
      if (!this.cidFont) {
        return false;
      }

      if (!this.cidFont.getEmbeddedProgram()) {
        return false;
      }

      for (const { codePoint } of iterateCodePoints(text)) {
        if (codePoint > 0xffff) {
          return false;
        }

        const charCode = this.cidFont.tryGetCharCodeForUnicode(codePoint);

        if (charCode === null || !this.cidFont.hasRenderableGlyphForCID(charCode)) {
          return false;
        }
      }

      return true;
    }

    if (!this.canEncode(text)) {
      return false;
    }

    if (this.simpleFont) {
      return true;
    }

    return this.standardFontName !== null;
  }

  /**
   * Check if font can encode the given text.
   *
   * CID fonts with Identity-H/V encoding can encode any BMP character.
   * Simple fonts are limited to their encoding (typically Latin-1).
   */
  canEncode(text: string): boolean {
    if (this.isCIDFont) {
      if (!this.cidFont) {
        return false;
      }

      if (!this.cidFont.getEmbeddedProgram()) {
        return false;
      }

      for (const { codePoint } of iterateCodePoints(text)) {
        if (codePoint > 0xffff) {
          return false;
        }

        if (this.cidFont.tryGetCharCodeForUnicode(codePoint) === null) {
          return false;
        }
      }

      return true;
    }

    if (this.simpleFont) {
      return this.simpleFont.canEncode(text);
    }

    // Standard 14 fallback: only Latin-1
    for (const char of text) {
      if (char.charCodeAt(0) > 255) {
        return false;
      }
    }

    return true;
  }

  /**
   * Encode text to character codes for this font.
   *
   * For CID fonts: returns 2-byte Unicode code points (Identity-H/V encoding).
   * For simple fonts: uses the font's encoding (WinAnsi, custom, etc.).
   */
  encodeText(text: string): number[] {
    if (this.simpleFont) {
      return this.simpleFont.encodeText(text);
    }

    // Simple ASCII encoding for Standard 14 fonts
    const codes: number[] = [];

    for (const char of text) {
      codes.push(char.charCodeAt(0));
    }

    return codes;
  }

  /**
   * Encode text as bytes for use in a PdfString.
   *
   * For CID fonts with Identity-H/V encoding, the character codes in the
   * PDF string are CIDs. With Identity CIDToGIDMap, CID = GID, so the
   * character code must equal the glyph ID in the font program.
   *
   * The encoding pipeline is:
   *   Unicode code point → GID (via font program cmap)
   *   → character code to write (= CID that maps to that GID)
   *
   * For Identity CIDToGIDMap: write GID directly (CID = GID)
   * For stream CIDToGIDMap: find CID where CIDToGIDMap[CID] = GID
   *
   * For simple fonts, produces single-byte codes.
   */
  encodeTextToBytes(text: string): Uint8Array {
    if (this.isCIDFont) {
      const chars = Array.from(iterateCodePoints(text));
      const bytes = new Uint8Array(chars.length * 2);

      for (let i = 0; i < chars.length; i++) {
        const codePoint = chars[i].codePoint;
        // Use CIDFont mapping if available, otherwise fall back to raw code point
        const charCode = this.cidFont ? this.cidFont.getCharCodeForUnicode(codePoint) : codePoint;
        bytes[i * 2] = (charCode >> 8) & 0xff;
        bytes[i * 2 + 1] = charCode & 0xff;
      }

      return bytes;
    }

    // Simple font: single-byte encoding
    const codes = this.encodeText(text);

    return new Uint8Array(codes);
  }

  /**
   * Get width of text in points at a given font size.
   */
  getTextWidth(text: string, fontSize: number): number {
    // CID font with parsed width data
    if (this.cidFont) {
      let totalWidth = 0;

      for (const { codePoint } of iterateCodePoints(text)) {
        // CIDFont.getWidth() expects a CID. For Identity-H, CID = character code.
        // Use getCharCodeForUnicode() to get the correct CID for width lookup.
        const cid = this.cidFont.getCharCodeForUnicode(codePoint);
        totalWidth += this.cidFont.getWidth(cid);
      }

      return (totalWidth * fontSize) / 1000;
    }

    if (this.simpleFont) {
      try {
        return this.simpleFont.getTextWidth(text, fontSize);
      } catch {
        // Fall through to approximation if font can't encode the text
      }
    }

    if (this.standardFontName) {
      let totalWidth = 0;

      for (const char of text) {
        const glyphName = unicodeToGlyphName(char.charCodeAt(0));
        const width = glyphName
          ? (getStandard14GlyphWidth(this.standardFontName, glyphName) ??
            getStandard14DefaultWidth(this.standardFontName))
          : getStandard14DefaultWidth(this.standardFontName);
        totalWidth += width;
      }

      return (totalWidth * fontSize) / 1000;
    }

    // Approximate for unknown fonts: 0.5 * fontSize per character
    return text.length * fontSize * 0.5;
  }

  /**
   * Get ascent in points at a given font size.
   */
  getAscent(fontSize: number): number {
    return this.getMetric("ascent", fontSize, 0.8);
  }

  /**
   * Get descent in points at a given font size (negative value).
   */
  getDescent(fontSize: number): number {
    return this.getMetric("descent", fontSize, -0.2);
  }

  /**
   * Get cap height in points at a given font size.
   */
  getCapHeight(fontSize: number): number {
    return this.getMetric("capHeight", fontSize, 0.7);
  }

  /**
   * Look up a font metric from the descriptor, Standard 14 tables, or a fallback ratio.
   */
  private getMetric(
    key: "ascent" | "descent" | "capHeight",
    fontSize: number,
    fallbackRatio: number,
  ): number {
    const descriptor = this.cidFont?.descriptor ?? this.simpleFont?.descriptor;

    if (descriptor) {
      return (descriptor[key] * fontSize) / 1000;
    }

    if (this.standardFontName) {
      const metrics = FONT_BASIC_METRICS[this.standardFontName];

      if (metrics) {
        return (metrics[key] * fontSize) / 1000;
      }
    }

    return fontSize * fallbackRatio;
  }
}

/**
 * Map common form font names to Standard 14 fonts.
 *
 * Returns the canonical Standard 14 name for common aliases (e.g., "Helv" → "Helvetica"),
 * or `null` if the name doesn't map to any Standard 14 font.
 */
export function mapToStandardFont(name: string): string | null {
  // Remove leading slash if present
  const cleanName = name.startsWith("/") ? name.slice(1) : name;

  // Common form font aliases
  const aliases: Record<string, string> = {
    Helv: "Helvetica",
    HeBo: "Helvetica-Bold",
    HeOb: "Helvetica-Oblique",
    HeBi: "Helvetica-BoldOblique",
    TiRo: "Times-Roman",
    TiBo: "Times-Bold",
    TiIt: "Times-Italic",
    TiBi: "Times-BoldItalic",
    Cour: "Courier",
    CoBo: "Courier-Bold",
    CoOb: "Courier-Oblique",
    CoBi: "Courier-BoldOblique",
    Symb: "Symbol",
    ZaDb: "ZapfDingbats",
  };

  if (aliases[cleanName]) {
    return aliases[cleanName];
  }

  if (isStandard14Font(cleanName)) {
    return cleanName;
  }

  return null;
}

/**
 * Parse an existing font from the PDF's resources.
 *
 * For simple fonts (Type1, TrueType): parses as SimpleFont for metrics.
 * For CID fonts (Type0): parses the DescendantFont's CIDFont for
 * accurate metrics and glyph widths, enabling proper 2-byte encoding.
 */
export function parseExistingFont(
  name: string,
  fontObj: PdfDict | PdfRef | null,
  registry: ObjectRegistry,
): ExistingFont {
  let ref: PdfRef | null = null;
  let simpleFont: SimpleFont | null = null;
  let cidFont: CIDFont | null = null;
  let isCIDFont = false;

  if (fontObj instanceof PdfRef) {
    ref = fontObj;

    // Use resolve() to handle fonts stored in object streams (where
    // getObject() returns null). resolve() caches the result so
    // subsequent getObject() calls will also succeed.
    const resolved = registry.resolve(fontObj);

    if (resolved instanceof PdfDict) {
      const resolver: RefResolver = r => registry.resolve(r);

      // Check if this is a CID-keyed font (Type0 with Identity encoding).
      const subtype = resolved.getName("Subtype", resolver)?.value;
      const encoding = resolved.getName("Encoding", resolver)?.value;
      const hasDescendantFonts = resolved.has("DescendantFonts");

      if (
        subtype === "Type0" ||
        hasDescendantFonts ||
        encoding === "Identity-H" ||
        encoding === "Identity-V"
      ) {
        isCIDFont = true;

        // Parse the DescendantFont for metrics and glyph widths.
        // Type0 fonts have a DescendantFonts array with exactly one CIDFont.
        try {
          cidFont = parseCIDFontFromDescendants(resolved, resolver);
        } catch {
          // Ignore parsing errors — we can still use the font
          // with approximate metrics
        }
      } else {
        // Parse as SimpleFont for accurate metrics
        try {
          simpleFont = parseSimpleFont(resolved, { resolver });
        } catch {
          // Ignore parsing errors for existing fonts
        }
      }
    }
  }

  return new ExistingFont(name, ref, simpleFont, isCIDFont, cidFont);
}

/**
 * Parse the CIDFont from a Type0 font's DescendantFonts array.
 */
function parseCIDFontFromDescendants(type0Dict: PdfDict, resolver: RefResolver): CIDFont | null {
  const descendants = type0Dict.getArray("DescendantFonts", resolver);

  if (!descendants || descendants.length === 0) {
    return null;
  }

  // Get the first (and only) descendant font
  let cidFontObj = descendants.at(0);

  if (cidFontObj instanceof PdfRef) {
    cidFontObj = resolver(cidFontObj) ?? undefined;
  }

  if (!(cidFontObj instanceof PdfDict)) {
    return null;
  }

  return parseCIDFont(cidFontObj, {
    resolver,
    toUnicodeMap: parseToUnicodeMap(type0Dict, resolver),
  });
}

function parseToUnicodeMap(type0Dict: PdfDict, resolver: RefResolver): ToUnicodeMap | null {
  const toUnicode = type0Dict.get("ToUnicode", resolver);

  if (!(toUnicode instanceof PdfStream)) {
    return null;
  }

  try {
    return parseToUnicode(toUnicode.getDecodedData());
  } catch {
    return null;
  }
}

/**
 * Check if a font is an EmbeddedFont.
 */
export function isEmbeddedFont(font: FormFont): font is EmbeddedFont {
  return font instanceof EmbeddedFont;
}

/**
 * Check if a font is an ExistingFont.
 */
export function isExistingFont(font: FormFont): font is ExistingFont {
  return font instanceof ExistingFont;
}

/**
 * Get the font name for use in DA strings.
 *
 * For EmbeddedFont: Returns a generated name like "F1" that will be
 * added to the form's default resources.
 *
 * For ExistingFont: Returns the existing font name from the PDF.
 */
export function getFormFontName(font: FormFont): string {
  if (isExistingFont(font)) {
    // Use existing name, ensure it starts with /
    return font.name.startsWith("/") ? font.name : `/${font.name}`;
  }

  // EmbeddedFont - use base font name
  // The actual resource name will be assigned during appearance generation
  return `/${font.baseFontName.replace(/[^a-zA-Z0-9]/g, "")}`;
}
