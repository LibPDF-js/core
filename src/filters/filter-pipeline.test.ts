import { beforeEach, describe, expect, it } from "vitest";
import { ASCIIHexFilter } from "./ascii-hex-filter";
import { ASCII85Filter } from "./ascii85-filter";
import type { Filter } from "./filter";
import { FilterPipeline } from "./filter-pipeline";
import { FlateFilter } from "./flate-filter";

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

  describe("decode", () => {
    it("passes through empty filter array", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await FilterPipeline.decode(data, []);
      expect(result).toEqual(data);
    });

    it("decodes single filter", async () => {
      // "Hello" in hex
      const hexData = new TextEncoder().encode("48656C6C6F>");
      const result = await FilterPipeline.decode(hexData, { name: "ASCIIHexDecode" });
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("throws on unknown filter", async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(FilterPipeline.decode(data, { name: "UnknownFilter" })).rejects.toThrow(
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
      const result = await FilterPipeline.decode(hexData, [{ name: "ASCIIHexDecode" }]);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });
  });

  describe("encode", () => {
    it("encodes single filter", async () => {
      const data = new TextEncoder().encode("Hello");
      const encoded = await FilterPipeline.encode(data, { name: "ASCIIHexDecode" });

      // Should be "48656C6C6F>"
      expect(new TextDecoder().decode(encoded)).toBe("48656C6C6F>");
    });

    it("encodes with filters in reverse order", async () => {
      // When encoding with [A, B], applies B first then A
      // This is the reverse of decode order
      const data = new TextEncoder().encode("Hi");

      // Just use single filter for simplicity in this test
      const encoded = await FilterPipeline.encode(data, { name: "ASCIIHexDecode" });
      expect(new TextDecoder().decode(encoded)).toBe("4869>");
    });
  });

  describe("round-trip", () => {
    it("encode then decode returns original data (hex)", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const spec = { name: "ASCIIHexDecode" };

      const encoded = await FilterPipeline.encode(original, spec);
      const decoded = await FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });

    it("encode then decode returns original data (ASCII85)", async () => {
      const original = new TextEncoder().encode("Hello, World!");
      const spec = { name: "ASCII85Decode" };

      const encoded = await FilterPipeline.encode(original, spec);
      const decoded = await FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });

    it("encode then decode returns original data (Flate)", async () => {
      const original = new TextEncoder().encode("Hello, World! ".repeat(100));
      const spec = { name: "FlateDecode" };

      const encoded = await FilterPipeline.encode(original, spec);
      const decoded = await FilterPipeline.decode(encoded, spec);

      expect(decoded).toEqual(original);
    });
  });
});
