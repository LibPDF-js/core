/**
 * Tests for PDF annotations.
 */

import { PDF } from "#src/api/pdf";
import { rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfRef } from "#src/objects/pdf-ref";
import { describe, expect, it } from "vitest";

import type { PDFLinkAnnotation } from "./link";
import type { PDFTextAnnotation } from "./text";
import type { PDFHighlightAnnotation } from "./text-markup";

describe("PDFAnnotations", () => {
  describe("getAnnotations()", () => {
    it("returns empty array for page with no annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();
      const annotations = page.getAnnotations();

      expect(annotations).toEqual([]);
    });

    it("returns annotations after adding them", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      const annotations = page.getAnnotations();

      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe("Highlight");
    });

    it("caches annotations on repeated calls", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      const first = page.getAnnotations();
      const second = page.getAnnotations();

      expect(first).toBe(second); // Same array instance
    });
  });

  describe("Highlight annotations", () => {
    it("creates highlight annotation with rect", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
        opacity: 0.5,
        contents: "Test comment",
        title: "Test Author",
      });

      expect(highlight.type).toBe("Highlight");
      expect(highlight.quadPoints).toHaveLength(1);
      expect(highlight.quadPoints[0]).toHaveLength(8);
      expect(highlight.contents).toBe("Test comment");
      expect(highlight.title).toBe("Test Author");
      expect(highlight.opacity).toBe(0.5);
    });

    it("creates highlight with multiple rects", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rects: [
          { x: 100, y: 700, width: 400, height: 14 },
          { x: 100, y: 680, width: 250, height: 14 },
        ],
        color: rgb(1, 1, 0),
      });

      expect(highlight.quadPoints).toHaveLength(2);
    });

    it("creates highlight with raw quadPoints", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const quad = [100, 714, 300, 714, 100, 700, 300, 700];

      const highlight = page.addHighlightAnnotation({
        quadPoints: [quad],
        color: rgb(1, 1, 0),
      });

      expect(highlight.quadPoints).toHaveLength(1);
      expect(highlight.quadPoints[0]).toEqual(quad);
    });

    it("getBounds() returns bounding box of quads", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      const bounds = highlight.getBounds();

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(700);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(14);
    });
  });

  describe("Underline annotations", () => {
    it("creates underline annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const underline = page.addUnderlineAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(0, 0, 1),
      });

      expect(underline.type).toBe("Underline");
    });
  });

  describe("StrikeOut annotations", () => {
    it("creates strikeout annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const strikeout = page.addStrikeOutAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 0, 0),
      });

      expect(strikeout.type).toBe("StrikeOut");
    });
  });

  describe("Squiggly annotations", () => {
    it("creates squiggly annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const squiggly = page.addSquigglyAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 0, 0),
      });

      expect(squiggly.type).toBe("Squiggly");
    });
  });

  describe("Link annotations", () => {
    it("creates link annotation with URI", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const link = page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
      });

      expect(link.type).toBe("Link");
      expect(link.uri).toBe("https://example.com");
    });

    it("creates link annotation with internal destination", async () => {
      const pdf = PDF.create();
      const page1 = pdf.addPage();
      const page2 = pdf.addPage();

      const link = page1.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        destination: { page: page2, type: "Fit" },
      });

      expect(link.type).toBe("Link");
      expect(link.destination).toBeTruthy();
      expect(link.destination?.page).toEqual(page2.ref);
      expect(link.destination?.type).toBe("Fit");
    });

    it("creates link with border", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const link = page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
        borderWidth: 1,
        borderColor: rgb(0, 0, 1),
      });

      expect(link.type).toBe("Link");
    });
  });

  describe("Text annotations (sticky notes)", () => {
    it("creates text annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const text = page.addTextAnnotation({
        rect: { x: 100, y: 500, width: 24, height: 24 },
        contents: "This is a comment",
        title: "Reviewer",
        color: rgb(1, 1, 0),
        icon: "Comment",
        open: true,
      });

      expect(text.type).toBe("Text");
      expect(text.contents).toBe("This is a comment");
      expect(text.title).toBe("Reviewer");
      expect(text.icon).toBe("Comment");
      expect(text.isOpen).toBe(true);
    });

    it("defaults to Note icon", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const text = page.addTextAnnotation({
        rect: { x: 100, y: 500, width: 24, height: 24 },
      });

      expect(text.icon).toBe("Note"); // Default
    });
  });

  describe("Line annotations", () => {
    it("creates line annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const line = page.addLineAnnotation({
        start: { x: 100, y: 300 },
        end: { x: 300, y: 300 },
        color: rgb(1, 0, 0),
        width: 2,
      });

      expect(line.type).toBe("Line");
      expect(line.start.x).toBe(100);
      expect(line.end.x).toBe(300);
    });

    it("creates line with arrow endings", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const line = page.addLineAnnotation({
        start: { x: 100, y: 300 },
        end: { x: 300, y: 300 },
        startStyle: "None",
        endStyle: "ClosedArrow",
      });

      expect(line.lineEndingStyles[0]).toBe("None");
      expect(line.lineEndingStyles[1]).toBe("ClosedArrow");
    });
  });

  describe("Square annotations", () => {
    it("creates square annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const square = page.addSquareAnnotation({
        rect: { x: 100, y: 200, width: 100, height: 100 },
        color: rgb(0, 0, 1),
        fillColor: rgb(0.9, 0.9, 1),
        borderWidth: 2,
      });

      expect(square.type).toBe("Square");
    });
  });

  describe("Circle annotations", () => {
    it("creates circle annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const circle = page.addCircleAnnotation({
        rect: { x: 250, y: 200, width: 100, height: 100 },
        color: rgb(0, 1, 0),
        borderWidth: 2,
      });

      expect(circle.type).toBe("Circle");
    });
  });

  describe("Stamp annotations", () => {
    it("creates stamp annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const stamp = page.addStampAnnotation({
        rect: { x: 400, y: 500, width: 150, height: 50 },
        name: "Approved",
      });

      expect(stamp.type).toBe("Stamp");
      expect(stamp.stampName).toBe("Approved");
    });

    it("defaults to Draft stamp", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const stamp = page.addStampAnnotation({
        rect: { x: 400, y: 500, width: 150, height: 50 },
      });

      expect(stamp.stampName).toBe("Draft");
    });
  });

  describe("Ink annotations", () => {
    it("creates ink annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const ink = page.addInkAnnotation({
        paths: [
          [
            { x: 100, y: 100 },
            { x: 150, y: 150 },
            { x: 200, y: 100 },
          ],
          [
            { x: 100, y: 80 },
            { x: 200, y: 80 },
          ],
        ],
        color: rgb(0, 0, 1),
        width: 2,
      });

      expect(ink.type).toBe("Ink");
      expect(ink.inkPaths).toHaveLength(2);
      expect(ink.inkPaths[0]).toHaveLength(3);
    });
  });

  describe("Type-specific getters", () => {
    it("returns only highlights from getHighlightAnnotations()", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
      });

      const highlights = page.getHighlightAnnotations();
      const underlines = page.getUnderlineAnnotations();
      const links = page.getLinkAnnotations();

      expect(highlights).toHaveLength(1);
      expect(underlines).toHaveLength(1);
      expect(links).toHaveLength(1);
    });
  });

  describe("removeAnnotation()", () => {
    it("removes a specific annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      expect(page.getAnnotations()).toHaveLength(2);

      page.removeAnnotation(highlight);

      expect(page.getAnnotations()).toHaveLength(1);
      expect(page.getAnnotations()[0].type).toBe("Underline");
    });

    it("removes a direct (non-ref) annotation dict entry", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const directAnnot = PdfDict.of({
        Type: PdfName.of("Annot"),
        Subtype: PdfName.of("Text"),
        Rect: new PdfArray([
          PdfNumber.of(10),
          PdfNumber.of(10),
          PdfNumber.of(20),
          PdfNumber.of(20),
        ]),
      });

      page.dict.set("Annots", new PdfArray([directAnnot]));

      const annotations = page.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0].ref).toBeNull();

      page.removeAnnotation(annotations[0]);

      expect(page.getAnnotations()).toHaveLength(0);
    });
  });

  describe("removeAnnotations()", () => {
    it("removes all annotations without filter", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      expect(page.getAnnotations()).toHaveLength(2);

      page.removeAnnotations();

      expect(page.getAnnotations()).toHaveLength(0);
    });

    it("removes only annotations of specified type", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addHighlightAnnotation({
        rect: { x: 100, y: 650, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      expect(page.getAnnotations()).toHaveLength(3);

      page.removeAnnotations({ type: "Highlight" });

      expect(page.getAnnotations()).toHaveLength(1);
      expect(page.getAnnotations()[0].type).toBe("Underline");
    });
  });

  describe("Annotation modification", () => {
    it("tracks modifications via setters", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      expect(highlight.isModified).toBe(false);

      highlight.setContents("New comment");

      expect(highlight.isModified).toBe(true);
      expect(highlight.contents).toBe("New comment");
    });

    it("allows changing color", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      highlight.setColor(rgb(0, 1, 0));

      const color = highlight.color;

      expect(color).toBeTruthy();
      expect(color?.type).toBe("RGB");

      if (color?.type === "RGB") {
        expect(color.red).toBe(0);
        expect(color.green).toBe(1);
        expect(color.blue).toBe(0);
      }
    });
  });

  describe("Save and reload", () => {
    it("preserves annotations after save and reload", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
        contents: "Test comment",
      });

      page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
      });

      // Save and reload
      const bytes = await pdf.save();
      const reloaded = await PDF.load(bytes);
      const reloadedPage = reloaded.getPage(0);

      expect(reloadedPage).toBeTruthy();

      const annotations = reloadedPage!.getAnnotations();

      expect(annotations).toHaveLength(2);

      const highlight = annotations.find(a => a.type === "Highlight");
      const link = annotations.find(a => a.type === "Link");

      expect(highlight).toBeTruthy();
      expect(highlight?.contents).toBe("Test comment");

      expect(link).toBeTruthy();
      expect((link as PDFLinkAnnotation).uri).toBe("https://example.com");
    });
  });

  describe("AnnotationFlags", () => {
    it("checks and sets flags correctly", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      // Default: Print flag is set
      expect(highlight.isPrintable).toBe(true);
      expect(highlight.isHidden).toBe(false);

      // Set hidden
      highlight.setHidden(true);

      expect(highlight.isHidden).toBe(true);

      // Clear hidden
      highlight.setHidden(false);

      expect(highlight.isHidden).toBe(false);
    });
  });

  describe("flattenAnnotations()", () => {
    it("flattens highlight annotation on page", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      expect(page.getAnnotations()).toHaveLength(1);

      const count = page.flattenAnnotations();

      expect(count).toBe(1);
      expect(page.getAnnotations()).toHaveLength(0);
    });

    it("flattens multiple annotations on page", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
        color: rgb(0, 0, 1),
      });

      page.addStrikeOutAnnotation({
        rect: { x: 100, y: 660, width: 200, height: 14 },
        color: rgb(1, 0, 0),
      });

      expect(page.getAnnotations()).toHaveLength(3);

      const count = page.flattenAnnotations();

      expect(count).toBe(3);
      expect(page.getAnnotations()).toHaveLength(0);
    });

    it("drops dangling /Annots refs during flatten", async () => {
      // Regression: /Annots entries whose target object doesn't exist were
      // skipped (`continue`) instead of removed. The dangling ref survived
      // into the full save, where renumbering left it pointing above /Size —
      // and a later incremental update (signing) reused that number,
      // invalidating signatures in Adobe.
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      // Inject a ref whose target is never defined.
      const annots = page.dict.get("Annots", ref => pdf.context.registry.resolve(ref));
      expect(annots).toBeInstanceOf(PdfArray);
      (annots as PdfArray).push(PdfRef.of(999, 0));

      const count = page.flattenAnnotations();
      expect(count).toBe(1);

      // The dangling ref must not survive in /Annots.
      const after = page.dict.get("Annots", ref => pdf.context.registry.resolve(ref));

      if (after instanceof PdfArray) {
        for (const item of after) {
          expect(item).not.toBe(PdfRef.of(999, 0));
        }
      }
    });

    it("drops dangling /Annots refs even when nothing is flattenable", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.dict.set("Annots", new PdfArray([PdfRef.of(999, 0)]));

      const count = page.flattenAnnotations();
      expect(count).toBe(0);

      const after = page.dict.get("Annots", ref => pdf.context.registry.resolve(ref));

      if (after instanceof PdfArray) {
        expect(after.length).toBe(0);
      }
    });

    it("preserves link annotations during flatten", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
      });

      expect(page.getAnnotations()).toHaveLength(2);

      const count = page.flattenAnnotations();

      // Link is non-flattenable, so only highlight is flattened
      expect(count).toBe(1);

      const remaining = page.getAnnotations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].type).toBe("Link");
    });

    it("excludes specified annotation types from flattening", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
        color: rgb(0, 0, 1),
      });

      expect(page.getAnnotations()).toHaveLength(2);

      const count = page.flattenAnnotations({ exclude: ["Underline"] });

      expect(count).toBe(1);

      const remaining = page.getAnnotations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].type).toBe("Underline");
    });

    it("adds content to page after flattening", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // Check page has no content initially
      const contentsBefore = page.dict.get("Contents");
      expect(contentsBefore).toBeUndefined();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.flattenAnnotations();

      // After flattening, page should have content
      const contentsAfter = page.dict.get("Contents");
      expect(contentsAfter).toBeTruthy();
    });

    it("adds XObject resources to page after flattening", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.flattenAnnotations();

      // After flattening, page should have XObject resources
      const resources = page.dict.getDict("Resources");
      expect(resources).toBeTruthy();

      const xObjects = resources?.getDict("XObject");
      expect(xObjects).toBeTruthy();
    });

    it("persists flattening through save/load", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      page.flattenAnnotations();

      // Save and reload
      const bytes = await pdf.save();
      const reloaded = await PDF.load(bytes);
      const reloadedPage = reloaded.getPage(0);

      expect(reloadedPage).toBeTruthy();

      // Annotations should remain empty
      expect(reloadedPage!.getAnnotations()).toHaveLength(0);

      // Page should have content (the flattened annotations)
      const contents = reloadedPage!.dict.get("Contents");
      expect(contents).toBeTruthy();
    });

    it("returns 0 for page with no annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const count = page.flattenAnnotations();

      expect(count).toBe(0);
    });

    it("removes hidden annotations without flattening them", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      // Hide the annotation
      highlight.setHidden(true);

      expect(page.getAnnotations()).toHaveLength(1);

      // Flatten should remove the hidden annotation but not count it as flattened
      const count = page.flattenAnnotations();

      // Hidden annotations are removed but not drawn, so count is 0
      expect(count).toBe(0);
      expect(page.getAnnotations()).toHaveLength(0);
    });
  });

  describe("pdf.flattenAnnotations()", () => {
    it("flattens annotations across all pages", async () => {
      const pdf = PDF.create();

      const page1 = pdf.addPage();
      page1.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      const page2 = pdf.addPage();
      page2.addUnderlineAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(0, 0, 1),
      });
      page2.addStrikeOutAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
        color: rgb(1, 0, 0),
      });

      // Total 3 annotations across 2 pages
      expect(page1.getAnnotations()).toHaveLength(1);
      expect(page2.getAnnotations()).toHaveLength(2);

      const count = pdf.flattenAnnotations();

      expect(count).toBe(3);

      // Check all pages have no annotations
      const reloadedPage1 = pdf.getPage(0);
      const reloadedPage2 = pdf.getPage(1);

      expect(reloadedPage1!.getAnnotations()).toHaveLength(0);
      expect(reloadedPage2!.getAnnotations()).toHaveLength(0);
    });

    it("excludes specified types across all pages", async () => {
      const pdf = PDF.create();

      const page1 = pdf.addPage();
      page1.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      const page2 = pdf.addPage();
      page2.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      const count = pdf.flattenAnnotations({ exclude: ["Highlight"] });

      expect(count).toBe(0);

      // Highlights should still exist
      expect(pdf.getPage(0)!.getAnnotations()).toHaveLength(1);
      expect(pdf.getPage(1)!.getAnnotations()).toHaveLength(1);
    });
  });
});
