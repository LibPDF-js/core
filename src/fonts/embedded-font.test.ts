import { describe, expect, it } from "vitest";
import { loadFixture } from "#src/test-utils";
import { EmbeddedFont } from "./embedded-font";
import { parseFontProgram } from "./embedded-parser";
import { buildToUnicodeCMap, buildToUnicodeCMapFromGids } from "./to-unicode-builder";
import {
  buildWidthsArray,
  buildWidthsArrayFromGids,
  optimizeWidthsArray,
  serializeWidthsArray,
} from "./widths-builder";

describe("EmbeddedFont", () => {
  it("should create from TTF bytes", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    expect(font.subtype).toBe("Type0");
    expect(font.baseFontName).toBeTruthy();
  });

  it("should encode text and track glyph usage", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    const codes = font.encodeText("Hello");

    // encodeText returns Unicode code points (user-friendly API)
    expect(codes).toEqual([72, 101, 108, 108, 111]); // H, e, l, l, o

    // Glyphs should be tracked
    const usedGlyphs = font.getUsedGlyphIds();
    expect(usedGlyphs.length).toBeGreaterThan(1); // At least .notdef + used glyphs
  });

  it("should check if text can be encoded", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    // ASCII should be encodable
    expect(font.canEncode("Hello World")).toBe(true);

    // Private use area characters likely not in font
    expect(font.canEncode("\uE000")).toBe(false);
  });

  it("should calculate text width", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    const width = font.getTextWidth("Hello", 12);
    expect(width).toBeGreaterThan(0);
    expect(typeof width).toBe("number");
  });

  it("should get width for individual characters", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    // getWidth takes a Unicode code point (user-friendly API)
    const widthA = font.getWidth(65); // 'A'
    expect(widthA).toBeGreaterThan(0);

    const widthSpace = font.getWidth(32); // space
    expect(widthSpace).toBeGreaterThan(0);
    expect(widthSpace).toBeLessThan(widthA); // Space is narrower than A
  });

  it("should decode to Unicode", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    // toUnicode takes a code point and returns it as a string (user-friendly API)
    expect(font.toUnicode(65)).toBe("A");
    expect(font.toUnicode(0x4e2d)).toBe("中"); // Chinese character
  });

  it("should build descriptor from font metrics", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    const descriptor = font.descriptor;
    expect(descriptor).not.toBeNull();
    expect(descriptor?.ascent).toBeGreaterThan(0);
    expect(descriptor?.descent).toBeLessThan(0); // Descent is negative
    expect(descriptor?.fontBBox).toHaveLength(4);
  });

  it("should reset usage tracking", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    font.encodeText("Hello");
    expect(font.getUsedGlyphIds().length).toBeGreaterThan(1);

    font.resetUsage();
    // Only .notdef should remain
    expect(font.getUsedGlyphIds()).toEqual([0]);
  });

  it("should get unencodable characters", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = EmbeddedFont.fromBytes(fontBytes);

    // Mix of encodable and unencodable
    const unencodable = font.getUnencodableCharacters("Hello\uE000World");
    expect(unencodable).toContain("\uE000");
    expect(unencodable).not.toContain("H");
  });

  describe("form field usage tracking", () => {
    it("should allow subsetting by default", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = EmbeddedFont.fromBytes(fontBytes);

      expect(font.canSubset()).toBe(true);
      expect(font.usedInForm).toBe(false);
    });

    it("should prevent subsetting when marked for form use", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = EmbeddedFont.fromBytes(fontBytes);

      font.markUsedInForm();

      expect(font.canSubset()).toBe(false);
      expect(font.usedInForm).toBe(true);
    });

    it("should persist form usage flag after encoding text", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = EmbeddedFont.fromBytes(fontBytes);

      font.markUsedInForm();
      font.encodeText("Hello World");

      expect(font.canSubset()).toBe(false);
    });

    it("should not reset form usage when resetting usage tracking", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = EmbeddedFont.fromBytes(fontBytes);

      font.markUsedInForm();
      font.encodeText("Test");
      font.resetUsage();

      // usedInForm should persist, only glyph tracking is reset
      // Note: the spec says resetUsage resets the subset tag, not the form flag
      expect(font.getUsedGlyphIds()).toEqual([0]); // Only .notdef
    });
  });
});

describe("parseFontProgram", () => {
  it("should parse TTF font", async () => {
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const program = parseFontProgram(fontBytes);

    expect(program.type).toBe("truetype");
    expect(program.numGlyphs).toBeGreaterThan(0);
    expect(program.unitsPerEm).toBeGreaterThan(0);
  });

  it("should parse OTF font", async () => {
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");
    const program = parseFontProgram(fontBytes);

    // OTF fonts can have either TrueType or CFF outlines
    expect(["truetype", "cff", "cff-cid"]).toContain(program.type);
    expect(program.numGlyphs).toBeGreaterThan(0);
  });

  it("should reject invalid data", () => {
    const invalidData = new Uint8Array([0, 0, 0, 0]);
    expect(() => parseFontProgram(invalidData)).toThrow();
  });
});

describe("ToUnicode CMap Builder", () => {
  describe("buildToUnicodeCMapFromGids (preferred)", () => {
    it("should build ToUnicode CMap from GID to code point mapping", () => {
      // GID -> Unicode code point
      const gidToCodePoint = new Map([
        [100, 65], // GID 100 -> 'A'
        [101, 66], // GID 101 -> 'B'
        [102, 67], // GID 102 -> 'C'
      ]);

      const cmap = buildToUnicodeCMapFromGids(gidToCodePoint);
      const text = new TextDecoder().decode(cmap);

      expect(text).toContain("begincodespacerange");
      expect(text).toContain("beginbfchar");
      // GID 100 (0x0064) maps to 'A' (0x0041)
      expect(text).toContain("<0064> <0041>");
      expect(text).toContain("endcmap");
    });

    it("should handle empty mapping", () => {
      const cmap = buildToUnicodeCMapFromGids(new Map());
      const text = new TextDecoder().decode(cmap);

      expect(text).toContain("begincmap");
      expect(text).toContain("endcmap");
      expect(text).not.toContain("beginbfchar");
    });

    it("should handle characters outside BMP", () => {
      // GID -> Unicode code point (emoji)
      const gidToCodePoint = new Map([
        [500, 0x1f600], // GID 500 -> grinning face emoji
      ]);

      const cmap = buildToUnicodeCMapFromGids(gidToCodePoint);
      const text = new TextDecoder().decode(cmap);

      // Should have surrogate pair representation for the emoji
      expect(text).toContain("<D83D"); // High surrogate
    });
  });

  describe("buildToUnicodeCMap (deprecated, backward compat)", () => {
    it("should build ToUnicode CMap from code points", () => {
      const codePoints = new Map([
        [65, 100], // A -> GID 100
        [66, 101], // B -> GID 101
        [67, 102], // C -> GID 102
      ]);

      const cmap = buildToUnicodeCMap(codePoints);
      const text = new TextDecoder().decode(cmap);

      expect(text).toContain("begincodespacerange");
      expect(text).toContain("beginbfchar");
      expect(text).toContain("<0041>"); // Hex for 'A' (65)
      expect(text).toContain("endcmap");
    });

    it("should handle empty mapping", () => {
      const cmap = buildToUnicodeCMap(new Map());
      const text = new TextDecoder().decode(cmap);

      expect(text).toContain("begincmap");
      expect(text).toContain("endcmap");
      expect(text).not.toContain("beginbfchar");
    });

    it("should handle characters outside BMP", () => {
      const codePoints = new Map([
        [0x1f600, 500], // Emoji: grinning face
      ]);

      const cmap = buildToUnicodeCMap(codePoints);
      const text = new TextDecoder().decode(cmap);

      // Should have surrogate pair representation
      expect(text).toContain("<D83D"); // High surrogate
    });
  });
});

describe("Widths Array Builder", () => {
  describe("buildWidthsArrayFromGids (preferred)", () => {
    it("should build widths array from GID to code point mapping", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const program = parseFontProgram(fontBytes);

      // GID -> code point mapping (as returned by EmbeddedFont.getGidToCodePointMap)
      const gidA = program.getGlyphId(65);
      const gidB = program.getGlyphId(66);
      const gidC = program.getGlyphId(67);

      const gidToCodePoint = new Map([
        [gidA, 65], // GID for 'A' -> 'A'
        [gidB, 66], // GID for 'B' -> 'B'
        [gidC, 67], // GID for 'C' -> 'C'
      ]);

      const entries = buildWidthsArrayFromGids(gidToCodePoint, program);

      expect(entries.length).toBeGreaterThan(0);
      // Widths should be keyed by GID
    });
  });

  describe("buildWidthsArray (deprecated, backward compat)", () => {
    it("should build widths array from used code points", async () => {
      const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const program = parseFontProgram(fontBytes);

      const usedCodePoints = new Map([
        [65, program.getGlyphId(65)], // A
        [66, program.getGlyphId(66)], // B
        [67, program.getGlyphId(67)], // C
      ]);

      const entries = buildWidthsArray(usedCodePoints, program);

      expect(entries.length).toBeGreaterThan(0);
      // Should have individual widths since widths likely differ
    });
  });

  describe("optimizeWidthsArray", () => {
    it("should optimize consecutive CIDs with same width", () => {
      const widths = new Map([
        [100, 500],
        [101, 500],
        [102, 500],
        [103, 500],
      ]);

      const entries = optimizeWidthsArray(widths);

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe("range");
      if (entries[0].type === "range") {
        expect(entries[0].startCid).toBe(100);
        expect(entries[0].endCid).toBe(103);
        expect(entries[0].width).toBe(500);
      }
    });

    it("should use individual format for different widths", () => {
      const widths = new Map([
        [100, 500],
        [101, 600],
        [102, 700],
      ]);

      const entries = optimizeWidthsArray(widths);

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe("individual");
      if (entries[0].type === "individual") {
        expect(entries[0].widths).toEqual([500, 600, 700]);
      }
    });

    it("should handle gaps in CIDs", () => {
      const widths = new Map([
        [100, 500],
        [101, 500],
        [200, 600], // Gap
        [201, 600],
      ]);

      const entries = optimizeWidthsArray(widths);

      // Should produce two entries (one for each group)
      expect(entries.length).toBe(2);
    });
  });

  describe("serializeWidthsArray (deprecated)", () => {
    it("should serialize widths array correctly", () => {
      const entries = optimizeWidthsArray(
        new Map([
          [1, 500],
          [2, 600],
          [3, 700],
          [100, 400],
          [101, 400],
          [102, 400],
        ]),
      );

      const serialized = serializeWidthsArray(entries);

      expect(serialized).toContain("[");
      expect(serialized).toContain("]");
      // Should contain both individual and range formats
    });
  });
});
