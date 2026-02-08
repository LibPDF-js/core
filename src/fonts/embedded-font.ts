/**
 * EmbeddedFont - User-facing class for embedding fonts into PDFs.
 *
 * This class wraps a parsed font (via fontbox) and provides:
 * - Text encoding (Unicode to character codes)
 * - Width measurement
 * - Usage tracking for subsetting
 * - ToUnicode map generation
 */

import type { TrueTypeFont } from "#src/fontbox/ttf/truetype-font.ts";
import type { PdfRef } from "#src/objects/pdf-ref.ts";

import { parseFontProgram } from "./embedded-parser.ts";
import { FontDescriptor } from "./font-descriptor.ts";
import { type FontProgram, TrueTypeFontProgram } from "./font-program/index.ts";
import { PdfFont } from "./pdf-font.ts";

/**
 * Options for embedding a font.
 */
export interface EmbedFontOptions {
  /**
   * Variation axis values for variable fonts.
   * Keys are axis tags (e.g., 'wght', 'wdth'), values are axis values.
   * If not specified, uses the font's default values.
   */
  variations?: Record<string, number>;

  /**
   * Named instance to use for variable fonts.
   * If specified, overrides any variations.
   */
  instance?: string;
}

/**
 * EmbeddedFont represents a font that will be embedded into a PDF.
 *
 * Usage:
 * ```typescript
 * const fontBytes = await fs.readFile("NotoSans-Regular.ttf");
 * const font = EmbeddedFont.fromBytes(fontBytes);
 *
 * // Check if text can be encoded
 * if (font.canEncode("Hello ")) {
 *   const codes = font.encodeText("Hello ");
 *   const width = font.getTextWidth("Hello ", 12);
 * }
 * ```
 */
export class EmbeddedFont extends PdfFont {
  readonly subtype = "Type0" as const;

  /** Underlying font program */
  private readonly fontProgram: FontProgram;

  /** Original font data */
  private readonly fontData: Uint8Array;

  /** Track used glyphs for subsetting (GID -> code points that use it) */
  private readonly usedGlyphs: Map<number, Set<number>> = new Map([[0, new Set()]]); // Always include .notdef

  /** Track used code points for ToUnicode (codePoint -> GID) */
  private readonly usedCodePoints: Map<number, number> = new Map();

  /** Subset tag (generated during save) */
  private _subsetTag: string | null = null;

  /** Whether this font is used in a form field (prevents subsetting) */
  private _usedInForm = false;

  /** Pre-allocated PDF reference (set by PDFFonts.embed()) */
  private _ref: PdfRef | null = null;

  /** Cached descriptor */
  private _descriptor: FontDescriptor | null = null;

  private constructor(fontProgram: FontProgram, fontData: Uint8Array) {
    super();

    this.fontProgram = fontProgram;
    this.fontData = fontData;
  }

  /**
   * Create an EmbeddedFont from raw font bytes.
   *
   * @param data - TTF, OTF, or Type1 font data
   * @param options - Embedding options
   * @returns EmbeddedFont instance
   * @throws {Error} if font format is not recognized
   */
  static fromBytes(data: Uint8Array, _options?: EmbedFontOptions): EmbeddedFont {
    const program = parseFontProgram(data);

    // TODO: Handle variable font options (flatten to static instance)
    return new EmbeddedFont(program, data);
  }

  /**
   * Create an EmbeddedFont from an already-parsed TrueType font.
   */
  static fromTrueTypeFont(font: TrueTypeFont, data: Uint8Array): EmbeddedFont {
    const program = new TrueTypeFontProgram(font, data);

    return new EmbeddedFont(program, data);
  }

  /**
   * Get the base font name.
   * During save, this will include a subset tag prefix (e.g., "ABCDEF+FontName").
   */
  get baseFontName(): string {
    const name = this.fontProgram.postScriptName ?? "Unknown";

    return this._subsetTag ? `${this._subsetTag}+${name}` : name;
  }

  /**
   * Get the font descriptor.
   */
  get descriptor(): FontDescriptor | null {
    if (!this._descriptor) {
      this._descriptor = this.buildDescriptor();
    }

    return this._descriptor;
  }

  /**
   * Get the underlying font program.
   */
  get program(): FontProgram {
    return this.fontProgram;
  }

  /**
   * Get the original font data.
   */
  get data(): Uint8Array {
    return this.fontData;
  }

  /**
   * Get the subset tag (only available after save).
   */
  get subsetTag(): string | null {
    return this._subsetTag;
  }

  /**
   * Set the subset tag (called during save).
   */
  setSubsetTag(tag: string): void {
    this._subsetTag = tag;
  }

  /**
   * Get all used glyph IDs.
   */
  getUsedGlyphIds(): number[] {
    return [...this.usedGlyphs.keys()].sort((a, b) => a - b);
  }

  /**
   * Get mapping from code point to GID.
   */
  getCodePointToGidMap(): Map<number, number> {
    return new Map(this.usedCodePoints);
  }

  /**
   * Get mapping from GID to Unicode code point.
   *
   * This is used for building the /W widths array and ToUnicode CMap.
   * Since the content stream contains GIDs (with CIDToGIDMap /Identity),
   * the /W array must be keyed by GID, and ToUnicode must map GID → Unicode.
   *
   * If multiple code points map to the same GID, returns the first one found.
   */
  getGidToCodePointMap(): Map<number, number> {
    const result = new Map<number, number>();

    for (const [gid, codePoints] of this.usedGlyphs) {
      if (codePoints.size > 0) {
        // Get the first code point (in case multiple map to same GID)
        const firstCodePoint = codePoints.values().next().value;

        if (firstCodePoint !== undefined) {
          result.set(gid, firstCodePoint);
        }
      }
    }

    return result;
  }

  /**
   * Iterate over text, tracking glyph usage and returning codePoint/GID pairs.
   * This is the shared implementation for encodeText and encodeTextToGids.
   */
  private trackAndEncode(text: string): Array<{ codePoint: number; gid: number }> {
    const result: Array<{ codePoint: number; gid: number }> = [];

    for (const char of text) {
      const codePoint = char.codePointAt(0);

      if (codePoint === undefined) {
        continue;
      }

      const gid = this.fontProgram.getGlyphId(codePoint);

      // Track usage for subsetting
      if (!this.usedGlyphs.has(gid)) {
        this.usedGlyphs.set(gid, new Set());
      }

      // biome-ignore lint/style/noNonNullAssertion: set(...) above if not has(...)
      this.usedGlyphs.get(gid)!.add(codePoint);
      this.usedCodePoints.set(codePoint, gid);

      result.push({ codePoint, gid });
    }

    return result;
  }

  /**
   * Encode text to character codes.
   *
   * Returns Unicode code points, which is intuitive for users.
   * The conversion to glyph IDs happens internally when writing to the PDF.
   *
   * Also tracks glyph usage for subsetting.
   */
  encodeText(text: string): number[] {
    return this.trackAndEncode(text).map(e => e.codePoint);
  }

  /**
   * Encode text to glyph IDs for PDF content stream.
   *
   * This is an internal method used when writing to the PDF.
   * With CIDToGIDMap /Identity, the content stream must contain GIDs.
   *
   * @internal
   */
  encodeTextToGids(text: string): number[] {
    return this.trackAndEncode(text).map(e => e.gid);
  }

  /**
   * Convert a code point to its glyph ID.
   *
   * @internal
   */
  codePointToGid(codePoint: number): number {
    return this.fontProgram.getGlyphId(codePoint);
  }

  /**
   * Get width of a character in glyph units (1000 = 1 em).
   *
   * Takes a Unicode code point (user-friendly API).
   */
  getWidth(code: number): number {
    // code is a Unicode code point - look up the GID to get the width
    const gid = this.fontProgram.getGlyphId(code);
    const width = this.fontProgram.getAdvanceWidth(gid);

    return Math.round((width * 1000) / this.fontProgram.unitsPerEm);
  }

  /**
   * Decode character code to Unicode string.
   *
   * For embedded fonts with Identity-H encoding, the code is the code point,
   * so this just converts the code point back to a string.
   */
  toUnicode(code: number): string {
    // code is a Unicode code point
    return String.fromCodePoint(code);
  }

  /**
   * Check if the font can encode the given text.
   * Returns true if all characters have glyphs in the font.
   */
  canEncode(text: string): boolean {
    for (const char of text) {
      const codePoint = char.codePointAt(0);

      if (codePoint === undefined) {
        continue;
      }

      if (!this.fontProgram.hasGlyph(codePoint)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the characters that cannot be encoded.
   */
  getUnencodableCharacters(text: string): string[] {
    const unencodable: string[] = [];

    for (const char of text) {
      const codePoint = char.codePointAt(0);

      if (codePoint === undefined) {
        continue;
      }

      if (!this.fontProgram.hasGlyph(codePoint)) {
        unencodable.push(char);
      }
    }

    return unencodable;
  }

  /**
   * Reset glyph usage tracking.
   * Call this before re-encoding if you want a fresh subset.
   */
  resetUsage(): void {
    this.usedGlyphs.clear();
    this.usedGlyphs.set(0, new Set()); // Always include .notdef
    this.usedCodePoints.clear();

    this._subsetTag = null;
  }

  /**
   * Get the pre-allocated PDF reference for this font.
   *
   * Set by `PDFFonts.embed()`. At save time, the actual font objects
   * (Type0 dict, CIDFont, FontDescriptor, font program, ToUnicode)
   * are created and registered at this ref.
   *
   * @throws {Error} if the font was not embedded via `pdf.embedFont()`
   */
  get ref(): PdfRef {
    if (!this._ref) {
      throw new Error("Font has no PDF reference. Use pdf.embedFont() to embed fonts.");
    }

    return this._ref;
  }

  /**
   * Set the pre-allocated PDF reference.
   *
   * @internal Called by PDFFonts.embed()
   */
  setRef(ref: PdfRef): void {
    this._ref = ref;
  }

  /**
   * Mark this font as used in a form field.
   *
   * Fonts used in form fields cannot be subsetted because users may type
   * any character at runtime. This method is called automatically when
   * an EmbeddedFont is used in form field appearances.
   */
  markUsedInForm(): void {
    this._usedInForm = true;
  }

  /**
   * Check if this font is used in a form field.
   */
  get usedInForm(): boolean {
    return this._usedInForm;
  }

  /**
   * Check if this font can be subsetted.
   *
   * Returns false if the font is used in a form field (since users can
   * type any character at runtime).
   */
  canSubset(): boolean {
    return !this._usedInForm;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Font Metrics (convenience methods for users)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get width of text in points at a given font size.
   *
   * Alias for getTextWidth() to match Standard14Font API.
   *
   * @param text - The text to measure
   * @param size - Font size in points
   * @returns Width in points
   */
  widthOfTextAtSize(text: string, size: number): number {
    return this.getTextWidth(text, size);
  }

  /**
   * Get the height of the font at a given size.
   *
   * This returns the full height from descender to ascender.
   *
   * @param size - Font size in points
   * @returns Height in points
   */
  heightAtSize(size: number): number {
    const desc = this.descriptor;
    if (!desc) {
      return size; // Fallback
    }

    return ((desc.ascent - desc.descent) * size) / 1000;
  }

  /**
   * Calculate font size needed to achieve a specific text height.
   *
   * @param height - Desired height in points
   * @returns Font size in points
   */
  sizeAtHeight(height: number): number {
    const desc = this.descriptor;
    if (!desc) {
      return height; // Fallback
    }

    const unitsHeight = desc.ascent - desc.descent;

    return (height * 1000) / unitsHeight;
  }

  /**
   * Calculate font size needed for text to fit a specific width.
   *
   * @param text - The text to measure
   * @param width - Desired width in points
   * @returns Font size in points
   */
  sizeAtWidth(text: string, width: number): number {
    if (text.length === 0) {
      return 0;
    }

    // Get width at size 1000 (in glyph units)
    const codes = this.encodeText(text);
    let totalWidth = 0;

    for (const code of codes) {
      totalWidth += this.getWidth(code);
    }

    if (totalWidth === 0) {
      return 0;
    }

    // width = (totalWidth * size) / 1000
    // size = (width * 1000) / totalWidth
    return (width * 1000) / totalWidth;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build a FontDescriptor from the font program.
   */
  private buildDescriptor(): FontDescriptor {
    const program = this.fontProgram;
    const bbox = program.bbox;

    // Scale metrics to 1000 units per em
    const scale = 1000 / program.unitsPerEm;

    return new FontDescriptor({
      fontName: program.postScriptName ?? "Unknown",
      flags: this.computeFlags(),
      fontBBox: [
        Math.round(bbox[0] * scale),
        Math.round(bbox[1] * scale),
        Math.round(bbox[2] * scale),
        Math.round(bbox[3] * scale),
      ],
      italicAngle: program.italicAngle,
      ascent: Math.round(program.ascent * scale),
      descent: Math.round(program.descent * scale),
      leading: 0,
      capHeight: Math.round(program.capHeight * scale),
      xHeight: Math.round(program.xHeight * scale),
      stemV: program.stemV,
      stemH: 0,
      avgWidth: 0,
      maxWidth: 0,
      missingWidth: this.getWidth(0), // Width of .notdef
    });
  }

  /**
   * Compute font flags for the descriptor.
   */
  private computeFlags(): number {
    let flags = 0;

    // Flag 1: FixedPitch
    if (this.fontProgram.isFixedPitch) {
      flags |= 1 << 0;
    }

    // Flag 3: Symbolic (use if not Latin)
    // For now, assume symbolic for all embedded fonts (safer)
    flags |= 1 << 2;

    // Flag 7: Italic
    if (this.fontProgram.italicAngle !== 0) {
      flags |= 1 << 6;
    }

    return flags;
  }
}
