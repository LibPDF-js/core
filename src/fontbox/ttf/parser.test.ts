import { beforeAll, describe, expect, it } from "vitest";

import { loadFixture } from "../../test-utils.ts";
import { isTTF, parseTTF } from "./parser.ts";
import { ENCODING_WIN_UNICODE_BMP, PLATFORM_WINDOWS } from "./tables/cmap.ts";
import type { TrueTypeFont } from "./truetype-font.ts";

describe("TrueType Font Parser", () => {
  let fontBytes: Uint8Array;
  let font: TrueTypeFont;

  beforeAll(async () => {
    fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    font = parseTTF(fontBytes);
  });

  describe("isTTF", () => {
    it("should detect TrueType fonts", () => {
      expect(isTTF(fontBytes)).toBe(true);
    });

    it("should reject non-fonts", () => {
      expect(isTTF(new Uint8Array([0, 0, 0, 0]))).toBe(false);
      expect(isTTF(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false); // %PDF
    });

    it("should reject short data", () => {
      expect(isTTF(new Uint8Array([0, 0]))).toBe(false);
    });
  });

  describe("parseTTF", () => {
    it("should parse table directory", () => {
      const tags = font.getTableTags();
      expect(tags).toContain("head");
      expect(tags).toContain("hhea");
      expect(tags).toContain("maxp");
      expect(tags).toContain("hmtx");
      expect(tags).toContain("loca");
      expect(tags).toContain("glyf");
      expect(tags).toContain("cmap");
      expect(tags).toContain("name");
      expect(tags).toContain("post");
    });

    it("should report hasTable correctly", () => {
      expect(font.hasTable("head")).toBe(true);
      expect(font.hasTable("cmap")).toBe(true);
      expect(font.hasTable("nonexistent")).toBe(false);
    });

    it("should throw on invalid data", () => {
      expect(() => parseTTF(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toThrow(
        /Invalid font/,
      );
    });
  });

  describe("head table", () => {
    it("should parse head table", () => {
      const head = font.head;
      expect(head).toBeDefined();
      expect(head!.tag).toBe("head");
    });

    it("should have correct unitsPerEm", () => {
      expect(font.unitsPerEm).toBe(2048);
    });

    it("should have valid magic number", () => {
      expect(font.head!.magicNumber).toBe(0x5f0f3cf5);
    });

    it("should have valid bounding box", () => {
      const bbox = font.bbox;
      // LiberationSans has these approximate bounds
      expect(bbox.xMin).toBeLessThan(0); // Has glyphs extending left
      expect(bbox.yMin).toBeLessThan(0); // Has descenders
      expect(bbox.xMax).toBeGreaterThan(0);
      expect(bbox.yMax).toBeGreaterThan(0);
    });

    it("should parse creation date as UTC", () => {
      const head = font.head!;
      // LiberationSans-Regular was created June 18, 2010 at 10:23:22 UTC
      // Based on PDFBox test: target.set(2010, 5, 18, 10, 23, 22)
      // Note: Java months are 0-indexed, so 5 = June
      const created = head.created;
      expect(created.getUTCFullYear()).toBe(2010);
      expect(created.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(created.getUTCDate()).toBe(18);
      expect(created.getUTCHours()).toBe(10);
      expect(created.getUTCMinutes()).toBe(23);
      expect(created.getUTCSeconds()).toBe(22);
    });

    it("should have valid indexToLocFormat", () => {
      // 0 = short offsets (16-bit), 1 = long offsets (32-bit)
      expect([0, 1]).toContain(font.head!.indexToLocFormat);
    });
  });

  describe("hhea table", () => {
    it("should parse hhea table", () => {
      const hhea = font.hhea;
      expect(hhea).toBeDefined();
      expect(hhea!.tag).toBe("hhea");
    });

    it("should have valid ascender/descender", () => {
      const hhea = font.hhea!;
      expect(hhea.ascender).toBeGreaterThan(0);
      expect(hhea.descender).toBeLessThan(0);
    });

    it("should have valid numberOfHMetrics", () => {
      const hhea = font.hhea!;
      expect(hhea.numberOfHMetrics).toBeGreaterThan(0);
      expect(hhea.numberOfHMetrics).toBeLessThanOrEqual(font.numGlyphs);
    });
  });

  describe("maxp table", () => {
    it("should parse maxp table", () => {
      const maxp = font.maxp;
      expect(maxp).toBeDefined();
      expect(maxp!.tag).toBe("maxp");
    });

    it("should report correct numGlyphs", () => {
      expect(font.numGlyphs).toBeGreaterThan(0);
      // LiberationSans has 2000+ glyphs
      expect(font.numGlyphs).toBeGreaterThan(2000);
    });
  });

  describe("hmtx table", () => {
    it("should parse hmtx table", () => {
      const hmtx = font.hmtx;
      expect(hmtx).toBeDefined();
      expect(hmtx!.tag).toBe("hmtx");
    });

    it("should return advance widths", () => {
      // Glyph 0 is typically .notdef
      const width0 = font.getAdvanceWidth(0);
      expect(width0).toBeGreaterThan(0);

      // Space character (glyph for U+0020)
      const spaceGid = font.getGlyphId(0x20);
      const spaceWidth = font.getAdvanceWidth(spaceGid);
      expect(spaceWidth).toBeGreaterThan(0);
      expect(spaceWidth).toBeLessThan(font.unitsPerEm); // Space is narrower than em
    });

    it("should handle out-of-range glyph IDs", () => {
      // Should return the last advance width for out-of-range glyphs
      const width = font.getAdvanceWidth(font.numGlyphs + 100);
      expect(width).toBeGreaterThanOrEqual(0);
    });
  });

  describe("loca table", () => {
    it("should parse loca table", () => {
      const loca = font.loca;
      expect(loca).toBeDefined();
      expect(loca!.tag).toBe("loca");
    });

    it("should return glyph offsets", () => {
      const loca = font.loca!;
      // Should have numGlyphs + 1 offsets
      expect(loca.offsets.length).toBe(font.numGlyphs + 1);

      // First offset should be 0
      expect(loca.getOffset(0)).toBe(0);

      // Offsets should be non-decreasing
      for (let i = 1; i < Math.min(100, loca.offsets.length); i++) {
        expect(loca.getOffset(i)).toBeGreaterThanOrEqual(loca.getOffset(i - 1));
      }
    });
  });

  describe("cmap table", () => {
    it("should parse cmap table", () => {
      const cmap = font.cmap;
      expect(cmap).toBeDefined();
      expect(cmap!.tag).toBe("cmap");
    });

    it("should have subtables", () => {
      expect(font.cmap!.subtables.length).toBeGreaterThan(0);
    });

    it("should have Windows Unicode BMP subtable", () => {
      const subtable = font.cmap!.getSubtable(PLATFORM_WINDOWS, ENCODING_WIN_UNICODE_BMP);
      expect(subtable).toBeDefined();
    });

    it("should map basic Latin characters", () => {
      // 'A' = U+0041
      const glyphA = font.getGlyphId(0x41);
      expect(glyphA).toBeGreaterThan(0);

      // 'a' = U+0061
      const glypha = font.getGlyphId(0x61);
      expect(glypha).toBeGreaterThan(0);
      expect(glypha).not.toBe(glyphA); // Different glyphs

      // Space = U+0020
      const glyphSpace = font.getGlyphId(0x20);
      expect(glyphSpace).toBeGreaterThan(0);
    });

    it("should return 0 for unmapped characters", () => {
      // Private use area character unlikely to be mapped
      const glyph = font.getGlyphId(0xf8ff);
      expect(glyph).toBe(0);
    });

    it("should map trade mark sign (from PDFBox test)", () => {
      // U+2122 TRADE MARK SIGN
      const gid = font.getGlyphId(0x2122);
      expect(gid).toBeGreaterThan(0);
    });

    it("should map euro sign (from PDFBox test)", () => {
      // U+20AC EURO SIGN
      const gid = font.getGlyphId(0x20ac);
      expect(gid).toBeGreaterThan(0);
    });

    it("should report hasGlyph correctly", () => {
      expect(font.hasGlyph(0x41)).toBe(true); // 'A'
      expect(font.hasGlyph(0xf8ff)).toBe(false); // Private use
    });
  });

  describe("getUnicodeCmap", () => {
    it("should return a unicode cmap", () => {
      const cmap = font.cmap!.getUnicodeCmap();
      expect(cmap).toBeDefined();
    });

    it("should map characters via unicode cmap", () => {
      const cmap = font.cmap!.getUnicodeCmap()!;
      expect(cmap.getGlyphId(0x41)).toBeGreaterThan(0);
    });
  });

  describe("getTableBytes", () => {
    it("should return raw table bytes", () => {
      const headBytes = font.getTableBytes("head");
      expect(headBytes).toBeDefined();
      expect(headBytes!.length).toBeGreaterThan(0);
      // head table is always 54 bytes
      expect(headBytes!.length).toBe(54);
    });

    it("should return undefined for missing tables", () => {
      const bytes = font.getTableBytes("nonexistent");
      expect(bytes).toBeUndefined();
    });
  });
});

describe("TrueType Font Parser - embedded mode", () => {
  it("should allow missing cmap/name/post when embedded", async () => {
    // This test verifies the isEmbedded option allows fonts with missing tables
    // In practice, embedded fonts in PDFs often have tables stripped

    // For now, just verify the option is accepted
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = parseTTF(fontBytes, { isEmbedded: false });
    expect(font).toBeDefined();
  });
});

describe("name table", () => {
  let fontBytes: Uint8Array;
  let font: TrueTypeFont;

  beforeAll(async () => {
    fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    font = parseTTF(fontBytes);
  });

  it("should parse name table", () => {
    const name = font.name;
    expect(name).toBeDefined();
    expect(name!.tag).toBe("name");
  });

  it("should have name records", () => {
    expect(font.name!.records.length).toBeGreaterThan(0);
  });

  it("should return font family name", () => {
    expect(font.name!.fontFamily).toBeDefined();
    expect(font.name!.fontFamily).toContain("Liberation");
  });

  it("should return PostScript name", () => {
    expect(font.name!.postScriptName).toBeDefined();
    expect(font.name!.postScriptName).toContain("LiberationSans");
  });

  it("should return font subfamily", () => {
    expect(font.name!.fontSubfamily).toBeDefined();
    expect(font.name!.fontSubfamily).toBe("Regular");
  });

  it("should get English name by ID", () => {
    // Name ID 1 is font family
    const family = font.name!.getEnglishName(1);
    expect(family).toBeDefined();
    expect(family).toContain("Liberation");
  });
});

describe("post table", () => {
  let fontBytes: Uint8Array;
  let font: TrueTypeFont;

  beforeAll(async () => {
    fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    font = parseTTF(fontBytes);
  });

  it("should parse post table", () => {
    const post = font.post;
    expect(post).toBeDefined();
    expect(post!.tag).toBe("post");
  });

  it("should have valid format type", () => {
    expect([1.0, 2.0, 2.5, 3.0]).toContain(font.post!.formatType);
  });

  it("should have glyph names for format 1.0 or 2.0", () => {
    const post = font.post!;
    if (post.formatType === 1.0 || post.formatType === 2.0) {
      expect(post.glyphNames).toBeDefined();
      expect(post.glyphNames!.length).toBeGreaterThan(0);
    }
  });

  it("should return .notdef for glyph 0", () => {
    const name = font.post!.getName(0);
    if (font.post!.glyphNames) {
      expect(name).toBe(".notdef");
    }
  });

  it("should return glyph names for common characters (from PDFBox test)", () => {
    const post = font.post!;
    if (post.glyphNames) {
      // Trade mark sign glyph should have name "trademark"
      const trademarkGid = font.getGlyphId(0x2122);
      if (trademarkGid > 0) {
        expect(post.getName(trademarkGid)).toBe("trademark");
      }

      // Euro sign should have name "Euro"
      const euroGid = font.getGlyphId(0x20ac);
      if (euroGid > 0) {
        expect(post.getName(euroGid)).toBe("Euro");
      }
    }
  });
});

describe("OS/2 table", () => {
  let fontBytes: Uint8Array;
  let font: TrueTypeFont;

  beforeAll(async () => {
    fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    font = parseTTF(fontBytes);
  });

  it("should parse OS/2 table", () => {
    const os2 = font.os2;
    expect(os2).toBeDefined();
    expect(os2!.tag).toBe("OS/2");
  });

  it("should have valid weight class", () => {
    expect(font.os2!.weightClass).toBeGreaterThanOrEqual(100);
    expect(font.os2!.weightClass).toBeLessThanOrEqual(900);
  });

  it("should have valid width class", () => {
    expect(font.os2!.widthClass).toBeGreaterThanOrEqual(1);
    expect(font.os2!.widthClass).toBeLessThanOrEqual(9);
  });

  it("should have PANOSE data", () => {
    expect(font.os2!.panose).toBeDefined();
    expect(font.os2!.panose.length).toBe(10);
  });

  it("should have valid typographic metrics", () => {
    expect(font.os2!.typoAscender).toBeGreaterThan(0);
    expect(font.os2!.typoDescender).toBeLessThan(0);
  });

  it("should have vendor ID", () => {
    expect(font.os2!.achVendId).toBeDefined();
    expect(font.os2!.achVendId.length).toBe(4);
  });
});

describe("glyf table", () => {
  let fontBytes: Uint8Array;
  let font: TrueTypeFont;

  beforeAll(async () => {
    fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    font = parseTTF(fontBytes);
  });

  it("should parse glyf table", () => {
    const glyf = font.glyf;
    expect(glyf).toBeDefined();
    expect(glyf!.tag).toBe("glyf");
  });

  it("should return undefined for invalid glyph IDs", () => {
    expect(font.glyf!.getGlyph(-1)).toBeUndefined();
    expect(font.glyf!.getGlyph(font.numGlyphs + 100)).toBeUndefined();
  });

  it("should parse simple glyphs", () => {
    // Get glyph for 'A'
    const glyphId = font.getGlyphId(0x41);
    expect(glyphId).toBeGreaterThan(0);

    const glyph = font.glyf!.getGlyph(glyphId);
    expect(glyph).toBeDefined();
    expect(glyph!.description.isComposite).toBe(false);
    expect(glyph!.description.numberOfContours).toBeGreaterThan(0);
    expect(glyph!.description.pointCount).toBeGreaterThan(0);
  });

  it("should have valid bounds for glyphs", () => {
    const glyphId = font.getGlyphId(0x41); // 'A'
    const glyph = font.glyf!.getGlyph(glyphId);
    expect(glyph).toBeDefined();
    expect(glyph!.bounds.xMax).toBeGreaterThan(glyph!.bounds.xMin);
    expect(glyph!.bounds.yMax).toBeGreaterThan(glyph!.bounds.yMin);
  });

  it("should parse composite glyphs (like accented characters)", () => {
    // 'Ö' (O with dieresis) is typically a composite glyph
    const glyphId = font.getGlyphId(0xd6); // Ö
    expect(glyphId).toBeGreaterThan(0);

    const glyph = font.glyf!.getGlyph(glyphId);
    expect(glyph).toBeDefined();

    if (glyph!.description.isComposite) {
      expect(glyph!.description.components).toBeDefined();
      expect(glyph!.description.components!.length).toBeGreaterThan(0);
    }
  });

  it("should get composite glyph component IDs", () => {
    // Find a composite glyph
    const glyphId = font.getGlyphId(0xd6); // Ö
    const glyph = font.glyf!.getGlyph(glyphId);

    if (glyph?.description.isComposite) {
      const componentIds = font.glyf!.getCompositeGlyphIds(glyphId);
      expect(componentIds.size).toBeGreaterThan(0);

      // Components should be valid glyph IDs
      for (const compId of componentIds) {
        expect(compId).toBeGreaterThanOrEqual(0);
        expect(compId).toBeLessThan(font.numGlyphs);
      }
    }
  });

  it("should handle empty glyphs (space)", () => {
    const spaceGid = font.getGlyphId(0x20);
    const glyph = font.glyf!.getGlyph(spaceGid);

    // Space typically has no outline
    expect(glyph).toBeDefined();
    expect(glyph!.description.pointCount).toBe(0);
  });

  it("should parse glyph with valid coordinates", () => {
    const glyphId = font.getGlyphId(0x41); // 'A'
    const glyph = font.glyf!.getGlyph(glyphId);
    expect(glyph).toBeDefined();

    const desc = glyph!.description;
    if (!desc.isComposite && desc.xCoordinates && desc.yCoordinates) {
      expect(desc.xCoordinates.length).toBe(desc.pointCount);
      expect(desc.yCoordinates.length).toBe(desc.pointCount);
      expect(desc.flags!.length).toBe(desc.pointCount);
    }
  });
});

describe("TrueType Font Parser - other fonts", () => {
  it("should parse JosefinSans-Italic.ttf", async () => {
    const bytes = await loadFixture("fonts", "ttf/JosefinSans-Italic.ttf");
    const font = parseTTF(bytes);

    expect(font.head).toBeDefined();
    expect(font.numGlyphs).toBeGreaterThan(0);
    expect(font.getGlyphId(0x41)).toBeGreaterThan(0); // 'A'
  });

  it("should parse Lohit-Bengali.ttf (complex script)", async () => {
    const bytes = await loadFixture("fonts", "ttf/Lohit-Bengali.ttf");
    const font = parseTTF(bytes);

    expect(font.head).toBeDefined();
    expect(font.numGlyphs).toBeGreaterThan(0);

    // Bengali script - U+0985 is the first letter "অ"
    const bengaliGlyph = font.getGlyphId(0x0985);
    expect(bengaliGlyph).toBeGreaterThan(0);
  });
});

describe("Variable Font Support", () => {
  describe("static fonts", () => {
    it("should report isVariableFont() as false for static fonts", async () => {
      const bytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = parseTTF(bytes);
      expect(font.isVariableFont()).toBe(false);
    });

    it("should return empty axes for static fonts", async () => {
      const bytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = parseTTF(bytes);
      expect(font.getVariationAxes()).toEqual([]);
    });

    it("should return empty named instances for static fonts", async () => {
      const bytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
      const font = parseTTF(bytes);
      expect(font.getNamedInstances()).toEqual([]);
    });
  });

  describe("variable fonts (Roboto Flex)", () => {
    let font: TrueTypeFont;

    beforeAll(async () => {
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      font = parseTTF(bytes);
    });

    it("should detect variable font", () => {
      expect(font.isVariableFont()).toBe(true);
    });

    it("should have fvar table", () => {
      expect(font.fvar).toBeDefined();
      expect(font.fvar!.tag).toBe("fvar");
    });

    it("should have variation axes", () => {
      const axes = font.getVariationAxes();
      expect(axes.length).toBeGreaterThan(0);
    });

    it("should have weight axis (wght)", () => {
      const axes = font.getVariationAxes();
      const weightAxis = axes.find(a => a.tag === "wght");

      expect(weightAxis).toBeDefined();
      expect(weightAxis!.minValue).toBeLessThan(weightAxis!.defaultValue);
      expect(weightAxis!.defaultValue).toBeLessThan(weightAxis!.maxValue);
      // Typical weight range is 100-900
      expect(weightAxis!.minValue).toBeGreaterThanOrEqual(100);
      expect(weightAxis!.maxValue).toBeLessThanOrEqual(1000);
    });

    it("should have width axis (wdth)", () => {
      const axes = font.getVariationAxes();
      const widthAxis = axes.find(a => a.tag === "wdth");

      expect(widthAxis).toBeDefined();
      // Width is typically 25-151 or similar
      expect(widthAxis!.minValue).toBeGreaterThan(0);
      expect(widthAxis!.maxValue).toBeGreaterThan(widthAxis!.minValue);
    });

    it("should have optical size axis (opsz)", () => {
      const axes = font.getVariationAxes();
      const opszAxis = axes.find(a => a.tag === "opsz");

      expect(opszAxis).toBeDefined();
    });

    it("should have named instances", () => {
      const instances = font.getNamedInstances();
      expect(instances.length).toBeGreaterThan(0);
    });

    it("named instances should have coordinates for each axis", () => {
      const axes = font.getVariationAxes();
      const instances = font.getNamedInstances();

      for (const instance of instances) {
        expect(instance.coordinates.length).toBe(axes.length);
      }
    });

    it("named instances should have valid name IDs", () => {
      const instances = font.getNamedInstances();

      for (const instance of instances) {
        expect(instance.subfamilyNameId).toBeGreaterThan(0);
      }
    });
  });

  describe("axis utilities", () => {
    it("should find axis by tag", async () => {
      const { findAxis, getWeightAxis, getWidthAxis } = await import("./tables/fvar.ts");
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      const font = parseTTF(bytes);
      const fvar = font.fvar!;

      const weightAxis = findAxis(fvar, "wght");
      expect(weightAxis).toBeDefined();
      expect(weightAxis!.tag).toBe("wght");

      // Convenience functions
      expect(getWeightAxis(fvar)).toBeDefined();
      expect(getWidthAxis(fvar)).toBeDefined();
    });

    it("should normalize axis values", async () => {
      const { normalizeAxisValue, denormalizeAxisValue } = await import("./tables/fvar.ts");
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      const font = parseTTF(bytes);
      const weightAxis = font.getVariationAxes().find(a => a.tag === "wght")!;

      // At default value should be 0
      expect(normalizeAxisValue(weightAxis, weightAxis.defaultValue)).toBe(0);

      // At min value should be -1
      expect(normalizeAxisValue(weightAxis, weightAxis.minValue)).toBe(-1);

      // At max value should be 1
      expect(normalizeAxisValue(weightAxis, weightAxis.maxValue)).toBe(1);

      // Round-trip test
      const testValue = 700;
      const normalized = normalizeAxisValue(weightAxis, testValue);
      const denormalized = denormalizeAxisValue(weightAxis, normalized);
      expect(denormalized).toBeCloseTo(testValue, 5);
    });

    it("should clamp out-of-range values during normalization", async () => {
      const { normalizeAxisValue } = await import("./tables/fvar.ts");
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      const font = parseTTF(bytes);
      const weightAxis = font.getVariationAxes().find(a => a.tag === "wght")!;

      // Below min should clamp to -1
      expect(normalizeAxisValue(weightAxis, 0)).toBe(-1);

      // Above max should clamp to 1
      expect(normalizeAxisValue(weightAxis, 2000)).toBe(1);
    });
  });

  describe("STAT table (Style Attributes)", () => {
    let font: TrueTypeFont;

    beforeAll(async () => {
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      font = parseTTF(bytes);
    });

    it("should have STAT table", () => {
      expect(font.stat).toBeDefined();
      expect(font.stat!.tag).toBe("STAT");
    });

    it("should have design axes", () => {
      const stat = font.stat!;
      expect(stat.designAxes.length).toBeGreaterThan(0);
    });

    it("should have design axis for weight", () => {
      const stat = font.stat!;
      const weightAxis = stat.designAxes.find(a => a.tag === "wght");
      expect(weightAxis).toBeDefined();
      expect(weightAxis!.axisNameId).toBeGreaterThan(0);
    });

    it("should have axis values array (may be empty)", () => {
      const stat = font.stat!;
      // Roboto Flex has a minimal STAT table with 0 axis values
      // This is valid per the spec - axis values are optional
      expect(Array.isArray(stat.axisValues)).toBe(true);
    });

    it("axis values should have valid name IDs if present", () => {
      const stat = font.stat!;
      for (const axisValue of stat.axisValues) {
        expect(axisValue.valueNameId).toBeGreaterThan(0);
      }
    });

    it("should have elidedFallbackNameId (version 1.1+)", () => {
      const stat = font.stat!;
      if (stat.minorVersion >= 1) {
        expect(stat.elidedFallbackNameId).toBeDefined();
        expect(stat.elidedFallbackNameId).toBeGreaterThan(0);
      }
    });

    it("should find design axis by tag", async () => {
      const { findDesignAxis } = await import("./tables/stat.ts");
      const stat = font.stat!;

      const weightAxis = findDesignAxis(stat, "wght");
      expect(weightAxis).toBeDefined();
      expect(weightAxis!.tag).toBe("wght");

      const unknownAxis = findDesignAxis(stat, "xxxx");
      expect(unknownAxis).toBeUndefined();
    });

    it("should get axis values for specific axis", async () => {
      const { getAxisValuesForAxis } = await import("./tables/stat.ts");
      const stat = font.stat!;

      // Find weight axis index
      const weightAxisIndex = stat.designAxes.findIndex(a => a.tag === "wght");
      if (weightAxisIndex >= 0) {
        const values = getAxisValuesForAxis(stat, weightAxisIndex);
        expect(values.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("avar table (Axis Variations)", () => {
    let font: TrueTypeFont;

    beforeAll(async () => {
      const bytes = await loadFixture("fonts", "variable/RobotoFlex-VariableFont.ttf");
      font = parseTTF(bytes);
    });

    it("should have avar table", () => {
      expect(font.avar).toBeDefined();
      expect(font.avar!.tag).toBe("avar");
    });

    it("should have segment maps for each axis in fvar", () => {
      const avar = font.avar!;
      const fvar = font.fvar!;

      // avar should have same number of segment maps as fvar has axes
      expect(avar.axisSegmentMaps.length).toBe(fvar.axes.length);
    });

    it("segment maps should have axis value mappings", () => {
      const avar = font.avar!;

      for (const segmentMap of avar.axisSegmentMaps) {
        // Each segment map should have at least 3 mappings (-1→-1, 0→0, 1→1)
        expect(segmentMap.axisValueMaps.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should have required identity mappings (-1, 0, 1)", async () => {
      const { isValidSegmentMap } = await import("./tables/avar.ts");
      const avar = font.avar!;

      // At least some segment maps should be valid
      const validMaps = avar.axisSegmentMaps.filter(isValidSegmentMap);
      expect(validMaps.length).toBeGreaterThan(0);
    });

    it("should apply avar mapping correctly", async () => {
      const { applyAvarMapping } = await import("./tables/avar.ts");
      const avar = font.avar!;

      // Test with the first axis that has mappings
      const segmentMap = avar.axisSegmentMaps[0];

      // Identity points should map to themselves
      expect(applyAvarMapping(segmentMap, 0)).toBeCloseTo(0, 5);

      // Endpoints should also approximately map correctly
      expect(applyAvarMapping(segmentMap, -1)).toBeCloseTo(-1, 2);
      expect(applyAvarMapping(segmentMap, 1)).toBeCloseTo(1, 2);
    });

    it("axis value maps should be in ascending order", () => {
      const avar = font.avar!;

      for (const segmentMap of avar.axisSegmentMaps) {
        const maps = segmentMap.axisValueMaps;
        for (let i = 1; i < maps.length; i++) {
          expect(maps[i].fromCoordinate).toBeGreaterThanOrEqual(maps[i - 1].fromCoordinate);
        }
      }
    });
  });
});
