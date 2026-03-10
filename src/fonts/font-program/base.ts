/**
 * FontProgram - Interface bridging PDF fonts to fontbox font parsers.
 *
 * This provides a unified interface for accessing font data regardless
 * of the underlying font format (TrueType, CFF, Type1).
 */

/**
 * Font program types that can be embedded in PDFs.
 */
export type FontProgramType = "truetype" | "cff" | "cff-cid" | "type1";

/**
 * Common interface for all font program types.
 *
 * Provides access to metrics and glyph mapping without needing
 * to know the underlying font format.
 */
export interface FontProgram {
  /** Type of font program */
  readonly type: FontProgramType;

  /** Number of glyphs in the font */
  readonly numGlyphs: number;

  /** Units per em (typically 1000 for PostScript, 2048 for TrueType) */
  readonly unitsPerEm: number;

  /** Font bounding box [xMin, yMin, xMax, yMax] */
  readonly bbox: readonly [number, number, number, number];

  /** PostScript name of the font */
  readonly postScriptName: string | undefined;

  /** Family name */
  readonly familyName: string | undefined;

  /** Whether font is fixed-pitch (monospace) */
  readonly isFixedPitch: boolean;

  /** Italic angle in degrees */
  readonly italicAngle: number;

  /** Ascent in font units */
  readonly ascent: number;

  /** Descent in font units (typically negative) */
  readonly descent: number;

  /** Cap height in font units */
  readonly capHeight: number;

  /** x-height in font units */
  readonly xHeight: number;

  /** Stem vertical width (for hinting) */
  readonly stemV: number;

  /**
   * Get glyph ID for a Unicode code point.
   * Returns 0 (.notdef) if the character is not in the font.
   */
  getGlyphId(codePoint: number): number;

  /**
   * Get advance width for a glyph ID in font units.
   */
  getAdvanceWidth(glyphId: number): number;

  /**
   * Check if the font has a glyph for the given code point.
   */
  hasGlyph(codePoint: number): boolean;

  /**
   * Check if the font has renderable glyph outlines.
   *
   * Some PDF subsetted fonts are "crippled" — they contain glyph metrics
   * and cmap data but no actual outline data (0 contours for all glyphs).
   * These fonts are used only for text extraction and cannot render text.
   *
   * Returns true if at least some common glyphs have actual outline data.
   */
  hasRenderableGlyphs(): boolean;

  /**
   * Check if a specific glyph has renderable outlines or charstring data.
   */
  hasRenderableGlyph(glyphId: number): boolean;

  /**
   * Get the raw font data.
   */
  getData(): Uint8Array;
}
