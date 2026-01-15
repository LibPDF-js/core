import { describe, expect, it } from "vitest";

import { ASCIIHexFilter } from "./ascii-hex-filter";

describe("ASCIIHexFilter", () => {
  const filter = new ASCIIHexFilter();

  describe("decode", () => {
    it("decodes simple hex string", async () => {
      const input = new TextEncoder().encode("48656C6C6F>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("decodes lowercase hex", async () => {
      const input = new TextEncoder().encode("48656c6c6f>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("decodes mixed case hex", async () => {
      const input = new TextEncoder().encode("48656C6c6F>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("ignores whitespace", async () => {
      const input = new TextEncoder().encode("48 65 6C\n6C\t6F>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("handles odd number of digits (pads with 0)", async () => {
      // "4" → 0x40 (padded to "40")
      const input = new TextEncoder().encode("4>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0x40]));
    });

    it("stops at > terminator", async () => {
      const input = new TextEncoder().encode("4865>6C6C6F");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("He");
    });

    it("handles empty input", async () => {
      const input = new TextEncoder().encode(">");
      const result = await filter.decode(input);
      expect(result.length).toBe(0);
    });

    it("decodes binary data correctly", async () => {
      const input = new TextEncoder().encode("00FF80>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0x00, 0xff, 0x80]));
    });

    it("skips invalid characters (lenient)", async () => {
      const input = new TextEncoder().encode("48XY65ZZ6C6C6F>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });
  });

  describe("encode", () => {
    it("encodes simple data", async () => {
      const input = new TextEncoder().encode("Hello");
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe("48656C6C6F>");
    });

    it("encodes binary data", async () => {
      const input = new Uint8Array([0x00, 0xff, 0x80]);
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe("00FF80>");
    });

    it("encodes empty data", async () => {
      const input = new Uint8Array(0);
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe(">");
    });
  });

  describe("round-trip", () => {
    it("preserves data through encode/decode", async () => {
      const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);
      expect(decoded).toEqual(original);
    });
  });
});
