/**
 * CFF CID-keyed font program wrapper.
 */

import type { CFFCIDFont } from "#src/fontbox/cff/parser.ts";

import type { FontProgram } from "./base.ts";

/**
 * Wrapper for CFF CID-keyed fonts.
 */
export class CFFCIDFontProgram implements FontProgram {
  readonly type = "cff-cid" as const;

  constructor(
    readonly font: CFFCIDFont,
    private readonly data: Uint8Array,
  ) {}

  get numGlyphs(): number {
    return this.font.charStrings.length;
  }

  get unitsPerEm(): number {
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
    // Use first private dict's stdVW
    if (this.font.privateDicts.length > 0) {
      return this.font.privateDicts[0].stdVW ?? 80;
    }
    return 80;
  }

  getGlyphId(_codePoint: number): number {
    // CID fonts map CID to GID via charset
    // Without a CMap, we can't map Unicode to CID
    // Return 0 (notdef) - caller should use CMap
    return 0;
  }

  /**
   * Get GID for a CID value.
   */
  getGlyphIdForCID(cid: number): number {
    return this.font.charset.getGIDForCID(cid) ?? 0;
  }

  getAdvanceWidth(glyphId: number): number {
    // CID font width requires parsing charstrings with correct FD
    const fdIndex = this.font.fdSelect.getFDIndex(glyphId);

    if (fdIndex < this.font.privateDicts.length) {
      return this.font.privateDicts[fdIndex].defaultWidthX;
    }

    return 1000;
  }

  hasGlyph(_codePoint: number): boolean {
    // CID fonts need CMap for proper lookup
    return false;
  }

  getData(): Uint8Array {
    return this.data;
  }
}
