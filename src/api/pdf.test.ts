import { describe, expect, it } from "vitest";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture } from "#src/test-utils";
import { PDF } from "./pdf";

describe("PDF", () => {
  describe("loading", () => {
    it("loads a basic PDF", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf).toBeInstanceOf(PDF);
    });

    it("exposes version", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.version).toMatch(/^\d\.\d$/);
    });

    it("detects non-linearized PDFs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.isLinearized).toBe(false);
    });

    it("reports encryption status", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.isEncrypted).toBe(false);
      expect(pdf.isAuthenticated).toBe(true);
    });
  });

  describe("object access", () => {
    it("getCatalog returns catalog", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const catalog = await pdf.getCatalog();

      expect(catalog).toBeInstanceOf(PdfDict);
      expect(catalog?.getName("Type")?.value).toBe("Catalog");
    });

    it("getPages returns page refs", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const pages = pdf.getPages();

      expect(pages.length).toBeGreaterThan(0);
    });

    it("getPageCount returns count", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const count = pdf.getPageCount();

      expect(count).toBeGreaterThan(0);
    });

    it("getPage returns page at index", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const page = pdf.getPage(0);

      expect(page).not.toBeNull();
      expect(page?.objectNumber).toBeGreaterThan(0);
    });

    it("getPage returns null for out of bounds", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.getPage(-1)).toBeNull();
      expect(pdf.getPage(1000)).toBeNull();
    });
  });

  describe("page manipulation", () => {
    it("addPage creates a new page with default size", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();

      const pageRef = pdf.addPage();

      expect(pdf.getPageCount()).toBe(originalCount + 1);
      expect(pdf.getPage(originalCount)).toBe(pageRef);

      // Verify it's a valid page
      const page = await pdf.getObject(pageRef);

      expect(page).toBeInstanceOf(PdfDict);
      expect((page as PdfDict).getName("Type")?.value).toBe("Page");
    });

    it("addPage respects size presets", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const pageRef = pdf.addPage({ size: "a4" });
      const page = (await pdf.getObject(pageRef)) as PdfDict;
      const mediaBox = page.getArray("MediaBox");

      expect(mediaBox?.at(2)).toBeDefined();
      // A4 width is ~595
      expect((mediaBox?.at(2) as PdfNumber).value).toBeCloseTo(595.28, 1);
    });

    it("addPage respects landscape orientation", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const pageRef = pdf.addPage({ size: "letter", orientation: "landscape" });
      const page = (await pdf.getObject(pageRef)) as PdfDict;
      const mediaBox = page.getArray("MediaBox");

      // Letter landscape: width=792, height=612
      expect((mediaBox?.at(2) as PdfNumber).value).toBe(792);
      expect((mediaBox?.at(3) as PdfNumber).value).toBe(612);
    });

    it("addPage respects insertAt option", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const firstPage = pdf.getPage(0);

      const pageRef = pdf.addPage({ insertAt: 0 });

      expect(pdf.getPage(0)).toBe(pageRef);
      expect(pdf.getPage(1)).toBe(firstPage);
    });

    it("removePage removes a page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();
      const secondPage = pdf.getPage(1);

      const removed = pdf.removePage(0);

      expect(pdf.getPageCount()).toBe(originalCount - 1);
      expect(removed).not.toBe(secondPage);
      expect(pdf.getPage(0)).toBe(secondPage);
    });

    it("removePage throws on out of bounds", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(() => pdf.removePage(100)).toThrow(RangeError);
    });

    it("movePage reorders pages", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      // Add some pages to have enough to move
      const page1 = pdf.addPage();
      pdf.addPage(); // page2 - just need it to exist

      // Move page1 to the end
      const page1Index = pdf.getPages().indexOf(page1);
      const lastIndex = pdf.getPageCount() - 1;
      pdf.movePage(page1Index, lastIndex);

      expect(pdf.getPage(lastIndex)).toBe(page1);
    });

    it("page modifications persist through save/load", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf1 = await PDF.load(bytes);
      const originalCount = pdf1.getPageCount();

      // Add a page
      pdf1.addPage({ size: "a4" });

      const saved = await pdf1.save();
      const pdf2 = await PDF.load(saved);

      expect(pdf2.getPageCount()).toBe(originalCount + 1);
    });
  });

  describe("modification tracking", () => {
    it("hasChanges returns false for unmodified doc", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.hasChanges()).toBe(false);
    });

    it("hasChanges returns true after modification", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const catalog = await pdf.getCatalog();

      catalog?.set("ModDate", PdfString.fromString("D:20240101"));

      expect(pdf.hasChanges()).toBe(true);
    });

    it("hasChanges returns true when new object registered", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      pdf.register(new PdfDict());

      expect(pdf.hasChanges()).toBe(true);
    });
  });

  describe("object creation", () => {
    it("register returns ref", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const ref = pdf.register(new PdfDict());

      expect(ref.objectNumber).toBeGreaterThan(0);
      expect(ref.generation).toBe(0);
    });

    it("createDict creates and registers dict", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const ref = pdf.createDict({ Type: PdfName.of("Annot") });

      const obj = await pdf.getObject(ref);

      expect(obj).toBeInstanceOf(PdfDict);
      expect((obj as PdfDict).getName("Type")?.value).toBe("Annot");
    });

    it("createArray creates and registers array", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const ref = pdf.createArray([PdfNumber.of(1), PdfNumber.of(2)]);

      expect(ref.objectNumber).toBeGreaterThan(0);
    });

    it("createStream creates and registers stream", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const ref = pdf.createStream({ Filter: PdfName.FlateDecode }, new Uint8Array([1, 2, 3]));

      expect(ref.objectNumber).toBeGreaterThan(0);
    });
  });

  describe("incremental save check", () => {
    it("returns null for normal PDF", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(pdf.canSaveIncrementally()).toBeNull();
    });
  });

  describe("saving", () => {
    it("save produces valid PDF bytes", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const saved = await pdf.save();

      // Check for PDF header
      const header = new TextDecoder().decode(saved.slice(0, 8));

      expect(header).toMatch(/^%PDF-\d\.\d/);

      // Check for EOF
      const tail = new TextDecoder().decode(saved.slice(-10));

      expect(tail).toContain("%%EOF");
    });

    it("save preserves unmodified content", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const saved = await pdf.save();
      const text = new TextDecoder().decode(saved);

      // Should contain catalog
      expect(text).toContain("/Type /Catalog");
    });

    it("incremental save appends to original", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const originalLength = bytes.length;

      // Modify catalog
      const catalog = await pdf.getCatalog();

      catalog?.set("ModDate", PdfString.fromString("D:20240101"));

      const saved = await pdf.save({ incremental: true });

      // Should be longer than original
      expect(saved.length).toBeGreaterThan(originalLength);

      // Original bytes should be preserved
      expect(saved.subarray(0, originalLength)).toEqual(bytes);
    });

    it("incremental save includes /Prev pointer", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const catalog = await pdf.getCatalog();

      catalog?.set("Modified", PdfNumber.of(1));

      const saved = await pdf.save({ incremental: true });
      const text = new TextDecoder().decode(saved);

      expect(text).toContain("/Prev ");
    });

    it("save falls back to full when incremental not possible", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      // Manually set recovered flag
      (pdf as unknown as { recoveredViaBruteForce: boolean }).recoveredViaBruteForce = true;

      // Should not throw, just add warning
      const saved = await pdf.save({ incremental: true });

      expect(saved.length).toBeGreaterThan(0);
      expect(pdf.warnings.some(w => w.includes("not possible"))).toBe(true);
    });
  });

  describe("copyPagesFrom", () => {
    it("copies and appends a single page from another document", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const destOriginalCount = dest.getPageCount();
      const sourceCount = source.getPageCount();
      expect(sourceCount).toBeGreaterThan(0);

      const [copiedRef] = await dest.copyPagesFrom(source, [0]);

      // Page is automatically inserted at the end
      expect(dest.getPageCount()).toBe(destOriginalCount + 1);
      expect(dest.getPage(destOriginalCount)).toBe(copiedRef);

      // Verify it's a valid page
      const copiedPage = await dest.getObject(copiedRef);
      expect(copiedPage).toBeInstanceOf(PdfDict);
      expect((copiedPage as PdfDict).getName("Type")?.value).toBe("Page");
    });

    it("copies multiple pages and appends them in order", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      if (source.getPageCount() < 2) {
        // Skip if source doesn't have enough pages
        return;
      }

      const destOriginalCount = dest.getPageCount();
      const copiedRefs = await dest.copyPagesFrom(source, [0, 1]);

      expect(copiedRefs.length).toBe(2);
      expect(dest.getPageCount()).toBe(destOriginalCount + 2);

      // Pages inserted in order
      expect(dest.getPage(destOriginalCount)).toBe(copiedRefs[0]);
      expect(dest.getPage(destOriginalCount + 1)).toBe(copiedRefs[1]);
    });

    it("inserts at specified position with insertAt option", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const originalFirstPage = dest.getPage(0);

      const [copiedRef] = await dest.copyPagesFrom(source, [0], { insertAt: 0 });

      // Copied page is now first
      expect(dest.getPage(0)).toBe(copiedRef);
      // Original first page is now second
      expect(dest.getPage(1)).toBe(originalFirstPage);
    });

    it("duplicates a page within the same document", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();
      const originalFirstPage = pdf.getPage(0);

      // Duplicate page 0 and insert after it
      const [duplicatedRef] = await pdf.copyPagesFrom(pdf, [0], { insertAt: 1 });

      expect(pdf.getPageCount()).toBe(originalCount + 1);
      expect(pdf.getPage(0)).toBe(originalFirstPage);
      expect(pdf.getPage(1)).toBe(duplicatedRef);

      // Refs should be different
      expect(duplicatedRef).not.toBe(originalFirstPage);
    });

    it("throws RangeError for out of bounds index", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      await expect(dest.copyPagesFrom(source, [999])).rejects.toThrow(RangeError);
    });

    it("throws RangeError for negative index", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      await expect(dest.copyPagesFrom(source, [-1])).rejects.toThrow(RangeError);
    });

    it("copies persist through save/load", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);
      const destOriginalCount = dest.getPageCount();

      await dest.copyPagesFrom(source, [0]);

      // Save and reload
      const saved = await dest.save();
      const reloaded = await PDF.load(saved);

      expect(reloaded.getPageCount()).toBe(destOriginalCount + 1);
    });

    it("excludes annotations when option is false", async () => {
      const sourceBytes = await loadFixture("basic", "SimpleForm2Fields.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const [copiedRef] = await dest.copyPagesFrom(source, [0], {
        includeAnnotations: false,
      });

      const copiedPage = (await dest.getObject(copiedRef)) as PdfDict;
      expect(copiedPage.has("Annots")).toBe(false);
    });
  });

  describe("round-trip", () => {
    it("load -> save -> load preserves structure", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf1 = await PDF.load(bytes);

      const catalog1 = await pdf1.getCatalog();
      const pageCount1 = pdf1.getPageCount();

      const saved = await pdf1.save();
      const pdf2 = await PDF.load(saved);

      const catalog2 = await pdf2.getCatalog();
      const pageCount2 = pdf2.getPageCount();

      expect(catalog2?.getName("Type")?.value).toBe(catalog1?.getName("Type")?.value);
      expect(pageCount2).toBe(pageCount1);
    });

    it("load -> modify -> save -> load shows modification", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf1 = await PDF.load(bytes);

      // Add metadata
      const catalog = await pdf1.getCatalog();

      catalog?.set("CustomKey", PdfString.fromString("CustomValue"));

      const saved = await pdf1.save();
      const pdf2 = await PDF.load(saved);

      const catalog2 = await pdf2.getCatalog();

      expect(catalog2?.getString("CustomKey")?.asString()).toBe("CustomValue");
    });

    it("incremental save preserves ability to do another incremental", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf1 = await PDF.load(bytes);

      // First modification
      const catalog1 = await pdf1.getCatalog();

      catalog1?.set("Mod1", PdfNumber.of(1));

      const saved1 = await pdf1.save({ incremental: true });

      // Load and modify again
      const pdf2 = await PDF.load(saved1);
      const catalog2 = await pdf2.getCatalog();

      catalog2?.set("Mod2", PdfNumber.of(2));

      const saved2 = await pdf2.save({ incremental: true });

      // Verify both modifications exist
      const pdf3 = await PDF.load(saved2);
      const catalog3 = await pdf3.getCatalog();

      expect(catalog3?.getNumber("Mod1")?.value).toBe(1);
      expect(catalog3?.getNumber("Mod2")?.value).toBe(2);

      // Verify we have /Prev chain
      const text = new TextDecoder().decode(saved2);
      const prevCount = (text.match(/\/Prev /g) || []).length;

      expect(prevCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getForm", () => {
    it("returns null when no form exists", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();

      expect(form).toBeNull();
    });

    it("returns PDFForm when form exists", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();

      expect(form).not.toBeNull();
      expect(form!.fieldCount).toBeGreaterThan(0);
    });

    it("caches form on subsequent calls", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form1 = await pdf.getForm();
      const form2 = await pdf.getForm();

      expect(form1).toBe(form2);
    });
  });

  describe("form.acroForm()", () => {
    it("returns AcroForm for low-level access", async () => {
      const bytes = await loadFixture("forms", "sample_form.pdf");
      const pdf = await PDF.load(bytes);

      const form = await pdf.getForm();
      const acroForm = form?.acroForm();

      expect(acroForm).not.toBeNull();
      expect(acroForm!.defaultAppearance).toBeDefined();
    });
  });
});
