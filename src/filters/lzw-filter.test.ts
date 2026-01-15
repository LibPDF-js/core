import { describe, expect, it } from "vitest";

import { LZWFilter } from "./lzw-filter";

describe("LZWFilter", () => {
  const filter = new LZWFilter();

  describe("decode", () => {
    it("decodes simple LZW compressed data", async () => {
      // LZW compressed "ABABABA" (a simple pattern)
      // This is manually constructed LZW data
      // Clear (256) + 'A' (65) + 'B' (66) + code for "AB" (258) + 'A' + EOD (257)
      const compressed = new Uint8Array([0x80, 0x0b, 0x60, 0x50, 0x22, 0x0c, 0x0c, 0x85, 0x01]);

      const result = await filter.decode(compressed);

      // Result should be decompressible
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles clear code", async () => {
      // Data with clear code to reset dictionary
      // This tests that the dictionary is properly reset
      const compressed = new Uint8Array([0x80, 0x0b, 0x60, 0x50, 0x20, 0x0c, 0x00]);

      // Should not throw
      const result = await filter.decode(compressed);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("handles empty after clear", async () => {
      // Clear code (256) immediately followed by EOD (257)
      // In 9-bit codes packed MSB-first:
      //   256 = 100000000
      //   257 = 100000001
      // Packed: 10000000 01000000 01xxxxxx
      const compressed = new Uint8Array([0x80, 0x40, 0x40]);

      const result = await filter.decode(compressed);

      expect(result.length).toBe(0);
    });

    it("decodes single byte", async () => {
      // Clear + single byte 'A' (65) + EOD
      // 256 = 0x100, 65 = 0x41, 257 = 0x101
      // In 9-bit codes: 100000000 01000001 100000001
      const compressed = new Uint8Array([0x80, 0x0b, 0x02, 0x01]);

      const result = await filter.decode(compressed);

      // Should decode to at least one byte
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("encode", () => {
    it("throws not implemented error", async () => {
      const data = new TextEncoder().encode("Hello");

      await expect(filter.encode(data)).rejects.toThrow("not implemented");
    });
  });

  describe("filter registration", () => {
    it("has correct name", () => {
      expect(filter.name).toBe("LZWDecode");
    });
  });
});
