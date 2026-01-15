import { describe, expect, it } from "vitest";

import {
  getPdfVersion,
  hexToBytes,
  isPdfHeader,
  loadFixture,
  stringToBytes,
  toAsciiString,
  toHexString,
} from "./test-utils.ts";

describe("setup", () => {
  it("should work", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("test-utils", () => {
  describe("loadFixture", () => {
    it("should load a basic PDF fixture", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
      expect(isPdfHeader(bytes)).toBe(true);
    });

    it("should load fixtures from different categories", async () => {
      const basic = await loadFixture("basic", "document.pdf");
      const xref = await loadFixture("xref", "hello3.pdf");
      const malformed = await loadFixture("malformed", "MissingCatalog.pdf");

      expect(isPdfHeader(basic)).toBe(true);
      expect(isPdfHeader(xref)).toBe(true);
      expect(isPdfHeader(malformed)).toBe(true);
    });
  });

  describe("stringToBytes / hexToBytes", () => {
    it("should convert string to bytes", () => {
      const bytes = stringToBytes("%PDF");
      expect(bytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    });

    it("should convert hex string to bytes", () => {
      const bytes = hexToBytes("25 50 44 46");
      expect(bytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    });

    it("should handle hex without spaces", () => {
      const bytes = hexToBytes("25504446");
      expect(bytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    });
  });

  describe("toHexString / toAsciiString", () => {
    it("should convert bytes to hex string", () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(toHexString(bytes)).toBe("25 50 44 46");
    });

    it("should convert bytes to ASCII string", () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(toAsciiString(bytes)).toBe("%PDF");
    });

    it("should replace non-printable with dots", () => {
      const bytes = new Uint8Array([0x25, 0x00, 0x44, 0x46]);
      expect(toAsciiString(bytes)).toBe("%.DF");
    });
  });

  describe("isPdfHeader / getPdfVersion", () => {
    it("should detect valid PDF header", () => {
      const bytes = stringToBytes("%PDF-1.4\n");
      expect(isPdfHeader(bytes)).toBe(true);
    });

    it("should reject invalid header", () => {
      const bytes = stringToBytes("Hello World");
      expect(isPdfHeader(bytes)).toBe(false);
    });

    it("should extract PDF version", () => {
      expect(getPdfVersion(stringToBytes("%PDF-1.4\n"))).toBe("1.4");
      expect(getPdfVersion(stringToBytes("%PDF-2.0\n"))).toBe("2.0");
    });

    it("should get version from real fixture", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      expect(getPdfVersion(bytes)).toBe("1.4");
    });
  });
});
