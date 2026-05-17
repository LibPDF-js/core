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

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/^%PDF-1\.7\n/);
  });

  it("includes binary comment after header", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });

    // Binary comment should be second line (bytes 9-14 approximately)
    // %âãÏÓ (0x25 0xe2 0xe3 0xcf 0xd3)
    expect(result.bytes[9]).toBe(0x25); // %
    expect(result.bytes[10]).toBeGreaterThan(127); // High byte
  });

  it("writes all reachable objects", async () => {
    const registry = new ObjectRegistry();

    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const info = PdfDict.of({
      Title: PdfString.fromString("Test PDF"),
    });
    const infoRef = registry.register(info);

    // Pass info as the info option so it's reachable
    const result = writeComplete(registry, { root: catalogRef, info: infoRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("1 0 obj");
    expect(text).toContain("2 0 obj");
  });

  it("includes xref section", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain("xref");
    expect(text).toContain("trailer");
  });

  it("includes trailer with /Root", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain(`/Root ${catalogRef.objectNumber} 0 R`);
  });

  it("includes trailer with /Size", async () => {
    const registry = new ObjectRegistry();

    // Create a second object that's reachable from catalog
    const secondObj = new PdfDict();
    const secondRef = registry.register(secondObj);

    const catalog = PdfDict.of({ Type: PdfName.Catalog, Extra: secondRef });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Size should be max object number + 1
    expect(text).toContain("/Size 3"); // 0 (free) + 1 + 2
  });

  it("includes startxref with correct offset", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // startxref should match returned offset
    expect(text).toContain(`startxref\n${result.xrefOffset}\n`);
  });

  it("ends with %%EOF", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toMatch(/%%EOF\n$/);
  });

  it("respects version option", async () => {
    const registry = new ObjectRegistry();
    const catalog = PdfDict.of({ Type: PdfName.Catalog });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, {
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

    const result = writeComplete(registry, {
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

    const result = writeComplete(registry, {
      root: catalogRef,
      info: infoRef,
    });
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain(`/Info ${infoRef.objectNumber} 0 R`);
  });

  it("compresses streams by default", async () => {
    const registry = new ObjectRegistry();

    // Create uncompressed stream with repeated data (compresses well)
    const uncompressedData = new TextEncoder().encode("AAAAAAAAAA".repeat(100));
    const stream = new PdfStream([], uncompressedData);
    const streamRef = registry.register(stream);

    // Catalog must reference the stream for it to be reachable
    const catalog = PdfDict.of({ Type: PdfName.Catalog, TestStream: streamRef });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Should have /Filter /FlateDecode added
    expect(text).toContain("/Filter /FlateDecode");
    // Compressed size should be smaller than original 1000 bytes
    expect(result.bytes.length).toBeLessThan(1200);
  });

  it("does not compress streams when compressStreams is false", async () => {
    const registry = new ObjectRegistry();

    // Create uncompressed stream
    const uncompressedData = new TextEncoder().encode("AAAAAAAAAA".repeat(100));
    const stream = new PdfStream([], uncompressedData);
    const streamRef = registry.register(stream);

    // Catalog must reference the stream for it to be reachable
    const catalog = PdfDict.of({ Type: PdfName.Catalog, TestStream: streamRef });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, {
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

    // Create stream that already has a filter (e.g., image)
    const stream = new PdfStream(
      [["Filter", PdfName.of("DCTDecode")]],
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG header
    );
    const streamRef = registry.register(stream);

    // Catalog must reference the stream for it to be reachable
    const catalog = PdfDict.of({ Type: PdfName.Catalog, TestStream: streamRef });
    const catalogRef = registry.register(catalog);

    const result = writeComplete(registry, { root: catalogRef });
    const text = new TextDecoder().decode(result.bytes);

    // Should keep original filter, not add FlateDecode
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).not.toContain("/FlateDecode");
  });

  describe("garbage collection", () => {
    it("excludes orphan objects not reachable from root", () => {
      const registry = new ObjectRegistry();

      // Create an orphan object (not referenced by anything)
      const orphan = PdfDict.of({ Type: PdfName.of("Orphan") });
      registry.register(orphan);

      // Create the catalog (no reference to orphan)
      const catalog = PdfDict.of({ Type: PdfName.Catalog });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // Orphan dropped entirely, catalog kept
      expect(text).not.toContain("/Type /Orphan");
      expect(text).toContain("/Type /Catalog");
    });

    it("renumbers reachable objects densely starting at 1", () => {
      const registry = new ObjectRegistry();

      // Orphan takes the first slot so renumbering visibly shifts the catalog.
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan") }));

      const catalog = PdfDict.of({ Type: PdfName.Catalog });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // Catalog (originally object 2) gets renumbered to 1 so the xref is dense
      expect(text).toContain("1 0 obj");
      expect(text).not.toContain("2 0 obj");

      // Dense xref: free entry + one in-use entry, /Root points at the new slot
      expect(text).toContain("/Size 2");
      expect(text).toContain("/Root 1 0 R");
    });

    it("produces dense xref when only the tail of the registry is reachable", () => {
      const registry = new ObjectRegistry();

      // Several orphan objects come before the reachable catalog
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan1") }));
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan2") }));
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan3") }));

      const catalog = PdfDict.of({ Type: PdfName.Catalog });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // Only the catalog survives, renumbered to object 1
      expect(text).toContain("1 0 obj");
      expect(text).not.toContain("2 0 obj");
      expect(text).not.toContain("3 0 obj");
      expect(text).not.toContain("4 0 obj");

      // /Size lines up with the actual number of in-use entries
      expect(text).toContain("/Size 2");
      expect(text).toContain("/Root 1 0 R");

      // xref has a single subsection covering 0..1, no gaps
      expect(text).toMatch(/xref\n0 2\n/);
    });

    it("rewrites internal refs to use the new numbering", () => {
      const registry = new ObjectRegistry();

      // Orphan padding so renumbering actually shifts the catalog/child.
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan1") }));
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan2") }));

      const child = PdfDict.of({ Type: PdfName.of("Child") });
      const childRef = registry.register(child);

      const catalog = PdfDict.of({ Type: PdfName.Catalog, Child: childRef });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // child becomes object 1, catalog becomes object 2 (registry order)
      expect(text).toContain("/Child 1 0 R");
      expect(text).toContain("/Root 2 0 R");
      expect(text).toContain("/Size 3");

      // Old numbers must not leak through (childRef was originally 3)
      expect(text).not.toContain("/Child 3 0 R");
    });

    it("replaces dangling refs with null", () => {
      const registry = new ObjectRegistry();

      // Catalog points at a ref whose target was never registered.
      const dangling = PdfRef.of(99, 0);
      const catalog = PdfDict.of({ Type: PdfName.Catalog, Stale: dangling });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // The dangling ref is replaced with literal null in the output
      expect(text).toContain("/Stale null");
      expect(text).not.toContain("99 0 R");
      expect(text).toContain("/Size 2");
    });

    it("includes objects reachable through indirect references", () => {
      const registry = new ObjectRegistry();

      // Create a chain of objects: catalog -> dict1 -> dict2
      const dict2 = PdfDict.of({ Type: PdfName.of("Level2") });
      const dict2Ref = registry.register(dict2);

      const dict1 = PdfDict.of({ Type: PdfName.of("Level1"), Child: dict2Ref });
      const dict1Ref = registry.register(dict1);

      const catalog = PdfDict.of({ Type: PdfName.Catalog, Child: dict1Ref });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // All objects should be included
      expect(text).toContain("/Type /Catalog");
      expect(text).toContain("/Type /Level1");
      expect(text).toContain("/Type /Level2");
      expect(text).toContain("/Size 4"); // 0 (free) + 3 objects
    });

    it("handles circular references without infinite loop", () => {
      const registry = new ObjectRegistry();

      // Create circular reference: A -> B -> A
      const dictA = PdfDict.of({ Type: PdfName.of("A") });
      const dictARef = registry.register(dictA);

      const dictB = PdfDict.of({ Type: PdfName.of("B"), PointsTo: dictARef });
      const dictBRef = registry.register(dictB);

      // Complete the circle
      dictA.set("PointsTo", dictBRef);

      // Use A as the catalog
      const result = writeComplete(registry, { root: dictARef });
      const text = new TextDecoder().decode(result.bytes);

      // Both objects should be included (no infinite loop)
      expect(text).toContain("/Type /A");
      expect(text).toContain("/Type /B");
      expect(text).toContain("/Size 3"); // 0 (free) + 2 objects
    });

    it("includes Info dictionary objects when provided", () => {
      const registry = new ObjectRegistry();

      const catalog = PdfDict.of({ Type: PdfName.Catalog });
      const catalogRef = registry.register(catalog);

      // Info dict with nested reference
      const nested = PdfDict.of({ Type: PdfName.of("Nested") });
      const nestedRef = registry.register(nested);

      const info = PdfDict.of({ Title: PdfString.fromString("Test"), Extra: nestedRef });
      const infoRef = registry.register(info);

      const result = writeComplete(registry, { root: catalogRef, info: infoRef });
      const text = new TextDecoder().decode(result.bytes);

      // All three objects should be included
      expect(text).toContain("/Type /Catalog");
      expect(text).toContain("/Type /Nested");
      expect(text).toContain("/Title");
    });

    it("includes objects reachable through arrays", () => {
      const registry = new ObjectRegistry();

      const item1 = PdfDict.of({ Type: PdfName.of("Item1") });
      const item1Ref = registry.register(item1);

      const item2 = PdfDict.of({ Type: PdfName.of("Item2") });
      const item2Ref = registry.register(item2);

      const catalog = PdfDict.of({
        Type: PdfName.Catalog,
        Items: new PdfArray([item1Ref, item2Ref]),
      });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // All objects should be included
      expect(text).toContain("/Type /Catalog");
      expect(text).toContain("/Type /Item1");
      expect(text).toContain("/Type /Item2");
    });

    it("correctly removes previously reachable objects after modification", () => {
      const registry = new ObjectRegistry();

      // Initially create catalog with a child
      const child = PdfDict.of({ Type: PdfName.of("Child") });
      const childRef = registry.register(child);

      const catalog = PdfDict.of({ Type: PdfName.Catalog, Child: childRef });
      const catalogRef = registry.register(catalog);

      // First save - both should be included
      const result1 = writeComplete(registry, { root: catalogRef });
      const text1 = new TextDecoder().decode(result1.bytes);
      expect(text1).toContain("/Type /Child");

      // Remove the child reference
      catalog.delete("Child");

      // Second save - child should be excluded (orphan)
      const result2 = writeComplete(registry, { root: catalogRef });
      const text2 = new TextDecoder().decode(result2.bytes);
      expect(text2).not.toContain("/Type /Child");
      expect(text2).toContain("/Type /Catalog");
    });
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

    const result = writeComplete(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    writeIncremental(registry, {
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

    writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeIncremental(registry, {
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

    const result = writeComplete(registry, { root: catalogRef });
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

    const result1 = writeComplete(registry1, {
      root: catalogRef,
      compressStreams: false,
    });

    // Second save (first incremental)
    catalog.set("ModDate", PdfString.fromString("D:20240101"));

    const result2 = writeIncremental(registry1, {
      originalBytes: result1.bytes,
      originalXRefOffset: result1.xrefOffset,
      root: catalogRef,
      compressStreams: false,
    });

    // Third save (second incremental)
    catalog.set("ModDate", PdfString.fromString("D:20240102"));

    const result3 = writeIncremental(registry1, {
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
