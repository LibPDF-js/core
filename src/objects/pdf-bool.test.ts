import { describe, expect, it } from "vitest";

import { PdfBool } from "./pdf-bool";

describe("PdfBool", () => {
  it("has type 'bool'", () => {
    expect(PdfBool.TRUE.type).toBe("bool");
    expect(PdfBool.FALSE.type).toBe("bool");
  });

  it("stores the boolean value", () => {
    expect(PdfBool.TRUE.value).toBe(true);
    expect(PdfBool.FALSE.value).toBe(false);
  });

  it("returns cached instances via .of()", () => {
    expect(PdfBool.of(true)).toBe(PdfBool.TRUE);
    expect(PdfBool.of(false)).toBe(PdfBool.FALSE);
  });

  it("returns same instance for same value", () => {
    expect(PdfBool.of(true)).toBe(PdfBool.of(true));
    expect(PdfBool.of(false)).toBe(PdfBool.of(false));
  });
});
