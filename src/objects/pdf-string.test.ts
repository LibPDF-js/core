import { describe, expect, it } from "vitest";

import { PdfString } from "./pdf-string";

describe("PdfString", () => {
  it("has type 'string'", () => {
    expect(PdfString.fromString("test").type).toBe("string");
  });

  describe("fromString", () => {
    it("encodes ASCII as PDFDocEncoding", () => {
      const str = PdfString.fromString("Hello");

      expect(str.bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(str.format).toBe("literal");
    });

    it("encodes Latin-1 as PDFDocEncoding", () => {
      const str = PdfString.fromString("café");

      // c=0x63, a=0x61, f=0x66, é=0xE9
      expect(str.bytes).toEqual(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
      expect(str.format).toBe("literal");
    });

    it("encodes special chars as PDFDocEncoding", () => {
      const str = PdfString.fromString("€50");

      // €=0xA0 in PDFDocEncoding, 5=0x35, 0=0x30
      expect(str.bytes).toEqual(new Uint8Array([0xa0, 0x35, 0x30]));
      expect(str.format).toBe("literal");
    });

    it("encodes CJK as UTF-16BE with BOM", () => {
      const str = PdfString.fromString("你好");

      // BOM + 你(U+4F60) + 好(U+597D)
      expect(str.bytes).toEqual(new Uint8Array([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]));
      expect(str.format).toBe("hex");
    });

    it("encodes emoji as UTF-16BE with BOM", () => {
      const str = PdfString.fromString("😀");

      // BOM + surrogate pair for U+1F600
      expect(str.bytes[0]).toBe(0xfe);
      expect(str.bytes[1]).toBe(0xff);
      expect(str.format).toBe("hex");
    });

    it("decodes back via asString()", () => {
      const str = PdfString.fromString("Hello World");

      expect(str.asString()).toBe("Hello World");
    });

    it("round-trips unicode", () => {
      const original = "Héllo 世界";
      const str = PdfString.fromString(original);

      expect(str.asString()).toBe(original);
    });

    it("round-trips emoji", () => {
      const original = "Hello 😀 World";
      const str = PdfString.fromString(original);

      expect(str.asString()).toBe(original);
    });
  });

  describe("asString", () => {
    it("decodes PDFDocEncoding bytes", () => {
      // "Hello" in ASCII/PDFDocEncoding
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const str = new PdfString(bytes);

      expect(str.asString()).toBe("Hello");
    });

    it("decodes UTF-16BE bytes with BOM", () => {
      // BOM + "Hi"
      const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
      const str = new PdfString(bytes);

      expect(str.asString()).toBe("Hi");
    });

    it("decodes PDFDocEncoding special chars", () => {
      // • (bullet) = 0x80, space, € (euro) = 0xA0
      const bytes = new Uint8Array([0x80, 0x20, 0xa0]);
      const str = new PdfString(bytes);

      expect(str.asString()).toBe("• €");
    });
  });

  describe("fromHex", () => {
    it("decodes hex string to bytes", () => {
      const str = PdfString.fromHex("48656C6C6F");

      expect(str.bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(str.asString()).toBe("Hello");
    });

    it("sets format to 'hex'", () => {
      expect(PdfString.fromHex("4142").format).toBe("hex");
    });

    it("ignores whitespace in hex", () => {
      const str = PdfString.fromHex("48 65 6C 6C 6F");

      expect(str.asString()).toBe("Hello");
    });

    it("pads odd-length hex with trailing 0", () => {
      // "F" becomes "F0" = 240
      const str = PdfString.fromHex("F");

      expect(str.bytes).toEqual(new Uint8Array([0xf0]));
    });

    it("handles empty hex", () => {
      const str = PdfString.fromHex("");

      expect(str.bytes.length).toBe(0);
    });
  });

  describe("raw bytes constructor", () => {
    it("stores provided bytes directly", () => {
      const bytes = new Uint8Array([0x00, 0xff, 0x42]);
      const str = new PdfString(bytes);

      expect(str.bytes).toBe(bytes);
    });
  });
});
