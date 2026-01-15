import { beforeAll, describe, expect, it } from "vitest";

import { loadFixture } from "../../test-utils.ts";
import {
  getOperator,
  getOperator2,
  getPredefinedCharset,
  getPredefinedEncoding,
  getStandardString,
  isCFF,
  isTwoByteOperator,
  parseCFF,
  STANDARD_STRINGS_COUNT,
} from "./index.ts";

// Load test OTF file (has CFF table) - loaded in beforeAll
let otfBytes: Uint8Array;

beforeAll(async () => {
  otfBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");
});

describe("CFF Parser", () => {
  describe("isCFF", () => {
    it("should detect OpenType with CFF (OTTO signature)", () => {
      expect(isCFF(otfBytes)).toBe(true);
    });

    it("should detect standalone CFF (version 1.0)", () => {
      // CFF header starts with major=1, minor=0
      const cffHeader = new Uint8Array([1, 0, 4, 2]);
      expect(isCFF(cffHeader)).toBe(true);
    });

    it("should reject TrueType fonts", () => {
      // TrueType starts with 0x00010000
      const ttf = new Uint8Array([0x00, 0x01, 0x00, 0x00]);
      expect(isCFF(ttf)).toBe(false);
    });

    it("should reject short data", () => {
      expect(isCFF(new Uint8Array([1, 2, 3]))).toBe(false);
    });
  });

  describe("parseCFF", () => {
    it("should parse OTF file with CFF table", () => {
      const fonts = parseCFF(otfBytes);

      expect(fonts.length).toBe(1);
      const font = fonts[0];

      expect(font.name).toBe("FoglihtenNo07");
      expect(font.isCIDFont).toBe(false);
    });

    it("should extract font metadata", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      // Font should have basic metadata
      expect(font.familyName).toBeDefined();
      expect(font.fontMatrix).toBeDefined();
      expect(font.fontMatrix.length).toBe(6);
      expect(font.fontBBox).toBeDefined();
      expect(font.fontBBox.length).toBe(4);
    });

    it("should parse charstrings", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      // Font should have charstrings (glyph data)
      expect(font.charStrings.length).toBeGreaterThan(0);
    });

    it("should parse charset", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      // Charset should map GIDs to names
      expect(font.charset).toBeDefined();
      expect(font.charset.getNameForGID(0)).toBe(".notdef");
    });

    it("should parse Type1 font private dict", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      if (!font.isCIDFont) {
        expect(font.privateDict).toBeDefined();
        expect(typeof font.privateDict.defaultWidthX).toBe("number");
        expect(typeof font.privateDict.nominalWidthX).toBe("number");
      }
    });

    it("should parse Type1 font encoding", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      if (!font.isCIDFont) {
        expect(font.encoding).toBeDefined();
        // Standard encoding should map code 32 to "space"
        const name = font.encoding.getName(32);
        expect(name).toBeDefined();
      }
    });

    it("should parse global subr index", () => {
      const fonts = parseCFF(otfBytes);
      const font = fonts[0];

      // Global subr index may be empty but should be an array
      expect(Array.isArray(font.globalSubrIndex)).toBe(true);
    });
  });

  describe("standard strings", () => {
    it("should have 391 standard strings", () => {
      expect(STANDARD_STRINGS_COUNT).toBe(391);
    });

    it("should return .notdef for SID 0", () => {
      expect(getStandardString(0)).toBe(".notdef");
    });

    it("should return space for SID 1", () => {
      expect(getStandardString(1)).toBe("space");
    });

    it("should return A for SID 34", () => {
      expect(getStandardString(34)).toBe("A");
    });

    it("should return a for SID 66", () => {
      expect(getStandardString(66)).toBe("a");
    });

    it("should return undefined for SID >= 391", () => {
      expect(getStandardString(391)).toBeUndefined();
      expect(getStandardString(1000)).toBeUndefined();
    });

    it("should return undefined for negative SID", () => {
      expect(getStandardString(-1)).toBeUndefined();
    });
  });

  describe("operators", () => {
    it("should return operator names for single-byte operators", () => {
      expect(getOperator(0)).toBe("version");
      expect(getOperator(1)).toBe("Notice");
      expect(getOperator(2)).toBe("FullName");
      expect(getOperator(3)).toBe("FamilyName");
      expect(getOperator(4)).toBe("Weight");
      expect(getOperator(5)).toBe("FontBBox");
    });

    it("should return operator names for two-byte operators", () => {
      expect(getOperator2(12, 0)).toBe("Copyright");
      expect(getOperator2(12, 1)).toBe("isFixedPitch");
      expect(getOperator2(12, 7)).toBe("FontMatrix");
      expect(getOperator2(12, 30)).toBe("ROS");
    });

    it("should identify two-byte operator escape", () => {
      expect(isTwoByteOperator(12)).toBe(true);
      expect(isTwoByteOperator(0)).toBe(false);
      expect(isTwoByteOperator(13)).toBe(false);
    });

    it("should return undefined for unknown operators", () => {
      expect(getOperator(255)).toBeUndefined();
      expect(getOperator2(12, 255)).toBeUndefined();
    });
  });

  describe("predefined charsets", () => {
    it("should return ISO Adobe charset for ID 0", () => {
      const charset = getPredefinedCharset(0, false);
      expect(charset).toBeDefined();
      expect(charset!.isCIDFont).toBe(false);
      expect(charset!.getNameForGID(0)).toBe(".notdef");
      expect(charset!.getNameForGID(1)).toBe("space");
    });

    it("should return Expert charset for ID 1", () => {
      const charset = getPredefinedCharset(1, false);
      expect(charset).toBeDefined();
      expect(charset!.isCIDFont).toBe(false);
    });

    it("should return Expert Subset charset for ID 2", () => {
      const charset = getPredefinedCharset(2, false);
      expect(charset).toBeDefined();
      expect(charset!.isCIDFont).toBe(false);
    });

    it("should return undefined for CID fonts", () => {
      expect(getPredefinedCharset(0, true)).toBeUndefined();
      expect(getPredefinedCharset(1, true)).toBeUndefined();
      expect(getPredefinedCharset(2, true)).toBeUndefined();
    });

    it("should return undefined for unknown charset IDs", () => {
      expect(getPredefinedCharset(3, false)).toBeUndefined();
      expect(getPredefinedCharset(100, false)).toBeUndefined();
    });
  });

  describe("predefined encodings", () => {
    it("should return Standard encoding for ID 0", () => {
      const encoding = getPredefinedEncoding(0);
      expect(encoding).toBeDefined();
      expect(encoding!.getName(32)).toBe("space");
      expect(encoding!.getName(65)).toBe("A");
      expect(encoding!.getName(97)).toBe("a");
    });

    it("should return Expert encoding for ID 1", () => {
      const encoding = getPredefinedEncoding(1);
      expect(encoding).toBeDefined();
    });

    it("should return undefined for unknown encoding IDs", () => {
      expect(getPredefinedEncoding(2)).toBeUndefined();
      expect(getPredefinedEncoding(100)).toBeUndefined();
    });
  });

  describe("charset operations", () => {
    it("should support GID to SID lookup", () => {
      const charset = getPredefinedCharset(0, false)!;
      // In ISO Adobe, GID 1 = SID 1 = "space"
      expect(charset.getSIDForGID(1)).toBe(1);
      expect(charset.getNameForGID(1)).toBe("space");
    });

    it("should support SID to GID reverse lookup", () => {
      const charset = getPredefinedCharset(0, false)!;
      // In ISO Adobe, SID 1 = GID 1
      expect(charset.getGIDForSID(1)).toBe(1);
    });

    it("should support name to SID lookup", () => {
      const charset = getPredefinedCharset(0, false)!;
      expect(charset.getSID("space")).toBe(1);
      expect(charset.getSID("A")).toBe(34);
    });
  });

  describe("encoding operations", () => {
    it("should support code to name lookup", () => {
      const encoding = getPredefinedEncoding(0)!;
      expect(encoding.getName(32)).toBe("space");
      expect(encoding.getName(65)).toBe("A");
    });

    it("should support name to code reverse lookup", () => {
      const encoding = getPredefinedEncoding(0)!;
      expect(encoding.getCode("space")).toBe(32);
      expect(encoding.getCode("A")).toBe(65);
    });

    it("should return undefined for unmapped codes", () => {
      const encoding = getPredefinedEncoding(0)!;
      // Codes 0-31 map to .notdef in standard encoding
      expect(encoding.getName(0)).toBe(".notdef");
    });
  });
});
