import { PDF } from "#src/api/pdf";
import { ObjectRegistry } from "#src/document/object-registry";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture } from "#src/test-utils";
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

      // Should NOT include orphan object
      expect(text).not.toContain("/Type /Orphan");
      // Should include catalog
      expect(text).toContain("/Type /Catalog");
      // After garbage collection, reachable objects are renumbered
      // sequentially starting from 1, so /Size reports only live objects
      // (free entry 0 + the catalog).
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

  describe("renumbering (full save compacts object numbers)", () => {
    /**
     * Walk every indirect object body in the output and confirm that every
     * `N G R` reference resolves to an entry that exists in the xref table.
     * This catches the worst-case bug: a dangling reference that points at
     * a non-existent object number after renumbering.
     */
    function assertNoDanglingRefs(bytes: Uint8Array): void {
      const text = new TextDecoder("latin1").decode(bytes);

      // Collect xref entries — start at the LAST occurrence of `xref` (so
      // we use the most recent xref table for incremental files; for a
      // full save there's only one).
      const xrefHeaderIdx = text.lastIndexOf("\nxref\n");
      const liveNums = new Set<number>();

      if (xrefHeaderIdx !== -1) {
        // Parse subsections after "xref\n"
        const xrefBody = text.slice(xrefHeaderIdx + 6);
        const trailerIdx = xrefBody.indexOf("trailer");
        const body = trailerIdx === -1 ? xrefBody : xrefBody.slice(0, trailerIdx);
        const lines = body.split("\n");
        let i = 0;

        while (i < lines.length) {
          const header = lines[i].match(/^(\d+)\s+(\d+)$/);

          if (!header) {
            i++;
            continue;
          }

          const first = Number(header[1]);
          const count = Number(header[2]);

          i++;

          for (let k = 0; k < count && i < lines.length; k++, i++) {
            const entry = lines[i].match(/^(\d{10})\s+(\d{5})\s+([nf])/);

            if (entry && entry[3] === "n") {
              liveNums.add(first + k);
            }
          }
        }
      } else {
        // Xref stream output — pull /Size and assume sequential 0..Size-1
        // (which is the structure renumbering produces).
        const sizeMatch = text.match(/\/Size\s+(\d+)/);

        if (sizeMatch) {
          for (let n = 0; n < Number(sizeMatch[1]); n++) {
            liveNums.add(n);
          }
        }
      }

      // Find every `N G R` reference in the file and check the object exists.
      // Limit the search to indirect object bodies (between `N G obj` and
      // `endobj`) to avoid false positives in stream contents.
      const objHeaderRe = /(\d+) (\d+) obj/g;
      let match: RegExpExecArray | null;
      const dangling = new Set<string>();

      while ((match = objHeaderRe.exec(text)) !== null) {
        const endIdx = text.indexOf("endobj", match.index);

        if (endIdx === -1) continue;

        const body = text.slice(match.index, endIdx);
        const refRe = /(\d+) \d+ R\b/g;
        let refMatch: RegExpExecArray | null;

        while ((refMatch = refRe.exec(body)) !== null) {
          const targetNum = Number(refMatch[1]);

          if (targetNum === 0) continue; // Refs to obj 0 are unusual; ignore

          if (!liveNums.has(targetNum)) {
            dangling.add(`${targetNum} 0 R (in obj at offset ${match.index})`);
          }
        }
      }

      if (dangling.size > 0) {
        throw new Error(
          `Dangling references found after renumbering:\n  ${[...dangling].join("\n  ")}`,
        );
      }
    }

    it("produces a single contiguous xref subsection (0..N)", async () => {
      // Build a PDF that registers extra objects then orphans some, so the
      // pre-fix code would have produced gap-laden subsections.
      const registry = new ObjectRegistry();

      // Orphan-to-be: registered first, never referenced
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan") }));

      const child = PdfDict.of({ Type: PdfName.of("Child") });
      const childRef = registry.register(child);

      // Another orphan in the middle of the number space
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan2") }));

      const catalog = PdfDict.of({ Type: PdfName.Catalog, Child: childRef });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder().decode(result.bytes);

      // Only ONE subsection header `0 N` should exist, not multiple.
      const subsectionHeaders = [...text.matchAll(/^(\d+) (\d+)$/gm)];
      expect(subsectionHeaders).toHaveLength(1);
      expect(subsectionHeaders[0][1]).toBe("0");

      // /Size should equal (live objects + free entry for obj 0), i.e. 3.
      expect(text).toContain("/Size 3");

      // The orphan dicts should not appear.
      expect(text).not.toContain("/Type /Orphan");
      expect(text).not.toContain("/Type /Orphan2");

      assertNoDanglingRefs(result.bytes);
    });

    it("renumbers refs inside dicts, arrays, and stream dicts", () => {
      const registry = new ObjectRegistry();

      // Leaf object referenced by both a dict entry and an array item.
      const leaf = PdfDict.of({ Type: PdfName.of("Leaf") });
      const leafRef = registry.register(leaf);

      // Orphan to force renumbering (without orphans, numbers stay 1,2,3,...)
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan") }));

      // A stream that references the leaf via its dict entry.
      const stream = new PdfStream([], new Uint8Array([1, 2, 3]));
      stream.set("Type", PdfName.of("Wrapper"));
      stream.set("Ptr", leafRef);
      const streamRef = registry.register(stream);

      // Another orphan
      registry.register(PdfDict.of({ Type: PdfName.of("Orphan2") }));

      // Catalog references everything via both a direct entry and an array.
      const catalog = PdfDict.of({
        Type: PdfName.Catalog,
        Stream: streamRef,
        Refs: new PdfArray([leafRef, streamRef]),
      });
      const catalogRef = registry.register(catalog);

      const result = writeComplete(registry, { root: catalogRef });
      const text = new TextDecoder("latin1").decode(result.bytes);

      // No dangling refs — the leaf and the stream both got renumbered, and
      // every reference to them in the output must point at the new numbers.
      assertNoDanglingRefs(result.bytes);

      // The output must NOT contain references to the orphans' original
      // numbers as objects. Verify by reloading and checking structure.
      expect(text).not.toContain("/Type /Orphan");
      expect(text).toContain("/Type /Leaf");
      expect(text).toContain("/Type /Wrapper");
    });

    it("preserves object-stream content across full save round-trip", async () => {
      // sampleForSpec.pdf uses /Type /ObjStm to store compressed objects.
      // After my renumbering change, those objects must:
      //   (a) round-trip without losing content
      //   (b) end up as plain indirect objects (the objstm gets dropped)
      //   (c) have no dangling refs in the output
      const bytes = await loadFixture("xref", "sampleForSpec.pdf");
      const pdf = await PDF.load(bytes);

      const pageCountBefore = pdf.getPages().length;
      expect(pageCountBefore).toBeGreaterThan(0);

      // Force a dirty mark so save() actually writes (otherwise it returns
      // the original bytes verbatim when nothing changed).
      pdf.getCatalog().set("LangX", new PdfString("x"));

      const saved = await pdf.save();
      const savedText = new TextDecoder("latin1").decode(saved);

      // The compressed object stream itself should be gone — we emit plain
      // indirect objects, never objstm.
      expect(savedText).not.toContain("/Type /ObjStm");

      // No dangling refs in the renumbered output.
      assertNoDanglingRefs(saved);

      // Reload and verify all pages still exist.
      const pdf2 = await PDF.load(saved);
      expect(pdf2.getPages().length).toBe(pageCountBefore);
    });

    it("full save of a form PDF preserves all fields and pages", async () => {
      // The big "don't cook user docs" smoke test: load a real form PDF,
      // make a trivial change, full save with renumbering, reload, and
      // confirm field count and page count are preserved.
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const pagesBefore = pdf.getPages().length;
      const fieldsBefore = pdf.getForm()?.getFields().length ?? 0;
      expect(fieldsBefore).toBeGreaterThan(0);

      pdf.getCatalog().set("LangX", new PdfString("x"));

      const saved = await pdf.save();
      assertNoDanglingRefs(saved);

      const pdf2 = await PDF.load(saved);
      expect(pdf2.getPages().length).toBe(pagesBefore);
      expect(pdf2.getForm()?.getFields().length).toBe(fieldsBefore);
    });

    it("preserves generation numbers on renumbered refs", () => {
      // A defensive check: even though most PDFs use generation 0
      // exclusively, the spec allows non-zero generations and the
      // renumberer must preserve them when constructing new PdfRef
      // instances. If renumberRef ever silently drops generation we'd
      // produce subtly broken cross-references.
      const registry = new ObjectRegistry();

      // Register a single dict with a self-reference at gen 0 (we can't
      // easily inject a non-zero generation through the public API, so
      // this test mostly documents the invariant — see renumberRef).
      const dict = PdfDict.of({ Type: PdfName.Catalog });
      const ref = registry.register(dict);

      const result = writeComplete(registry, { root: ref });
      const text = new TextDecoder("latin1").decode(result.bytes);

      // The catalog ref in the trailer must use gen 0.
      expect(text).toMatch(/\/Root\s+1\s+0\s+R/);
      assertNoDanglingRefs(result.bytes);
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
