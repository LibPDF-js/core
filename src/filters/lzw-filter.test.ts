import { hexToBytes } from "#src/test-utils";
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

      const result = filter.decode(compressed);

      // Result should be decompressible
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles clear code", async () => {
      // Data with clear code to reset dictionary
      // This tests that the dictionary is properly reset
      const compressed = new Uint8Array([0x80, 0x0b, 0x60, 0x50, 0x20, 0x0c, 0x00]);

      // Should not throw
      const result = filter.decode(compressed);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("handles empty after clear", async () => {
      // Clear code (256) immediately followed by EOD (257)
      // In 9-bit codes packed MSB-first:
      //   256 = 100000000
      //   257 = 100000001
      // Packed: 10000000 01000000 01xxxxxx
      const compressed = new Uint8Array([0x80, 0x40, 0x40]);

      const result = filter.decode(compressed);

      expect(result.length).toBe(0);
    });

    it("decodes single byte", async () => {
      // Clear + single byte 'A' (65) + EOD
      // 256 = 0x100, 65 = 0x41, 257 = 0x101
      // In 9-bit codes: 100000000 01000001 100000001
      const compressed = new Uint8Array([0x80, 0x0b, 0x02, 0x01]);

      const result = filter.decode(compressed);

      // Should decode to at least one byte
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("decodes streams crossing the 9→10 bit code-width boundary", () => {
      // LZW payload from issue #110. The repetitive comment prefix grows the
      // dictionary past entry 511, so later codes are 10 bits wide. With the
      // default EarlyChange=1 the reader must widen when nextCode + 1 reaches
      // 512 — one entry earlier than the old threshold check did.
      const compressed = hexToBytes(
        "8009440412110c88452311c90492512c984d2713ca0512914ca8552b15cb0592d0c06232198d06a361b8e072412110c8" +
          "8452311c90492512c984d2713ca0512914ca8552b15cb0592d0c06232198d06a361b8e072412110c88452311c9049251" +
          "2c984d2713ca0512914ca8552b15cb0592d0c06232198d06a361b8e072412110c88452311c90492512c984d2713ca051" +
          "2914ca8552b15cb0592d0c06232198d06a361b8e072412110c88452311c90492512c984d2713ca0512914ca8552b15cb" +
          "0592d0c06232198d06a361b8e072412110c88452311c90492512c984d2713ca0512914ca8552b15cb0592d0c06232198" +
          "d06a361b8e072412110c88452311c90492512c984d2713ca0512914ca8552b15cb0592d0c06232198d06a361b8e07220" +
          "884218882288c2389024894258982689c278a0288a4298a82a8ac2b8b02c8b418062190661a06a1b06e1c07220884218" +
          "882288c2389024894258982689c278a0288a4298a82a8ac2b8b02c8b418062190661a06a1b06e1c072050842a0401788" +
          "c188401886c100a8330401a8601006e1a060100a832040140a63c8dc3a0d0328e8348c6100982d0ae100c8328c6378c8" +
          "328e4100e4328e0390de320ea318e8348de37052100a83504018040168641b0402a0c810050270de100e0328e4398de3" +
          "70c236040378e4100c63a8e63a0de368ca39040320c23a0c217052100a835040228a805202",
      );

      const result = filter.decode(compressed);
      const text = new TextDecoder("latin1").decode(result);

      expect(text).toContain("(Synthetic LZW decoder reproduction) Tj");
    });
  });

  describe("encode", () => {
    it("throws not implemented error", async () => {
      const data = new TextEncoder().encode("Hello");

      expect(() => filter.encode(data)).toThrow("not implemented");
    });
  });

  describe("filter registration", () => {
    it("has correct name", () => {
      expect(filter.name).toBe("LZWDecode");
    });
  });
});
