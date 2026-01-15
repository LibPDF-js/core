import { describe, expect, it } from "vitest";

import { cmyk, colorToArray, grayscale, rgb } from "./colors";

describe("rgb", () => {
  it("creates RGB color object", () => {
    const color = rgb(0.5, 0.3, 0.8);

    expect(color.type).toBe("RGB");
    expect(color.red).toBe(0.5);
    expect(color.green).toBe(0.3);
    expect(color.blue).toBe(0.8);
  });

  it("creates black", () => {
    const black = rgb(0, 0, 0);

    expect(black.red).toBe(0);
    expect(black.green).toBe(0);
    expect(black.blue).toBe(0);
  });

  it("creates white", () => {
    const white = rgb(1, 1, 1);

    expect(white.red).toBe(1);
    expect(white.green).toBe(1);
    expect(white.blue).toBe(1);
  });
});

describe("grayscale", () => {
  it("creates grayscale color object", () => {
    const color = grayscale(0.5);

    expect(color.type).toBe("Grayscale");
    expect(color.gray).toBe(0.5);
  });

  it("creates black", () => {
    const black = grayscale(0);

    expect(black.gray).toBe(0);
  });

  it("creates white", () => {
    const white = grayscale(1);

    expect(white.gray).toBe(1);
  });
});

describe("cmyk", () => {
  it("creates CMYK color object", () => {
    const color = cmyk(0.1, 0.2, 0.3, 0.4);

    expect(color.type).toBe("CMYK");
    expect(color.cyan).toBe(0.1);
    expect(color.magenta).toBe(0.2);
    expect(color.yellow).toBe(0.3);
    expect(color.black).toBe(0.4);
  });
});

describe("colorToArray", () => {
  it("converts RGB to array", () => {
    const color = rgb(0.1, 0.2, 0.3);
    const array = colorToArray(color);

    expect(array).toEqual([0.1, 0.2, 0.3]);
  });

  it("converts grayscale to array", () => {
    const color = grayscale(0.5);
    const array = colorToArray(color);

    expect(array).toEqual([0.5]);
  });

  it("converts CMYK to array", () => {
    const color = cmyk(0.1, 0.2, 0.3, 0.4);
    const array = colorToArray(color);

    expect(array).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
