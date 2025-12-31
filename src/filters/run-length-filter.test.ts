import { describe, expect, it } from "vitest";
import { RunLengthFilter } from "./run-length-filter";

describe("RunLengthFilter", () => {
  const filter = new RunLengthFilter();

  describe("decode", () => {
    it("decodes literal run", async () => {
      // Length 2 means copy next 3 bytes literally
      const input = new Uint8Array([2, 65, 66, 67, 128]); // "ABC" + EOD
      const result = await filter.decode(input);

      expect(new TextDecoder().decode(result)).toBe("ABC");
    });

    it("decodes repeat run", async () => {
      // Length 253 means repeat next byte (257-253=4) times
      const input = new Uint8Array([253, 65, 128]); // 'A' x 4 + EOD
      const result = await filter.decode(input);

      expect(new TextDecoder().decode(result)).toBe("AAAA");
    });

    it("decodes mixed literal and repeat runs", async () => {
      // Literal "AB" + Repeat 'C' x 3
      const input = new Uint8Array([
        1,
        65,
        66, // Literal: 2 bytes "AB"
        254,
        67, // Repeat: 'C' x 3
        128, // EOD
      ]);
      const result = await filter.decode(input);

      expect(new TextDecoder().decode(result)).toBe("ABCCC");
    });

    it("handles EOD marker", async () => {
      // EOD in the middle stops decoding
      const input = new Uint8Array([0, 65, 128, 0, 66]);
      const result = await filter.decode(input);

      expect(new TextDecoder().decode(result)).toBe("A");
    });

    it("handles empty input", async () => {
      const input = new Uint8Array([128]); // Just EOD
      const result = await filter.decode(input);

      expect(result.length).toBe(0);
    });

    it("handles maximum literal length (128 bytes)", async () => {
      // Length 127 means copy next 128 bytes
      const bytes = new Array(128).fill(42);
      const input = new Uint8Array([127, ...bytes, 128]);
      const result = await filter.decode(input);

      expect(result.length).toBe(128);
      expect(result.every(b => b === 42)).toBe(true);
    });

    it("handles maximum repeat length (128 times)", async () => {
      // Length 129 means repeat next byte (257-129=128) times
      const input = new Uint8Array([129, 42, 128]);
      const result = await filter.decode(input);

      expect(result.length).toBe(128);
      expect(result.every(b => b === 42)).toBe(true);
    });
  });

  describe("encode", () => {
    it("encodes literal data", async () => {
      const input = new TextEncoder().encode("ABC");
      const encoded = await filter.encode(input);

      // Should be: length byte + literals + EOD
      expect(encoded[encoded.length - 1]).toBe(128); // EOD
    });

    it("encodes repeated data efficiently", async () => {
      const input = new Uint8Array(10).fill(65); // 'A' x 10
      const encoded = await filter.encode(input);

      // Repeat encoding should be smaller than input
      expect(encoded.length).toBeLessThan(input.length);

      // Should contain repeat marker (257 - 10 = 247)
      expect(encoded[0]).toBe(247);
      expect(encoded[1]).toBe(65);
      expect(encoded[2]).toBe(128); // EOD
    });

    it("encodes mixed data", async () => {
      // "ABCCCC" - literal "AB" + repeat "C" x 4
      const input = new TextEncoder().encode("ABCCCC");
      const encoded = await filter.encode(input);

      expect(encoded[encoded.length - 1]).toBe(128); // EOD
    });

    it("adds EOD marker", async () => {
      const input = new TextEncoder().encode("X");
      const encoded = await filter.encode(input);

      expect(encoded[encoded.length - 1]).toBe(128);
    });
  });

  describe("round-trip", () => {
    it("preserves simple data", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves repeated data", async () => {
      const original = new Uint8Array(50).fill(42);
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves binary data", async () => {
      const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });

    it("preserves pattern data", async () => {
      // AAABBBCCC pattern
      const original = new Uint8Array([65, 65, 65, 66, 66, 66, 67, 67, 67]);
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe("filter registration", () => {
    it("has correct name", () => {
      expect(filter.name).toBe("RunLengthDecode");
    });
  });
});
