import { describe, expect, it } from "vitest";

import { CIDFont, CIDWidthMap } from "./cid-font";
import { CMap } from "./cmap";
import { CompositeFont } from "./composite-font";
import { ToUnicodeMap } from "./to-unicode";

describe("CompositeFont", () => {
  describe("constructor", () => {
    it("should create with minimal options", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      expect(font.subtype).toBe("Type0");
      expect(font.baseFontName).toBe("TestFont");
    });
  });

  describe("getWidth", () => {
    it("should get width via CMap lookup then CIDFont", () => {
      const cmap = CMap.identityH();
      const widths = new CIDWidthMap();
      widths.set(0x41, 500); // 'A'
      widths.set(0x42, 600); // 'B'

      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
        defaultWidth: 1000,
        widths,
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // For Identity-H, code = CID
      expect(font.getWidth(0x41)).toBe(500);
      expect(font.getWidth(0x42)).toBe(600);
      expect(font.getWidth(0x43)).toBe(1000); // default
    });
  });

  describe("encodeText", () => {
    it("should encode text via CMap", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // For Identity-H, codes are Unicode code points
      const codes = font.encodeText("AB");

      expect(codes).toEqual([0x41, 0x42]);
    });

    it("should handle CJK characters", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // CJK character U+4E2D (中)
      const codes = font.encodeText("中");

      expect(codes).toEqual([0x4e2d]);
    });

    it("should handle emoji as code points", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // Emoji U+1F389 (🎉) encoded as full code point
      // (PDF string encoding handles UTF-16 conversion separately)
      const codes = font.encodeText("🎉");

      expect(codes).toEqual([0x1f389]);
    });
  });

  describe("toUnicode", () => {
    it("should use ToUnicode map when available", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });
      const toUnicodeMap = new ToUnicodeMap();
      toUnicodeMap.set(1, "X");

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
        toUnicodeMap,
      });

      expect(font.toUnicode(1)).toBe("X");
    });

    it("should fall back to Identity for unmapped codes", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // For Identity-H, code is Unicode
      expect(font.toUnicode(0x41)).toBe("A");
      expect(font.toUnicode(0x4e2d)).toBe("中");
    });
  });

  describe("canEncode", () => {
    it("should return true for Identity-H", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      expect(font.canEncode("Hello")).toBe(true);
      expect(font.canEncode("日本語")).toBe(true);
      expect(font.canEncode("🎉")).toBe(true);
    });
  });

  describe("getTextWidth", () => {
    it("should calculate text width at font size", () => {
      const cmap = CMap.identityH();
      const widths = new CIDWidthMap();
      widths.set(0x41, 500);
      widths.set(0x42, 500);
      widths.set(0x43, 500);

      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
        widths,
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      // "ABC" = 3 * 500 = 1500 units
      // At 10pt = 1500 * 10 / 1000 = 15
      const width = font.getTextWidth("ABC", 10);

      expect(width).toBe(15);
    });
  });

  describe("descriptor", () => {
    it("should return CIDFont descriptor", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
        descriptor: null,
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      expect(font.descriptor).toBeNull();
    });
  });

  describe("getCMap and getCIDFont", () => {
    it("should expose CMap and CIDFont", () => {
      const cmap = CMap.identityH();
      const cidFont = new CIDFont({
        subtype: "CIDFontType2",
        baseFontName: "TestFont",
      });

      const font = new CompositeFont({
        baseFontName: "TestFont",
        cmap,
        cidFont,
      });

      expect(font.getCMap()).toBe(cmap);
      expect(font.getCIDFont()).toBe(cidFont);
    });
  });
});
