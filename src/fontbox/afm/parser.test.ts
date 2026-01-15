/**
 * AFM Parser tests.
 *
 * Ported from Apache PDFBox's fontbox/afm/AFMParserTest.java
 */

import { beforeAll, describe, expect, it } from "vitest";

import { loadFixture } from "../../test-utils.ts";
import type { FontMetrics } from "./index.ts";
import { parseAFM } from "./parser.ts";

describe("AFM Parser", () => {
  let helveticaBytes: Uint8Array;
  let helvetica: FontMetrics;

  beforeAll(async () => {
    helveticaBytes = await loadFixture("afm", "Helvetica.afm");
    helvetica = parseAFM(helveticaBytes);
  });

  describe("error handling", () => {
    it("should throw on missing StartFontMetrics", () => {
      const data = new TextEncoder().encode("huhu");
      expect(() => parseAFM(data)).toThrow(/Expected 'StartFontMetrics'/);
    });

    it("should throw on missing EndFontMetrics", async () => {
      const data = await loadFixture("afm", "NoEndFontMetrics.afm");
      expect(() => parseAFM(data)).toThrow(/Unknown AFM key/);
    });

    it("should throw on malformed float", async () => {
      const data = await loadFixture("afm", "MalformedFloat.afm");
      expect(() => parseAFM(data)).toThrow(/4,1ab/);
    });

    it("should throw on malformed integer", async () => {
      const data = await loadFixture("afm", "MalformedInteger.afm");
      expect(() => parseAFM(data)).toThrow(/3\.4/);
    });
  });

  describe("Helvetica font metrics", () => {
    it("should parse AFM version", () => {
      expect(helvetica.afmVersion).toBe(4.1);
    });

    it("should parse font names", () => {
      expect(helvetica.fontName).toBe("Helvetica");
      expect(helvetica.fullName).toBe("Helvetica");
      expect(helvetica.familyName).toBe("Helvetica");
    });

    it("should parse weight", () => {
      expect(helvetica.weight).toBe("Medium");
    });

    it("should parse font bounding box", () => {
      const bbox = helvetica.fontBBox!;
      expect(bbox).toBeDefined();
      expect(bbox.lowerLeftX).toBe(-166);
      expect(bbox.lowerLeftY).toBe(-225);
      expect(bbox.upperRightX).toBe(1000);
      expect(bbox.upperRightY).toBe(931);
    });

    it("should parse font version", () => {
      expect(helvetica.fontVersion).toBe("002.000");
    });

    it("should parse notice", () => {
      expect(helvetica.notice).toContain("Copyright (c) 1985");
      expect(helvetica.notice).toContain("Adobe Systems Incorporated");
    });

    it("should parse encoding scheme", () => {
      expect(helvetica.encodingScheme).toBe("AdobeStandardEncoding");
    });

    it("should parse mapping scheme", () => {
      expect(helvetica.mappingScheme).toBe(0);
    });

    it("should parse escape char", () => {
      expect(helvetica.escChar).toBe(0);
    });

    it("should parse character set", () => {
      expect(helvetica.characterSet).toBe("ExtendedRoman");
    });

    it("should parse characters count", () => {
      expect(helvetica.characters).toBe(0);
    });

    it("should parse isBaseFont", () => {
      expect(helvetica.isBaseFont).toBe(true);
    });

    it("should parse vVector", () => {
      expect(helvetica.vVector).toBeNull();
    });

    it("should parse isFixedV", () => {
      expect(helvetica.isFixedV).toBe(false);
    });

    it("should parse cap height", () => {
      expect(helvetica.capHeight).toBe(718);
    });

    it("should parse x height", () => {
      expect(helvetica.xHeight).toBe(523);
    });

    it("should parse ascender", () => {
      expect(helvetica.ascender).toBe(718);
    });

    it("should parse descender", () => {
      expect(helvetica.descender).toBe(-207);
    });

    it("should parse standard horizontal width", () => {
      expect(helvetica.standardHorizontalWidth).toBe(76);
    });

    it("should parse standard vertical width", () => {
      expect(helvetica.standardVerticalWidth).toBe(88);
    });

    it("should parse comments", () => {
      expect(helvetica.comments.length).toBe(4);
      expect(helvetica.comments[0]).toContain("Copyright");
      expect(helvetica.comments[2]).toBe("UniqueID 43054");
    });

    it("should parse underline position", () => {
      expect(helvetica.underlinePosition).toBe(-100);
    });

    it("should parse underline thickness", () => {
      expect(helvetica.underlineThickness).toBe(50);
    });

    it("should parse italic angle", () => {
      expect(helvetica.italicAngle).toBe(0);
    });

    it("should parse charWidth", () => {
      expect(helvetica.charWidth).toBeNull();
    });

    it("should parse isFixedPitch", () => {
      expect(helvetica.isFixedPitch).toBe(false);
    });
  });

  describe("Helvetica character metrics", () => {
    it("should parse correct number of char metrics", () => {
      expect(helvetica.charMetrics.length).toBe(315);
    });

    it("should parse space character metrics", () => {
      const space = helvetica.charMetrics.find(c => c.name === "space");
      expect(space).toBeDefined();
      expect(space!.wx).toBe(278);
      expect(space!.characterCode).toBe(32);
      expect(space!.boundingBox).toBeDefined();
      expect(space!.boundingBox!.lowerLeftX).toBe(0);
      expect(space!.boundingBox!.lowerLeftY).toBe(0);
      expect(space!.boundingBox!.upperRightX).toBe(0);
      expect(space!.boundingBox!.upperRightY).toBe(0);
      expect(space!.ligatures.length).toBe(0);
      expect(space!.w).toBeNull();
      expect(space!.w0).toBeNull();
      expect(space!.w1).toBeNull();
      expect(space!.vv).toBeNull();
    });

    it("should parse ring character metrics", () => {
      const ring = helvetica.charMetrics.find(c => c.name === "ring");
      expect(ring).toBeDefined();
      expect(ring!.wx).toBe(333);
      expect(ring!.characterCode).toBe(202);
      expect(ring!.boundingBox).toBeDefined();
      expect(ring!.boundingBox!.lowerLeftX).toBe(75);
      expect(ring!.boundingBox!.lowerLeftY).toBe(572);
      expect(ring!.boundingBox!.upperRightX).toBe(259);
      expect(ring!.boundingBox!.upperRightY).toBe(756);
    });
  });

  describe("Helvetica kerning pairs", () => {
    it("should parse kern pairs", () => {
      expect(helvetica.kernPairs.length).toBe(2705);
    });

    it("should parse KPX A Ucircumflex -50", () => {
      const pair = helvetica.kernPairs.find(
        k => k.firstKernCharacter === "A" && k.secondKernCharacter === "Ucircumflex",
      );
      expect(pair).toBeDefined();
      expect(pair!.x).toBe(-50);
      expect(pair!.y).toBe(0);
    });

    it("should parse KPX W agrave -40", () => {
      const pair = helvetica.kernPairs.find(
        k => k.firstKernCharacter === "W" && k.secondKernCharacter === "agrave",
      );
      expect(pair).toBeDefined();
      expect(pair!.x).toBe(-40);
      expect(pair!.y).toBe(0);
    });

    it("should have empty kernPairs0", () => {
      expect(helvetica.kernPairs0.length).toBe(0);
    });

    it("should have empty kernPairs1", () => {
      expect(helvetica.kernPairs1.length).toBe(0);
    });

    it("should have empty composites", () => {
      expect(helvetica.composites.length).toBe(0);
    });
  });

  describe("reduced dataset parsing", () => {
    let helveticaReduced: FontMetrics;

    beforeAll(() => {
      helveticaReduced = parseAFM(helveticaBytes, { reducedDataset: true });
    });

    it("should parse font metrics", () => {
      expect(helveticaReduced.afmVersion).toBe(4.1);
      expect(helveticaReduced.fontName).toBe("Helvetica");
    });

    it("should parse char metrics", () => {
      expect(helveticaReduced.charMetrics.length).toBe(315);
    });

    it("should skip kern pairs in reduced mode", () => {
      expect(helveticaReduced.kernPairs.length).toBe(0);
    });

    it("should skip composites in reduced mode", () => {
      expect(helveticaReduced.composites.length).toBe(0);
    });
  });
});
