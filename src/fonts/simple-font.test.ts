import { describe, expect, it } from "vitest";

import { DifferencesEncoding } from "./encodings/differences";
import { WinAnsiEncoding } from "./encodings/win-ansi";
import { FontDescriptor } from "./font-descriptor";
import { SimpleFont } from "./simple-font";
import { ToUnicodeMap } from "./to-unicode";

describe("SimpleFont", () => {
  describe("constructor defaults", () => {
    it("should create with minimal options", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      expect(font.subtype).toBe("TrueType");
      expect(font.baseFontName).toBe("Helvetica");
      expect(font.firstChar).toBe(0);
      expect(font.lastChar).toBe(255);
      expect(font.isStandard14).toBe(true);
    });

    it("should detect non-standard14 fonts", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "CustomFont",
      });

      expect(font.isStandard14).toBe(false);
    });

    it("should handle subset prefix in font name", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "ABCDEF+Helvetica",
      });

      expect(font.isStandard14).toBe(true);
    });
  });

  describe("getWidth", () => {
    it("should return width from widths array", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "CustomFont",
        firstChar: 32,
        lastChar: 34,
        widths: [100, 200, 300],
      });

      expect(font.getWidth(32)).toBe(100);
      expect(font.getWidth(33)).toBe(200);
      expect(font.getWidth(34)).toBe(300);
    });

    it("should return missing width for out-of-range codes", () => {
      const descriptor = new FontDescriptor({
        fontName: "Test",
        flags: 0,
        fontBBox: [0, 0, 0, 0],
        italicAngle: 0,
        ascent: 0,
        descent: 0,
        leading: 0,
        capHeight: 0,
        xHeight: 0,
        stemV: 0,
        stemH: 0,
        avgWidth: 0,
        maxWidth: 0,
        missingWidth: 500,
      });

      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "CustomFont",
        firstChar: 32,
        lastChar: 34,
        widths: [100, 200, 300],
        descriptor,
      });

      expect(font.getWidth(31)).toBe(500);
      expect(font.getWidth(35)).toBe(500);
    });

    it("should use Standard 14 metrics for standard fonts", () => {
      const font = new SimpleFont({
        subtype: "Type1",
        baseFontName: "Helvetica",
      });

      // 'A' in WinAnsi is code 65, width should be 667
      expect(font.getWidth(65)).toBe(667);

      // space (code 32) should be 278
      expect(font.getWidth(32)).toBe(278);
    });

    it("should use Courier monospace widths", () => {
      const font = new SimpleFont({
        subtype: "Type1",
        baseFontName: "Courier",
      });

      // All Courier glyphs are 600
      expect(font.getWidth(65)).toBe(600);
      expect(font.getWidth(32)).toBe(600);
      expect(font.getWidth(100)).toBe(600);
    });
  });

  describe("encodeText", () => {
    it("should encode ASCII text", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      const codes = font.encodeText("ABC");

      expect(codes).toEqual([65, 66, 67]);
    });

    it("should encode extended characters", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      const codes = font.encodeText("\u00E9"); // é

      expect(codes).toEqual([0xe9]);
    });
  });

  describe("toUnicode", () => {
    it("should decode using encoding", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      expect(font.toUnicode(65)).toBe("A");
      expect(font.toUnicode(32)).toBe(" ");
    });

    it("should use ToUnicode map when available", () => {
      // Create a ToUnicodeMap with some mappings
      const toUnicodeMap = new ToUnicodeMap();
      toUnicodeMap.set(1, "X");

      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
        toUnicodeMap,
      });

      // Should use ToUnicode for code 1
      expect(font.toUnicode(1)).toBe("X");

      // Should fall back to encoding for code 65
      expect(font.toUnicode(65)).toBe("A");
    });
  });

  describe("canEncode", () => {
    it("should return true for encodable text", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      expect(font.canEncode("Hello")).toBe(true);
      expect(font.canEncode("ABC123")).toBe(true);
    });

    it("should return false for non-encodable text", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      // Chinese characters not in WinAnsi
      expect(font.canEncode("\u4E2D")).toBe(false);
    });
  });

  describe("getTextWidth", () => {
    it("should calculate text width at given font size", () => {
      const font = new SimpleFont({
        subtype: "Type1",
        baseFontName: "Helvetica",
      });

      // "A" is 667 units, at 12pt = 667 * 12 / 1000 = 8.004
      const width = font.getTextWidth("A", 12);

      expect(width).toBeCloseTo(8.004, 2);
    });

    it("should sum widths for multiple characters", () => {
      const font = new SimpleFont({
        subtype: "Type1",
        baseFontName: "Courier",
      });

      // Courier is monospace (600 units per glyph)
      // "ABC" = 3 * 600 = 1800 units
      // At 10pt = 1800 * 10 / 1000 = 18
      const width = font.getTextWidth("ABC", 10);

      expect(width).toBe(18);
    });
  });

  describe("with custom encoding", () => {
    it("should use differences encoding", () => {
      const differences = new Map<number, string>([
        [65, "A"], // Map code 65 to glyph "A"
        [66, "B"],
      ]);

      const encoding = new DifferencesEncoding(WinAnsiEncoding.instance, differences);

      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
        encoding,
      });

      expect(font.getEncoding().name).toBe("WinAnsiEncoding+Differences");
    });
  });

  describe("descriptor", () => {
    it("should return null when no descriptor", () => {
      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "Helvetica",
      });

      expect(font.descriptor).toBeNull();
    });

    it("should return descriptor when provided", () => {
      const descriptor = new FontDescriptor({
        fontName: "Test",
        flags: 32,
        fontBBox: [0, -200, 1000, 800],
        italicAngle: 0,
        ascent: 800,
        descent: -200,
        leading: 0,
        capHeight: 700,
        xHeight: 500,
        stemV: 80,
        stemH: 0,
        avgWidth: 0,
        maxWidth: 0,
        missingWidth: 250,
      });

      const font = new SimpleFont({
        subtype: "TrueType",
        baseFontName: "CustomFont",
        descriptor,
      });

      expect(font.descriptor).toBe(descriptor);
      expect(font.descriptor?.ascent).toBe(800);
    });
  });
});
