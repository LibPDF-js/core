/**
 * CMap Parser tests.
 * Based on PDFBox TestCMapParser.java
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCMap } from "./parser.ts";

function loadCMapFixture(name: string): Uint8Array {
  const path = join(process.cwd(), "fixtures", "cmap", name);
  return new Uint8Array(readFileSync(path));
}

describe("CMap Parser", () => {
  describe("testLookup", () => {
    it("parses CMapTest and looks up character mappings", () => {
      const data = loadCMapFixture("CMapTest");
      const cmap = parseCMap(data);

      // bfchar mappings
      // bytes 00 0A from bfchar <000A> <002A>
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 0x0a]))).toBe("*");

      // bytes 01 0A from bfchar <010A> <002B>
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0x0a]))).toBe("+");
    });

    it("parses CMapTest and looks up bfrange mappings", () => {
      const data = loadCMapFixture("CMapTest");
      const cmap = parseCMap(data);

      // bytes 00 01 from bfrange <0001> <0005> <0041>
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 1]))).toBe("A");

      // bytes 01 00 from bfrange <0100> <0109> <0030>
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0]))).toBe("0");

      // bytes 01 20 from bfrange <0120> <0122> [<0050> <0052> <0054>]
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0x20]))).toBe("P");

      // bytes 01 21 from bfrange <0120> <0122> [<0050> <0052> <0054>]
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0x21]))).toBe("R");

      // bytes 01 22 from bfrange <0120> <0122> [<0050> <0052> <0054>]
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0x22]))).toBe("T");
    });

    it("parses CMapTest and looks up CID mappings from cidchar", () => {
      const data = loadCMapFixture("CMapTest");
      const cmap = parseCMap(data);

      // CID 520 from cidchar <0208> 520
      expect(cmap.toCIDBytes(new Uint8Array([2, 8]))).toBe(520);

      // CID 512 from cidchar <0200> 512
      expect(cmap.toCIDBytes(new Uint8Array([2, 0]))).toBe(512);

      // CID 522 from cidchar <020A> 522
      expect(cmap.toCIDBytes(new Uint8Array([2, 0x0a]))).toBe(522);
    });

    it("parses CMapTest and looks up CID mappings from cidrange", () => {
      const data = loadCMapFixture("CMapTest");
      const cmap = parseCMap(data);

      // CID 65 from cidrange <0000> <00ff> 0
      expect(cmap.toCIDBytes(new Uint8Array([0, 65]))).toBe(65);

      // CID 0x0118 (280) from cidrange <0100> <01ff> 256
      expect(cmap.toCIDBytes(new Uint8Array([1, 0x18]))).toBe(0x0118);

      // CID 0x12C (300) from cidrange <0300> <0300> 300
      // Note: this is <012C> mapped to 300, but the fixture has 3-byte ranges
      // Actually, re-reading the fixture: <0300> <0300> 300 maps code 0x0300 to CID 300
      // But wait, the test expects bytes [1, 0x2c] which is 0x012C...
      // Let me trace through - cidrange <0100> <01ff> 256 means code 0x0100 -> CID 256
      // So code 0x012C -> CID 256 + (0x012C - 0x0100) = 256 + 0x2C = 256 + 44 = 300
      expect(cmap.toCIDBytes(new Uint8Array([1, 0x2c]))).toBe(0x12c);
    });
  });

  describe("testParserWithPoorWhitespace", () => {
    it("parses CMap with poor/missing whitespace", () => {
      const data = loadCMapFixture("CMapNoWhitespace");
      const cmap = parseCMap(data);

      // Should parse without throwing
      expect(cmap).toBeDefined();
      expect(cmap.hasUnicodeMappings()).toBe(true);

      // Check some mappings from the poorly-formatted file
      // <0003> <0020> -> space
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 3]))).toBe(" ");

      // <0011> <002e> -> .
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 0x11]))).toBe(".");

      // <001a> <0037> -> 7
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 0x1a]))).toBe("7");

      // <001b> <0038> -> 8
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 0x1b]))).toBe("8");

      // <0026> <0043> -> C
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 0x26]))).toBe("C");
    });
  });

  describe("testParserWithMalformedbfrange1", () => {
    it("handles malformed bfrange with end < start", () => {
      const data = loadCMapFixture("CMapMalformedbfrange1");
      const cmap = parseCMap(data);

      // Should parse without throwing
      expect(cmap).toBeDefined();

      // bytes 00 01 from bfrange <0001> <0009> <0041>
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 1]))).toBe("A");

      // The malformed range <0109> <0100> has end < start, so should be skipped
      // bytes 01 00 should not be mapped
      expect(cmap.toUnicodeBytes(new Uint8Array([1, 0]))).toBeUndefined();
    });
  });

  describe("testParserWithMalformedbfrange2", () => {
    it("handles bfrange in non-strict mode (default)", () => {
      const data = loadCMapFixture("CMapMalformedbfrange2");
      const cmap = parseCMap(data);

      expect(cmap).toBeDefined();

      // bytes 00 01 from bfrange <0001> <0009> <0030>
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 1]))).toBe("0");

      // bytes 02 32 from bfrange <0232> <0432> <0041>
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0x32]))).toBe("A");

      // In non-strict mode, should handle values near the overflow boundary
      // Range is <0232> <0432> <0041> - 0x0201 entries (513)
      // 0x02F0 - 0x0232 = 0xBE = 190, so char is 0x0041 + 190 = 0x00FF
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0xf0]))).toBeDefined();
      // 0x02F1 - 0x0232 = 0xBF = 191, so char is 0x0041 + 191 = 0x0100 (wraps in non-strict)
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0xf1]))).toBeDefined();
    });

    it("handles bfrange in strict mode", () => {
      const data = loadCMapFixture("CMapMalformedbfrange2");
      const cmap = parseCMap(data, true);

      expect(cmap).toBeDefined();

      // bytes 00 01 from bfrange <0001> <0009> <0030>
      expect(cmap.toUnicodeBytes(new Uint8Array([0, 1]))).toBe("0");

      // bytes 02 32 from bfrange <0232> <0432> <0041>
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0x32]))).toBe("A");

      // In strict mode, 0x02F0 should work (before overflow)
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0xf0]))).toBeDefined();

      // In strict mode, 0x02F1 would overflow single-byte char, so mapping stops
      expect(cmap.toUnicodeBytes(new Uint8Array([2, 0xf1]))).toBeUndefined();
    });
  });

  describe("testIdentitybfrange", () => {
    it("parses identity bfrange mapping in strict mode", () => {
      const data = loadCMapFixture("Identitybfrange");
      const cmap = parseCMap(data, true);

      expect(cmap.name).toBe("Adobe-Identity-UCS");

      // Identity mapping: code bytes map to same Unicode value
      // <0000> <ffff> <0000> means 0x0000 -> U+0000, 0x0001 -> U+0001, etc.

      // 0x0041 (65) -> "A" (char code 65)
      const bytes1 = new Uint8Array([0, 65]);
      expect(cmap.toUnicodeBytes(bytes1)).toBe(String.fromCharCode(0x0041));

      // 0x3039 (12345) -> char 0x3039
      const bytes2 = new Uint8Array([0x30, 0x39]);
      expect(cmap.toUnicodeBytes(bytes2)).toBe(String.fromCharCode(0x3039));

      // Check border values in strict mode
      // 0x30FF -> works
      const bytes3 = new Uint8Array([0x30, 0xff]);
      expect(cmap.toUnicodeBytes(bytes3)).toBe(String.fromCharCode(0x30ff));

      // 0x3100 -> works (next value after 0x30FF)
      const bytes4 = new Uint8Array([0x31, 0x00]);
      expect(cmap.toUnicodeBytes(bytes4)).toBe(String.fromCharCode(0x3100));

      // 0xFFFF -> works
      const bytes5 = new Uint8Array([0xff, 0xff]);
      expect(cmap.toUnicodeBytes(bytes5)).toBe(String.fromCharCode(0xffff));
    });
  });

  describe("CMap metadata", () => {
    it("parses CIDSystemInfo from CMap", () => {
      const data = loadCMapFixture("Identitybfrange");
      const cmap = parseCMap(data);

      expect(cmap.name).toBe("Adobe-Identity-UCS");
      expect(cmap.type).toBe(2);
      expect(cmap.registry).toBe("Adobe");
      expect(cmap.ordering).toBe("UCS");
      expect(cmap.supplement).toBe(0);
    });

    it("parses CMapName from poorly formatted CMap", () => {
      const data = loadCMapFixture("CMapNoWhitespace");
      const cmap = parseCMap(data);

      expect(cmap.name).toBe("DDACTR+F1+0");
      expect(cmap.type).toBe(2);
    });
  });

  describe("CMap queries", () => {
    it("reports hasCIDMappings correctly", () => {
      const cmapWithCid = parseCMap(loadCMapFixture("CMapTest"));
      expect(cmapWithCid.hasCIDMappings()).toBe(true);

      const cmapWithoutCid = parseCMap(loadCMapFixture("Identitybfrange"));
      expect(cmapWithoutCid.hasCIDMappings()).toBe(false);
    });

    it("reports hasUnicodeMappings correctly", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));
      expect(cmap.hasUnicodeMappings()).toBe(true);

      const cmapIdentity = parseCMap(loadCMapFixture("Identitybfrange"));
      expect(cmapIdentity.hasUnicodeMappings()).toBe(true);
    });
  });

  describe("toUnicode convenience method", () => {
    it("looks up by code value", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));

      // Single byte values should try 1-byte first
      // bfchar <000A> <002A> maps 0x000A to "*"
      // But our toUnicode method tries to guess length...
      // For code < 256, it tries 1-byte first, then 2-byte
      // Code 0x0A = 10, try 1-byte: not found, try 2-byte: found? No, it's stored as 2-byte key 0x000A
      // Actually the code maps 2-byte codes, so toUnicode(10) tries 1-byte (not found)
      // then for code <= 0xffff tries 2-byte with value 10 -> looks up key 10 in 2-byte map

      // Let's check 2-byte value directly: 0x0001 -> "A"
      expect(cmap.toUnicode(0x0001)).toBe("A");
      expect(cmap.toUnicode(0x000a)).toBe("*");
    });

    it("handles multi-byte codes", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));

      // 2-byte codes
      expect(cmap.toUnicodeWithLength(0x0001, 2)).toBe("A");
      expect(cmap.toUnicodeWithLength(0x0100, 2)).toBe("0");
    });
  });

  describe("toCID convenience method", () => {
    it("looks up CID by code value", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));

      // cidrange <0000> <00ff> 0 -> code 0x0041 maps to CID 0x41 = 65
      expect(cmap.toCID(0x0041)).toBe(65);

      // cidrange <0100> <01ff> 256 -> code 0x0118 maps to CID 256 + 0x18 = 280
      expect(cmap.toCID(0x0118)).toBe(280);
    });

    it("returns 0 for unmapped codes when no CID mappings exist", () => {
      const cmap = parseCMap(loadCMapFixture("Identitybfrange"));
      expect(cmap.hasCIDMappings()).toBe(false);
      expect(cmap.toCID(65)).toBe(0);
    });
  });

  describe("reverse mapping", () => {
    it("can get code bytes from unicode", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));

      // "A" was mapped from <0001>
      const codes = cmap.getCodesFromUnicode("A");
      expect(codes).toEqual(new Uint8Array([0, 1]));

      // "*" was mapped from <000A>
      const asteriskCodes = cmap.getCodesFromUnicode("*");
      expect(asteriskCodes).toEqual(new Uint8Array([0, 0x0a]));
    });

    it("returns undefined for unmapped unicode", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));
      expect(cmap.getCodesFromUnicode("Z")).toBeUndefined();
    });
  });

  describe("space mapping", () => {
    it("tracks space character mapping", () => {
      const cmap = parseCMap(loadCMapFixture("CMapNoWhitespace"));

      // <0003> <0020> maps code 3 to space
      expect(cmap.spaceMapping).toBe(3);
    });

    it("returns -1 when no space mapping", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));
      expect(cmap.spaceMapping).toBe(-1);
    });
  });

  describe("wmode", () => {
    it("defaults to 0 (horizontal)", () => {
      const cmap = parseCMap(loadCMapFixture("CMapTest"));
      expect(cmap.wmode).toBe(0);
    });
  });
});
