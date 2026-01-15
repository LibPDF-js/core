import { describe, expect, it } from "vitest";

import { PdfRef } from "./pdf-ref";

describe("PdfRef", () => {
  it("has type 'ref'", () => {
    expect(PdfRef.of(1, 0).type).toBe("ref");
  });

  it("stores object number and generation", () => {
    const ref = PdfRef.of(42, 1);

    expect(ref.objectNumber).toBe(42);
    expect(ref.generation).toBe(1);
  });

  it("defaults generation to 0", () => {
    const ref = PdfRef.of(5);

    expect(ref.objectNumber).toBe(5);
    expect(ref.generation).toBe(0);
  });

  it("returns same instance for same ref (interning)", () => {
    const a = PdfRef.of(1, 0);
    const b = PdfRef.of(1, 0);

    expect(a).toBe(b);
  });

  it("returns different instances for different refs", () => {
    const a = PdfRef.of(1, 0);
    const b = PdfRef.of(2, 0);
    const c = PdfRef.of(1, 1);

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("formats as PDF syntax via toString()", () => {
    expect(PdfRef.of(1, 0).toString()).toBe("1 0 R");
    expect(PdfRef.of(42, 1).toString()).toBe("42 1 R");
  });
});
