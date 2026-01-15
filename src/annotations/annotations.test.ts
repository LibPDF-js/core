/**
 * Tests for PDF annotations.
 */

import { PDF } from "#src/api/pdf";
import { rgb } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { describe, expect, it } from "vitest";

import type { PDFLinkAnnotation } from "./link";
import type { PDFTextAnnotation } from "./text";
import type { PDFHighlightAnnotation } from "./text-markup";

describe("PDFAnnotations", () => {
  describe("getAnnotations()", () => {
    it("returns empty array for page with no annotations", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();
      const annotations = await page.getAnnotations();

      expect(annotations).toEqual([]);
    });

    it("returns annotations after adding them", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
      });

      const annotations = await page.getAnnotations();

      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe("Highlight");
    });

    it("caches annotations on repeated calls", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      const first = await page.getAnnotations();
      const second = await page.getAnnotations();

      expect(first).toBe(second); // Same array instance
    });
  });

  describe("Highlight annotations", () => {
    it("creates highlight annotation with rect", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
        opacity: 0.5,
        contents: "Test comment",
        title: "Test Author",
      }) as PDFHighlightAnnotation;

      expect(highlight.type).toBe("Highlight");
      expect(highlight.quadPoints).toHaveLength(1);
      expect(highlight.quadPoints[0]).toHaveLength(8);
      expect(highlight.contents).toBe("Test comment");
      expect(highlight.title).toBe("Test Author");
      expect(highlight.opacity).toBe(0.5);
    });

    it("creates highlight with multiple rects", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rects: [
          { x: 100, y: 700, width: 400, height: 14 },
          { x: 100, y: 680, width: 250, height: 14 },
        ],
        color: rgb(1, 1, 0),
      }) as PDFHighlightAnnotation;

      expect(highlight.quadPoints).toHaveLength(2);
    });

    it("creates highlight with raw quadPoints", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const quad = [100, 714, 300, 714, 100, 700, 300, 700];

      const highlight = page.addHighlightAnnotation({
        quadPoints: [quad],
        color: rgb(1, 1, 0),
      }) as PDFHighlightAnnotation;

      expect(highlight.quadPoints).toHaveLength(1);
      expect(highlight.quadPoints[0]).toEqual(quad);
    });

    it("getBounds() returns bounding box of quads", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      }) as PDFHighlightAnnotation;

      const bounds = highlight.getBounds();

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(700);
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(14);
    });
  });

  describe("Underline annotations", () => {
    it("creates underline annotation", async () => {
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const link = page.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        uri: "https://example.com",
      }) as PDFLinkAnnotation;

      expect(link.type).toBe("Link");
      expect(link.uri).toBe("https://example.com");
    });

    it("creates link annotation with internal destination", async () => {
      const pdf = await PDF.create();
      const page1 = pdf.addPage();
      const page2 = pdf.addPage();

      const link = page1.addLinkAnnotation({
        rect: { x: 100, y: 600, width: 200, height: 20 },
        destination: { page: page2, type: "Fit" },
      }) as PDFLinkAnnotation;

      expect(link.type).toBe("Link");
      expect(link.destination).toBeTruthy();
      expect(link.destination?.page).toEqual(page2.ref);
      expect(link.destination?.type).toBe("Fit");
    });

    it("creates link with border", async () => {
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const text = page.addTextAnnotation({
        rect: { x: 100, y: 500, width: 24, height: 24 },
        contents: "This is a comment",
        title: "Reviewer",
        color: rgb(1, 1, 0),
        icon: "Comment",
        open: true,
      }) as PDFTextAnnotation;

      expect(text.type).toBe("Text");
      expect(text.contents).toBe("This is a comment");
      expect(text.title).toBe("Reviewer");
      expect(text.icon).toBe("Comment");
      expect(text.isOpen).toBe(true);
    });

    it("defaults to Note icon", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const text = page.addTextAnnotation({
        rect: { x: 100, y: 500, width: 24, height: 24 },
      }) as PDFTextAnnotation;

      expect(text.icon).toBe("Note"); // Default
    });
  });

  describe("Line annotations", () => {
    it("creates line annotation", async () => {
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const stamp = page.addStampAnnotation({
        rect: { x: 400, y: 500, width: 150, height: 50 },
        name: "Approved",
      });

      expect(stamp.type).toBe("Stamp");
      expect(stamp.stampName).toBe("Approved");
    });

    it("defaults to Draft stamp", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const stamp = page.addStampAnnotation({
        rect: { x: 400, y: 500, width: 150, height: 50 },
      });

      expect(stamp.stampName).toBe("Draft");
    });
  });

  describe("Ink annotations", () => {
    it("creates ink annotation", async () => {
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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

      const highlights = await page.getHighlightAnnotations();
      const underlines = await page.getUnderlineAnnotations();
      const links = await page.getLinkAnnotations();

      expect(highlights).toHaveLength(1);
      expect(underlines).toHaveLength(1);
      expect(links).toHaveLength(1);
    });
  });

  describe("removeAnnotation()", () => {
    it("removes a specific annotation", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      const highlight = page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      expect(await page.getAnnotations()).toHaveLength(2);

      await page.removeAnnotation(highlight);

      expect(await page.getAnnotations()).toHaveLength(1);
      expect((await page.getAnnotations())[0].type).toBe("Underline");
    });

    it("removes a direct (non-ref) annotation dict entry", async () => {
      const pdf = await PDF.create();
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

      const annotations = await page.getAnnotations();
      expect(annotations).toHaveLength(1);
      expect(annotations[0].ref).toBeNull();

      await page.removeAnnotation(annotations[0]);

      expect(await page.getAnnotations()).toHaveLength(0);
    });
  });

  describe("removeAnnotations()", () => {
    it("removes all annotations without filter", async () => {
      const pdf = await PDF.create();
      const page = pdf.addPage();

      page.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
      });

      page.addUnderlineAnnotation({
        rect: { x: 100, y: 680, width: 200, height: 14 },
      });

      expect(await page.getAnnotations()).toHaveLength(2);

      await page.removeAnnotations();

      expect(await page.getAnnotations()).toHaveLength(0);
    });

    it("removes only annotations of specified type", async () => {
      const pdf = await PDF.create();
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

      expect(await page.getAnnotations()).toHaveLength(3);

      await page.removeAnnotations({ type: "Highlight" });

      expect(await page.getAnnotations()).toHaveLength(1);
      expect((await page.getAnnotations())[0].type).toBe("Underline");
    });
  });

  describe("Annotation modification", () => {
    it("tracks modifications via setters", async () => {
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const pdf = await PDF.create();
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
      const reloadedPage = await reloaded.getPage(0);

      expect(reloadedPage).toBeTruthy();

      const annotations = await reloadedPage!.getAnnotations();

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
      const pdf = await PDF.create();
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
});
