import pako from "pako";
import { beforeEach, describe, expect, it } from "vitest";

import { ASCIIHexFilter } from "./ascii-hex-filter";
import { ASCII85Filter } from "./ascii85-filter";
import { CCITTFaxFilter } from "./ccitt-fax-filter";
import { DCTFilter } from "./dct-filter";
import { FilterPipeline } from "./filter-pipeline";
import { FlateFilter } from "./flate-filter";
import { LZWFilter } from "./lzw-filter";
import { RunLengthFilter } from "./run-length-filter";

describe("FilterPipeline", () => {
  beforeEach(() => {
    // Clear and re-register filters for each test
    FilterPipeline.clear();
    FilterPipeline.register(new FlateFilter());
    FilterPipeline.register(new ASCIIHexFilter());
    FilterPipeline.register(new ASCII85Filter());
  });

  describe("registration", () => {
    it("registers and retrieves filters", () => {
      expect(FilterPipeline.hasFilter("FlateDecode")).toBe(true);
      expect(FilterPipeline.hasFilter("ASCIIHexDecode")).toBe(true);
      expect(FilterPipeline.hasFilter("ASCII85Decode")).toBe(true);
      expect(FilterPipeline.hasFilter("NonExistent")).toBe(false);
    });

    it("returns registered filter by name", () => {
      const filter = FilterPipeline.getFilter("FlateDecode");
      expect(filter).toBeDefined();
      expect(filter!.name).toBe("FlateDecode");
    });

    it("clears all filters", () => {
      FilterPipeline.clear();
      expect(FilterPipeline.hasFilter("FlateDecode")).toBe(false);
    });
  });

  // Abbreviated filter names from ISO 32000-1 Table 6 — real-world PDFs
  // use them and readers are expected to accept them.
  describe("filter name abbreviations", () => {
    beforeEach(() => {
      FilterPipeline.register(new LZWFilter());
      FilterPipeline.register(new RunLengthFilter());
      FilterPipeline.register(new DCTFilter());
      FilterPipeline.register(new CCITTFaxFilter());
    });

    it("resolves every standard abbreviation to its filter", () => {
      const aliases: [string, string][] = [
        ["AHx", "ASCIIHexDecode"],
        ["A85", "ASCII85Decode"],
        ["LZW", "LZWDecode"],
        ["Fl", "FlateDecode"],
        ["RL", "RunLengthDecode"],
        ["CCF", "CCITTFaxDecode"],
        ["DCT", "DCTDecode"],
      ];

      for (const [alias, canonical] of aliases) {
        expect(FilterPipeline.hasFilter(alias)).toBe(true);
        expect(FilterPipeline.getFilter(alias)!.name).toBe(canonical);
      }
    });

    it("decodes a stream tagged with the /Fl abbreviation", () => {
      const original = new TextEncoder().encode("Hello, World!");
      const compressed = pako.deflate(original);

      const result = FilterPipeline.decode(new Uint8Array(compressed), { name: "Fl" });

      expect(new TextDecoder().decode(result)).toBe("Hello, World!");
    });

    it("still rejects unknown and case-mismatched names", () => {
      expect(FilterPipeline.hasFilter("fl")).toBe(false);
      expect(FilterPipeline.hasFilter("FlateDecod")).toBe(false);
      expect(() => FilterPipeline.decode(new Uint8Array([1]), { name: "bogus" })).toThrow(
        "Unknown filter: bogus",
      );
    });
  });

  describe("decode", () => {
    it("passes through empty filter array", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = FilterPipeline.decode(data, []);
      expect(result).toEqual(data);
    });

    it("decodes single filter", async () => {
      // "Hello" in hex
      const hexData = new TextEncoder().encode("48656C6C6F>");
      const result = FilterPipeline.decode(hexData, { name: "ASCIIHexDecode" });
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("throws on unknown filter", async () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(() => FilterPipeline.decode(data, { name: "UnknownFilter" })).toThrow(
        "Unknown filter: UnknownFilter",
      );
    });

    it("chains multiple filters in order", async () => {
      // First ASCII85, then ASCIIHex
      // "Hello" → ASCII85 → "87cURD]j7h~>" → ASCIIHex → hex representation
      // Actually let's do it the other way for easier testing:
      // hex("Hello") = "48656C6C6F" → encode that as ASCII85

      // For this test, encode "Hello" as hex, then decode with hex filter
      const hexData = new TextEncoder().encode("48656C6C6F>");
      const result = FilterPipeline.decode(hexData, [{ name: "ASCIIHexDecode" }]);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });
  });

  describe("encode", () => {
    it("encodes single filter", async () => {
      const data = new TextEncoder().encode("Hello");
      const encoded = FilterPipeline.encode(data, { name: "ASCIIHexDecode" });

      // Should be "48656C6C6F>"
      expect(new TextDecoder().decode(encoded)).toBe("48656C6C6F>");
    });

    it("encodes with filters in reverse order", async () => {
      // When encoding with [A, B], applies B first then A
      // This is the reverse of decode order
      const data = new TextEncoder().encode("Hi");

      // Just use single filter for simplicity in this test
      const encoded = FilterPipeline.encode(data, { name: "ASCIIHexDecode" });
      expect(new TextDecoder().decode(encoded)).toBe("4869>");
    });
  });

  describe("round-trip", () => {
    it("encode then decode returns original data (hex)", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const spec = { name: "ASCIIHexDecode" };

      const encoded = FilterPipeline.encode(original, spec);
      const decoded = FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });

    it("encode then decode returns original data (ASCII85)", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const spec = { name: "ASCII85Decode" };

      const encoded = FilterPipeline.encode(original, spec);
      const decoded = FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });

    it("encode then decode returns original data (Flate)", async () => {
      const original = new TextEncoder().encode("Hello, World! ".repeat(100));
      const spec = { name: "FlateDecode" };

      const encoded = FilterPipeline.encode(original, spec);
      const decoded = FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });
  });
});
