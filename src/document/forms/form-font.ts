/**
 * Form font types for use in form fields.
 *
 * Supports two font types:
 * - EmbeddedFont: Full font with metrics and subsetting
 * - ExistingFont: Lightweight wrapper for fonts already in the PDF
 *
 * PDF Reference: Section 12.7.3.3 "Variable Text"
 */

import type { EmbeddedFont } from "#src/fonts/embedded-font";
import { parseSimpleFont, type SimpleFont } from "#src/fonts/simple-font";
import {
  FONT_BASIC_METRICS,
  getStandard14DefaultWidth,
  getStandard14GlyphWidth,
  isStandard14Font,
} from "#src/fonts/standard-14";
import { unicodeToGlyphName } from "#src/helpers/unicode";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import type { ObjectRegistry } from "../object-registry";

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
 * Provides limited metrics based on Standard 14 font data for common fonts.
 */
export class ExistingFont {
  /** Font name as it appears in the PDF (e.g., "Helv", "ZaDb") */
  readonly name: string;

  /** Reference to font object in PDF (may be null for inline Standard 14 fonts) */
  readonly ref: PdfRef | null;

  /** Underlying SimpleFont if resolved from PDF */
  private readonly simpleFont: SimpleFont | null;

  /** Standard 14 font name if this maps to one (e.g., "Helvetica" for "Helv") */
  private readonly standardFontName: string | null;

  constructor(name: string, ref: PdfRef | null, simpleFont: SimpleFont | null = null) {
    this.name = name;
    this.ref = ref;
    this.simpleFont = simpleFont;

    // Map common form font names to Standard 14 fonts
    this.standardFontName = mapToStandardFont(name);
  }

  /**
   * Check if font can encode the given text.
   *
   * For existing fonts, this is always true for ASCII text.
   * For non-ASCII, returns false (can't verify without full font data).
   */
  canEncode(text: string): boolean {
    if (this.simpleFont) {
      return this.simpleFont.canEncode(text);
    }

    // For Standard 14 fonts, only ASCII is safe
    for (const char of text) {
      const code = char.charCodeAt(0);

      if (code > 255) {
        return false;
      }
    }

    return true;
  }

  /**
   * Encode text to character codes for this font.
   *
   * For existing fonts, uses WinAnsi encoding (0-255).
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
   * Get width of text in points at a given font size.
   */
  getTextWidth(text: string, fontSize: number): number {
    if (this.simpleFont) {
      return this.simpleFont.getTextWidth(text, fontSize);
    }

    if (!this.standardFontName) {
      // Approximate for unknown fonts: 0.5 * fontSize per character
      return text.length * fontSize * 0.5;
    }

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

  /**
   * Get ascent in points at a given font size.
   */
  getAscent(fontSize: number): number {
    if (this.simpleFont?.descriptor) {
      return (this.simpleFont.descriptor.ascent * fontSize) / 1000;
    }

    if (this.standardFontName) {
      const metrics = FONT_BASIC_METRICS[this.standardFontName];

      if (metrics) {
        return (metrics.ascent * fontSize) / 1000;
      }
    }

    return fontSize * 0.8;
  }

  /**
   * Get descent in points at a given font size (negative value).
   */
  getDescent(fontSize: number): number {
    if (this.simpleFont?.descriptor) {
      return (this.simpleFont.descriptor.descent * fontSize) / 1000;
    }

    if (this.standardFontName) {
      const metrics = FONT_BASIC_METRICS[this.standardFontName];

      if (metrics) {
        return (metrics.descent * fontSize) / 1000;
      }
    }

    return -fontSize * 0.2;
  }

  /**
   * Get cap height in points at a given font size.
   */
  getCapHeight(fontSize: number): number {
    if (this.simpleFont?.descriptor) {
      return (this.simpleFont.descriptor.capHeight * fontSize) / 1000;
    }

    if (this.standardFontName) {
      const metrics = FONT_BASIC_METRICS[this.standardFontName];

      if (metrics) {
        return (metrics.capHeight * fontSize) / 1000;
      }
    }

    return fontSize * 0.7;
  }
}

/**
 * Map common form font names to Standard 14 fonts.
 */
function mapToStandardFont(name: string): string | null {
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
 */
export function parseExistingFont(
  name: string,
  fontObj: PdfDict | PdfRef | null,
  registry: ObjectRegistry,
): ExistingFont {
  let ref: PdfRef | null = null;
  let simpleFont: SimpleFont | null = null;

  if (fontObj?.type === "ref") {
    ref = fontObj;
    const resolved = registry.getObject(fontObj);

    if (resolved?.type === "dict") {
      // Parse as SimpleFont for accurate metrics
      try {
        const resolveRef = (r: unknown) => {
          if (r instanceof PdfRef) {
            const obj = registry.getObject(r);

            if (obj instanceof PdfDict || obj instanceof PdfArray || obj instanceof PdfStream) {
              return obj;
            }
          }

          return null;
        };

        simpleFont = parseSimpleFont(resolved, { resolveRef });
      } catch (err) {
        console.warn(err);
        // Ignore parsing errors for existing fonts
      }
    }
  }

  return new ExistingFont(name, ref, simpleFont);
}

/**
 * Check if a font is an EmbeddedFont.
 */
export function isEmbeddedFont(font: FormFont): font is EmbeddedFont {
  return "encodeText" in font && "getUsedGlyphIds" in font;
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
