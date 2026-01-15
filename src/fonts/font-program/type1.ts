/**
 * Type 1 font program wrapper.
 */

import type { Type1Font } from "#src/fontbox/type1/font.ts";

import type { FontProgram } from "./base.ts";

/**
 * Wrapper for Type 1 fonts.
 */
export class Type1FontProgram implements FontProgram {
  readonly type = "type1" as const;

  /** Glyph name to index mapping */
  private readonly glyphNameToIndex: Map<string, number>;

  /** Unicode to glyph name mapping (via encoding) */
  private readonly unicodeToName: Map<number, string>;

  constructor(
    readonly font: Type1Font,
    private readonly data: Uint8Array,
  ) {
    // Build glyph name to index mapping
    this.glyphNameToIndex = new Map();
    const names = font.getGlyphNames();

    for (let i = 0; i < names.length; i++) {
      this.glyphNameToIndex.set(names[i], i);
    }

    // Build unicode to glyph name mapping from encoding
    this.unicodeToName = new Map();

    if (font.encoding) {
      for (let code = 0; code < 256; code++) {
        const name = font.encoding.getName(code);

        if (name) {
          // Map the character code to glyph name
          // This assumes the encoding maps character codes (not unicode)
          this.unicodeToName.set(code, name);
        }
      }
    }
  }

  get numGlyphs(): number {
    return this.font.charstrings.size;
  }

  get unitsPerEm(): number {
    // Type 1 uses fontMatrix to define units
    // Default is [0.001, 0, 0, 0.001, 0, 0] which means 1000 units per em
    const matrix = this.font.fontMatrix;

    if (matrix.length >= 1 && matrix[0] !== 0) {
      return Math.round(1 / matrix[0]);
    }

    return 1000;
  }

  get bbox(): readonly [number, number, number, number] {
    const b = this.font.fontBBox;

    if (b.length >= 4) {
      return [b[0], b[1], b[2], b[3]] as const;
    }

    return [0, 0, 0, 0];
  }

  get postScriptName(): string | undefined {
    return this.font.fontName || undefined;
  }

  get familyName(): string | undefined {
    return this.font.familyName || undefined;
  }

  get isFixedPitch(): boolean {
    return this.font.isFixedPitch;
  }

  get italicAngle(): number {
    return this.font.italicAngle;
  }

  get ascent(): number {
    // Type 1 doesn't have explicit ascent, use bbox
    const b = this.font.fontBBox;

    return b.length >= 4 ? b[3] : 800;
  }

  get descent(): number {
    const b = this.font.fontBBox;

    return b.length >= 4 ? b[1] : -200;
  }

  get capHeight(): number {
    return Math.round(this.ascent * 0.9);
  }

  get xHeight(): number {
    return Math.round(this.ascent * 0.5);
  }

  get stemV(): number {
    // Use stdVW if available
    return this.font.stdVW.length > 0 ? this.font.stdVW[0] : 80;
  }

  getGlyphId(codePoint: number): number {
    // First try encoding lookup
    const name = this.unicodeToName.get(codePoint);
    if (name) {
      return this.glyphNameToIndex.get(name) ?? 0;
    }
    return 0;
  }

  /**
   * Get glyph ID by glyph name.
   */
  getGlyphIdByName(name: string): number {
    return this.glyphNameToIndex.get(name) ?? 0;
  }

  getAdvanceWidth(_glyphId: number): number {
    // Type 1 width requires parsing charstrings
    // Return a reasonable default
    return 600;
  }

  hasGlyph(codePoint: number): boolean {
    return this.getGlyphId(codePoint) !== 0;
  }

  /**
   * Check if font has glyph by name.
   */
  hasGlyphByName(name: string): boolean {
    return this.font.hasGlyph(name);
  }

  getData(): Uint8Array {
    return this.data;
  }
}
