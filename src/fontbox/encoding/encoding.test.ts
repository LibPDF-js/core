/**
 * Encoding tests.
 *
 * Ported from Apache PDFBox's fontbox/encoding/EncodingTest.java
 */

import { describe, expect, it } from "vitest";

import { createBuiltInEncoding, createBuiltInEncodingFromObject } from "./built-in-encoding.ts";
import { EncodingBuilder } from "./encoding.ts";
import { MAC_ROMAN_ENCODING } from "./mac-roman-encoding.ts";
import { STANDARD_ENCODING } from "./standard-encoding.ts";

describe("Encoding", () => {
  describe("StandardEncoding", () => {
    it("should return .notdef for unmapped codes", () => {
      expect(STANDARD_ENCODING.getName(0)).toBe(".notdef");
    });

    it("should map space at code 32", () => {
      expect(STANDARD_ENCODING.getName(32)).toBe("space");
    });

    it("should map p at code 112", () => {
      expect(STANDARD_ENCODING.getName(112)).toBe("p");
    });

    it("should map guilsinglleft at code 172", () => {
      expect(STANDARD_ENCODING.getName(172)).toBe("guilsinglleft");
    });

    it("should reverse map space to code 32", () => {
      expect(STANDARD_ENCODING.getCode("space")).toBe(32);
    });

    it("should reverse map p to code 112", () => {
      expect(STANDARD_ENCODING.getCode("p")).toBe(112);
    });

    it("should reverse map guilsinglleft to code 172", () => {
      expect(STANDARD_ENCODING.getCode("guilsinglleft")).toBe(172);
    });

    it("should return undefined for unmapped names", () => {
      expect(STANDARD_ENCODING.getCode("nonexistent")).toBeUndefined();
    });

    it("should have a code to name map", () => {
      const map = STANDARD_ENCODING.getCodeToNameMap();
      expect(map.size).toBeGreaterThan(0);
      expect(map.get(32)).toBe("space");
    });

    // Additional tests for common characters
    it("should map uppercase letters correctly", () => {
      expect(STANDARD_ENCODING.getName(65)).toBe("A");
      expect(STANDARD_ENCODING.getName(66)).toBe("B");
      expect(STANDARD_ENCODING.getName(90)).toBe("Z");
    });

    it("should map lowercase letters correctly", () => {
      expect(STANDARD_ENCODING.getName(97)).toBe("a");
      expect(STANDARD_ENCODING.getName(98)).toBe("b");
      expect(STANDARD_ENCODING.getName(122)).toBe("z");
    });

    it("should map digits correctly", () => {
      expect(STANDARD_ENCODING.getName(48)).toBe("zero");
      expect(STANDARD_ENCODING.getName(49)).toBe("one");
      expect(STANDARD_ENCODING.getName(57)).toBe("nine");
    });

    it("should map punctuation correctly", () => {
      expect(STANDARD_ENCODING.getName(46)).toBe("period");
      expect(STANDARD_ENCODING.getName(44)).toBe("comma");
      expect(STANDARD_ENCODING.getName(33)).toBe("exclam");
      expect(STANDARD_ENCODING.getName(63)).toBe("question");
    });
  });

  describe("MacRomanEncoding", () => {
    it("should return .notdef for unmapped codes", () => {
      expect(MAC_ROMAN_ENCODING.getName(0)).toBe(".notdef");
    });

    it("should map space at code 32", () => {
      expect(MAC_ROMAN_ENCODING.getName(32)).toBe("space");
    });

    it("should map p at code 112", () => {
      expect(MAC_ROMAN_ENCODING.getName(112)).toBe("p");
    });

    it("should map germandbls at code 167", () => {
      expect(MAC_ROMAN_ENCODING.getName(167)).toBe("germandbls");
    });

    it("should reverse map space to code 32", () => {
      expect(MAC_ROMAN_ENCODING.getCode("space")).toBe(32);
    });

    it("should reverse map p to code 112", () => {
      expect(MAC_ROMAN_ENCODING.getCode("p")).toBe(112);
    });

    it("should reverse map germandbls to code 167", () => {
      expect(MAC_ROMAN_ENCODING.getCode("germandbls")).toBe(167);
    });

    it("should return undefined for unmapped names", () => {
      expect(MAC_ROMAN_ENCODING.getCode("nonexistent")).toBeUndefined();
    });

    // Test Mac-specific characters
    it("should map accented characters", () => {
      expect(MAC_ROMAN_ENCODING.getName(128)).toBe("Adieresis");
      expect(MAC_ROMAN_ENCODING.getName(135)).toBe("aacute");
      expect(MAC_ROMAN_ENCODING.getName(150)).toBe("ntilde");
    });

    it("should map special Mac characters", () => {
      expect(MAC_ROMAN_ENCODING.getName(160)).toBe("dagger");
      expect(MAC_ROMAN_ENCODING.getName(169)).toBe("copyright");
      expect(MAC_ROMAN_ENCODING.getName(170)).toBe("trademark");
    });
  });

  describe("BuiltInEncoding", () => {
    it("should create encoding from Map", () => {
      const map = new Map<number, string>([
        [65, "A"],
        [66, "B"],
        [67, "C"],
      ]);
      const encoding = createBuiltInEncoding(map);

      expect(encoding.getName(65)).toBe("A");
      expect(encoding.getName(66)).toBe("B");
      expect(encoding.getName(67)).toBe("C");
      expect(encoding.getName(68)).toBe(".notdef");

      expect(encoding.getCode("A")).toBe(65);
      expect(encoding.getCode("B")).toBe(66);
      expect(encoding.getCode("D")).toBeUndefined();
    });

    it("should create encoding from object", () => {
      const encoding = createBuiltInEncodingFromObject({
        65: "A",
        66: "B",
        67: "C",
      });

      expect(encoding.getName(65)).toBe("A");
      expect(encoding.getName(66)).toBe("B");
      expect(encoding.getName(67)).toBe("C");
    });
  });

  describe("EncodingBuilder", () => {
    it("should build custom encoding", () => {
      const builder = new EncodingBuilder();
      builder.addCharacterEncoding(100, "test");
      builder.addCharacterEncoding(101, "test2");

      expect(builder.getName(100)).toBe("test");
      expect(builder.getName(101)).toBe("test2");
      expect(builder.getName(102)).toBe(".notdef");

      expect(builder.getCode("test")).toBe(100);
      expect(builder.getCode("test2")).toBe(101);
      expect(builder.getCode("test3")).toBeUndefined();
    });

    it("should provide code to name map", () => {
      const builder = new EncodingBuilder();
      builder.addCharacterEncoding(65, "A");
      builder.addCharacterEncoding(66, "B");

      const map = builder.getCodeToNameMap();
      expect(map.size).toBe(2);
      expect(map.get(65)).toBe("A");
      expect(map.get(66)).toBe("B");
    });
  });
});
