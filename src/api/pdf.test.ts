import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

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

      const pages = await pdf.getPages();

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

      const page = await pdf.getPage(0);

      expect(page).not.toBeNull();
      expect(page?.ref.objectNumber).toBeGreaterThan(0);
    });

    it("getPage returns null for out of bounds", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      expect(await pdf.getPage(-1)).toBeNull();
      expect(await pdf.getPage(1000)).toBeNull();
    });
  });

  describe("page manipulation", () => {
    it("addPage creates a new page with default size", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();

      const newPage = pdf.addPage();

      expect(pdf.getPageCount()).toBe(originalCount + 1);
      expect((await pdf.getPage(originalCount))?.ref).toEqual(newPage.ref);

      // Verify it's a valid page
      expect(newPage.dict).toBeInstanceOf(PdfDict);
      expect(newPage.dict.getName("Type")?.value).toBe("Page");
    });

    it("addPage respects size presets", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const newPage = pdf.addPage({ size: "a4" });
      const page = newPage.dict;
      const mediaBox = page.getArray("MediaBox");

      expect(mediaBox?.at(2)).toBeDefined();
      // A4 width is ~595
      expect((mediaBox?.at(2) as PdfNumber).value).toBeCloseTo(595.28, 1);
    });

    it("addPage respects landscape orientation", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const newPage = pdf.addPage({ size: "letter", orientation: "landscape" });
      const page = newPage.dict;
      const mediaBox = page.getArray("MediaBox");

      // Letter landscape: width=792, height=612
      expect((mediaBox?.at(2) as PdfNumber).value).toBe(792);
      expect((mediaBox?.at(3) as PdfNumber).value).toBe(612);
    });

    it("addPage respects insertAt option", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const firstPage = await pdf.getPage(0);

      const newPage = pdf.addPage({ insertAt: 0 });

      expect((await pdf.getPage(0))?.ref).toEqual(newPage.ref);
      expect((await pdf.getPage(1))?.ref).toEqual(firstPage?.ref);
    });

    it("removePage removes a page", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();
      const secondPage = await pdf.getPage(1);

      const removed = pdf.removePage(0);

      expect(pdf.getPageCount()).toBe(originalCount - 1);
      expect(removed).not.toEqual(secondPage?.ref);
      expect((await pdf.getPage(0))?.ref).toEqual(secondPage?.ref);
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
      const pages = await pdf.getPages();
      const page1Index = pages.findIndex(p => p.ref.objectNumber === page1.ref.objectNumber);
      const lastIndex = pdf.getPageCount() - 1;
      pdf.movePage(page1Index, lastIndex);

      expect((await pdf.getPage(lastIndex))?.ref).toEqual(page1.ref);
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

      const [copiedPage] = await dest.copyPagesFrom(source, [0]);

      // Page is automatically inserted at the end
      expect(dest.getPageCount()).toBe(destOriginalCount + 1);
      expect((await dest.getPage(destOriginalCount))?.ref).toEqual(copiedPage.ref);

      // Verify it's a valid page with accessible properties
      expect(copiedPage.dict).toBeInstanceOf(PdfDict);
      expect(copiedPage.dict.getName("Type")?.value).toBe("Page");
      expect(copiedPage.width).toBeGreaterThan(0);
      expect(copiedPage.height).toBeGreaterThan(0);
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
      const copiedPages = await dest.copyPagesFrom(source, [0, 1]);

      expect(copiedPages.length).toBe(2);
      expect(dest.getPageCount()).toBe(destOriginalCount + 2);

      // Pages inserted in order
      expect((await dest.getPage(destOriginalCount))?.ref).toEqual(copiedPages[0].ref);
      expect((await dest.getPage(destOriginalCount + 1))?.ref).toEqual(copiedPages[1].ref);
    });

    it("inserts at specified position with insertAt option", async () => {
      const sourceBytes = await loadFixture("basic", "document.pdf");
      const source = await PDF.load(sourceBytes);

      const destBytes = await loadFixture("basic", "sample.pdf");
      const dest = await PDF.load(destBytes);

      const originalFirstPage = await dest.getPage(0);

      const [copiedPage] = await dest.copyPagesFrom(source, [0], { insertAt: 0 });

      // Copied page is now first
      expect((await dest.getPage(0))?.ref).toEqual(copiedPage.ref);
      // Original first page is now second
      expect((await dest.getPage(1))?.ref).toEqual(originalFirstPage?.ref);
    });

    it("duplicates a page within the same document", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);
      const originalCount = pdf.getPageCount();
      const originalFirstPage = await pdf.getPage(0);

      // Duplicate page 0 and insert after it
      const [duplicatedPage] = await pdf.copyPagesFrom(pdf, [0], { insertAt: 1 });

      expect(pdf.getPageCount()).toBe(originalCount + 1);
      expect((await pdf.getPage(0))?.ref).toEqual(originalFirstPage?.ref);
      expect((await pdf.getPage(1))?.ref).toEqual(duplicatedPage.ref);

      // Refs should be different
      expect(duplicatedPage.ref).not.toEqual(originalFirstPage?.ref);
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

      const [copiedPage] = await dest.copyPagesFrom(source, [0], {
        includeAnnotations: false,
      });

      expect(copiedPage.dict.has("Annots")).toBe(false);
    });
  });

  describe("PDF.create", () => {
    it("creates an empty document with no pages", () => {
      const pdf = PDF.create();

      expect(pdf.getPageCount()).toBe(0);
      expect(pdf.version).toBe("1.7");
      expect(pdf.isEncrypted).toBe(false);
    });

    it("allows adding pages", () => {
      const pdf = PDF.create();

      const page = pdf.addPage({ size: "letter" });

      expect(pdf.getPageCount()).toBe(1);
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    });

    it("can save and reload", async () => {
      const pdf = PDF.create();
      pdf.addPage({ size: "a4" });

      const saved = await pdf.save();
      const reloaded = await PDF.load(saved);

      expect(reloaded.getPageCount()).toBe(1);
    });
  });

  describe("PDF.merge", () => {
    it("merges multiple documents", async () => {
      const bytes1 = await loadFixture("basic", "rot0.pdf");
      const bytes2 = await loadFixture("basic", "sample.pdf");

      const pdf1 = await PDF.load(bytes1);
      const pdf2 = await PDF.load(bytes2);
      const totalPages = pdf1.getPageCount() + pdf2.getPageCount();

      const merged = await PDF.merge([bytes1, bytes2]);

      expect(merged.getPageCount()).toBe(totalPages);
    });

    it("returns empty document for empty array", async () => {
      const merged = await PDF.merge([]);

      expect(merged.getPageCount()).toBe(0);
    });

    it("returns clone of single document", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const original = await PDF.load(bytes);

      const merged = await PDF.merge([bytes]);

      expect(merged.getPageCount()).toBe(original.getPageCount());
    });

    it("merged document can be saved and reloaded", async () => {
      const bytes1 = await loadFixture("basic", "rot0.pdf");
      const bytes2 = await loadFixture("basic", "sample.pdf");

      const merged = await PDF.merge([bytes1, bytes2]);
      const saved = await merged.save();
      const reloaded = await PDF.load(saved);

      expect(reloaded.getPageCount()).toBe(merged.getPageCount());
    });
  });

  describe("extractPages", () => {
    it("extracts specified pages into new document", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      if (pdf.getPageCount() < 2) {
        return; // Skip if not enough pages
      }

      const extracted = await pdf.extractPages([0]);

      expect(extracted.getPageCount()).toBe(1);
      expect(pdf.getPageCount()).toBeGreaterThan(1); // Original unchanged
    });

    it("extracts multiple pages in order", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      if (pdf.getPageCount() < 3) {
        return; // Skip if not enough pages
      }

      const extracted = await pdf.extractPages([0, 2]);

      expect(extracted.getPageCount()).toBe(2);
    });

    it("throws RangeError for out of bounds index", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      await expect(pdf.extractPages([999])).rejects.toThrow(RangeError);
    });

    it("extracted document can be saved", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      const extracted = await pdf.extractPages([0]);
      const saved = await extracted.save();

      expect(saved.length).toBeGreaterThan(0);

      const reloaded = await PDF.load(saved);

      expect(reloaded.getPageCount()).toBe(1);
    });

    it("returns empty document for empty indices", async () => {
      const bytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(bytes);

      const extracted = await pdf.extractPages([]);

      expect(extracted.getPageCount()).toBe(0);
    });
  });

  describe("embedPage and drawPage", () => {
    it("embeds a page from another document", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const sourcePage = await source.getPage(0);

      const embedded = await dest.embedPage(source, 0);

      expect(embedded.ref).toBeDefined();
      expect(embedded.width).toBe(sourcePage!.width);
      expect(embedded.height).toBe(sourcePage!.height);
    });

    it("throws for invalid page index", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      await expect(dest.embedPage(source, 999)).rejects.toThrow(RangeError);
    });

    it("draws embedded page on a page", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);
      const page = await dest.getPage(0);

      expect(page).not.toBeNull();
      page!.drawPage(embedded);

      // Verify XObject was added to resources
      const resources = page!.getResources();
      const xobjects = resources.get("XObject");

      expect(xobjects).toBeInstanceOf(PdfDict);
    });

    it("draws embedded page as background", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);
      const page = await dest.getPage(0);

      page!.drawPage(embedded, { background: true });

      // Verify content was added
      const contents = page!.dict.get("Contents");

      expect(contents).toBeDefined();
    });

    it("draws with position and scale", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);
      const page = await dest.getPage(0);

      page!.drawPage(embedded, { x: 50, y: 100, scale: 0.5 });

      // Verify XObject was added
      const resources = page!.getResources();
      const xobjects = resources.get("XObject");

      expect(xobjects).toBeInstanceOf(PdfDict);
    });

    it("draws with opacity", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);
      const page = await dest.getPage(0);

      page!.drawPage(embedded, { opacity: 0.5 });

      // Verify ExtGState was added for opacity
      const resources = page!.getResources();
      const extGState = resources.get("ExtGState");

      expect(extGState).toBeInstanceOf(PdfDict);
    });

    it("survives save and reload", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);
      const page = await dest.getPage(0);

      page!.drawPage(embedded);

      // Save and reload
      const saved = await dest.save();
      const reloaded = await PDF.load(saved);

      expect(reloaded.getPageCount()).toBe(dest.getPageCount());

      // Verify the XObject is in the reloaded document
      const reloadedPage = await reloaded.getPage(0);
      const resources = reloadedPage!.getResources();
      const xobjects = resources.get("XObject");

      expect(xobjects).toBeInstanceOf(PdfDict);
    });
  });

  describe("visual output tests", () => {
    it("outputs merged PDF", async () => {
      const bytes1 = await loadFixture("basic", "rot0.pdf");
      const bytes2 = await loadFixture("basic", "sample.pdf");

      const merged = await PDF.merge([bytes1, bytes2]);
      const saved = await merged.save();

      const outputPath = await saveTestOutput("merge-split/merged.pdf", saved);
      console.log(`  -> Merged output: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs extracted pages", async () => {
      const bytes = await loadFixture("basic", "document.pdf");
      const pdf = await PDF.load(bytes);

      if (pdf.getPageCount() < 2) {
        console.log("  -> Skipped: source has < 2 pages");
        return;
      }

      const extracted = await pdf.extractPages([0]);
      const saved = await extracted.save();

      const outputPath = await saveTestOutput("merge-split/extracted-page-0.pdf", saved);
      console.log(`  -> Extracted output: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs new document with added pages", async () => {
      const pdf = PDF.create();

      // Add a few pages with different sizes
      pdf.addPage({ size: "letter" });
      pdf.addPage({ size: "a4" });
      pdf.addPage({ width: 400, height: 600 });

      const saved = await pdf.save();

      const outputPath = await saveTestOutput("merge-split/created-new.pdf", saved);
      console.log(`  -> Created output: ${outputPath}`);

      expect(pdf.getPageCount()).toBe(3);
      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs overlay (foreground)", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);

      // Draw on first page, scaled down and positioned
      const page = await dest.getPage(0);
      page!.drawPage(embedded, {
        x: 50,
        y: 50,
        scale: 0.3,
      });

      const saved = await dest.save();

      const outputPath = await saveTestOutput("merge-split/overlay-foreground.pdf", saved);
      console.log(`  -> Overlay foreground: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs overlay (background)", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);

      // Draw as background on first page
      const page = await dest.getPage(0);
      page!.drawPage(embedded, {
        background: true,
        scale: 0.5,
        x: 100,
        y: 200,
      });

      const saved = await dest.save();

      const outputPath = await saveTestOutput("merge-split/overlay-background.pdf", saved);
      console.log(`  -> Overlay background: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs overlay with opacity", async () => {
      const destBytes = await loadFixture("basic", "rot0.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "sample.pdf");
      const source = await PDF.load(sourceBytes);

      const embedded = await dest.embedPage(source, 0);

      // Draw with 50% opacity
      const page = await dest.getPage(0);
      page!.drawPage(embedded, {
        opacity: 0.5,
        scale: 0.4,
        x: 150,
        y: 150,
      });

      const saved = await dest.save();

      const outputPath = await saveTestOutput("merge-split/overlay-opacity.pdf", saved);
      console.log(`  -> Overlay opacity: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
    });

    it("outputs watermark on all pages", async () => {
      const destBytes = await loadFixture("basic", "document.pdf");
      const dest = await PDF.load(destBytes);

      const sourceBytes = await loadFixture("basic", "rot0.pdf");
      const source = await PDF.load(sourceBytes);

      const watermark = await dest.embedPage(source, 0);

      // Apply watermark to all pages
      const pages = await dest.getPages();

      for (const page of pages) {
        // Center the watermark
        const x = (page.width - watermark.width * 0.3) / 2;
        const y = (page.height - watermark.height * 0.3) / 2;

        page.drawPage(watermark, {
          x,
          y,
          scale: 0.3,
          opacity: 0.2,
        });
      }

      const saved = await dest.save();

      const outputPath = await saveTestOutput("merge-split/watermark-all-pages.pdf", saved);
      console.log(`  -> Watermark all pages: ${outputPath}`);

      expect(saved.length).toBeGreaterThan(0);
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

  describe("metadata", () => {
    describe("PDF.create() default metadata", () => {
      it("sets default metadata values", () => {
        const pdf = PDF.create();

        expect(pdf.getTitle()).toBe("Untitled");
        expect(pdf.getAuthor()).toBe("Unknown");
        expect(pdf.getCreator()).toBe("@libpdf/core");
        expect(pdf.getProducer()).toBe("@libpdf/core");
        expect(pdf.getCreationDate()).toBeInstanceOf(Date);
        expect(pdf.getModificationDate()).toBeInstanceOf(Date);
      });

      it("optional metadata fields are undefined by default", () => {
        const pdf = PDF.create();

        expect(pdf.getSubject()).toBeUndefined();
        expect(pdf.getKeywords()).toBeUndefined();
        expect(pdf.getTrapped()).toBeUndefined();
        expect(pdf.getLanguage()).toBeUndefined();
      });
    });

    describe("individual getters/setters", () => {
      it("setTitle/getTitle", () => {
        const pdf = PDF.create();

        pdf.setTitle("Test Document Title");

        expect(pdf.getTitle()).toBe("Test Document Title");
      });

      it("setAuthor/getAuthor", () => {
        const pdf = PDF.create();

        pdf.setAuthor("Jane Smith");

        expect(pdf.getAuthor()).toBe("Jane Smith");
      });

      it("setSubject/getSubject", () => {
        const pdf = PDF.create();

        pdf.setSubject("Financial Report Q4");

        expect(pdf.getSubject()).toBe("Financial Report Q4");
      });

      it("setKeywords/getKeywords", () => {
        const pdf = PDF.create();

        pdf.setKeywords(["finance", "quarterly", "2024"]);

        expect(pdf.getKeywords()).toEqual(["finance", "quarterly", "2024"]);
      });

      it("setCreator/getCreator overrides default", () => {
        const pdf = PDF.create();

        pdf.setCreator("My App v1.0");

        expect(pdf.getCreator()).toBe("My App v1.0");
      });

      it("setProducer/getProducer overrides default", () => {
        const pdf = PDF.create();

        pdf.setProducer("Custom Producer");

        expect(pdf.getProducer()).toBe("Custom Producer");
      });

      it("setCreationDate/getCreationDate", () => {
        const pdf = PDF.create();
        const date = new Date("2024-06-15T10:30:00Z");

        pdf.setCreationDate(date);

        const retrieved = pdf.getCreationDate();

        expect(retrieved).toBeInstanceOf(Date);
        expect(retrieved?.toISOString()).toBe(date.toISOString());
      });

      it("setModificationDate/getModificationDate", () => {
        const pdf = PDF.create();
        const date = new Date("2024-07-20T14:45:00Z");

        pdf.setModificationDate(date);

        const retrieved = pdf.getModificationDate();

        expect(retrieved).toBeInstanceOf(Date);
        expect(retrieved?.toISOString()).toBe(date.toISOString());
      });

      it("setTrapped/getTrapped - True", () => {
        const pdf = PDF.create();

        pdf.setTrapped("True");

        expect(pdf.getTrapped()).toBe("True");
      });

      it("setTrapped/getTrapped - False", () => {
        const pdf = PDF.create();

        pdf.setTrapped("False");

        expect(pdf.getTrapped()).toBe("False");
      });

      it("setTrapped/getTrapped - Unknown", () => {
        const pdf = PDF.create();

        pdf.setTrapped("Unknown");

        expect(pdf.getTrapped()).toBe("Unknown");
      });

      it("setLanguage/getLanguage", () => {
        const pdf = PDF.create();

        pdf.setLanguage("en-US");

        expect(pdf.getLanguage()).toBe("en-US");
      });
    });

    describe("setTitle with showInWindowTitleBar", () => {
      it("sets DisplayDocTitle in ViewerPreferences", async () => {
        const pdf = PDF.create();

        pdf.setTitle("My Document", { showInWindowTitleBar: true });

        const catalog = await pdf.getCatalog();
        const viewerPrefs = catalog?.get("ViewerPreferences");

        expect(viewerPrefs).toBeInstanceOf(PdfDict);
        expect((viewerPrefs as PdfDict).getBool("DisplayDocTitle")?.value).toBe(true);
      });
    });

    describe("bulk operations", () => {
      it("getMetadata returns all fields", () => {
        const pdf = PDF.create();
        const date = new Date("2024-01-15T12:00:00Z");

        pdf.setTitle("Test Title");
        pdf.setAuthor("Test Author");
        pdf.setSubject("Test Subject");
        pdf.setKeywords(["test", "keywords"]);
        pdf.setCreationDate(date);
        pdf.setModificationDate(date);
        pdf.setTrapped("True");
        pdf.setLanguage("de-DE");

        const metadata = pdf.getMetadata();

        expect(metadata.title).toBe("Test Title");
        expect(metadata.author).toBe("Test Author");
        expect(metadata.subject).toBe("Test Subject");
        expect(metadata.keywords).toEqual(["test", "keywords"]);
        expect(metadata.producer).toBe("@libpdf/core");
        expect(metadata.creator).toBe("@libpdf/core");
        expect(metadata.creationDate?.toISOString()).toBe(date.toISOString());
        expect(metadata.modificationDate?.toISOString()).toBe(date.toISOString());
        expect(metadata.trapped).toBe("True");
        expect(metadata.language).toBe("de-DE");
      });

      it("setMetadata sets multiple fields at once", () => {
        const pdf = PDF.create();
        const date = new Date("2024-03-20T08:00:00Z");

        pdf.setMetadata({
          title: "Bulk Title",
          author: "Bulk Author",
          creationDate: date,
          language: "fr-FR",
        });

        expect(pdf.getTitle()).toBe("Bulk Title");
        expect(pdf.getAuthor()).toBe("Bulk Author");
        expect(pdf.getCreationDate()?.toISOString()).toBe(date.toISOString());
        expect(pdf.getLanguage()).toBe("fr-FR");
        // Unchanged fields
        expect(pdf.getSubject()).toBeUndefined();
      });
    });

    describe("Unicode support", () => {
      it("handles Unicode in title", () => {
        const pdf = PDF.create();

        pdf.setTitle("Quarterly Report Q4 2024 - 季度报告");

        expect(pdf.getTitle()).toBe("Quarterly Report Q4 2024 - 季度报告");
      });

      it("handles emoji in author", () => {
        const pdf = PDF.create();

        pdf.setAuthor("John Smith 🚀");

        expect(pdf.getAuthor()).toBe("John Smith 🚀");
      });

      it("handles RTL text in subject", () => {
        const pdf = PDF.create();

        pdf.setSubject("مرحبا بالعالم");

        expect(pdf.getSubject()).toBe("مرحبا بالعالم");
      });
    });

    describe("round-trip", () => {
      it("metadata survives save/load cycle", async () => {
        const pdf = PDF.create();
        const date = new Date("2024-05-10T16:30:00Z");

        pdf.setTitle("Round-trip Test");
        pdf.setAuthor("Test Author");
        pdf.setSubject("Testing metadata persistence");
        pdf.setKeywords(["test", "round-trip", "metadata"]);
        pdf.setCreationDate(date);
        pdf.setTrapped("False");
        pdf.setLanguage("en-GB");
        pdf.addPage();

        const saved = await pdf.save();
        const loaded = await PDF.load(saved);

        expect(loaded.getTitle()).toBe("Round-trip Test");
        expect(loaded.getAuthor()).toBe("Test Author");
        expect(loaded.getSubject()).toBe("Testing metadata persistence");
        expect(loaded.getKeywords()).toEqual(["test", "round-trip", "metadata"]);
        expect(loaded.getCreationDate()?.toISOString()).toBe(date.toISOString());
        expect(loaded.getTrapped()).toBe("False");
        expect(loaded.getLanguage()).toBe("en-GB");
      });

      it("Unicode metadata survives save/load cycle", async () => {
        const pdf = PDF.create();

        pdf.setTitle("日本語タイトル");
        pdf.setAuthor("著者名 🎉");
        pdf.addPage();

        const saved = await pdf.save();
        const loaded = await PDF.load(saved);

        expect(loaded.getTitle()).toBe("日本語タイトル");
        expect(loaded.getAuthor()).toBe("著者名 🎉");
      });
    });

    describe("loading PDFs with existing metadata", () => {
      it("reads metadata from text fixture PDF", async () => {
        // This PDF (OpenOffice-generated) should have metadata
        const bytes = await loadFixture("text", "openoffice-test-document.pdf");
        const pdf = await PDF.load(bytes);

        // Just verify we can read without error - actual values depend on fixture
        const metadata = pdf.getMetadata();

        expect(metadata).toBeDefined();
        // OpenOffice typically sets Producer
        expect(typeof metadata.producer === "string" || metadata.producer === undefined).toBe(true);
      });

      it("returns undefined for missing metadata fields", async () => {
        const bytes = await loadFixture("basic", "rot0.pdf");
        const pdf = await PDF.load(bytes);

        // Basic fixture may not have all metadata
        const title = pdf.getTitle();
        const author = pdf.getAuthor();

        // These should be undefined or valid strings, not throw
        expect(title === undefined || typeof title === "string").toBe(true);
        expect(author === undefined || typeof author === "string").toBe(true);
      });

      it("can modify loaded PDF metadata", async () => {
        const bytes = await loadFixture("basic", "rot0.pdf");
        const pdf = await PDF.load(bytes);

        pdf.setTitle("Modified Title");
        pdf.setAuthor("New Author");

        expect(pdf.getTitle()).toBe("Modified Title");
        expect(pdf.getAuthor()).toBe("New Author");
      });
    });

    describe("keywords edge cases", () => {
      it("handles empty keywords array", () => {
        const pdf = PDF.create();

        pdf.setKeywords([]);

        // Empty string splits to empty array after filtering
        expect(pdf.getKeywords()).toEqual([]);
      });

      it("handles single keyword", () => {
        const pdf = PDF.create();

        pdf.setKeywords(["single"]);

        expect(pdf.getKeywords()).toEqual(["single"]);
      });

      it("handles keywords with spaces in them (joined with space)", () => {
        const pdf = PDF.create();

        // Note: Keywords are space-separated in PDF, so keywords with spaces
        // will be split when retrieved. This is per PDF spec behavior.
        pdf.setKeywords(["word1", "word2", "word3"]);

        expect(pdf.getKeywords()).toEqual(["word1", "word2", "word3"]);
      });
    });
  });
});
