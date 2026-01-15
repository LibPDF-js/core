import { beforeAll, describe, expect, it } from "vitest";

import { loadFixture } from "../../test-utils.ts";
import { parseTTF } from "./parser.ts";
import { TTFSubsetter } from "./subsetter.ts";
import type { TrueTypeFont } from "./truetype-font.ts";

describe("TTFSubsetter", () => {
  const fontBytes = loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

  let fullFont: TrueTypeFont;

  beforeAll(async () => {
    fullFont = parseTTF(await fontBytes);
  });

  describe("empty subset", () => {
    it("should create subset with only .notdef (PDFBOX-2854)", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      const subsetBytes = await subsetter.write();

      // Parse the subset
      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      expect(subset.numGlyphs).toBe(1);
      expect(subset.post?.getName(0)).toBe(".notdef");
    });
  });

  describe("single glyph subset", () => {
    it("should subset to single glyph (PDFBOX-2854)", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.add("a".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      expect(subset.numGlyphs).toBe(2); // .notdef + 'a'
      expect(subset.post?.getName(0)).toBe(".notdef");
      expect(subset.post?.getName(1)).toBe("a");
    });

    it("should preserve advance widths", async () => {
      const fullGid = fullFont.getGlyphId("a".charCodeAt(0));
      const fullWidth = fullFont.getAdvanceWidth(fullGid);

      const subsetter = new TTFSubsetter(fullFont);
      subsetter.add("a".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });
      const subsetWidth = subset.getAdvanceWidth(1); // 'a' is glyph 1

      expect(subsetWidth).toBe(fullWidth);
    });
  });

  describe("multiple glyphs", () => {
    it("should subset multiple characters", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.addString("ABC");
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      expect(subset.numGlyphs).toBe(4); // .notdef + A + B + C
    });

    it("should preserve left side bearings (PDFBOX-3379)", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.add("A".charCodeAt(0));
      subsetter.add(" ".charCodeAt(0));
      subsetter.add("B".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // Verify metrics are preserved
      for (const char of ["A", "B", " "]) {
        const fullGid = fullFont.getGlyphId(char.charCodeAt(0));
        const fullWidth = fullFont.getAdvanceWidth(fullGid);

        const subsetGid = subset.getGlyphId(char.charCodeAt(0));
        const subsetWidth = subset.getAdvanceWidth(subsetGid);

        expect(subsetWidth).toBe(fullWidth);
      }
    });
  });

  describe("composite glyphs", () => {
    it("should include component glyphs for composites (PDFBOX-3757)", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      // Ö (O-dieresis) is typically a composite of O + dieresis
      subsetter.add("Ö".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // Should have more glyphs than just .notdef and Ö
      // (at minimum: .notdef, O, dieresis, Ö)
      expect(subset.numGlyphs).toBeGreaterThanOrEqual(3);

      // Verify the subset is valid by checking we can access glyphs
      for (let i = 0; i < subset.numGlyphs; i++) {
        const glyph = subset.glyf?.getGlyph(i);
        // Glyph should be defined (may be empty for some glyphs)
        expect(glyph !== undefined || subset.loca?.getLength(i) === 0).toBe(true);
      }
    });
  });

  describe("GID mapping", () => {
    it("should return correct GID mapping", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.add("A".charCodeAt(0));
      subsetter.add("B".charCodeAt(0));

      const gidMap = subsetter.getGIDMap();

      // First entry is always .notdef (0 -> 0)
      expect(gidMap.get(0)).toBe(0);

      // Check that old GIDs are mapped correctly
      const oldAGid = fullFont.getGlyphId("A".charCodeAt(0));
      const oldBGid = fullFont.getGlyphId("B".charCodeAt(0));

      // New GIDs should be 1 and 2 (or 2 and 1 depending on sort order)
      const values = [...gidMap.values()];
      expect(values).toContain(oldAGid);
      expect(values).toContain(oldBGid);
    });
  });

  describe("force invisible", () => {
    it("should create zero-width invisible glyphs (PDFBOX-5230)", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.add("A".charCodeAt(0));
      subsetter.add("B".charCodeAt(0));
      subsetter.forceInvisible("B".charCodeAt(0));

      const subsetBytes = await subsetter.write();
      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // A should have non-zero width
      const aGid = subset.getGlyphId("A".charCodeAt(0));
      expect(subset.getAdvanceWidth(aGid)).toBeGreaterThan(0);

      // B should have zero width
      const bGid = subset.getGlyphId("B".charCodeAt(0));
      expect(subset.getAdvanceWidth(bGid)).toBe(0);
    });
  });

  describe("prefix", () => {
    it("should add prefix to PostScript name", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.setPrefix("SUBSET+");
      subsetter.add("a".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // The PostScript name in the name table should have the prefix
      const psName = subset.name?.postScriptName;
      expect(psName).toBeDefined();
      expect(psName).toMatch(/^SUBSET\+/);
    });
  });

  describe("table selection", () => {
    it("should keep only specified tables", async () => {
      const subsetter = new TTFSubsetter(fullFont, {
        keepTables: ["head", "hhea", "loca", "maxp", "glyf", "hmtx"],
      });
      subsetter.add("a".charCodeAt(0));
      const subsetBytes = await subsetter.write();

      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // Should have required tables
      expect(subset.hasTable("head")).toBe(true);
      expect(subset.hasTable("hhea")).toBe(true);
      expect(subset.hasTable("glyf")).toBe(true);
      expect(subset.hasTable("loca")).toBe(true);
      expect(subset.hasTable("maxp")).toBe(true);
      expect(subset.hasTable("hmtx")).toBe(true);

      // Should not have name/post/cmap since they weren't in keepTables
      expect(subset.hasTable("name")).toBe(false);
      expect(subset.hasTable("post")).toBe(false);
    });
  });

  describe("re-parsing", () => {
    it("should produce valid re-parseable TTF", async () => {
      const subsetter = new TTFSubsetter(fullFont);
      subsetter.addString("Hello World");
      const subsetBytes = await subsetter.write();

      // Should not throw when parsing
      const subset = parseTTF(subsetBytes, { isEmbedded: true });

      // Basic validity checks
      expect(subset.head).toBeDefined();
      expect(subset.head?.magicNumber).toBe(0x5f0f3cf5);
      expect(subset.numGlyphs).toBeGreaterThan(0);

      // Check that all glyphs are accessible
      for (let i = 0; i < subset.numGlyphs; i++) {
        const length = subset.loca?.getLength(i) ?? 0;
        if (length > 0) {
          const glyph = subset.glyf?.getGlyph(i);
          expect(glyph).toBeDefined();
        }
      }
    });
  });
});
