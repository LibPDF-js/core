import { describe, expect, it } from "vitest";

import { getRotatedFormTransform } from "./pdf-embedded-page";

describe("getRotatedFormTransform", () => {
  it("returns null for unrotated pages", () => {
    expect(getRotatedFormTransform(0, [0, 0, 612, 792])).toBeNull();
  });

  it("maps 90 degree rotation into visual space", () => {
    const result = getRotatedFormTransform(90, [0, 0, 1000, 200]);

    expect(result).not.toBeNull();
    expect(result!.matrix).toEqual([0, -1, 1, 0, 0, 1000]);
    expect(result!.width).toBe(200);
    expect(result!.height).toBe(1000);
  });

  it("maps 180 degree rotation into visual space", () => {
    const result = getRotatedFormTransform(180, [0, 0, 612, 792]);

    expect(result).not.toBeNull();
    expect(result!.matrix).toEqual([-1, 0, 0, -1, 612, 792]);
    expect(result!.width).toBe(612);
    expect(result!.height).toBe(792);
  });

  it("maps 270 degree rotation into visual space", () => {
    const result = getRotatedFormTransform(270, [0, 0, 1000, 200]);

    expect(result).not.toBeNull();
    expect(result!.matrix).toEqual([0, 1, -1, 0, 200, 0]);
    expect(result!.width).toBe(200);
    expect(result!.height).toBe(1000);
  });

  it("preserves non-zero box origins", () => {
    const result = getRotatedFormTransform(90, [100, 50, 712, 842]);

    expect(result).not.toBeNull();
    // x' = y - 50, y' = 712 - x; the rotated content still lands in
    // [0, 0, 792, 612]
    expect(result!.matrix).toEqual([0, -1, 1, 0, -50, 712]);
    expect(result!.width).toBe(792);
    expect(result!.height).toBe(612);
  });

  it("normalizes out-of-range rotations", () => {
    const result = getRotatedFormTransform(450, [0, 0, 100, 200]);

    expect(result).not.toBeNull();
    expect(result!.matrix).toEqual([0, -1, 1, 0, 0, 100]);
  });
});
