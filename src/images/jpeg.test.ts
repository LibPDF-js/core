import { describe, expect, it } from "vitest";

import { isJpeg, parseJpegHeader } from "./jpeg";

describe("isJpeg", () => {
  it("returns true for JPEG signature", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isJpeg(bytes)).toBe(true);
  });

  it("returns false for non-JPEG data", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isJpeg(png)).toBe(false);
  });

  it("returns false for empty data", () => {
    expect(isJpeg(new Uint8Array(0))).toBe(false);
  });

  it("returns false for data too short", () => {
    expect(isJpeg(new Uint8Array([0xff]))).toBe(false);
  });
});

describe("parseJpegHeader", () => {
  // Create a minimal valid JPEG with SOF0 marker
  function createMinimalJpeg(width: number, height: number, components: number): Uint8Array {
    // JPEG structure:
    // SOI (FFD8) + APP0 (FFE0) + SOF0 (FFC0) with dimensions
    const sof0Length = 8 + components * 3; // 8 bytes header + 3 bytes per component
    const bytes = new Uint8Array([
      // SOI
      0xff,
      0xd8,
      // APP0 (minimal)
      0xff,
      0xe0,
      0x00,
      0x02, // length 2 (just the length field)
      // SOF0 (Start of Frame, baseline DCT)
      0xff,
      0xc0,
      (sof0Length >> 8) & 0xff,
      sof0Length & 0xff, // length
      0x08, // precision (8 bits)
      (height >> 8) & 0xff,
      height & 0xff, // height
      (width >> 8) & 0xff,
      width & 0xff, // width
      components, // number of components
      // Component specs (3 bytes each)
      ...Array(components * 3).fill(0),
    ]);
    return bytes;
  }

  it("parses dimensions from valid JPEG", () => {
    const jpeg = createMinimalJpeg(640, 480, 3);
    const info = parseJpegHeader(jpeg);

    expect(info.width).toBe(640);
    expect(info.height).toBe(480);
  });

  it("detects RGB color space for 3 components", () => {
    const jpeg = createMinimalJpeg(100, 100, 3);
    const info = parseJpegHeader(jpeg);

    expect(info.colorSpace).toBe("DeviceRGB");
  });

  it("detects grayscale for 1 component", () => {
    const jpeg = createMinimalJpeg(100, 100, 1);
    const info = parseJpegHeader(jpeg);

    expect(info.colorSpace).toBe("DeviceGray");
  });

  it("detects CMYK for 4 components", () => {
    const jpeg = createMinimalJpeg(100, 100, 4);
    const info = parseJpegHeader(jpeg);

    expect(info.colorSpace).toBe("DeviceCMYK");
  });

  it("throws for invalid JPEG", () => {
    const notJpeg = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(() => parseJpegHeader(notJpeg)).toThrow();
  });
});
