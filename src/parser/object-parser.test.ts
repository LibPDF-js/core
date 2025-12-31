import { describe, expect, it, vi } from "vitest";
import { Scanner } from "#src/io/scanner";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";
import { ObjectParser } from "./object-parser";
import { TokenReader } from "./token-reader";

/**
 * Helper to create an ObjectParser from a string.
 */
function parser(input: string): ObjectParser {
  const bytes = new TextEncoder().encode(input);
  const scanner = new Scanner(bytes);
  const reader = new TokenReader(scanner);

  return new ObjectParser(reader);
}

describe("ObjectParser", () => {
  describe("primitives", () => {
    it("parses null", () => {
      const p = parser("null");
      const result = p.parseObject();

      expect(result).not.toBeNull();
      expect(result!.object).toBe(PdfNull.instance);
      expect(result!.hasStream).toBe(false);
    });

    it("parses true", () => {
      const p = parser("true");
      const result = p.parseObject();

      expect(result!.object).toBe(PdfBool.TRUE);
    });

    it("parses false", () => {
      const p = parser("false");
      const result = p.parseObject();

      expect(result!.object).toBe(PdfBool.FALSE);
    });

    it("parses integer", () => {
      const p = parser("42");
      const result = p.parseObject();

      expect(result!.object).toEqual(PdfNumber.of(42));
    });

    it("parses negative integer", () => {
      const p = parser("-17");
      const result = p.parseObject();

      expect(result!.object).toEqual(PdfNumber.of(-17));
    });

    it("parses decimal", () => {
      const p = parser("3.14");
      const result = p.parseObject();

      expect(result!.object).toEqual(PdfNumber.of(3.14));
    });

    it("parses name", () => {
      const p = parser("/Type");
      const result = p.parseObject();

      expect(result!.object).toBe(PdfName.of("Type"));
    });

    it("parses literal string", () => {
      const p = parser("(Hello World)");
      const result = p.parseObject();

      expect(result!.object).toBeInstanceOf(PdfString);
      expect((result!.object as PdfString).asString()).toBe("Hello World");
    });

    it("parses hex string", () => {
      const p = parser("<48656C6C6F>");
      const result = p.parseObject();

      expect(result!.object).toBeInstanceOf(PdfString);
      expect((result!.object as PdfString).asString()).toBe("Hello");
    });

    it("returns null at EOF", () => {
      const p = parser("");
      const result = p.parseObject();

      expect(result).toBeNull();
    });

    it("returns null for whitespace-only input", () => {
      const p = parser("   ");
      const result = p.parseObject();

      expect(result).toBeNull();
    });
  });

  describe("references", () => {
    it("parses simple reference", () => {
      const p = parser("1 0 R");
      const result = p.parseObject();

      expect(result!.object).toBe(PdfRef.of(1, 0));
    });

    it("parses reference with non-zero generation", () => {
      const p = parser("10 5 R");
      const result = p.parseObject();

      expect(result!.object).toBe(PdfRef.of(10, 5));
    });

    it("parses two numbers without R as separate numbers", () => {
      const p = parser("1 0");

      const first = p.parseObject();

      expect(first!.object).toEqual(PdfNumber.of(1));

      const second = p.parseObject();

      expect(second!.object).toEqual(PdfNumber.of(0));
    });

    it("parses number followed by non-integer as just number", () => {
      const p = parser("1 3.14");

      const first = p.parseObject();

      expect(first!.object).toEqual(PdfNumber.of(1));

      const second = p.parseObject();

      expect(second!.object).toEqual(PdfNumber.of(3.14));
    });

    it("parses decimal followed by int R as just decimal", () => {
      const p = parser("1.5 0 R");

      const first = p.parseObject();

      expect(first!.object).toEqual(PdfNumber.of(1.5));

      // The "0 R" should cause issues or be parsed weirdly
      // but "0 R" alone isn't a valid reference start
    });

    it("throws on negative object number in normal mode", () => {
      const p = parser("-1 0 R");

      expect(() => p.parseObject()).toThrow("Invalid reference values");
    });

    it("accepts negative object number in recovery mode with warning", () => {
      const p = parser("-1 0 R");
      const warnings: string[] = [];

      p.recoveryMode = true;
      p.onWarning = msg => warnings.push(msg);

      const result = p.parseObject();

      expect(result!.object).toBe(PdfRef.of(-1, 0));
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("-1 0 R");
    });

    it("throws on generation > 65535 in normal mode", () => {
      const p = parser("1 99999 R");

      expect(() => p.parseObject()).toThrow("Invalid reference values");
    });

    it("parses consecutive references", () => {
      const p = parser("1 0 R 2 0 R");

      const first = p.parseObject();

      expect(first!.object).toBe(PdfRef.of(1, 0));

      const second = p.parseObject();

      expect(second!.object).toBe(PdfRef.of(2, 0));
    });
  });

  describe("arrays", () => {
    it("parses empty array", () => {
      const p = parser("[]");
      const result = p.parseObject();

      expect(result!.object).toBeInstanceOf(PdfArray);
      expect((result!.object as PdfArray).length).toBe(0);
    });

    it("parses array of numbers", () => {
      const p = parser("[1 2 3]");
      const result = p.parseObject();

      const arr = result!.object as PdfArray;

      expect(arr.length).toBe(3);
      expect(arr.at(0)).toEqual(PdfNumber.of(1));
      expect(arr.at(1)).toEqual(PdfNumber.of(2));
      expect(arr.at(2)).toEqual(PdfNumber.of(3));
    });

    it("parses array with mixed types", () => {
      const p = parser("[/Name (string) 1 0 R true]");
      const result = p.parseObject();

      const arr = result!.object as PdfArray;

      expect(arr.length).toBe(4);
      expect(arr.at(0)).toBe(PdfName.of("Name"));
      expect((arr.at(1) as PdfString).asString()).toBe("string");
      expect(arr.at(2)).toBe(PdfRef.of(1, 0));
      expect(arr.at(3)).toBe(PdfBool.TRUE);
    });

    it("parses nested arrays", () => {
      const p = parser("[[1 2] [3 4]]");
      const result = p.parseObject();

      const outer = result!.object as PdfArray;

      expect(outer.length).toBe(2);

      const inner1 = outer.at(0) as PdfArray;
      const inner2 = outer.at(1) as PdfArray;

      expect(inner1.length).toBe(2);
      expect(inner2.length).toBe(2);
    });

    it("throws on unterminated array in normal mode", () => {
      const p = parser("[1 2");

      expect(() => p.parseObject()).toThrow("Unterminated array");
    });

    it("returns partial array in recovery mode", () => {
      const p = parser("[1 2");
      const warnings: string[] = [];

      p.recoveryMode = true;
      p.onWarning = msg => warnings.push(msg);

      const result = p.parseObject();
      const arr = result!.object as PdfArray;

      expect(arr.length).toBe(2);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("Unterminated array");
    });
  });

  describe("dictionaries", () => {
    it("parses empty dict", () => {
      const p = parser("<< >>");
      const result = p.parseObject();

      expect(result!.object).toBeInstanceOf(PdfDict);
      expect((result!.object as PdfDict).size).toBe(0);
      expect(result!.hasStream).toBe(false);
    });

    it("parses simple dict", () => {
      const p = parser("<< /Type /Page >>");
      const result = p.parseObject();

      const dict = result!.object as PdfDict;

      expect(dict.get("Type")).toBe(PdfName.of("Page"));
    });

    it("parses dict with number value", () => {
      const p = parser("<< /Count 5 >>");
      const result = p.parseObject();

      const dict = result!.object as PdfDict;

      expect(dict.getNumber("Count")?.value).toBe(5);
    });

    it("parses dict with reference value", () => {
      const p = parser("<< /Parent 1 0 R >>");
      const result = p.parseObject();

      const dict = result!.object as PdfDict;

      expect(dict.get("Parent")).toBe(PdfRef.of(1, 0));
    });

    it("parses dict with array value", () => {
      const p = parser("<< /Kids [1 0 R 2 0 R] >>");
      const result = p.parseObject();

      const dict = result!.object as PdfDict;
      const kids = dict.getArray("Kids");

      expect(kids?.length).toBe(2);
    });

    it("parses nested dicts", () => {
      const p = parser("<< /A << /B 1 >> >>");
      const result = p.parseObject();

      const outer = result!.object as PdfDict;
      const inner = outer.getDict("A");

      expect(inner?.getNumber("B")?.value).toBe(1);
    });

    it("throws on unterminated dict in normal mode", () => {
      const p = parser("<< /Type /Page");

      expect(() => p.parseObject()).toThrow("Unterminated dictionary");
    });

    it("returns partial dict in recovery mode", () => {
      const p = parser("<< /Type /Page");
      const warnings: string[] = [];

      p.recoveryMode = true;
      p.onWarning = msg => warnings.push(msg);

      const result = p.parseObject();
      const dict = result!.object as PdfDict;

      expect(dict.get("Type")).toBe(PdfName.of("Page"));
      expect(warnings.length).toBe(1);
    });

    it("throws on non-name key in normal mode", () => {
      const p = parser("<< 123 /Value >>");

      expect(() => p.parseObject()).toThrow("Invalid dictionary key");
    });

    it("skips invalid key in recovery mode", () => {
      const p = parser("<< 123 /bad /Type /Page >>");
      const warnings: string[] = [];

      p.recoveryMode = true;
      p.onWarning = msg => warnings.push(msg);

      const result = p.parseObject();
      const dict = result!.object as PdfDict;

      expect(dict.get("Type")).toBe(PdfName.of("Page"));
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe("stream detection", () => {
    it("detects stream keyword after dict", () => {
      const p = parser("<< /Length 5 >> stream");
      const result = p.parseObject();

      expect(result!.hasStream).toBe(true);
      expect(result!.object).toBeInstanceOf(PdfDict);
    });

    it("returns hasStream false when no stream follows", () => {
      const p = parser("<< /Type /Page >>");
      const result = p.parseObject();

      expect(result!.hasStream).toBe(false);
    });

    it("does not consume stream keyword", () => {
      const p = parser("<< /Length 5 >> stream");

      p.parseObject();

      // Next parse should see the stream keyword
      // (though it will throw since "stream" isn't a valid object start)
      expect(() => p.parseObject()).toThrow("Unexpected keyword: stream");
    });
  });

  describe("recursion protection", () => {
    it("throws on deeply nested structures", () => {
      // Create deeply nested array
      const depth = 600;
      const input = "[".repeat(depth) + "]".repeat(depth);
      const p = parser(input);

      expect(() => p.parseObject()).toThrow("Maximum nesting depth exceeded");
    });
  });

  describe("multiple objects", () => {
    it("parses multiple objects in sequence", () => {
      const p = parser("/Name 42 true");

      const first = p.parseObject();

      expect(first!.object).toBe(PdfName.of("Name"));

      const second = p.parseObject();

      expect(second!.object).toEqual(PdfNumber.of(42));

      const third = p.parseObject();

      expect(third!.object).toBe(PdfBool.TRUE);

      const fourth = p.parseObject();

      expect(fourth).toBeNull();
    });
  });

  describe("warning callback", () => {
    it("calls onWarning with message and position", () => {
      const p = parser("[1 2");
      const callback = vi.fn();

      p.recoveryMode = true;
      p.onWarning = callback;

      p.parseObject();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0]).toContain("Unterminated array");
      expect(typeof callback.mock.calls[0][1]).toBe("number");
    });
  });
});
