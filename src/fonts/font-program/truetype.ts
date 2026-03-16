/**
 * TrueType/OpenType font program wrapper.
 */

import { parseCFF } from "#src/fontbox/cff/parser.ts";
import type { TrueTypeFont } from "#src/fontbox/ttf/truetype-font.ts";

import type { FontProgram } from "./base.ts";

/**
 * Wrapper for TrueType/OpenType fonts.
 */
export class TrueTypeFontProgram implements FontProgram {
  readonly type = "truetype" as const;

  constructor(
    readonly font: TrueTypeFont,
    private readonly data: Uint8Array,
  ) {}

  get numGlyphs(): number {
    return this.font.numGlyphs;
  }

  get unitsPerEm(): number {
    return this.font.unitsPerEm;
  }

  get bbox(): readonly [number, number, number, number] {
    const b = this.font.bbox;

    return [b.xMin, b.yMin, b.xMax, b.yMax];
  }

  get postScriptName(): string | undefined {
    return this.font.name?.postScriptName;
  }

  get familyName(): string | undefined {
    return this.font.name?.fontFamily;
  }

  get isFixedPitch(): boolean {
    // isFixedPitch is a number (0 = proportional, non-zero = fixed)
    return (this.font.post?.isFixedPitch ?? 0) !== 0;
  }

  get italicAngle(): number {
    return this.font.post?.italicAngle ?? 0;
  }

  get ascent(): number {
    // Prefer OS/2 values, fall back to hhea
    return this.font.os2?.typoAscender ?? this.font.hhea?.ascender ?? 0;
  }

  get descent(): number {
    // Prefer OS/2 values, fall back to hhea
    return this.font.os2?.typoDescender ?? this.font.hhea?.descender ?? 0;
  }

  get capHeight(): number {
    return this.font.os2?.sCapHeight ?? this.ascent;
  }

  get xHeight(): number {
    return this.font.os2?.sxHeight ?? Math.round(this.ascent * 0.5);
  }

  get stemV(): number {
    // TrueType doesn't have stemV, estimate from weight class
    const weight = this.font.os2?.weightClass ?? 400;

    // Rough estimate: map 100-900 to 50-150
    return Math.round(50 + ((weight - 100) / 800) * 100);
  }

  getGlyphId(codePoint: number): number {
    return this.font.getGlyphId(codePoint);
  }

  getAdvanceWidth(glyphId: number): number {
    return this.font.getAdvanceWidth(glyphId);
  }

  hasGlyph(codePoint: number): boolean {
    return this.font.hasGlyph(codePoint);
  }

  hasRenderableGlyph(glyphId: number): boolean {
    if (glyphId <= 0) {
      return false;
    }

    if (!this.font.glyf) {
      const cffData = this.font.getTableBytes("CFF ") ?? this.font.getTableBytes("CFF2");

      if (!cffData) {
        return false;
      }

      try {
        const [cffFont] = parseCFF(cffData);

        return (
          !!cffFont &&
          glyphId < cffFont.charStrings.length &&
          cffFont.charStrings[glyphId].length > 0
        );
      } catch {
        return false;
      }
    }

    const glyph = this.font.glyf?.getGlyph(glyphId);

    if (!glyph) {
      return false;
    }

    const { description } = glyph;

    if (description.isComposite) {
      return (description.components?.length ?? 0) > 0;
    }

    return description.numberOfContours !== 0;
  }

  hasRenderableGlyphs(): boolean {
    for (let glyphId = 1; glyphId < this.font.numGlyphs; glyphId++) {
      if (this.hasRenderableGlyph(glyphId)) {
        return true;
      }
    }

    return false;
  }

  getData(): Uint8Array {
    return this.data;
  }
}

export const isTrueTypeFontProgram = (program: FontProgram): program is TrueTypeFontProgram =>
  program.type === "truetype";
