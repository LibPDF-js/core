/**
 * Integration tests for text extraction bounding boxes.
 *
 * These tests verify that extracted text positions are accurate by:
 * 1. Extracting text with character-level bounding boxes
 * 2. Drawing visual markers around extracted content
 * 3. Saving output PDFs for visual inspection
 *
 * Output PDFs are saved to test-output/text-bbox/ for manual verification.
 */

import { PDF, rgb } from "#src/index";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Text Extraction Bounding Boxes", () => {
  describe("Character-level highlighting", () => {
    it("highlights every character in rot0.pdf", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Draw a small rectangle around each character
      let charCount = 0;
      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            // Alternate colors for visibility
            const hue = (charCount * 30) % 360;
            const color = hslToRgb(hue, 0.7, 0.5);

            page!.drawRectangle({
              x: char.bbox.x,
              y: char.bbox.y,
              width: char.bbox.width,
              height: char.bbox.height,
              borderColor: rgb(color.r, color.g, color.b),
              borderWidth: 0.5,
              opacity: 0.8,
            });
            charCount++;
          }
        }
      }

      const outputPath = await saveTestOutput(
        "text-bbox/rot0-chars-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${charCount} characters)`);

      // Verify we extracted characters
      expect(charCount).toBeGreaterThan(0);

      // Verify all character boxes have positive dimensions
      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            expect(char.bbox.width).toBeGreaterThan(0);
            expect(char.bbox.height).toBeGreaterThan(0);
          }
        }
      }
    });

    it("highlights every character in proposal.pdf", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Draw rectangles with alternating colors per line
      let charCount = 0;
      for (let lineIdx = 0; lineIdx < pageText.lines.length; lineIdx++) {
        const line = pageText.lines[lineIdx];
        const lineColor = lineIdx % 2 === 0 ? rgb(0.2, 0.6, 0.9) : rgb(0.9, 0.4, 0.2);

        for (const span of line.spans) {
          for (const char of span.chars) {
            page!.drawRectangle({
              x: char.bbox.x,
              y: char.bbox.y,
              width: char.bbox.width,
              height: char.bbox.height,
              borderColor: lineColor,
              borderWidth: 0.3,
            });
            charCount++;
          }
        }
      }

      const outputPath = await saveTestOutput(
        "text-bbox/proposal-chars-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${charCount} characters)`);

      expect(charCount).toBeGreaterThan(100);
    });

    it("highlights characters in openoffice document", async () => {
      const bytes = await loadFixture("text", "openoffice-test-document.pdf");
      const pdf = await PDF.load(bytes);

      let totalChars = 0;
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const page = pdf.getPage(i);
        if (!page) {
          continue;
        }

        const pageText = page.extractText();

        for (const line of pageText.lines) {
          for (const span of line.spans) {
            for (const char of span.chars) {
              page.drawRectangle({
                x: char.bbox.x,
                y: char.bbox.y,
                width: char.bbox.width,
                height: char.bbox.height,
                borderColor: rgb(0.1, 0.5, 0.8),
                borderWidth: 0.3,
              });
              totalChars++;
            }
          }
        }
      }

      const outputPath = await saveTestOutput(
        "text-bbox/openoffice-chars-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${totalChars} characters across ${pageCount} pages)`);

      expect(totalChars).toBeGreaterThan(0);
    });
  });

  describe("Word-level highlighting", () => {
    it("highlights words in rot0.pdf", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      // Find all words using regex
      const matches = page!.findText(/\S+/g);

      // Draw rectangles around each word
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const hue = (i * 47) % 360;
        const color = hslToRgb(hue, 0.6, 0.5);

        page!.drawRectangle({
          x: match.bbox.x - 1,
          y: match.bbox.y - 1,
          width: match.bbox.width + 2,
          height: match.bbox.height + 2,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 1,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/rot0-words-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${matches.length} words)`);

      expect(matches.length).toBeGreaterThan(0);

      // Verify word bounding boxes encompass their characters
      for (const match of matches) {
        expect(match.bbox.width).toBeGreaterThan(0);
        expect(match.bbox.height).toBeGreaterThan(0);

        // Combined bbox should contain all character boxes
        if (match.charBoxes.length > 0) {
          const firstChar = match.charBoxes[0];
          const lastChar = match.charBoxes[match.charBoxes.length - 1];

          // Match bbox should start at or before first char
          expect(match.bbox.x).toBeLessThanOrEqual(firstChar.x + 0.1);
          // Match bbox should end at or after last char
          expect(match.bbox.x + match.bbox.width).toBeGreaterThanOrEqual(
            lastChar.x + lastChar.width - 0.1,
          );
        }
      }
    });

    it("highlights words in proposal.pdf", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const matches = page!.findText(/\S+/g);

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        // Use different colors for template tags vs regular words
        const isTemplate = match.text.includes("{{");
        const color = isTemplate ? rgb(0.9, 0.2, 0.2) : rgb(0.2, 0.7, 0.3);

        page!.drawRectangle({
          x: match.bbox.x - 1,
          y: match.bbox.y - 1,
          width: match.bbox.width + 2,
          height: match.bbox.height + 2,
          borderColor: color,
          borderWidth: isTemplate ? 2 : 0.5,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/proposal-words-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${matches.length} words)`);

      expect(matches.length).toBeGreaterThan(50);
    });
  });

  describe("Line-level highlighting", () => {
    it("highlights lines in rot0.pdf", async () => {
      const bytes = await loadFixture("text", "rot0.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Draw rectangles around each line
      for (let i = 0; i < pageText.lines.length; i++) {
        const line = pageText.lines[i];
        const hue = (i * 60) % 360;
        const color = hslToRgb(hue, 0.5, 0.6);

        // Draw filled background with low opacity
        page!.drawRectangle({
          x: line.bbox.x - 2,
          y: line.bbox.y - 2,
          width: line.bbox.width + 4,
          height: line.bbox.height + 4,
          color: rgb(color.r, color.g, color.b),
          opacity: 0.2,
        });

        // Draw border
        page!.drawRectangle({
          x: line.bbox.x - 2,
          y: line.bbox.y - 2,
          width: line.bbox.width + 4,
          height: line.bbox.height + 4,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 1,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/rot0-lines-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${pageText.lines.length} lines)`);

      expect(pageText.lines.length).toBeGreaterThan(0);

      // Verify line bounding boxes encompass their spans
      for (const line of pageText.lines) {
        expect(line.bbox.width).toBeGreaterThan(0);
        expect(line.bbox.height).toBeGreaterThan(0);

        // Line should contain all its spans
        for (const span of line.spans) {
          for (const char of span.chars) {
            // Character should be within line bounds (with small tolerance)
            expect(char.bbox.x).toBeGreaterThanOrEqual(line.bbox.x - 1);
            expect(char.bbox.y).toBeGreaterThanOrEqual(line.bbox.y - 1);
          }
        }
      }
    });

    it("highlights lines in proposal.pdf", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      for (let i = 0; i < pageText.lines.length; i++) {
        const line = pageText.lines[i];
        const color = i % 2 === 0 ? rgb(0.9, 0.8, 0.3) : rgb(0.3, 0.8, 0.9);

        page!.drawRectangle({
          x: line.bbox.x - 2,
          y: line.bbox.y - 1,
          width: line.bbox.width + 4,
          height: line.bbox.height + 2,
          color: color,
          opacity: 0.15,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/proposal-lines-highlighted.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath} (${pageText.lines.length} lines)`);

      expect(pageText.lines.length).toBeGreaterThan(10);
    });
  });

  describe("Character width accuracy", () => {
    it("characters have varying widths in proportional fonts", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Collect character widths
      const widthsByChar = new Map<string, number[]>();

      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            if (!widthsByChar.has(char.char)) {
              widthsByChar.set(char.char, []);
            }
            widthsByChar.get(char.char)!.push(char.bbox.width);
          }
        }
      }

      // In proportional fonts, different characters should have different widths
      // 'M' and 'W' should be wider than 'i' and 'l'
      const wideChars = ["M", "W", "m", "w"];
      const narrowChars = ["i", "l", "I", "|"];

      let wideAvg = 0;
      let wideCount = 0;
      let narrowAvg = 0;
      let narrowCount = 0;

      for (const [char, widths] of widthsByChar) {
        const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;

        if (wideChars.includes(char)) {
          wideAvg += avgWidth;
          wideCount++;
        } else if (narrowChars.includes(char)) {
          narrowAvg += avgWidth;
          narrowCount++;
        }
      }

      if (wideCount > 0 && narrowCount > 0) {
        wideAvg /= wideCount;
        narrowAvg /= narrowCount;

        // Wide characters should be significantly wider than narrow characters
        expect(wideAvg).toBeGreaterThan(narrowAvg * 1.3);
        console.log(
          `Wide chars avg: ${wideAvg.toFixed(2)}, Narrow chars avg: ${narrowAvg.toFixed(2)}`,
        );
      }
    });

    it("space characters have non-zero width", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      let spaceCount = 0;
      let totalSpaceWidth = 0;

      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            if (char.char === " ") {
              expect(char.bbox.width).toBeGreaterThan(0);
              totalSpaceWidth += char.bbox.width;
              spaceCount++;
            }
          }
        }
      }

      if (spaceCount > 0) {
        const avgSpaceWidth = totalSpaceWidth / spaceCount;
        console.log(`Average space width: ${avgSpaceWidth.toFixed(2)} (${spaceCount} spaces)`);
        expect(avgSpaceWidth).toBeGreaterThan(1);
      }
    });
  });

  describe("Y-flipped coordinate system (design tool exports)", () => {
    it("proposal.pdf highlights align with text despite flipped CTM", async () => {
      // proposal.pdf uses a Y-flipped coordinate system (1 0 0 -1 0 792 cm)
      // This test verifies our bounding boxes still align correctly
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      // Find specific known text
      const companyMatches = page!.findText("COMPANY_NAME");
      expect(companyMatches.length).toBeGreaterThan(0);

      const match = companyMatches[0];

      // Draw tight box around the found text
      page!.drawRectangle({
        x: match.bbox.x,
        y: match.bbox.y,
        width: match.bbox.width,
        height: match.bbox.height,
        borderColor: rgb(1, 0, 0),
        borderWidth: 2,
      });

      // Draw individual character boxes
      for (const charBox of match.charBoxes) {
        page!.drawRectangle({
          x: charBox.x,
          y: charBox.y,
          width: charBox.width,
          height: charBox.height,
          borderColor: rgb(0, 0, 1),
          borderWidth: 0.5,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/proposal-company-name-highlight.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath}`);

      // Verify the bounding box is reasonable
      // Y should be in upper portion of page (proposal has text near top)
      expect(match.bbox.y).toBeGreaterThan(600); // Near top of 792pt page

      // Width should be reasonable for "COMPANY_NAME" (~12 chars)
      expect(match.bbox.width).toBeGreaterThan(50);
      expect(match.bbox.width).toBeLessThan(200);
    });
  });

  describe("Combined visualization", () => {
    it("creates comprehensive highlight visualization", async () => {
      const bytes = await loadFixture("text", "proposal.pdf");
      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Layer 1: Line backgrounds (very light)
      for (let i = 0; i < pageText.lines.length; i++) {
        const line = pageText.lines[i];
        page!.drawRectangle({
          x: line.bbox.x - 2,
          y: line.bbox.y - 1,
          width: line.bbox.width + 4,
          height: line.bbox.height + 2,
          color: i % 2 === 0 ? rgb(1, 0.95, 0.8) : rgb(0.8, 0.95, 1),
          opacity: 0.3,
        });
      }

      // Layer 2: Character boxes
      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            page!.drawRectangle({
              x: char.bbox.x,
              y: char.bbox.y,
              width: char.bbox.width,
              height: char.bbox.height,
              borderColor: rgb(0.5, 0.5, 0.5),
              borderWidth: 0.2,
            });
          }
        }
      }

      // Layer 3: Template tag highlights
      const templateMatches = page!.findText(/\{\{[^}]+\}\}/g);
      for (const match of templateMatches) {
        page!.drawRectangle({
          x: match.bbox.x - 2,
          y: match.bbox.y - 2,
          width: match.bbox.width + 4,
          height: match.bbox.height + 4,
          borderColor: rgb(0.9, 0.2, 0.2),
          borderWidth: 2,
        });
      }

      const outputPath = await saveTestOutput(
        "text-bbox/proposal-combined-visualization.pdf",
        await pdf.save(),
      );
      console.log(`Saved: ${outputPath}`);
      console.log(
        `  - ${pageText.lines.length} lines, ${templateMatches.length} template tags highlighted`,
      );

      expect(pageText.lines.length).toBeGreaterThan(0);
      expect(templateMatches.length).toBe(5);
    });
  });
});

describe("Variety of PDF producers", () => {
  const varietyPdfs = [
    { file: "variety/helloworld.pdf", desc: "Simple Type1 font" },
    { file: "variety/hello-world.pdf", desc: "iText producer" },
    { file: "variety/standard_fonts.pdf", desc: "TCPDF with standard fonts" },
    { file: "variety/mixedfonts.pdf", desc: "TCPDF with mixed fonts" },
    { file: "variety/sample_fonts_solidconvertor.pdf", desc: "Solid Converter" },
    { file: "variety/pdf-lib-normal.pdf", desc: "pdf-lib produced" },
    { file: "variety/pdf-lib-standard-fonts.pdf", desc: "pdf-lib standard fonts" },
    { file: "variety/us_constitution.pdf", desc: "Multi-page document" },
    { file: "variety/complex_ttf_font.pdf", desc: "Complex TrueType" },
    { file: "variety/simpletype3font.pdf", desc: "Type3 font" },
    { file: "variety/BidiSample.pdf", desc: "Bidirectional text" },
    { file: "variety/ArabicCIDTrueType.pdf", desc: "Arabic CID TrueType" },
    { file: "variety/cid_cff.pdf", desc: "CID CFF font" },
    { file: "variety/font_ascent_descent.pdf", desc: "Font metrics test" },
    { file: "variety/arial_unicode_en_cidfont.pdf", desc: "Arial Unicode CID" },
    { file: "variety/AngledExample.pdf", desc: "Rotated text" },
  ];

  for (const { file, desc } of varietyPdfs) {
    it(`extracts text from ${desc} (${file})`, async () => {
      let bytes: Uint8Array;
      try {
        bytes = await loadFixture("text", file);
      } catch {
        // Skip if file doesn't exist
        return;
      }

      const pdf = await PDF.load(bytes);
      const page = pdf.getPage(0);
      expect(page).not.toBeNull();

      const pageText = page!.extractText();

      // Should extract some text (may be empty for some edge cases)
      expect(pageText).toBeDefined();
      expect(pageText.lines).toBeDefined();

      // Draw character boxes and save output
      let charCount = 0;
      for (const line of pageText.lines) {
        for (const span of line.spans) {
          for (const char of span.chars) {
            // Verify each char has valid bbox (width/height can be 0 for some fonts)
            expect(char.bbox.width).toBeGreaterThanOrEqual(0);
            expect(char.bbox.height).toBeGreaterThanOrEqual(0);

            // Only draw if bbox has size
            if (char.bbox.width > 0 && char.bbox.height > 0) {
              page!.drawRectangle({
                x: char.bbox.x,
                y: char.bbox.y,
                width: char.bbox.width,
                height: char.bbox.height,
                borderColor: rgb(0.2, 0.6, 0.9),
                borderWidth: 0.3,
              });
            }
            charCount++;
          }
        }
      }

      // Save highlighted output
      const outputFile = file.replace("variety/", "").replace(".pdf", "-highlighted.pdf");
      await saveTestOutput(`text-bbox/variety/${outputFile}`, await pdf.save());

      console.log(`${file}: ${pageText.lines.length} lines, ${charCount} chars`);
    });
  }
});

/**
 * Convert HSL to RGB values (0-1 range).
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tAdj = t;
      if (tAdj < 0) {
        tAdj += 1;
      }
      if (tAdj > 1) {
        tAdj -= 1;
      }
      if (tAdj < 1 / 6) {
        return p + (q - p) * 6 * tAdj;
      }
      if (tAdj < 1 / 2) {
        return q;
      }
      if (tAdj < 2 / 3) {
        return p + (q - p) * (2 / 3 - tAdj) * 6;
      }
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}
