/**
 * Type1 Parser tests.
 * Tests parsing of Type 1 font components.
 */

import { describe, expect, it } from "vitest";

import { BuiltInEncoding, StandardEncoding, Type1Font } from "./font.ts";
import { parseType1 } from "./parser.ts";
import { PfbParser } from "./pfb-parser.ts";

/**
 * Create a minimal PFB file from ASCII and binary segments.
 */
function createPfb(ascii: Uint8Array, binary: Uint8Array): Uint8Array {
  const START_MARKER = 0x80;
  const ASCII_MARKER = 0x01;
  const BINARY_MARKER = 0x02;
  const EOF_MARKER = 0x03;

  // Calculate total size
  const totalSize = 6 + ascii.length + 6 + binary.length + 2; // 2 headers + segments + EOF
  const pfb = new Uint8Array(totalSize);
  let pos = 0;

  // ASCII segment header
  pfb[pos++] = START_MARKER;
  pfb[pos++] = ASCII_MARKER;
  pfb[pos++] = ascii.length & 0xff;
  pfb[pos++] = (ascii.length >> 8) & 0xff;
  pfb[pos++] = (ascii.length >> 16) & 0xff;
  pfb[pos++] = (ascii.length >> 24) & 0xff;
  pfb.set(ascii, pos);
  pos += ascii.length;

  // Binary segment header
  pfb[pos++] = START_MARKER;
  pfb[pos++] = BINARY_MARKER;
  pfb[pos++] = binary.length & 0xff;
  pfb[pos++] = (binary.length >> 8) & 0xff;
  pfb[pos++] = (binary.length >> 16) & 0xff;
  pfb[pos++] = (binary.length >> 24) & 0xff;
  pfb.set(binary, pos);
  pos += binary.length;

  // EOF marker
  pfb[pos++] = START_MARKER;
  pfb[pos++] = EOF_MARKER;

  return pfb;
}

/**
 * Encode a string to bytes.
 */
function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("PfbParser", () => {
  it("parses a minimal PFB file", () => {
    const ascii = encode("%!PS-AdobeFont-1.0: TestFont\n");
    const binary = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const pfb = createPfb(ascii, binary);

    const parser = new PfbParser(pfb);

    expect(parser.segment1).toEqual(ascii);
    expect(parser.segment2).toEqual(binary);
    expect(parser.lengths[0]).toBe(ascii.length);
    expect(parser.lengths[1]).toBe(binary.length);
  });

  it("handles multiple ASCII segments", () => {
    // Create PFB with two ASCII segments (should be combined)
    const START_MARKER = 0x80;
    const ASCII_MARKER = 0x01;
    const EOF_MARKER = 0x03;

    const ascii1 = encode("%!PS-AdobeFont-1.0: ");
    const ascii2 = encode("TestFont\n");
    const totalSize = 6 + ascii1.length + 6 + ascii2.length + 2;
    const pfb = new Uint8Array(totalSize);
    let pos = 0;

    // First ASCII segment
    pfb[pos++] = START_MARKER;
    pfb[pos++] = ASCII_MARKER;
    pfb[pos++] = ascii1.length & 0xff;
    pfb[pos++] = (ascii1.length >> 8) & 0xff;
    pfb[pos++] = (ascii1.length >> 16) & 0xff;
    pfb[pos++] = (ascii1.length >> 24) & 0xff;
    pfb.set(ascii1, pos);
    pos += ascii1.length;

    // Second ASCII segment
    pfb[pos++] = START_MARKER;
    pfb[pos++] = ASCII_MARKER;
    pfb[pos++] = ascii2.length & 0xff;
    pfb[pos++] = (ascii2.length >> 8) & 0xff;
    pfb[pos++] = (ascii2.length >> 16) & 0xff;
    pfb[pos++] = (ascii2.length >> 24) & 0xff;
    pfb.set(ascii2, pos);
    pos += ascii2.length;

    // EOF
    pfb[pos++] = START_MARKER;
    pfb[pos++] = EOF_MARKER;

    const parser = new PfbParser(pfb);

    // Both ASCII segments should be combined
    expect(parser.lengths[0]).toBe(ascii1.length + ascii2.length);
    expect(parser.lengths[1]).toBe(0); // No binary segment
  });

  it("throws on missing start marker", () => {
    const badPfb = new Uint8Array([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
      0x0f, 0x10, 0x11,
    ]);
    expect(() => new PfbParser(badPfb)).toThrow("Start marker missing");
  });

  it("throws on invalid record type", () => {
    const badPfb = new Uint8Array([
      0x80, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00,
    ]);
    expect(() => new PfbParser(badPfb)).toThrow("Incorrect record type");
  });
});

describe("parseType1", () => {
  // Create a minimal Type 1 font ASCII segment for testing
  const minimalAscii = `%!PS-AdobeFont-1.0: TestFont 001.000
%%Title: TestFont
12 dict begin
/FontName /TestFont def
/FontType 1 def
/FontMatrix [0.001 0 0 0.001 0 0] readonly def
/FontBBox [-100 -200 1000 800] readonly def
/PaintType 0 def
/FontInfo 3 dict dup begin
  /FamilyName (Test Family) readonly def
  /Weight (Medium) readonly def
  /ItalicAngle 0 def
end readonly def
/Encoding StandardEncoding def
currentdict end
currentfile eexec
`;

  it("parses font name from ASCII segment", () => {
    const ascii = encode(minimalAscii);
    // Empty binary segment (no charstrings for this test)
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.fontName).toBe("TestFont");
  });

  it("parses font type", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.fontType).toBe(1);
  });

  it("parses font matrix", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.fontMatrix).toHaveLength(6);
    expect(font.fontMatrix[0]).toBeCloseTo(0.001);
    expect(font.fontMatrix[3]).toBeCloseTo(0.001);
  });

  it("parses font bounding box", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.fontBBox).toEqual([-100, -200, 1000, 800]);
  });

  it("parses FontInfo", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.familyName).toBe("Test Family");
    expect(font.weight).toBe("Medium");
    expect(font.italicAngle).toBe(0);
  });

  it("parses StandardEncoding", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.encoding).toBe(StandardEncoding);
  });

  it("parses paint type", () => {
    const ascii = encode(minimalAscii);
    const binary = new Uint8Array(0);

    const font = parseType1(ascii, binary);

    expect(font.paintType).toBe(0);
  });
});

describe("Type1Font", () => {
  it("has correct default values", () => {
    const font = new Type1Font(new Uint8Array(0), new Uint8Array(0));

    expect(font.fontName).toBe("");
    expect(font.fontType).toBe(1);
    expect(font.paintType).toBe(0);
    expect(font.isFixedPitch).toBe(false);
    expect(font.italicAngle).toBe(0);
    expect(font.blueScale).toBeCloseTo(0.039625);
    expect(font.blueShift).toBe(7);
    expect(font.blueFuzz).toBe(1);
    expect(font.languageGroup).toBe(0);
  });

  it("reports hasGlyph correctly", () => {
    const font = new Type1Font(new Uint8Array(0), new Uint8Array(0));

    expect(font.hasGlyph("A")).toBe(false);

    font.charstrings.set("A", new Uint8Array([1, 2, 3]));
    expect(font.hasGlyph("A")).toBe(true);
  });

  it("returns glyph names", () => {
    const font = new Type1Font(new Uint8Array(0), new Uint8Array(0));

    font.charstrings.set(".notdef", new Uint8Array([1]));
    font.charstrings.set("A", new Uint8Array([2]));
    font.charstrings.set("B", new Uint8Array([3]));

    const names = font.getGlyphNames();
    expect(names).toContain(".notdef");
    expect(names).toContain("A");
    expect(names).toContain("B");
    expect(names).toHaveLength(3);
  });
});

describe("StandardEncoding", () => {
  it("maps common characters", () => {
    expect(StandardEncoding.getName(0x41)).toBe("A");
    expect(StandardEncoding.getName(0x61)).toBe("a");
    expect(StandardEncoding.getName(0x20)).toBe("space");
    expect(StandardEncoding.getName(0x30)).toBe("zero");
  });

  it("returns undefined for unmapped codes", () => {
    expect(StandardEncoding.getName(0x00)).toBeUndefined();
    expect(StandardEncoding.getName(0xff)).toBeUndefined();
  });
});

describe("BuiltInEncoding", () => {
  it("uses custom code-to-name mapping", () => {
    const mapping = new Map<number, string>([
      [0x41, "Alpha"],
      [0x42, "Beta"],
    ]);
    const encoding = new BuiltInEncoding(mapping);

    expect(encoding.getName(0x41)).toBe("Alpha");
    expect(encoding.getName(0x42)).toBe("Beta");
    expect(encoding.getName(0x43)).toBeUndefined();
  });
});
