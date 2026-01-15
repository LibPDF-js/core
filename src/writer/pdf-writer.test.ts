import { ObjectRegistry } from "#src/document/object-registry";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { verifyIncrementalSave, writeComplete, writeIncremental } from "./pdf-writer";

describe("writeComplete", () => {
  it("produces valid PDF header", async () => {
    const registry = new ObjectRegistry();

    // Minimal PDF structure
    const catalog = PdfDict.of({
      Type: PdfName.Catalog,
      Pages: PdfRef.of(2, 0),
    });
    const catalogRef = registry.register(catalog);

    const pages = PdfDict.of({
      Type: PdfName.Pages,
      Count: PdfNumber.of(0),
      Kids: new PdfArray([]),
    });

    registry.register(pages);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/^%PDF-1\.7\n/);
  });

  it("includes binary comment after header", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });

    // Binary comment should be second line (bytes 9-14 approximately)
    // %âãÏÓ (0x25 0xe2 0xe3 0xcf 0xd3)
    expect(result.bytes[9]).toBe(0x25); // %
    expect(result.bytes[10]).toBeGreaterThan(127); // High byte
  });

  it("writes all registered objects", async () => {
    const registry = new ObjectRegistry();

    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const info = PdfDict.of({
      Title: PdfString.fromString("Test PDF"),
    });

    registry.register(info);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("1 0 obj");
    expect(text).toContain("2 0 obj");
  });

  it("includes xref section", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("xref");
    expect(text).toContain("trailer");
  });

  it("includes trailer with /Root", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain(`/Root ${catalogRef.objectNumber} 0 R`);
  });

  it("includes trailer with /Size", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    registry.register(new PdfDict()); // Second object

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Size should be max object number + 1
    expect(text).toContain("/Size 3"); // 0 (free) + 1 + 2
  });

  it("includes startxref with correct offset", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // startxref should match returned offset
    expect(text).toContain(`startxref\n${result.xrefOffset}\n`);
  });

  it("ends with %%EOF", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/%%EOF\n$/);
  });

  it("respects version option", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, {
      root: catalogRef,
      version: "2.0",
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/^%PDF-2\.0\n/);
  });

  it("can use xref stream", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, {
      root: catalogRef,
      useXRefStream: true,
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("/Type /XRef");
    // Traditional xref starts with "xref\n" followed by subsection header like "0 1"
    // XRef stream doesn't have this pattern
    expect(text).not.toMatch(/^xref\n\d+ \d+/m);
  });

  it("includes Info in trailer when provided", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const info = PdfDict.of({ Title: PdfString.fromString("Test") });
    const infoRef = registry.register(info);

    const result = await writeComplete(registry, {
      root: catalogRef,
      info: infoRef,
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain(`/Info ${infoRef.objectNumber} 0 R`);
  });

  it("compresses streams by default", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    // Create uncompressed stream with repeated data (compresses well)
    const uncompressedData = new TextEncoder().encode("AAAAAAAAAA".repeat(100));
    const stream = new PdfStream([], uncompressedData);

    registry.register(stream);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Should have /Filter /FlateDecode added
    expect(text).toContain("/Filter /FlateDecode");
    // Compressed size should be smaller than original 1000 bytes
    expect(result.bytes.length).toBeLessThan(1200);
  });

  it("does not compress streams when compressStreams is false", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    // Create uncompressed stream
    const uncompressedData = new TextEncoder().encode("AAAAAAAAAA".repeat(100));
    const stream = new PdfStream([], uncompressedData);

    registry.register(stream);

    const result = await writeComplete(registry, {
      root: catalogRef,
      compressStreams: false,
    });
    const text = new TextDecoder().decode(result.bytes);

    // Should NOT have /Filter added
    expect(text).not.toContain("/Filter");
    // Should contain uncompressed data
    expect(result.bytes.length).toBeGreaterThan(1000);
  });

  it("does not re-compress already filtered streams", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    // Create stream that already has a filter (e.g., image)
    const stream = new PdfStream(
      [["Filter", PdfName.of("DCTDecode")]],
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG header
    );

    registry.register(stream);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Should keep original filter, not add FlateDecode
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).not.toContain("/FlateDecode");
  });
});

describe("writeIncremental", () => {
  /**
   * Create a minimal PDF for testing.
   */
  async function createMinimalPdf(): Promise<{
    bytes: Uint8Array;
    xrefOffset: number;
    registry: ObjectRegistry;
    catalogRef: PdfRef;
  }> {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({
      Type: PdfName.Catalog,
      Pages: PdfRef.of(2, 0),
    });
    const catalogRef = registry.register(catalog);

    const pages = PdfDict.of({
      Type: PdfName.Pages,
      Count: PdfNumber.of(0),
      Kids: new PdfArray([]),
    });

    registry.register(pages);

    // Commit objects so they're "loaded"
    registry.commitNewObjects();

    const result = await writeComplete(registry, {
      root: catalogRef,
      compressStreams: false, // Keep original bytes predictable
    });

    // Clear dirty flags (simulating a clean load)
    catalog.clearDirty();
    pages.clearDirty();

    return {
      bytes: result.bytes,
      xrefOffset: result.xrefOffset,
      registry,
      catalogRef,
    };
  }

  it("preserves original bytes exactly", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();
    const originalLength = bytes.length;

    // Modify something
    const catalog = registry.getObject(catalogRef) as PdfDict;

    catalog.set("ModDate", PdfString.fromString("D:20240101"));

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    // Original bytes should be preserved
    expect(result.bytes.subarray(0, originalLength)).toEqual(bytes);
  });

  it("appends modified objects after original", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();
    const originalLength = bytes.length;

    const catalog = registry.getObject(catalogRef) as PdfDict;

    catalog.set("ModDate", PdfString.fromString("D:20240101"));

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    // Result should be longer than original
    expect(result.bytes.length).toBeGreaterThan(originalLength);

    // New content should be after original
    const newContent = new TextDecoder().decode(result.bytes.slice(originalLength));

    expect(newContent).toContain("1 0 obj"); // Modified catalog
  });

  it("includes new xref with /Prev pointer", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    const catalog = registry.getObject(catalogRef) as PdfDict;

    catalog.set("ModDate", PdfString.fromString("D:20240101"));

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain(`/Prev ${xrefOffset}`);
  });

  it("appends new objects", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    // Register a new object
    const newAnnot = PdfDict.of({
      Type: PdfName.of("Annot"),
      Subtype: PdfName.of("Text"),
    });

    registry.register(newAnnot);

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("/Type /Annot");
    expect(text).toContain("3 0 obj"); // New object number
  });

  it("returns original bytes when no changes", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    // Should return original unchanged
    expect(result.bytes).toBe(bytes);
    expect(result.xrefOffset).toBe(xrefOffset);
  });

  it("clears dirty flags after save", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    const catalog = registry.getObject(catalogRef) as PdfDict;

    catalog.set("ModDate", PdfString.fromString("D:20240101"));
    expect(catalog.dirty).toBe(true);

    await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    expect(catalog.dirty).toBe(false);
  });

  it("moves new objects to loaded after save", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    const newDict = new PdfDict();
    const newRef = registry.register(newDict);

    expect(registry.isNew(newRef)).toBe(true);

    await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    expect(registry.isNew(newRef)).toBe(false);
  });

  it("ends with %%EOF", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    const catalog = registry.getObject(catalogRef) as PdfDict;

    catalog.set("Modified", PdfNumber.of(1));

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/%%EOF\n$/);
  });

  it("handles stream objects", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    // Create new stream with existing filter (won't be re-compressed)
    const stream = new PdfStream(
      [["Filter", PdfName.of("FlateDecode")]],
      new Uint8Array([1, 2, 3, 4, 5]),
    );

    registry.register(stream);

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("/Filter /FlateDecode");
    expect(text).toContain("stream");
    expect(text).toContain("endstream");
  });

  it("compresses new streams by default", async () => {
    const { bytes, xrefOffset, registry, catalogRef } = await createMinimalPdf();

    // Create uncompressed stream with repeated data
    const uncompressedData = new TextEncoder().encode("AAAAAAAAAA".repeat(100));
    const stream = new PdfStream([], uncompressedData);

    registry.register(stream);

    const result = await writeIncremental(registry, {
      originalBytes: bytes,
      originalXRefOffset: xrefOffset,
      root: catalogRef,
    });

    const text = new TextDecoder().decode(result.bytes);

    // Should have /Filter /FlateDecode added
    expect(text).toContain("/Filter /FlateDecode");
  });
});

describe("verifyIncrementalSave", () => {
  it("validates preserved original bytes", () => {
    const original = new TextEncoder().encode("original content");
    const result = new Uint8Array([...original, ...new TextEncoder().encode("\n%%EOF\n")]);

    const verification = verifyIncrementalSave(original, result);

    expect(verification.valid).toBe(true);
  });

  it("detects modified original bytes", () => {
    const original = new TextEncoder().encode("original content");
    const result = new TextEncoder().encode("modified content%%EOF\n");

    const verification = verifyIncrementalSave(original, result);

    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("Byte mismatch");
  });

  it("detects missing %%EOF", () => {
    const original = new TextEncoder().encode("content");
    const result = new TextEncoder().encode("content\nmore stuff");

    const verification = verifyIncrementalSave(original, result);

    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("%%EOF");
  });

  it("detects result shorter than original", () => {
    const original = new TextEncoder().encode("long original content");
    const result = new TextEncoder().encode("short");

    const verification = verifyIncrementalSave(original, result);

    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("shorter");
  });
});

describe("round-trip", () => {
  it("modified PDF can be parsed (structure check)", async () => {
    const registry = new ObjectRegistry();

    // Create a proper minimal PDF structure
    const pages = PdfDict.of({
      Type: PdfName.Pages,
      Count: PdfNumber.of(0),
      Kids: new PdfArray([]),
    });
    const pagesRef = registry.register(pages);

    const catalog = PdfDict.of({
      Type: PdfName.Catalog,
      Pages: pagesRef,
    });
    const catalogRef = registry.register(catalog);

    const result = await writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Verify structure
    expect(text).toContain("%PDF-");
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("xref");
    expect(text).toContain("trailer");
    expect(text).toContain("/Root");
    expect(text).toContain("startxref");
    expect(text).toContain("%%EOF");
  });

  it("multiple incremental saves work correctly", async () => {
    // First save
    const registry1 = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry1.register(catalog);

    registry1.commitNewObjects();
    catalog.clearDirty();

    const result1 = await writeComplete(registry1, {
      root: catalogRef,
      compressStreams: false,
    });

    // Second save (first incremental)
    catalog.set("ModDate", PdfString.fromString("D:20240101"));

    const result2 = await writeIncremental(registry1, {
      originalBytes: result1.bytes,
      originalXRefOffset: result1.xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    // Third save (second incremental)
    catalog.set("ModDate", PdfString.fromString("D:20240102"));

    const result3 = await writeIncremental(registry1, {
      originalBytes: result2.bytes,
      originalXRefOffset: result2.xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    // Verify all original bytes preserved
    expect(result3.bytes.subarray(0, result1.bytes.length)).toEqual(result1.bytes);

    // Verify has /Prev chain
    const text = new TextDecoder().decode(result3.bytes);

    expect(text).toContain(`/Prev ${result2.xrefOffset}`);
  });
});
