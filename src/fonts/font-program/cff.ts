/**
 * CFF Type1-equivalent font program wrapper.
 */

import type { CFFType1Font } from "#src/fontbox/cff/parser.ts";

import type { FontProgram } from "./base.ts";

/**
 * Wrapper for CFF Type1-equivalent fonts.
 */
export class CFFType1FontProgram implements FontProgram {
  readonly type = "cff" as const;

  constructor(
    readonly font: CFFType1Font,
    private readonly data: Uint8Array,
  ) {}

  get numGlyphs(): number {
    return this.font.charStrings.length;
  }

  get unitsPerEm(): number {
    // CFF uses fontMatrix to define units
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
      return [b[0], b[1], b[2], b[3]];
    }

    return [0, 0, 0, 0];
  }

  get postScriptName(): string | undefined {
    return this.font.name || undefined;
  }

  get familyName(): string | undefined {
    return this.font.familyName;
  }

  get isFixedPitch(): boolean {
    return this.font.isFixedPitch;
  }

  get italicAngle(): number {
    return this.font.italicAngle;
  }

  get ascent(): number {
    // CFF doesn't have explicit ascent, estimate from bbox
    const b = this.font.fontBBox;

    return b.length >= 4 ? b[3] : 800;
  }

  get descent(): number {
    // CFF doesn't have explicit descent, estimate from bbox
    const b = this.font.fontBBox;

    return b.length >= 4 ? b[1] : -200;
  }

  get capHeight(): number {
    // CFF doesn't have cap height, estimate

    return Math.round(this.ascent * 0.9);
  }

  get xHeight(): number {
    // CFF doesn't have x-height, estimate

    return Math.round(this.ascent * 0.5);
  }

  get stemV(): number {
    // Use stdVW from private dict if available

    return this.font.privateDict.stdVW ?? 80;
  }

  getGlyphId(codePoint: number): number {
    // CFF Type1 fonts use encoding to map codes to glyph names
    // For now, just do a simple mapping assuming standard encoding positions
    // This is a simplification - proper implementation needs encoding support
    const encoding = this.font.encoding;

    if (encoding) {
      // Try to find glyph by character code
      const glyphName = encoding.getName(codePoint);

      if (glyphName) {
        // Find GID via charset - need to look up by SID
        const sid = this.font.charset.getSID(glyphName);

        if (sid !== 0) {
          return this.font.charset.getGIDForSID(sid);
        }
      }
    }

    return 0;
  }

  getAdvanceWidth(_glyphId: number): number {
    // CFF width calculation requires parsing charstrings
    // For now return default width from private dict

    return this.font.privateDict.defaultWidthX;
  }

  hasGlyph(codePoint: number): boolean {
    return this.getGlyphId(codePoint) !== 0;
  }

  getData(): Uint8Array {
    return this.data;
  }
}
