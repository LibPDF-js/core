/**
 * Integration tests for PDF annotations with visual output.
 *
 * These tests create PDFs with various annotation types and save them
 * to test-output/annotations/ for manual inspection.
 */

import { PDF } from "#src/api/pdf";
import { rgb } from "#src/helpers/colors";
import { saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Annotations Integration", () => {
  describe("Text markup annotations", () => {
    it("creates highlight annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Draw some "text" rectangles to highlight
      page.drawRectangle({
        x: 72,
        y: 700,
        width: 400,
        height: 14,
        color: rgb(0.95, 0.95, 0.95),
      });

      page.drawRectangle({
        x: 72,
        y: 680,
        width: 300,
        height: 14,
        color: rgb(0.95, 0.95, 0.95),
      });

      // Yellow highlight
      page.addHighlightAnnotation({
        rect: { x: 72, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
        contents: "Yellow highlight",
      });

      // Green highlight
      page.addHighlightAnnotation({
        rect: { x: 280, y: 700, width: 192, height: 14 },
        color: rgb(0.5, 1, 0.5),
        contents: "Green highlight",
      });

      // Multi-line highlight
      page.addHighlightAnnotation({
        rects: [
          { x: 72, y: 680, width: 300, height: 14 },
          { x: 72, y: 660, width: 150, height: 14 },
        ],
        color: rgb(0.5, 0.8, 1),
        contents: "Multi-line highlight",
        title: "Test Author",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/highlights.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates underline annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Simulated text areas
      page.drawText("This text has an underline annotation", {
        x: 72,
        y: 700,
        size: 14,
      });

      page.addUnderlineAnnotation({
        rect: { x: 72, y: 700, width: 280, height: 14 },
        color: rgb(1, 0, 0),
        contents: "Red underline",
      });

      page.drawText("This text has a blue underline", {
        x: 72,
        y: 670,
        size: 14,
      });

      page.addUnderlineAnnotation({
        rect: { x: 72, y: 670, width: 220, height: 14 },
        color: rgb(0, 0, 1),
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/underlines.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates strikeout annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      page.drawText("This text is struck out", {
        x: 72,
        y: 700,
        size: 14,
      });

      page.addStrikeOutAnnotation({
        rect: { x: 72, y: 700, width: 170, height: 14 },
        color: rgb(1, 0, 0),
        contents: "Deleted text",
      });

      page.drawText("Another strikeout example", {
        x: 72,
        y: 670,
        size: 14,
      });

      page.addStrikeOutAnnotation({
        rect: { x: 72, y: 670, width: 185, height: 14 },
        color: rgb(0.5, 0.5, 0.5),
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/strikeouts.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates squiggly annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      page.drawText("This text has a squiggly underline (spelling error?)", {
        x: 72,
        y: 700,
        size: 14,
      });

      page.addSquigglyAnnotation({
        rect: { x: 72, y: 700, width: 380, height: 14 },
        color: rgb(1, 0, 0),
        contents: "Possible spelling error",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/squiggly.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Link annotations", () => {
    it("creates external link annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      page.drawText("Click here to visit Example.com", {
        x: 72,
        y: 700,
        size: 14,
        color: rgb(0, 0, 0.8),
      });

      page.addLinkAnnotation({
        rect: { x: 72, y: 698, width: 230, height: 16 },
        uri: "https://example.com",
        borderColor: rgb(0, 0, 1),
        borderWidth: 1,
      });

      page.drawText("Visit GitHub", {
        x: 72,
        y: 660,
        size: 14,
        color: rgb(0, 0, 0.8),
      });

      page.addLinkAnnotation({
        rect: { x: 72, y: 658, width: 90, height: 16 },
        uri: "https://github.com",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/links-external.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates internal link annotations", async () => {
      const pdf = PDF.create();
      const page1 = pdf.addPage({ width: 612, height: 792 });
      const page2 = pdf.addPage({ width: 612, height: 792 });

      page1.drawText("Page 1 - Click to go to Page 2", {
        x: 72,
        y: 700,
        size: 14,
      });

      page1.addLinkAnnotation({
        rect: { x: 72, y: 698, width: 220, height: 16 },
        destination: { page: page2, type: "Fit" },
        borderColor: rgb(0, 0.5, 0),
        borderWidth: 1,
      });

      page2.drawText("Page 2 - Click to go back to Page 1", {
        x: 72,
        y: 700,
        size: 14,
      });

      page2.addLinkAnnotation({
        rect: { x: 72, y: 698, width: 250, height: 16 },
        destination: { page: page1, type: "FitH", top: 792 },
        borderColor: rgb(0, 0.5, 0),
        borderWidth: 1,
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/links-internal.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Text annotations (sticky notes)", () => {
    it("creates text annotations with different icons", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      const icons = [
        "Comment",
        "Key",
        "Note",
        "Help",
        "NewParagraph",
        "Paragraph",
        "Insert",
      ] as const;
      let y = 750;

      for (const icon of icons) {
        page.drawText(`${icon} icon:`, { x: 72, y, size: 12 });

        page.addTextAnnotation({
          rect: { x: 180, y: y - 4, width: 24, height: 24 },
          icon,
          contents: `This is a ${icon} annotation`,
          title: "Author",
          color: rgb(1, 1, 0.7),
        });

        y -= 40;
      }

      const bytes = await pdf.save();
      await saveTestOutput("annotations/sticky-notes.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates open text annotation", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      page.drawText("This note should appear open by default:", { x: 72, y: 700, size: 12 });

      page.addTextAnnotation({
        rect: { x: 300, y: 696, width: 24, height: 24 },
        contents: "This popup should be visible immediately when you open the PDF.",
        title: "Visible Note",
        color: rgb(1, 0.8, 0.8),
        open: true,
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/sticky-note-open.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Shape annotations", () => {
    it("creates line annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Simple line
      page.addLineAnnotation({
        start: { x: 72, y: 700 },
        end: { x: 300, y: 700 },
        color: rgb(0, 0, 0),
        width: 2,
        contents: "Simple line",
      });

      // Line with arrow
      page.addLineAnnotation({
        start: { x: 72, y: 650 },
        end: { x: 300, y: 650 },
        color: rgb(1, 0, 0),
        width: 2,
        endStyle: "OpenArrow",
        contents: "Arrow line",
      });

      // Line with double arrows
      page.addLineAnnotation({
        start: { x: 72, y: 600 },
        end: { x: 300, y: 600 },
        color: rgb(0, 0, 1),
        width: 2,
        startStyle: "ClosedArrow",
        endStyle: "ClosedArrow",
        interiorColor: rgb(0, 0, 1),
        contents: "Double arrow",
      });

      // Diagonal line
      page.addLineAnnotation({
        start: { x: 350, y: 700 },
        end: { x: 540, y: 600 },
        color: rgb(0, 0.5, 0),
        width: 3,
        endStyle: "Diamond",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/lines.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates square annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Stroke only
      page.addSquareAnnotation({
        rect: { x: 72, y: 650, width: 100, height: 80 },
        color: rgb(0, 0, 0),
        borderWidth: 2,
        contents: "Stroke only",
      });

      // Filled
      page.addSquareAnnotation({
        rect: { x: 200, y: 650, width: 100, height: 80 },
        color: rgb(0, 0, 1),
        fillColor: rgb(0.8, 0.8, 1),
        borderWidth: 2,
        contents: "Filled rectangle",
      });

      // Fill only (no stroke visible)
      page.addSquareAnnotation({
        rect: { x: 330, y: 650, width: 100, height: 80 },
        color: rgb(0, 0.5, 0),
        fillColor: rgb(0.8, 1, 0.8),
        borderWidth: 0,
        contents: "Fill only",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/squares.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });

    it("creates circle annotations", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Stroke only
      page.addCircleAnnotation({
        rect: { x: 72, y: 650, width: 100, height: 100 },
        color: rgb(1, 0, 0),
        borderWidth: 2,
        contents: "Red circle",
      });

      // Filled ellipse
      page.addCircleAnnotation({
        rect: { x: 200, y: 650, width: 150, height: 100 },
        color: rgb(0, 0, 1),
        fillColor: rgb(0.9, 0.9, 1),
        borderWidth: 3,
        contents: "Blue ellipse",
      });

      // Small filled circle
      page.addCircleAnnotation({
        rect: { x: 380, y: 680, width: 40, height: 40 },
        color: rgb(0, 0.6, 0),
        fillColor: rgb(0, 0.8, 0),
        borderWidth: 1,
        contents: "Green dot",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/circles.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Stamp annotations", () => {
    it("creates stamp annotations with standard names", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      const stamps = [
        "Approved",
        "NotApproved",
        "Draft",
        "Final",
        "Confidential",
        "ForComment",
        "TopSecret",
        "Expired",
      ] as const;

      let x = 72;
      let y = 720;

      for (const name of stamps) {
        page.addStampAnnotation({
          rect: { x, y, width: 120, height: 40 },
          name,
          contents: `${name} stamp`,
        });

        x += 140;
        if (x > 450) {
          x = 72;
          y -= 60;
        }
      }

      const bytes = await pdf.save();
      await saveTestOutput("annotations/stamps.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Ink annotations", () => {
    it("creates ink annotations (freehand drawing)", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Simple squiggle
      page.addInkAnnotation({
        paths: [
          [
            { x: 72, y: 700 },
            { x: 100, y: 720 },
            { x: 130, y: 690 },
            { x: 160, y: 710 },
            { x: 190, y: 695 },
            { x: 220, y: 715 },
          ],
        ],
        color: rgb(0, 0, 0),
        width: 2,
        contents: "Squiggle",
      });

      // Multiple strokes (like a checkmark)
      page.addInkAnnotation({
        paths: [
          [
            { x: 300, y: 700 },
            { x: 320, y: 680 },
            { x: 380, y: 740 },
          ],
        ],
        color: rgb(0, 0.6, 0),
        width: 4,
        contents: "Checkmark",
      });

      // Circle-ish shape
      const circlePoints: { x: number; y: number }[] = [];
      for (let angle = 0; angle <= 360; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        circlePoints.push({
          x: 150 + Math.cos(rad) * 50,
          y: 580 + Math.sin(rad) * 50,
        });
      }

      page.addInkAnnotation({
        paths: [circlePoints],
        color: rgb(1, 0, 0),
        width: 3,
        contents: "Hand-drawn circle",
      });

      // Multiple separate strokes
      page.addInkAnnotation({
        paths: [
          [
            { x: 350, y: 600 },
            { x: 350, y: 560 },
          ],
          [
            { x: 330, y: 580 },
            { x: 370, y: 580 },
          ],
        ],
        color: rgb(0, 0, 1),
        width: 3,
        contents: "Plus sign",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/ink.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Combined annotations", () => {
    it("creates a page with multiple annotation types", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ width: 612, height: 792 });

      // Title
      page.drawText("Annotation Showcase", { x: 72, y: 750, size: 24 });

      // Highlighted text
      page.drawText("This text is highlighted in yellow.", { x: 72, y: 700, size: 12 });
      page.addHighlightAnnotation({
        rect: { x: 72, y: 698, width: 210, height: 14 },
        color: rgb(1, 1, 0),
      });

      // Underlined text with link
      page.drawText("Click here for more info", { x: 72, y: 670, size: 12, color: rgb(0, 0, 0.8) });
      page.addUnderlineAnnotation({
        rect: { x: 72, y: 668, width: 145, height: 14 },
        color: rgb(0, 0, 0.8),
      });
      page.addLinkAnnotation({
        rect: { x: 72, y: 668, width: 145, height: 14 },
        uri: "https://example.com/info",
      });

      // Sticky note
      page.addTextAnnotation({
        rect: { x: 500, y: 700, width: 24, height: 24 },
        icon: "Note",
        contents: "Remember to review this section",
        title: "Reviewer",
        color: rgb(1, 1, 0.7),
      });

      // Shape annotations
      page.addSquareAnnotation({
        rect: { x: 72, y: 500, width: 150, height: 100 },
        color: rgb(0, 0, 0),
        fillColor: rgb(0.95, 0.95, 0.95),
        borderWidth: 1,
        contents: "Important area",
      });

      page.addCircleAnnotation({
        rect: { x: 250, y: 510, width: 80, height: 80 },
        color: rgb(1, 0, 0),
        borderWidth: 2,
        contents: "Attention!",
      });

      // Arrow pointing to circle
      page.addLineAnnotation({
        start: { x: 350, y: 550 },
        end: { x: 330, y: 550 },
        color: rgb(1, 0, 0),
        width: 2,
        endStyle: "OpenArrow",
      });

      // Stamp
      page.addStampAnnotation({
        rect: { x: 400, y: 500, width: 120, height: 40 },
        name: "Draft",
        contents: "Document is in draft state",
      });

      // Freehand annotation
      page.addInkAnnotation({
        paths: [
          [
            { x: 72, y: 420 },
            { x: 90, y: 440 },
            { x: 110, y: 410 },
            { x: 130, y: 430 },
            { x: 150, y: 415 },
          ],
        ],
        color: rgb(0, 0.5, 0),
        width: 2,
        contents: "Hand-drawn emphasis",
      });

      const bytes = await pdf.save();
      await saveTestOutput("annotations/combined.pdf", bytes);

      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("Annotation persistence", () => {
    it("preserves annotations after save and reload", async () => {
      // Create PDF with annotations
      const pdf1 = PDF.create();
      const page1 = pdf1.addPage();

      page1.addHighlightAnnotation({
        rect: { x: 100, y: 700, width: 200, height: 14 },
        color: rgb(1, 1, 0),
        contents: "Persistent highlight",
      });

      page1.addTextAnnotation({
        rect: { x: 350, y: 700, width: 24, height: 24 },
        contents: "Persistent note",
        icon: "Note",
      });

      page1.addLinkAnnotation({
        rect: { x: 100, y: 650, width: 150, height: 14 },
        uri: "https://example.com",
      });

      // Save
      const bytes = await pdf1.save();
      await saveTestOutput("annotations/persistence-test.pdf", bytes);

      // Reload and verify
      const pdf2 = await PDF.load(bytes);
      const page2 = pdf2.getPage(0);
      const annotations = page2!.getAnnotations();

      expect(annotations).toHaveLength(3);

      const highlight = annotations.find((a: { type: string }) => a.type === "Highlight");
      const note = annotations.find((a: { type: string }) => a.type === "Text");
      const link = annotations.find((a: { type: string }) => a.type === "Link");

      expect(highlight).toBeDefined();
      expect(highlight?.contents).toBe("Persistent highlight");

      expect(note).toBeDefined();
      expect(note?.contents).toBe("Persistent note");

      expect(link).toBeDefined();
    });
  });
});
