import { PDF } from "#src/api/pdf";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { ObjectCopier } from "./object-copier";

describe("ObjectCopier", () => {
  describe("copyPage", () => {
    it("copies a page from one document to another", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const destPageCount = dest.getPageCount();

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);

      // The copied page should be registered in dest
      expect(copiedPageRef).toBeInstanceOf(PdfRef);
      expect(copiedPageRef.objectNumber).not.toBe(srcPageRef.objectNumber);

      // Insert and verify
      dest.insertPage(destPageCount, copiedPageRef);
      expect(dest.getPageCount()).toBe(destPageCount + 1);

      // Verify it's a valid page with correct Type
      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;
      expect(copiedPage.getName("Type")?.value).toBe("Page");
    });

    it("flattens inherited MediaBox from parent", async () => {
      const sourceBytes = await loadFixture("basic", "page_tree_multiple_levels.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;

      // Should have MediaBox flattened into the page
      const mediaBox = copiedPage.getArray("MediaBox");
      expect(mediaBox).not.toBeNull();
      expect(mediaBox!.length).toBe(4);

      // Verify it's a valid box (all numbers)
      expect(mediaBox!.toArray().every(item => item instanceof PdfNumber)).toBe(true);
    });

    it("removes Parent reference from copied page", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Verify source page HAS a parent
      const srcPageRef = source.getPage(0)!.ref;
      const srcPage = source.getObject(srcPageRef) as PdfDict;
      expect(srcPage.has("Parent")).toBe(true);

      const copier = new ObjectCopier(source, dest);
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;
      expect(copiedPage.has("Parent")).toBe(false);
    });

    it("excludes annotations when option is false", async () => {
      const sourceBytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Verify source page has annotations
      const srcPageRef = source.getPage(0)!.ref;
      const srcPage = source.getObject(srcPageRef) as PdfDict;
      expect(srcPage.has("Annots")).toBe(true);

      const copier = new ObjectCopier(source, dest, { includeAnnotations: false });
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;
      expect(copiedPage.has("Annots")).toBe(false);
    });

    it("includes annotations by default", async () => {
      const sourceBytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Verify source page has annotations
      const srcPageRef = source.getPage(0)!.ref;
      const srcPage = source.getObject(srcPageRef) as PdfDict;
      expect(srcPage.has("Annots")).toBe(true);

      const copier = new ObjectCopier(source, dest);
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;
      expect(copiedPage.has("Annots")).toBe(true);

      // Verify annotations are remapped refs, not the same refs
      const srcAnnots = srcPage.getArray("Annots")!;
      const copiedAnnots = copiedPage.getArray("Annots")!;
      expect(copiedAnnots.length).toBe(srcAnnots.length);

      if (srcAnnots.at(0) instanceof PdfRef && copiedAnnots.at(0) instanceof PdfRef) {
        expect((copiedAnnots.at(0) as PdfRef).objectNumber).not.toBe(
          (srcAnnots.at(0) as PdfRef).objectNumber,
        );
      }
    });

    it("throws for non-existent page ref", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);
      const fakeRef = PdfRef.of(99999, 0);

      expect(() => copier.copyPage(fakeRef)).toThrow(/not found/);
    });

    it("copies page Resources", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;

      // Page should have Resources (either direct or as ref)
      const resources = copiedPage.get("Resources");
      expect(resources).toBeDefined();

      // If it's a ref, resolve it and verify it's a dict
      if (resources instanceof PdfRef) {
        const resolvedResources = dest.getObject(resources);
        expect(resolvedResources).toBeInstanceOf(PdfDict);
      } else {
        expect(resources).toBeInstanceOf(PdfDict);
      }
    });
  });

  describe("copyObject", () => {
    it("returns same instance for primitives (immutable)", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);
      const dest = await PDF.load(sourceBytes);

      const copier = new ObjectCopier(source, dest);

      const name = PdfName.of("Test");
      const num = PdfNumber.of(42);
      const str = PdfString.fromString("hello");

      // Primitives should be returned as-is (they're immutable)
      expect(copier.copyObject(name)).toBe(name);
      expect(copier.copyObject(num)).toBe(num);
      expect(copier.copyObject(str)).toBe(str);
    });

    it("creates new instance for arrays", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);
      const dest = await PDF.load(sourceBytes);

      const copier = new ObjectCopier(source, dest);

      const arr = new PdfArray([PdfNumber.of(1), PdfNumber.of(2), PdfName.of("Test")]);

      const copied = copier.copyObject(arr);
      expect(copied).toBeInstanceOf(PdfArray);
      expect(copied).not.toBe(arr);
      expect(copied.length).toBe(3);

      // Verify values are preserved
      expect((copied.at(0) as PdfNumber).value).toBe(1);
      expect((copied.at(1) as PdfNumber).value).toBe(2);
      expect((copied.at(2) as PdfName).value).toBe("Test");
    });

    it("creates new instance for dictionaries", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);
      const dest = await PDF.load(sourceBytes);

      const copier = new ObjectCopier(source, dest);

      const dict = PdfDict.of({
        Key1: PdfNumber.of(42),
        Key2: PdfString.fromString("value"),
      });

      const copied = copier.copyObject(dict);
      expect(copied).toBeInstanceOf(PdfDict);
      expect(copied).not.toBe(dict);

      // Verify values are preserved
      expect(copied.getNumber("Key1")?.value).toBe(42);
      expect(copied.getString("Key2")?.asString()).toBe("value");
    });

    it("deep copies nested structures", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);
      const dest = await PDF.load(sourceBytes);

      const copier = new ObjectCopier(source, dest);

      const innerDict = PdfDict.of({ Inner: PdfNumber.of(1) });
      const innerArr = new PdfArray([PdfNumber.of(2)]);
      const outerDict = PdfDict.of({
        Dict: innerDict,
        Array: innerArr,
      });

      const copied = copier.copyObject(outerDict);

      // Outer should be new
      expect(copied).not.toBe(outerDict);

      // Inner dict should be new
      const copiedInnerDict = copied.get("Dict") as PdfDict;
      expect(copiedInnerDict).not.toBe(innerDict);
      expect(copiedInnerDict.getNumber("Inner")?.value).toBe(1);

      // Inner array should be new
      const copiedInnerArr = copied.getArray("Array")!;
      expect(copiedInnerArr).not.toBe(innerArr);
      expect((copiedInnerArr.at(0) as PdfNumber).value).toBe(2);
    });
  });

  describe("reference remapping", () => {
    it("remaps all references to destination document", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);

      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);

      // Refs should be different
      expect(copiedPageRef.objectNumber).not.toBe(srcPageRef.objectNumber);

      // Copied page should be resolvable in dest
      const copiedPage = dest.getObject(copiedPageRef);
      expect(copiedPage).toBeInstanceOf(PdfDict);
    });

    it("reuses already-copied references (deduplication)", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);

      // Copy same page twice - internal resources should be deduplicated
      const srcPageRef = source.getPage(0)!.ref;
      const copied1 = copier.copyPage(srcPageRef);
      const copied2 = copier.copyPage(srcPageRef);

      // Page refs are different (each copyPage registers a new page)
      expect(copied1.objectNumber).not.toBe(copied2.objectNumber);

      // But Resources should point to the same ref (if they're refs)
      const page1 = dest.getObject(copied1) as PdfDict;
      const page2 = dest.getObject(copied2) as PdfDict;

      const resources1 = page1.get("Resources");
      const resources2 = page2.get("Resources");

      if (resources1 instanceof PdfRef && resources2 instanceof PdfRef) {
        // Same ref means deduplication worked
        expect(resources1.objectNumber).toBe(resources2.objectNumber);
      }
    });

    it("handles circular references in annotations", async () => {
      // SimpleForm2Fields.pdf has form field annotations that may have circular /Parent refs
      const sourceBytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;

      // This should not throw due to circular references
      const copiedPageRef = copier.copyPage(srcPageRef);
      expect(copiedPageRef).toBeInstanceOf(PdfRef);

      // Page should be valid
      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;
      expect(copiedPage.getName("Type")?.value).toBe("Page");
    });
  });

  describe("stream copying", () => {
    it("preserves raw bytes for unencrypted streams", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      expect(source.isEncrypted).toBe(false);

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);

      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;

      // Check that Contents exists and is a stream (or ref to stream)
      const contents = copiedPage.get("Contents");
      expect(contents).toBeDefined();
    });

    it("decodes and re-encodes streams from encrypted source", async () => {
      const sourceBytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const source = await PDF.load(sourceBytes, { credentials: "user" });

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      expect(source.isEncrypted).toBe(true);
      expect(source.isAuthenticated).toBe(true);

      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;

      // Should not throw - streams are decoded and re-encoded
      const copiedPageRef = copier.copyPage(srcPageRef);
      const copiedPage = dest.getObject(copiedPageRef) as PdfDict;

      expect(copiedPage.getName("Type")?.value).toBe("Page");
    });
  });

  describe("same-document copy (duplication)", () => {
    it("duplicates a page creating new objects", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const initialCount = pdf.getPageCount();
      const originalPageRef = pdf.getPage(0)!.ref;

      const copier = new ObjectCopier(pdf, pdf);
      const duplicatedRef = copier.copyPage(originalPageRef);

      // Refs should be different
      expect(duplicatedRef.objectNumber).not.toBe(originalPageRef.objectNumber);

      // Insert and verify count
      pdf.insertPage(initialCount, duplicatedRef);
      expect(pdf.getPageCount()).toBe(initialCount + 1);

      // Both pages should be valid
      const originalPage = pdf.getObject(originalPageRef) as PdfDict;
      const duplicatedPage = pdf.getObject(duplicatedRef) as PdfDict;

      expect(originalPage.getName("Type")?.value).toBe("Page");
      expect(duplicatedPage.getName("Type")?.value).toBe("Page");
    });
  });

  describe("round-trip", () => {
    it("copied pages survive save and reload", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);
      const destOriginalCount = dest.getPageCount();

      // Copy a page
      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);
      dest.insertPage(destOriginalCount, copiedPageRef);

      // Save
      const savedBytes = await dest.save();

      // Reload
      const reloaded = await PDF.load(savedBytes);

      // Verify page count
      expect(reloaded.getPageCount()).toBe(destOriginalCount + 1);

      // Verify the copied page is valid
      const reloadedPageRef = reloaded.getPage(destOriginalCount)!.ref;
      const reloadedPage = reloaded.getObject(reloadedPageRef) as PdfDict;

      expect(reloadedPage.getName("Type")?.value).toBe("Page");
      expect(reloadedPage.getArray("MediaBox")).not.toBeNull();
    });
  });

  describe("visual inspection (test-output/)", () => {
    it("outputs cross-document page copy for manual review", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Copy all pages from source to dest
      for (let i = 0; i < source.getPageCount(); i++) {
        const copier = new ObjectCopier(source, dest);
        const srcPageRef = source.getPage(i)!.ref;
        const copiedPageRef = copier.copyPage(srcPageRef);
        dest.insertPage(dest.getPageCount(), copiedPageRef);
      }

      const savedBytes = await dest.save();
      const outputPath = await saveTestOutput("object-copier/cross-document-copy.pdf", savedBytes);

      // Verify the output was created
      expect(savedBytes.length).toBeGreaterThan(0);

      // Log the path for easy opening
      console.log(`  → Output: ${outputPath}`);
    });

    it("outputs same-document duplication for manual review", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const originalCount = pdf.getPageCount();

      // Duplicate each page
      for (let i = 0; i < originalCount; i++) {
        const copier = new ObjectCopier(pdf, pdf);
        const srcPageRef = pdf.getPage(i)!.ref;
        const copiedPageRef = copier.copyPage(srcPageRef);
        // Insert duplicate after the original
        pdf.insertPage(i * 2 + 1, copiedPageRef);
      }

      const savedBytes = await pdf.save();
      const outputPath = await saveTestOutput(
        "object-copier/same-document-duplicate.pdf",
        savedBytes,
      );

      expect(pdf.getPageCount()).toBe(originalCount * 2);
      console.log(`  → Output: ${outputPath}`);
    });

    it("outputs form page copy (with annotations) for manual review", async () => {
      const sourceBytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Copy form page with annotations
      const copier = new ObjectCopier(source, dest, { includeAnnotations: true });
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);
      dest.insertPage(dest.getPageCount(), copiedPageRef);

      const savedBytes = await dest.save();
      const outputPath = await saveTestOutput(
        "object-copier/form-page-with-annotations.pdf",
        savedBytes,
      );

      expect(savedBytes.length).toBeGreaterThan(0);
      console.log(`  → Output: ${outputPath}`);
    });

    it("outputs encrypted source copy for manual review", async () => {
      const sourceBytes = await loadFixture("encryption", "PasswordSample-40bit.pdf");
      const source = await PDF.load(sourceBytes, { credentials: "user" });

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      // Copy from encrypted source
      const copier = new ObjectCopier(source, dest);
      const srcPageRef = source.getPage(0)!.ref;
      const copiedPageRef = copier.copyPage(srcPageRef);
      dest.insertPage(dest.getPageCount(), copiedPageRef);

      const savedBytes = await dest.save();
      const outputPath = await saveTestOutput(
        "object-copier/from-encrypted-source.pdf",
        savedBytes,
      );

      expect(savedBytes.length).toBeGreaterThan(0);
      console.log(`  → Output: ${outputPath}`);
    });
  });
});
