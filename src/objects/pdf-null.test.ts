import { describe, expect, it } from "vitest";

import { PdfNull } from "./pdf-null";

describe("PdfNull", () => {
  it("has type 'null'", () => {
    expect(PdfNull.instance.type).toBe("null");
  });

  it("is a singleton (same reference)", () => {
    const a = PdfNull.instance;
    const b = PdfNull.instance;

    expect(a).toBe(b);
  });
});
