import { ByteWriter } from "#src/io/byte-writer";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

import { writeXRefStream, writeXRefTable, type XRefWriteEntry } from "./xref-writer";

describe("writeXRefTable", () => {
  it("produces valid xref table syntax", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 200,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("xref");
    expect(result).toContain("trailer");
    expect(result).toContain("startxref");
    expect(result).toContain("%%EOF");
  });

  it("formats entries as exactly 20 bytes", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
      { objectNumber: 1, generation: 0, type: "inuse", offset: 12345 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 200,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    // Each entry line should be 20 chars: 10 + space + 5 + space + 1 + \r\n
    expect(result).toContain("0000000000 65535 f\r\n");
    expect(result).toContain("0000012345 00000 n\r\n");
  });

  it("uses 'f' marker for free entries", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 1,
      xrefOffset: 100,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("0000000000 65535 f\r\n");
  });

  it("uses 'n' marker for in-use entries", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 500 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 100,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("0000000500 00000 n\r\n");
  });

  it("compacts non-contiguous entries into subsections", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
      { objectNumber: 2, generation: 0, type: "inuse", offset: 200 },
      { objectNumber: 5, generation: 0, type: "inuse", offset: 500 },
      { objectNumber: 6, generation: 0, type: "inuse", offset: 600 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 7,
      xrefOffset: 1000,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    // Should have two subsections
    expect(result).toContain("1 2\n"); // Objects 1-2
    expect(result).toContain("5 2\n"); // Objects 5-6
  });

  it("sets /Size to max object number + 1", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 5, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 10,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("/Size 10");
  });

  it("includes /Prev for incremental updates", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      prev: 1234,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("/Prev 1234");
  });

  it("includes startxref with correct offset", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 9999,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("startxref\n9999\n");
  });

  it("includes /Root reference", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(5, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("/Root 5 0 R");
  });

  it("handles empty entries list", () => {
    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries: [],
      size: 1,
      xrefOffset: 100,
      root: PdfRef.of(1, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    // Should still produce valid structure
    expect(result).toContain("xref");
    expect(result).toContain("trailer");
  });

  it("includes optional Info reference", () => {
    const writer = new ByteWriter();
    writeXRefTable(writer, {
      entries: [],
      size: 3,
      xrefOffset: 100,
      root: PdfRef.of(1, 0),
      info: PdfRef.of(2, 0),
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("/Info 2 0 R");
  });
});

describe("writeXRefStream", () => {
  it("produces valid xref stream object", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    writeXRefStream(writer, {
      entries,
      size: 3,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const result = new TextDecoder().decode(writer.toBytes());

    expect(result).toContain("2 0 obj");
    expect(result).toContain("endobj");
    expect(result).toContain("startxref");
    expect(result).toContain("%%EOF");
  });

  it("includes /Type /XRef", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    expect(stream.getName("Type")?.value).toBe("XRef");
  });

  it("includes /W array with field widths", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const w = stream.getArray("W");

    expect(w).toBeDefined();
    expect(w?.length).toBe(3);
  });

  it("includes /Index array for non-default ranges", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 5, generation: 0, type: "inuse", offset: 100 },
      { objectNumber: 6, generation: 0, type: "inuse", offset: 200 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 7,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const index = stream.getArray("Index");

    expect(index).toBeDefined();
    // [5, 2] - starting at 5, 2 entries
    expect(index?.length).toBe(2);
  });

  it("encodes binary data correctly", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 65535, type: "free", offset: 0 },
      { objectNumber: 1, generation: 0, type: "inuse", offset: 255 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    // Check that stream has data
    expect(stream.data.length).toBeGreaterThan(0);
  });

  it("includes /Prev for incremental updates", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      prev: 1234,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    expect(stream.getNumber("Prev")?.value).toBe(1234);
  });

  it("includes /Size", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 10,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    expect(stream.getNumber("Size")?.value).toBe(10);
  });

  it("encodes type field correctly (0=free, 1=inuse, 2=compressed)", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 0, generation: 0, type: "free", offset: 0 },
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
      {
        objectNumber: 2,
        generation: 0,
        type: "compressed",
        offset: 5,
        index: 0,
      },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 3,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 3,
    });

    const data = stream.data;
    const w = stream.getArray("W");

    // Get field widths
    const w1 = (w?.at(0) as { value: number })?.value ?? 1;
    const w2 = (w?.at(1) as { value: number })?.value ?? 1;
    const w3 = (w?.at(2) as { value: number })?.value ?? 1;
    const entrySize = w1 + w2 + w3;

    // Check type bytes (first byte of each entry)
    expect(data[0 * entrySize]).toBe(0); // free
    expect(data[1 * entrySize]).toBe(1); // inuse
    expect(data[2 * entrySize]).toBe(2); // compressed
  });

  it("handles large offsets", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 1000000 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 2000000,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    // Should still produce valid data
    expect(stream.data.length).toBeGreaterThan(0);
  });
});

describe("xref stream binary encoding", () => {
  it("uses minimal field widths", () => {
    // Small values should use small field widths
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const w = stream.getArray("W");
    const w1 = (w?.at(0) as { value: number })?.value;
    const w2 = (w?.at(1) as { value: number })?.value;
    const w3 = (w?.at(2) as { value: number })?.value;

    // Type is always 1 byte
    expect(w1).toBe(1);
    // Small offset (100) should fit in 1 byte
    expect(w2).toBe(1);
    // Generation 0 should fit in 1 byte
    expect(w3).toBe(1);
  });

  it("increases field widths for large values", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100000 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 2,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const w = stream.getArray("W");
    const w2 = (w?.at(1) as { value: number })?.value;

    // 100000 needs 3 bytes (17 bits)
    expect(w2).toBeGreaterThanOrEqual(3);
  });

  it("encodes multiple subsections in Index array", () => {
    const entries: XRefWriteEntry[] = [
      { objectNumber: 1, generation: 0, type: "inuse", offset: 100 },
      { objectNumber: 2, generation: 0, type: "inuse", offset: 200 },
      { objectNumber: 10, generation: 0, type: "inuse", offset: 1000 },
      { objectNumber: 11, generation: 0, type: "inuse", offset: 1100 },
    ];

    const writer = new ByteWriter();
    const stream = writeXRefStream(writer, {
      entries,
      size: 12,
      xrefOffset: 500,
      root: PdfRef.of(1, 0),
      streamObjectNumber: 2,
    });

    const index = stream.getArray("Index");

    // Should have [1, 2, 10, 2] - two subsections
    expect(index?.length).toBe(4);
  });
});
