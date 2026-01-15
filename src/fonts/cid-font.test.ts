import { PdfArray } from "#src/objects/pdf-array";
import { PdfNumber } from "#src/objects/pdf-number";
import { describe, expect, it } from "vitest";

import { CIDFont, CIDWidthMap, parseCIDWidths } from "./cid-font";

describe("CIDWidthMap", () => {
  describe("individual mappings", () => {
    it("should set and get individual widths", () => {
      const map = new CIDWidthMap();
      map.set(1, 500);
      map.set(2, 600);
      map.set(3, 700);

      expect(map.get(1)).toBe(500);
      expect(map.get(2)).toBe(600);
      expect(map.get(3)).toBe(700);
    });

    it("should return undefined for unmapped CIDs", () => {
      const map = new CIDWidthMap();
      map.set(1, 500);

      expect(map.get(100)).toBeUndefined();
    });
  });

  describe("range mappings", () => {
    it("should handle range mappings", () => {
      const map = new CIDWidthMap();
      map.addRange(100, 200, 500);

      expect(map.get(100)).toBe(500);
      expect(map.get(150)).toBe(500);
      expect(map.get(200)).toBe(500);
      expect(map.get(99)).toBeUndefined();
      expect(map.get(201)).toBeUndefined();
    });

    it("should handle multiple ranges", () => {
      const map = new CIDWidthMap();
      map.addRange(100, 200, 500);
      map.addRange(300, 400, 600);

      expect(map.get(150)).toBe(500);
      expect(map.get(350)).toBe(600);
      expect(map.get(250)).toBeUndefined();
    });
  });

  describe("individual takes precedence", () => {
    it("should prefer individual over range", () => {
      const map = new CIDWidthMap();
      map.addRange(100, 200, 500);
      map.set(150, 999);

      expect(map.get(150)).toBe(999);
      expect(map.get(100)).toBe(500);
    });
  });
});

describe("parseCIDWidths", () => {
  it("should parse individual widths format: cid [w1 w2 w3]", () => {
    // [1 [500 600 700]]
    const innerArray = new PdfArray();
    innerArray.push(new PdfNumber(500), new PdfNumber(600), new PdfNumber(700));

    const wArray = new PdfArray();
    wArray.push(new PdfNumber(1), innerArray);

    const map = parseCIDWidths(wArray);

    expect(map.get(1)).toBe(500);
    expect(map.get(2)).toBe(600);
    expect(map.get(3)).toBe(700);
    expect(map.get(4)).toBeUndefined();
  });

  it("should parse range format: cidStart cidEnd width", () => {
    // [100 200 500]
    const wArray = new PdfArray();
    wArray.push(new PdfNumber(100), new PdfNumber(200), new PdfNumber(500));

    const map = parseCIDWidths(wArray);

    expect(map.get(100)).toBe(500);
    expect(map.get(150)).toBe(500);
    expect(map.get(200)).toBe(500);
    expect(map.get(99)).toBeUndefined();
  });

  it("should parse mixed format", () => {
    // [1 [500 600] 100 200 700]
    const innerArray = new PdfArray();
    innerArray.push(new PdfNumber(500), new PdfNumber(600));

    const wArray = new PdfArray();
    wArray.push(
      new PdfNumber(1),
      innerArray,
      new PdfNumber(100),
      new PdfNumber(200),
      new PdfNumber(700),
    );

    const map = parseCIDWidths(wArray);

    expect(map.get(1)).toBe(500);
    expect(map.get(2)).toBe(600);
    expect(map.get(100)).toBe(700);
    expect(map.get(200)).toBe(700);
  });

  it("should handle empty array", () => {
    const wArray = new PdfArray();
    const map = parseCIDWidths(wArray);

    expect(map.size).toBe(0);
  });
});

describe("CIDFont", () => {
  it("should create with defaults", () => {
    const font = new CIDFont({
      subtype: "CIDFontType2",
      baseFontName: "TestFont",
    });

    expect(font.subtype).toBe("CIDFontType2");
    expect(font.baseFontName).toBe("TestFont");
    expect(font.defaultWidth).toBe(1000);
  });

  it("should return default width for unmapped CIDs", () => {
    const font = new CIDFont({
      subtype: "CIDFontType2",
      baseFontName: "TestFont",
      defaultWidth: 500,
    });

    expect(font.getWidth(999)).toBe(500);
  });

  it("should return width from map", () => {
    const widths = new CIDWidthMap();
    widths.set(1, 250);
    widths.set(2, 350);

    const font = new CIDFont({
      subtype: "CIDFontType2",
      baseFontName: "TestFont",
      defaultWidth: 1000,
      widths,
    });

    expect(font.getWidth(1)).toBe(250);
    expect(font.getWidth(2)).toBe(350);
    expect(font.getWidth(3)).toBe(1000);
  });

  it("should return identity GID mapping by default", () => {
    const font = new CIDFont({
      subtype: "CIDFontType2",
      baseFontName: "TestFont",
    });

    expect(font.getGid(0)).toBe(0);
    expect(font.getGid(100)).toBe(100);
    expect(font.getGid(65535)).toBe(65535);
  });

  it("should store CIDSystemInfo", () => {
    const font = new CIDFont({
      subtype: "CIDFontType0",
      baseFontName: "TestFont",
      cidSystemInfo: {
        registry: "Adobe",
        ordering: "Japan1",
        supplement: 6,
      },
    });

    expect(font.cidSystemInfo.registry).toBe("Adobe");
    expect(font.cidSystemInfo.ordering).toBe("Japan1");
    expect(font.cidSystemInfo.supplement).toBe(6);
  });
});
