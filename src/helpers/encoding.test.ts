import { describe, expect, it } from "vitest";

import {
  canEncodePdfDoc,
  decodePdfDocEncoding,
  decodeTextString,
  decodeUtf16BE,
  encodePdfDocEncoding,
  encodeTextString,
  encodeUtf16BE,
  hasUtf16BOM,
} from "./encoding";

describe("encoding", () => {
  describe("hasUtf16BOM", () => {
    it("detects UTF-16BE BOM", () => {
      expect(hasUtf16BOM(new Uint8Array([0xfe, 0xff]))).toBe(true);
      expect(hasUtf16BOM(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe(true);
    });

    it("returns false for non-BOM", () => {
      expect(hasUtf16BOM(new Uint8Array([0x48, 0x65]))).toBe(false);
      expect(hasUtf16BOM(new Uint8Array([0xff, 0xfe]))).toBe(false); // UTF-16LE BOM
      expect(hasUtf16BOM(new Uint8Array([0xfe]))).toBe(false); // Too short
      expect(hasUtf16BOM(new Uint8Array([]))).toBe(false);
    });
  });

  describe("decodePdfDocEncoding", () => {
    it("decodes ASCII range", () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      expect(decodePdfDocEncoding(bytes)).toBe("Hello");
    });

    it("decodes Latin-1 supplement", () => {
      // café = c a f é (0xE9)
      const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);
      expect(decodePdfDocEncoding(bytes)).toBe("café");
    });

    it("decodes special chars 0x80-0x9F", () => {
      // • (bullet) = 0x80
      expect(decodePdfDocEncoding(new Uint8Array([0x80]))).toBe("•");
      // † (dagger) = 0x81
      expect(decodePdfDocEncoding(new Uint8Array([0x81]))).toBe("†");
      // — (em dash) = 0x84
      expect(decodePdfDocEncoding(new Uint8Array([0x84]))).toBe("—");
      // – (en dash) = 0x85
      expect(decodePdfDocEncoding(new Uint8Array([0x85]))).toBe("–");
      // " (left double quote) = 0x8D
      expect(decodePdfDocEncoding(new Uint8Array([0x8d]))).toBe("\u201c");
      // " (right double quote) = 0x8E
      expect(decodePdfDocEncoding(new Uint8Array([0x8e]))).toBe("\u201d");
      // ™ (trademark) = 0x92
      expect(decodePdfDocEncoding(new Uint8Array([0x92]))).toBe("™");
    });

    it("decodes Euro sign at 0xA0", () => {
      expect(decodePdfDocEncoding(new Uint8Array([0xa0]))).toBe("€");
    });

    it("decodes special low bytes 0x18-0x1F", () => {
      // ˘ (breve) = 0x18
      expect(decodePdfDocEncoding(new Uint8Array([0x18]))).toBe("˘");
      // ˇ (caron) = 0x19
      expect(decodePdfDocEncoding(new Uint8Array([0x19]))).toBe("ˇ");
      // ˜ (small tilde) = 0x1F
      expect(decodePdfDocEncoding(new Uint8Array([0x1f]))).toBe("˜");
    });

    it("preserves tab, newline, carriage return", () => {
      const bytes = new Uint8Array([0x41, 0x09, 0x42, 0x0a, 0x43, 0x0d, 0x44]);
      expect(decodePdfDocEncoding(bytes)).toBe("A\tB\nC\rD");
    });

    it("skips undefined bytes", () => {
      // 0x9F is undefined
      expect(decodePdfDocEncoding(new Uint8Array([0x41, 0x9f, 0x42]))).toBe("AB");
      // 0xAD is undefined
      expect(decodePdfDocEncoding(new Uint8Array([0x41, 0xad, 0x42]))).toBe("AB");
      // Control chars 0x00-0x17 (except 0x09, 0x0A, 0x0D) are skipped
      expect(decodePdfDocEncoding(new Uint8Array([0x41, 0x00, 0x42]))).toBe("AB");
    });

    it("handles empty bytes", () => {
      expect(decodePdfDocEncoding(new Uint8Array([]))).toBe("");
    });
  });

  describe("decodeUtf16BE", () => {
    it("decodes UTF-16BE with BOM", () => {
      // BOM + "Hello"
      const bytes = new Uint8Array([
        0xfe, 0xff, 0x00, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f,
      ]);
      expect(decodeUtf16BE(bytes)).toBe("Hello");
    });

    it("decodes UTF-16BE without BOM", () => {
      const bytes = new Uint8Array([0x00, 0x48, 0x00, 0x69]); // "Hi"
      expect(decodeUtf16BE(bytes)).toBe("Hi");
    });

    it("decodes CJK characters", () => {
      // 你好 = U+4F60 U+597D
      const bytes = new Uint8Array([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]);
      expect(decodeUtf16BE(bytes)).toBe("你好");
    });

    it("decodes surrogate pairs (emoji)", () => {
      // 😀 = U+1F600 = D83D DE00 in UTF-16
      const bytes = new Uint8Array([0xfe, 0xff, 0xd8, 0x3d, 0xde, 0x00]);
      expect(decodeUtf16BE(bytes)).toBe("😀");
    });

    it("handles odd-length bytes gracefully", () => {
      // Incomplete character at end is ignored
      const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00]);
      expect(decodeUtf16BE(bytes)).toBe("A");
    });

    it("handles empty bytes", () => {
      expect(decodeUtf16BE(new Uint8Array([]))).toBe("");
      expect(decodeUtf16BE(new Uint8Array([0xfe, 0xff]))).toBe("");
    });
  });

  describe("decodeTextString", () => {
    it("auto-detects UTF-16BE with BOM", () => {
      const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
      expect(decodeTextString(bytes)).toBe("AB");
    });

    it("falls back to PDFDocEncoding without BOM", () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(decodeTextString(bytes)).toBe("Hello");
    });

    it("handles PDFDocEncoding special chars", () => {
      const bytes = new Uint8Array([0x80, 0x20, 0x84]); // • —
      expect(decodeTextString(bytes)).toBe("• —");
    });
  });

  describe("canEncodePdfDoc", () => {
    it("returns true for ASCII", () => {
      expect(canEncodePdfDoc("Hello World")).toBe(true);
    });

    it("returns true for Latin-1 supplement", () => {
      expect(canEncodePdfDoc("café")).toBe(true);
      expect(canEncodePdfDoc("naïve")).toBe(true);
    });

    it("returns true for special chars in PDFDocEncoding", () => {
      expect(canEncodePdfDoc("€")).toBe(true); // Euro
      expect(canEncodePdfDoc("•")).toBe(true); // Bullet
      expect(canEncodePdfDoc("—")).toBe(true); // Em dash
      expect(canEncodePdfDoc("™")).toBe(true); // Trademark
    });

    it("returns true for whitespace", () => {
      expect(canEncodePdfDoc("A\tB\nC\rD")).toBe(true);
    });

    it("returns false for CJK", () => {
      expect(canEncodePdfDoc("你好")).toBe(false);
      expect(canEncodePdfDoc("日本語")).toBe(false);
    });

    it("returns false for emoji", () => {
      expect(canEncodePdfDoc("😀")).toBe(false);
    });

    it("returns false for chars outside range", () => {
      expect(canEncodePdfDoc("\u0100")).toBe(false); // Ā (Latin Extended)
    });

    it("handles empty string", () => {
      expect(canEncodePdfDoc("")).toBe(true);
    });
  });

  describe("encodePdfDocEncoding", () => {
    it("encodes ASCII", () => {
      const result = encodePdfDocEncoding("Hello");
      expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it("encodes Latin-1 supplement", () => {
      const result = encodePdfDocEncoding("café");
      expect(result).toEqual(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
    });

    it("encodes special chars", () => {
      expect(encodePdfDocEncoding("•")).toEqual(new Uint8Array([0x80]));
      expect(encodePdfDocEncoding("€")).toEqual(new Uint8Array([0xa0]));
      expect(encodePdfDocEncoding("—")).toEqual(new Uint8Array([0x84]));
      expect(encodePdfDocEncoding("™")).toEqual(new Uint8Array([0x92]));
    });

    it("encodes whitespace", () => {
      const result = encodePdfDocEncoding("A\tB\nC");
      expect(result).toEqual(new Uint8Array([0x41, 0x09, 0x42, 0x0a, 0x43]));
    });

    it("returns null for unencodable chars", () => {
      expect(encodePdfDocEncoding("你好")).toBe(null);
      expect(encodePdfDocEncoding("😀")).toBe(null);
    });

    it("handles empty string", () => {
      expect(encodePdfDocEncoding("")).toEqual(new Uint8Array([]));
    });
  });

  describe("encodeUtf16BE", () => {
    it("encodes with BOM", () => {
      const result = encodeUtf16BE("A");
      expect(result[0]).toBe(0xfe);
      expect(result[1]).toBe(0xff);
    });

    it("encodes ASCII", () => {
      const result = encodeUtf16BE("Hi");
      expect(result).toEqual(new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]));
    });

    it("encodes CJK", () => {
      // 你好 = U+4F60 U+597D
      const result = encodeUtf16BE("你好");
      expect(result).toEqual(new Uint8Array([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]));
    });

    it("encodes emoji with surrogate pairs", () => {
      // 😀 = U+1F600 = D83D DE00
      const result = encodeUtf16BE("😀");
      expect(result).toEqual(new Uint8Array([0xfe, 0xff, 0xd8, 0x3d, 0xde, 0x00]));
    });

    it("handles empty string", () => {
      const result = encodeUtf16BE("");
      expect(result).toEqual(new Uint8Array([0xfe, 0xff]));
    });
  });

  describe("encodeTextString", () => {
    it("uses PDFDocEncoding for ASCII", () => {
      const result = encodeTextString("Hello");
      // No BOM, just ASCII bytes
      expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it("uses PDFDocEncoding for Latin-1", () => {
      const result = encodeTextString("café");
      expect(result).toEqual(new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
    });

    it("uses PDFDocEncoding for special chars", () => {
      const result = encodeTextString("€50");
      expect(result).toEqual(new Uint8Array([0xa0, 0x35, 0x30]));
    });

    it("uses UTF-16BE for CJK", () => {
      const result = encodeTextString("你好");
      // Should have BOM
      expect(result[0]).toBe(0xfe);
      expect(result[1]).toBe(0xff);
      expect(result).toEqual(new Uint8Array([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]));
    });

    it("uses UTF-16BE for emoji", () => {
      const result = encodeTextString("😀");
      expect(result[0]).toBe(0xfe);
      expect(result[1]).toBe(0xff);
    });

    it("uses UTF-16BE for mixed content with unencodable chars", () => {
      const result = encodeTextString("Hello 你好");
      expect(result[0]).toBe(0xfe);
      expect(result[1]).toBe(0xff);
    });
  });

  describe("round-trip", () => {
    it("round-trips ASCII", () => {
      const text = "Hello, World!";
      expect(decodeTextString(encodeTextString(text))).toBe(text);
    });

    it("round-trips Latin-1", () => {
      const text = "Ça fait plaisir, naïve café";
      expect(decodeTextString(encodeTextString(text))).toBe(text);
    });

    it("round-trips special chars", () => {
      const text = "Price: €50 • Discount: 10% — Save ™";
      expect(decodeTextString(encodeTextString(text))).toBe(text);
    });

    it("round-trips CJK", () => {
      const text = "你好世界";
      expect(decodeTextString(encodeTextString(text))).toBe(text);
    });

    it("round-trips emoji", () => {
      const text = "Hello 😀 World 🎉";
      expect(decodeTextString(encodeTextString(text))).toBe(text);
    });

    it("round-trips empty string", () => {
      expect(decodeTextString(encodeTextString(""))).toBe("");
    });
  });
});
