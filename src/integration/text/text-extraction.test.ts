import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Text Extraction Integration", () => {
  describe("extractText", () => {
    it("extracts text from simple PDF", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      expect(pageText.pageIndex).toBe(0);
      expect(pageText.text.length).toBeGreaterThan(0);
      expect(pageText.lines.length).toBeGreaterThan(0);
    });

    it("extracts text from yaddatest PDF", async () => {
      const bytes = await loadFixture("text", "yaddatest.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      expect(pageText.text.length).toBeGreaterThan(0);
      // The file should contain some text
      expect(pageText.lines.length).toBeGreaterThan(0);
    });

    it("extracts text from OpenOffice test document", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);
      const pageCount = pdf.getPageCount();

      expect(pageCount).toBeGreaterThan(0);

      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      expect(pageText.text.length).toBeGreaterThan(0);
    });

    it("includes line structure", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      // Check that we have structured data
      expect(pageText.lines).toBeDefined();

      for (const line of pageText.lines) {
        expect(line.text).toBeDefined();
        expect(line.bbox).toBeDefined();
        expect(line.spans).toBeDefined();
        expect(line.spans.length).toBeGreaterThan(0);

        for (const span of line.spans) {
          expect(span.text).toBeDefined();
          expect(span.chars).toBeDefined();
          expect(span.fontSize).toBeGreaterThan(0);
          expect(span.fontName).toBeDefined();
        }
      }
    });
  });

  describe("document-wide extractText", () => {
    it("extracts text from all pages", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);
      const pageCount = pdf.getPageCount();

      const allText = pdf.extractText();

      expect(allText).toHaveLength(pageCount);

      for (let i = 0; i < pageCount; i++) {
        expect(allText[i].pageIndex).toBe(i);
      }
    });
  });

  describe("findText", () => {
    it("finds string in page", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      // First extract text to see what's in the PDF
      const pageText = page!.extractText();

      // Use the first few characters of the text as search query
      if (pageText.text.length >= 3) {
        const searchTerm = pageText.text.substring(0, 3);
        const matches = page!.findText(searchTerm);

        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0].text).toBe(searchTerm);
        expect(matches[0].pageIndex).toBe(0);
        expect(matches[0].bbox).toBeDefined();
        expect(matches[0].charBoxes.length).toBe(3);
      }
    });

    it("returns empty array when text not found", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      const matches = page!.findText("xyz123nonexistent");

      expect(matches).toHaveLength(0);
    });

    it("finds regex patterns", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      // Search for any word characters
      const matches = page!.findText(/\w+/g);

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("document-wide findText", () => {
    it("searches across all pages", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);

      // First extract to see what text exists
      const allText = pdf.extractText();
      const combinedText = allText.map(p => p.text).join(" ");

      // Find a word that appears in the document
      const wordMatch = combinedText.match(/\w{4,}/);

      if (wordMatch) {
        const searchTerm = wordMatch[0];
        const matches = pdf.findText(searchTerm);

        expect(matches.length).toBeGreaterThan(0);
      }
    });

    it("respects page filter", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);

      if (pdf.getPageCount() > 1) {
        // Search only first page
        const matches = pdf.findText(/\w+/, { pages: [0] });

        // All matches should be from page 0
        for (const match of matches) {
          expect(match.pageIndex).toBe(0);
        }
      }
    });
  });

  describe("template tag extraction (proposal.pdf)", () => {
    it("extracts all template tags from proposal document", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      // Search for template tags with {{ ... }} pattern
      const matches = page!.findText(/\{\{[^}]+\}\}/g);

      // Should find exactly 5 template tags
      expect(matches).toHaveLength(5);

      // Check the expected template tags
      const tagTexts = matches.map(m => m.text);
      expect(tagTexts).toContain("{{ COMPANY_NAME|type:text|label:Company Name }}");
      expect(tagTexts).toContain("{{ STREET }}");
      expect(tagTexts).toContain("{{ CITY }}");
      expect(tagTexts).toContain("{{ PHONE }}");
      expect(tagTexts).toContain("{{ DATE|type:date }}");
    });

    it("provides accurate bounding boxes for template tags", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);

      const matches = page!.findText(/\{\{[^}]+\}\}/g);

      for (const match of matches) {
        // Bounding box should be valid
        expect(match.bbox.x).toBeGreaterThan(0);
        expect(match.bbox.y).toBeGreaterThan(0);
        expect(match.bbox.width).toBeGreaterThan(0);
        expect(match.bbox.height).toBeGreaterThan(0);

        // Character boxes should match character count
        // Account for special chars that may be multi-byte
        expect(match.charBoxes.length).toBeGreaterThan(0);
      }
    });

    it("can extract full page text from proposal", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      // Check for expected content
      expect(pageText.text).toContain("OVERVIEW");
      expect(pageText.text).toContain("GOALS");
      expect(pageText.text).toContain("SPECIFICATIONS");
      expect(pageText.text).toContain("MILESTONES");
      expect(pageText.text).toContain("Lorem ipsum");
    });
  });

  describe("bounding boxes", () => {
    it("provides valid bounding boxes", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      // Check line bounding boxes
      for (const line of pageText.lines) {
        expect(line.bbox.x).toBeGreaterThanOrEqual(0);
        expect(line.bbox.y).toBeGreaterThanOrEqual(0);
        expect(line.bbox.width).toBeGreaterThan(0);
        expect(line.bbox.height).toBeGreaterThan(0);
      }
    });

    it("provides character boxes for search matches", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      if (pageText.text.length >= 3) {
        const searchTerm = pageText.text.substring(0, 3);
        const matches = page!.findText(searchTerm);

        if (matches.length > 0) {
          const match = matches[0];

          // charBoxes should have one box per character
          expect(match.charBoxes.length).toBe(searchTerm.length);

          // Each character box should be valid
          for (const box of match.charBoxes) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
      }
    });

    it("extracts correct positions for OpenOffice TrueType text", async () => {
      // This test verifies that extracted positions match the content stream
      // The content stream has explicit positions:
      // - Td 56.8 774.5 for first char
      // - Tm 1 0 0 1 64 774.5 for second/third chars
      // - Tm 1 0 0 1 74.1 774.5 for fourth char
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      const pageText = page!.extractText();

      expect(pageText.lines.length).toBe(1);
      expect(pageText.lines[0].text).toBe("Test");

      const chars = pageText.lines[0].spans[0].chars;
      expect(chars.length).toBe(4);

      // Verify X positions match content stream
      expect(chars[0].char).toBe("T");
      expect(chars[0].bbox.x).toBeCloseTo(56.8, 1);

      expect(chars[1].char).toBe("e");
      expect(chars[1].bbox.x).toBeCloseTo(64.0, 1);

      expect(chars[2].char).toBe("s");
      // After 'e' (width 443), position advances by 443/1000*12 = 5.316
      expect(chars[2].bbox.x).toBeCloseTo(69.32, 1);

      expect(chars[3].char).toBe("t");
      expect(chars[3].bbox.x).toBeCloseTo(74.1, 1);

      // Verify baseline matches content stream (y=774.5)
      expect(chars[0].baseline).toBeCloseTo(774.5, 1);

      // Verify widths are calculated from the /W array
      // T=610, e=443, s=389, t=277 (in 1000ths of em)
      // At 12pt: T=7.32, e=5.316, s=4.668, t=3.324
      expect(chars[0].bbox.width).toBeCloseTo(7.32, 1);
      expect(chars[1].bbox.width).toBeCloseTo(5.32, 1);
      expect(chars[2].bbox.width).toBeCloseTo(4.67, 1);
      expect(chars[3].bbox.width).toBeCloseTo(3.32, 1);
    });
  });
});
