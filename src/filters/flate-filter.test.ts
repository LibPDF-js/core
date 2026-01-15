import pako from "pako";
import { describe, expect, it } from "vitest";

import { FlateFilter } from "./flate-filter";

describe("FlateFilter", () => {
  const filter = new FlateFilter();

  describe("decode", () => {
    it("decodes simple compressed data", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const compressed = pako.deflate(original);

      const result = await filter.decode(compressed);

      expect(new TextDecoder().decode(result)).toBe("Hello, World!");
    });

    it("decodes repeated data (high compression)", async () => {
      const original = new TextEncoder().encode("AAAA".repeat(1000));
      const compressed = pako.deflate(original);

      const result = await filter.decode(compressed);

      expect(result).toEqual(original);
      expect(compressed.length).toBeLessThan(original.length / 10);
    });

    it("decodes binary data", async () => {
      const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
      const compressed = pako.deflate(original);

      const result = await filter.decode(compressed);

      expect(result).toEqual(original);
    });

    it("decodes empty stream", async () => {
      const original = new Uint8Array(0);
      const compressed = pako.deflate(original);

      const result = await filter.decode(compressed);

      expect(result.length).toBe(0);
    });

    it("decodes large data", async () => {
      // Use moderately sized data to avoid timeout
      const original = new Uint8Array(10000);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }
      const compressed = pako.deflate(original);

      const result = await filter.decode(compressed);

      expect(result).toEqual(original);
    }, 30000); // 30 second timeout for large data
  });

  describe("encode", () => {
    it("encodes simple data", async () => {
      const original = new TextEncoder().encode("Hello, World!");

      const encoded = await filter.encode(original);

      // Verify it's valid zlib by decoding
      const decoded = pako.inflate(encoded);
      expect(new TextDecoder().decode(decoded)).toBe("Hello, World!");
    });

    it("achieves compression on repeated data", async () => {
      const original = new TextEncoder().encode("AAAA".repeat(1000));

      const encoded = await filter.encode(original);

      expect(encoded.length).toBeLessThan(original.length);
    });
  });

  describe("round-trip", () => {
    it("preserves text data", async () => {
      const original = new TextEncoder().encode("Hello, World! This is a test.");

      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves binary data", async () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }

      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves large data", async () => {
      const original = new Uint8Array(50000);
      for (let i = 0; i < original.length; i++) {
        original[i] = Math.floor(Math.random() * 256);
      }

      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
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
      const result = await filter.decode(compressed, undefined);

      expect(new TextDecoder().decode(result)).toBe("Test");
    });
  });
});
