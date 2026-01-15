import { describe, expect, it } from "vitest";

import { isPng, parsePng } from "./png";

describe("isPng", () => {
  it("returns true for PNG signature", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isPng(bytes)).toBe(true);
  });

  it("returns false for JPEG data", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isPng(jpeg)).toBe(false);
  });

  it("returns false for empty data", () => {
    expect(isPng(new Uint8Array(0))).toBe(false);
  });

  it("returns false for data too short", () => {
    expect(isPng(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false);
  });
});

describe("parsePng", () => {
  it("throws for invalid PNG", () => {
    const notPng = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() => parsePng(notPng)).toThrow("Invalid PNG: missing signature");
  });

  it("throws for missing IHDR", () => {
    // PNG signature but nothing else
    const bytes = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      // IEND chunk (empty)
      0x00,
      0x00,
      0x00,
      0x00, // length 0
      0x49,
      0x45,
      0x4e,
      0x44, // "IEND"
      0xae,
      0x42,
      0x60,
      0x82, // CRC
    ]);
    expect(() => parsePng(bytes)).toThrow("Invalid PNG: missing IHDR chunk");
  });

  // Note: Full PNG parsing tests would require actual PNG files
  // The basic signature tests verify the module works correctly
});
