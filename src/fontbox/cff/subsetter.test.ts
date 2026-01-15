import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { parseCFF } from "./parser";
import { CFFSubsetter } from "./subsetter";

describe("CFFSubsetter", () => {
  it("should create a valid CFF subset", async () => {
    // Load an OTF font with CFF outlines
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");

    // Parse to get the CFF data
    const fonts = parseCFF(fontBytes);
    expect(fonts.length).toBe(1);

    const font = fonts[0];
    expect(font.charStrings.length).toBeGreaterThan(0);

    // Create subsetter and add some glyphs
    const subsetter = new CFFSubsetter(font);
    subsetter.addGlyph(0); // .notdef (always included anyway)
    subsetter.addGlyph(1);
    subsetter.addGlyph(2);
    subsetter.addGlyph(3);

    // Write the subset
    const subsetData = subsetter.write();

    // Should produce valid CFF data
    expect(subsetData.length).toBeGreaterThan(0);

    // Check CFF header
    expect(subsetData[0]).toBe(1); // major version
    expect(subsetData[1]).toBe(0); // minor version
    expect(subsetData[2]).toBe(4); // header size
  });

  it("should handle subsetting with many glyphs", async () => {
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");
    const fonts = parseCFF(fontBytes);
    const font = fonts[0];

    const subsetter = new CFFSubsetter(font);

    // Add more glyphs
    for (let i = 0; i < Math.min(50, font.charStrings.length); i++) {
      subsetter.addGlyph(i);
    }

    const subsetData = subsetter.write();
    expect(subsetData.length).toBeGreaterThan(0);

    // Should be smaller than original if we're only using a subset
    // (unless the font is very small)
    if (font.charStrings.length > 50) {
      expect(subsetData.length).toBeLessThan(fontBytes.length);
    }
  });

  it("should parse the subset CFF", async () => {
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");
    const fonts = parseCFF(fontBytes);
    const font = fonts[0];

    const subsetter = new CFFSubsetter(font);
    subsetter.addGlyph(1);
    subsetter.addGlyph(2);
    subsetter.addGlyph(3);

    const subsetData = subsetter.write();

    // The subset should be parseable as a valid CFF
    const subsetFonts = parseCFF(subsetData);
    expect(subsetFonts.length).toBe(1);

    // Should have the subset glyphs plus .notdef
    const subsetFont = subsetFonts[0];
    expect(subsetFont.charStrings.length).toBe(4); // .notdef + 3 glyphs

    // Should be a CID font (we convert to CID during subsetting)
    expect(subsetFont.isCIDFont).toBe(true);
  });

  it("should handle empty subset (only .notdef)", async () => {
    const fontBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");
    const fonts = parseCFF(fontBytes);
    const font = fonts[0];

    const subsetter = new CFFSubsetter(font);
    // Don't add any glyphs - only .notdef will be included

    const subsetData = subsetter.write();
    expect(subsetData.length).toBeGreaterThan(0);

    // Should be parseable
    const subsetFonts = parseCFF(subsetData);
    expect(subsetFonts.length).toBe(1);
    expect(subsetFonts[0].charStrings.length).toBe(1); // Just .notdef
  });
});
