/**
 * Tests for form font functionality.
 */

import { describe, expect, it } from "vitest";
import { ExistingFont, isEmbeddedFont, isExistingFont } from "./form-font";

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
