import pako from "pako";
import { describe, expect, it } from "vitest";

import { FlateFilter } from "./flate-filter";

describe("FlateFilter", () => {
  const filter = new FlateFilter();

  describe("decode", () => {
    it("decodes simple compressed data", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(new TextDecoder().decode(result)).toBe("Hello, World!");
    });

    it("decodes repeated data (high compression)", async () => {
      const original = new TextEncoder().encode("AAAA".repeat(1000));
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(result).toEqual(original);
      expect(compressed.length).toBeLessThan(original.length / 10);
    });

    it("decodes binary data", async () => {
      const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(result).toEqual(original);
    });

    it("decodes empty stream", async () => {
      const original = new Uint8Array(0);
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(result.length).toBe(0);
    });

    it("decodes large data", async () => {
      // Use moderately sized data to avoid timeout
      const original = new Uint8Array(10000);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(result).toEqual(original);
    }, 30000); // 30 second timeout for large data
  });

  describe("encode", () => {
    it("encodes simple data", async () => {
      const original = new TextEncoder().encode("Hello, World!");

      const encoded = filter.encode(original);

      // Verify it's valid zlib by decoding
      const decoded = pako.inflate(encoded);
      expect(new TextDecoder().decode(decoded)).toBe("Hello, World!");
    });

    it("achieves compression on repeated data", async () => {
      const original = new TextEncoder().encode("AAAA".repeat(1000));

      const encoded = filter.encode(original);

      expect(encoded.length).toBeLessThan(original.length);
    });
  });

  describe("round-trip", () => {
    it("preserves text data", async () => {
      const original = new TextEncoder().encode("Hello, World! This is a test.");

      const encoded = filter.encode(original);
      const decoded = filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves binary data", async () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }

      const encoded = filter.encode(original);
      const decoded = filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves large data", async () => {
      const original = new Uint8Array(50000);
      for (let i = 0; i < original.length; i++) {
        original[i] = Math.floor(Math.random() * 256);
      }

      const encoded = filter.encode(original);
      const decoded = filter.decode(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe("sync-flush streams", () => {
    // Some PDF generators (notably PDFium) produce zlib streams terminated
    // with a sync-flush marker (00 00 FF FF) instead of a proper final
    // block and Adler-32 checksum. These are the actual byte sequences
    // from the PDF reported in issue #16.

    it("decodes a small sync-flush stream", () => {
      // Decompresses to "q\n" — a PDF content stream save-state operator
      const syncFlush = new Uint8Array([120, 156, 42, 228, 2, 0, 0, 0, 255, 255]);

      const result = filter.decode(syncFlush);

      expect(new TextDecoder().decode(result)).toBe("q\n");
    });

    it("decodes a larger sync-flush stream with PDF content", () => {
      // Decompresses to "/ADBE_FillSign BMC \nq \n/Fm0 Do \nQ \nEMC"
      const syncFlush = new Uint8Array([
        120, 156, 210, 119, 116, 113, 114, 141, 119, 203, 204, 201, 9, 206, 76, 207, 83, 112, 242,
        117, 86, 224, 42, 84, 224, 210, 119, 203, 53, 80, 112, 201, 87, 224, 10, 84, 224, 114, 245,
        117, 6, 0, 0, 0, 255, 255,
      ]);

      const result = filter.decode(syncFlush);

      expect(new TextDecoder().decode(result)).toBe("/ADBE_FillSign BMC \nq \n/Fm0 Do \nQ \nEMC");
    });

    it("decodes another small sync-flush stream", () => {
      // Decompresses to "\nQ\n" — a PDF content stream restore-state operator
      const syncFlush = new Uint8Array([120, 156, 226, 10, 228, 2, 0, 0, 0, 255, 255]);

      const result = filter.decode(syncFlush);

      expect(new TextDecoder().decode(result)).toBe("\nQ\n");
    });

    it("still handles well-formed streams normally", () => {
      const original = new TextEncoder().encode("Hello, World!");
      const compressed = pako.deflate(original);

      const result = filter.decode(compressed);

      expect(new TextDecoder().decode(result)).toBe("Hello, World!");
    });

    it("returns empty for truly corrupt data (lenient)", () => {
      // Random garbage that cannot be decompressed at all.
      // Returns empty rather than throwing — callers handle empty data gracefully.
      const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);

      const result = filter.decode(garbage);

      expect(result).toEqual(new Uint8Array(0));
    });
  });

  describe("predictor support", () => {
    // Predictor tests would need proper test data
    // For now, just verify that params are passed through
    it("accepts params without predictor", async () => {
      const original = new TextEncoder().encode("Test");
      const compressed = pako.deflate(original);

      // Empty params dict (would come from PDF)
      // For testing, we pass undefined
      const result = filter.decode(compressed, undefined);

      expect(new TextDecoder().decode(result)).toBe("Test");
    });
  });
});
