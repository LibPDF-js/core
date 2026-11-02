import { ByteWriter } from "#src/io/byte-writer";
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

  it("keeps refs with large generations distinct", () => {
    const a = PdfRef.of(1, 65536);
    const b = PdfRef.of(2, 0);

    expect(a).not.toBe(b);
    expect(a.generation).toBe(65536);
  });

  it("formats as PDF syntax via toString()", () => {
    expect(PdfRef.of(1, 0).toString()).toBe("1 0 R");
    expect(PdfRef.of(42, 1).toString()).toBe("42 1 R");
  });

  it("applies the writer's renumber map when serializing", () => {
    const writer = new ByteWriter();

    writer.refRenumberMap = new Map([[7, 2]]);

    PdfRef.of(7, 1).toBytes(writer);
    writer.writeAscii(" ");
    PdfRef.of(8, 0).toBytes(writer);

    writer.refRenumberMap = null;

    writer.writeAscii(" ");
    PdfRef.of(7, 0).toBytes(writer);

    expect(new TextDecoder().decode(writer.toBytes())).toBe("2 1 R null 7 0 R");
  });
});
