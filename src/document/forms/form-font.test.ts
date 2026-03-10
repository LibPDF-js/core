/**
 * Tests for form font functionality.
 */

import { CIDFont } from "#src/fonts/cid-font";
import type { FontProgram } from "#src/fonts/font-program";
import { ToUnicodeMap } from "#src/fonts/to-unicode";
import { describe, expect, it } from "vitest";

import { ExistingFont, isEmbeddedFont, isExistingFont } from "./form-font";

class StubFontProgram implements FontProgram {
  readonly type = "truetype" as const;
  readonly numGlyphs = 4;
  readonly unitsPerEm = 1000;
  readonly bbox = [0, 0, 1000, 1000] as const;
  readonly postScriptName = "Stub";
  readonly familyName = "Stub";
  readonly isFixedPitch = false;
  readonly italicAngle = 0;
  readonly ascent = 800;
  readonly descent = -200;
  readonly capHeight = 700;
  readonly xHeight = 500;
  readonly stemV = 80;

  constructor(
    private readonly glyphMap: Map<number, number>,
    private readonly renderableGlyphs: Set<number>,
  ) {}

  getGlyphId(codePoint: number): number {
    return this.glyphMap.get(codePoint) ?? 0;
  }

  getAdvanceWidth(_glyphId: number): number {
    return 600;
  }

  hasGlyph(codePoint: number): boolean {
    return this.glyphMap.has(codePoint);
  }

  hasRenderableGlyphs(): boolean {
    return this.renderableGlyphs.size > 0;
  }

  hasRenderableGlyph(glyphId: number): boolean {
    return this.renderableGlyphs.has(glyphId);
  }

  getData(): Uint8Array {
    return new Uint8Array();
  }
}

describe("ExistingFont", () => {
  describe("constructor", () => {
    it("should create with name and null ref", () => {
      const font = new ExistingFont("Helv", null, null);
      expect(font.name).toBe("Helv");
      expect(font.ref).toBeNull();
    });

    it("should map common form font names to Standard 14", () => {
      const helvetica = new ExistingFont("Helv", null, null);
      const timesBold = new ExistingFont("TiBo", null, null);
      const zapfDingbats = new ExistingFont("ZaDb", null, null);

      // These fonts should have proper metrics from Standard 14
      expect(helvetica.getAscent(12)).toBeGreaterThan(0);
      expect(timesBold.getAscent(12)).toBeGreaterThan(0);
      expect(zapfDingbats.getAscent(12)).toBeGreaterThan(0);
    });
  });

  describe("canEncode", () => {
    it("should return true for ASCII text", () => {
      const font = new ExistingFont("Helv", null, null);
      expect(font.canEncode("Hello World")).toBe(true);
    });

    it("should return true for Latin-1 characters", () => {
      const font = new ExistingFont("Helv", null, null);
      expect(font.canEncode("cafe")).toBe(true);
    });

    it("should return false for CJK characters", () => {
      const font = new ExistingFont("Helv", null, null);
      // Use Unicode escape for CJK character (U+4E16 = )
      expect(font.canEncode("\u4E16")).toBe(false);
    });

    it("returns true for CID fonts with explicit CIDToGID maps when ToUnicode resolves the code", () => {
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "StubCID",
        cidToGidMap: new Uint16Array([0, 7]),
        embeddedProgram: new StubFontProgram(new Map([[0x0041, 7]]), new Set([7])),
        toUnicodeMap: new ToUnicodeMap(new Map([[1, "A"]])),
      });
      const font = new ExistingFont("F0", null, null, true, cidFont);

      expect(font.canEncode("A")).toBe(true);
      expect(Array.from(font.encodeTextToBytes("A"))).toEqual([0x00, 0x01]);
    });

    it("returns false for astral characters in CID fonts", () => {
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "StubCID",
        embeddedProgram: new StubFontProgram(new Map([[0x1f600, 5]]), new Set([5])),
      });
      const font = new ExistingFont("F0", null, null, true, cidFont);

      expect(font.canEncode("😀")).toBe(false);
      expect(font.canUseForAppearance("😀")).toBe(false);
    });
  });

  describe("canUseForAppearance", () => {
    it("returns true for standard 14 fonts with encodable text", () => {
      const font = new ExistingFont("Helv", null, null);

      expect(font.canUseForAppearance("Hello World")).toBe(true);
    });

    it("returns false for standard 14 fonts with unencodable text", () => {
      const font = new ExistingFont("Helv", null, null);

      expect(font.canUseForAppearance("\u4E16")).toBe(false);
    });

    it("returns false for CID fonts whose mapped glyph is not renderable", () => {
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "StubCID",
        embeddedProgram: new StubFontProgram(new Map([[0x0041, 1]]), new Set()),
      });
      const font = new ExistingFont("F0", null, null, true, cidFont);

      expect(font.canUseForAppearance("A")).toBe(false);
    });

    it("returns true for CID fonts whose mapped glyph is renderable", () => {
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "StubCID",
        embeddedProgram: new StubFontProgram(new Map([[0x0041, 1]]), new Set([1])),
      });
      const font = new ExistingFont("F0", null, null, true, cidFont);

      expect(font.canUseForAppearance("A")).toBe(true);
    });
  });

  describe("encodeText", () => {
    it("should encode ASCII text to character codes", () => {
      const font = new ExistingFont("Helv", null, null);
      const codes = font.encodeText("ABC");
      expect(codes).toEqual([65, 66, 67]);
    });
  });

  describe("getTextWidth", () => {
    it("should calculate text width using Standard 14 metrics", () => {
      const font = new ExistingFont("Helv", null, null);
      const width = font.getTextWidth("Hello", 12);
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(100); // Reasonable bounds
    });

    it("should return wider value for more characters", () => {
      const font = new ExistingFont("Helv", null, null);
      const short = font.getTextWidth("Hi", 12);
      const long = font.getTextWidth("Hello World", 12);
      expect(long).toBeGreaterThan(short);
    });

    it("should scale with font size", () => {
      const font = new ExistingFont("Helv", null, null);
      const small = font.getTextWidth("Hello", 6);
      const large = font.getTextWidth("Hello", 12);
      expect(large).toBeCloseTo(small * 2, 1);
    });
  });

  describe("metrics", () => {
    it("should provide ascent for Helvetica", () => {
      const font = new ExistingFont("Helv", null, null);
      const ascent = font.getAscent(1000);
      expect(ascent).toBeCloseTo(718, 0);
    });

    it("should provide descent for Helvetica", () => {
      const font = new ExistingFont("Helv", null, null);
      const descent = font.getDescent(1000);
      expect(descent).toBeCloseTo(-207, 0);
    });

    it("should provide cap height for Helvetica", () => {
      const font = new ExistingFont("Helv", null, null);
      const capHeight = font.getCapHeight(1000);
      expect(capHeight).toBeCloseTo(718, 0);
    });

    it("should fall back for unknown fonts", () => {
      const font = new ExistingFont("UnknownFont", null, null);
      expect(font.getAscent(12)).toBeGreaterThan(0);
      expect(font.getDescent(12)).toBeLessThan(0);
    });
  });
});

describe("isEmbeddedFont", () => {
  it("should return false for ExistingFont", () => {
    const font = new ExistingFont("Helv", null, null);
    expect(isEmbeddedFont(font)).toBe(false);
  });
});

describe("isExistingFont", () => {
  it("should return true for ExistingFont", () => {
    const font = new ExistingFont("Helv", null, null);
    expect(isExistingFont(font)).toBe(true);
  });
});
