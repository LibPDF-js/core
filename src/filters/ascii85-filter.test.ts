import { describe, expect, it } from "vitest";
import { ASCII85Filter } from "./ascii85-filter";

describe("ASCII85Filter", () => {
  const filter = new ASCII85Filter();

  describe("decode", () => {
    it("decodes simple string", async () => {
      // Use round-trip to verify: encode "Hello" then decode it
      const original = new TextEncoder().encode("Hello");
      const encoded = await filter.encode(original);
      const result = await filter.decode(encoded);
      expect(new TextDecoder().decode(result)).toBe("Hello");
    });

    it("decodes 4-byte aligned data", async () => {
      // "test" = 0x74657374 = FD,i:
      const input = new TextEncoder().encode("FCfN8~>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("test");
    });

    it("handles z shortcut for four zeros", async () => {
      const input = new TextEncoder().encode("z~>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0]));
    });

    it("handles multiple z shortcuts", async () => {
      const input = new TextEncoder().encode("zz~>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it("ignores whitespace", async () => {
      const input = new TextEncoder().encode("FCf N8~>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("test");
    });

    it("ignores newlines", async () => {
      const input = new TextEncoder().encode("FCf\nN8~>");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("test");
    });

    it("handles partial final group (2 chars → 1 byte)", async () => {
      // Single byte 'A' (0x41) needs 2 chars
      const input = new TextEncoder().encode("5l~>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0x41]));
    });

    it("handles partial final group (3 chars → 2 bytes)", async () => {
      // "AB" = 0x4142
      const input = new TextEncoder().encode("5sb~>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0x41, 0x42]));
    });

    it("handles partial final group (4 chars → 3 bytes)", async () => {
      // "ABC" = 0x414243
      const input = new TextEncoder().encode("5sdp~>");
      const result = await filter.decode(input);
      expect(result).toEqual(new Uint8Array([0x41, 0x42, 0x43]));
    });

    it("handles empty input", async () => {
      const input = new TextEncoder().encode("~>");
      const result = await filter.decode(input);
      expect(result.length).toBe(0);
    });

    it("stops at ~> marker", async () => {
      const input = new TextEncoder().encode("FCfN8~>garbage");
      const result = await filter.decode(input);
      expect(new TextDecoder().decode(result)).toBe("test");
    });
  });

  describe("encode", () => {
    it("encodes simple string", async () => {
      const input = new TextEncoder().encode("test");
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe("FCfN8~>");
    });

    it("uses z shortcut for zeros", async () => {
      const input = new Uint8Array([0, 0, 0, 0]);
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe("z~>");
    });

    it("encodes partial final group (1 byte)", async () => {
      const input = new Uint8Array([0x41]);
      const result = await filter.encode(input);
      // Should be 2 chars + ~>
      const text = new TextDecoder().decode(result);
      expect(text).toMatch(/^.{2}~>$/);
    });

    it("encodes partial final group (2 bytes)", async () => {
      const input = new Uint8Array([0x41, 0x42]);
      const result = await filter.encode(input);
      // Should be 3 chars + ~>
      const text = new TextDecoder().decode(result);
      expect(text).toMatch(/^.{3}~>$/);
    });

    it("encodes partial final group (3 bytes)", async () => {
      const input = new Uint8Array([0x41, 0x42, 0x43]);
      const result = await filter.encode(input);
      // Should be 4 chars + ~>
      const text = new TextDecoder().decode(result);
      expect(text).toMatch(/^.{4}~>$/);
    });

    it("encodes empty data", async () => {
      const input = new Uint8Array(0);
      const result = await filter.encode(input);
      expect(new TextDecoder().decode(result)).toBe("~>");
    });
  });

  describe("round-trip", () => {
    it("preserves 4-byte aligned data", async () => {
      const original = new TextEncoder().encode("testdata");
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it("preserves non-aligned data", async () => {
      const original = new TextEncoder().encode("Hello, World!");
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

    it("preserves all-zeros", async () => {
      const original = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
      const encoded = await filter.encode(original);
      expect(new TextDecoder().decode(encoded)).toBe("zz~>");
      const decoded = await filter.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it("preserves long data", async () => {
      const original = new TextEncoder().encode("A".repeat(1000));
      const encoded = await filter.encode(original);
      const decoded = await filter.decode(encoded);
      expect(decoded).toEqual(original);
    });
  });
});
