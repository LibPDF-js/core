import { describe, expect, it } from "vitest";

import { PdfNumber } from "./pdf-number";

describe("PdfNumber", () => {
  it("has type 'number'", () => {
    expect(PdfNumber.of(42).type).toBe("number");
  });

  it("stores integer values", () => {
    expect(PdfNumber.of(42).value).toBe(42);
    expect(PdfNumber.of(-100).value).toBe(-100);
    expect(PdfNumber.of(0).value).toBe(0);
  });

  it("stores real values", () => {
    expect(PdfNumber.of(3.14).value).toBe(3.14);
    expect(PdfNumber.of(-0.5).value).toBe(-0.5);
  });

  it("detects integers", () => {
    expect(PdfNumber.of(42).isInteger()).toBe(true);
    expect(PdfNumber.of(-100).isInteger()).toBe(true);
    expect(PdfNumber.of(0).isInteger()).toBe(true);
  });

  it("detects non-integers", () => {
    expect(PdfNumber.of(3.14).isInteger()).toBe(false);
    expect(PdfNumber.of(-0.5).isInteger()).toBe(false);
  });

  it("creates new instances (not interned)", () => {
    const a = PdfNumber.of(42);
    const b = PdfNumber.of(42);

    expect(a).not.toBe(b);
    expect(a.value).toBe(b.value);
  });
});
