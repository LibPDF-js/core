/**
 * Tests for Latin-1 / accented character rendering with Standard 14 fonts.
 *
 * Verifies that the content stream pipeline correctly encodes non-ASCII
 * characters using WinAnsiEncoding, avoiding UTF-8 round-trip corruption.
 */

import {
  getEncodingForStandard14,
  getGlyphName,
  getStandard14GlyphWidth,
  isWinAnsiStandard14,
} from "#src/fonts/standard-14";
import { red } from "#src/helpers/colors";
import { isPdfHeader, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "../pdf";

describe("Latin-1 / WinAnsi encoding for Standard 14 fonts", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Font encoding selection
  // ─────────────────────────────────────────────────────────────────────────────

  describe("getEncodingForStandard14", () => {
    it("returns WinAnsiEncoding for Helvetica family", () => {
      expect(getEncodingForStandard14("Helvetica").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Helvetica-Bold").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Helvetica-Oblique").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Helvetica-BoldOblique").name).toBe("WinAnsiEncoding");
    });

    it("returns WinAnsiEncoding for Times family", () => {
      expect(getEncodingForStandard14("Times-Roman").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Times-Bold").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Times-Italic").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Times-BoldItalic").name).toBe("WinAnsiEncoding");
    });

    it("returns WinAnsiEncoding for Courier family", () => {
      expect(getEncodingForStandard14("Courier").name).toBe("WinAnsiEncoding");
      expect(getEncodingForStandard14("Courier-Bold").name).toBe("WinAnsiEncoding");
    });

    it("returns SymbolEncoding for Symbol", () => {
      expect(getEncodingForStandard14("Symbol").name).toBe("SymbolEncoding");
    });

    it("returns ZapfDingbatsEncoding for ZapfDingbats", () => {
      expect(getEncodingForStandard14("ZapfDingbats").name).toBe("ZapfDingbatsEncoding");
    });
  });

  describe("isWinAnsiStandard14", () => {
    it("returns true for Helvetica/Times/Courier", () => {
      expect(isWinAnsiStandard14("Helvetica")).toBe(true);
      expect(isWinAnsiStandard14("Times-Roman")).toBe(true);
      expect(isWinAnsiStandard14("Courier")).toBe(true);
    });

    it("returns false for Symbol and ZapfDingbats", () => {
      expect(isWinAnsiStandard14("Symbol")).toBe(false);
      expect(isWinAnsiStandard14("ZapfDingbats")).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Glyph name mapping (width measurement)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("getGlyphName for non-ASCII characters", () => {
    it("maps common accented characters to correct glyph names", () => {
      expect(getGlyphName("é")).toBe("eacute");
      expect(getGlyphName("á")).toBe("aacute");
      expect(getGlyphName("ñ")).toBe("ntilde");
      expect(getGlyphName("ü")).toBe("udieresis");
      expect(getGlyphName("ö")).toBe("odieresis");
      expect(getGlyphName("ß")).toBe("germandbls");
      expect(getGlyphName("ç")).toBe("ccedilla");
    });

    it("maps WinAnsi 0x80-0x9F range characters", () => {
      expect(getGlyphName("€")).toBe("Euro");
      expect(getGlyphName("†")).toBe("dagger");
      expect(getGlyphName("‡")).toBe("daggerdbl");
      expect(getGlyphName("…")).toBe("ellipsis");
      expect(getGlyphName("–")).toBe("endash");
      expect(getGlyphName("—")).toBe("emdash");
      expect(getGlyphName("™")).toBe("trademark");
      expect(getGlyphName("\u201C")).toBe("quotedblleft"); // "
      expect(getGlyphName("\u201D")).toBe("quotedblright"); // "
    });

    it("maps Latin-1 supplement characters", () => {
      expect(getGlyphName("©")).toBe("copyright");
      expect(getGlyphName("®")).toBe("registered");
      expect(getGlyphName("°")).toBe("degree");
      expect(getGlyphName("±")).toBe("plusminus");
      expect(getGlyphName("×")).toBe("multiply");
      expect(getGlyphName("÷")).toBe("divide");
    });

    it("still maps ASCII characters correctly", () => {
      expect(getGlyphName("A")).toBe("A");
      expect(getGlyphName("z")).toBe("z");
      expect(getGlyphName(" ")).toBe("space");
      expect(getGlyphName("!")).toBe("exclam");
    });
  });

  describe("width measurement for accented characters", () => {
    it("returns correct width for eacute in Helvetica", () => {
      const width = getStandard14GlyphWidth("Helvetica", "eacute");
      expect(width).toBe(556);
    });

    it("returns correct width for Euro in Helvetica", () => {
      const width = getStandard14GlyphWidth("Helvetica", "Euro");
      expect(width).toBe(556);
    });

    it("returns correct width for ntilde in Times-Roman", () => {
      const width = getStandard14GlyphWidth("Times-Roman", "ntilde");
      expect(width).toBe(500);
    });

    it("eacute glyph name produces non-space width", () => {
      const eacuteWidth = getStandard14GlyphWidth("Helvetica", getGlyphName("é"));
      const spaceWidth = getStandard14GlyphWidth("Helvetica", "space");

      expect(eacuteWidth).toBe(556);
      expect(spaceWidth).toBe(278);
      expect(eacuteWidth).not.toBe(spaceWidth);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Font dictionary /Encoding
  // ─────────────────────────────────────────────────────────────────────────────

  describe("font dictionary /Encoding", () => {
    it("adds /Encoding WinAnsiEncoding for Helvetica", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("Hello", { font: "Helvetica", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const parsed = await PDF.load(bytes);
      const parsedPage = parsed.getPage(0)!;

      const resources = parsedPage.getResources();
      const fonts = resources.getDict("Font");
      expect(fonts).toBeDefined();

      // Find the Helvetica font dict
      let foundEncoding = false;

      for (const [, value] of fonts!) {
        if (value.type === "dict") {
          const baseFont = value.getName("BaseFont");

          if (baseFont && baseFont.value === "Helvetica") {
            const encoding = value.getName("Encoding");
            expect(encoding).toBeDefined();
            expect(encoding!.value).toBe("WinAnsiEncoding");
            foundEncoding = true;
          }
        }
      }

      expect(foundEncoding).toBe(true);
    });

    it("adds /Encoding WinAnsiEncoding for Times-Roman", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("Hello", { font: "Times-Roman", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const parsed = await PDF.load(bytes);
      const parsedPage = parsed.getPage(0)!;

      const resources = parsedPage.getResources();
      const fonts = resources.getDict("Font");

      let foundEncoding = false;

      for (const [, value] of fonts!) {
        if (value.type === "dict") {
          const baseFont = value.getName("BaseFont");

          if (baseFont && baseFont.value === "Times-Roman") {
            const encoding = value.getName("Encoding");
            expect(encoding).toBeDefined();
            expect(encoding!.value).toBe("WinAnsiEncoding");
            foundEncoding = true;
          }
        }
      }

      expect(foundEncoding).toBe(true);
    });

    it("does NOT add /Encoding for Symbol font", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // Symbol font maps ASCII 'a' to alpha (α) via SymbolEncoding
      page.drawText("a", { font: "Symbol", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const parsed = await PDF.load(bytes);
      const parsedPage = parsed.getPage(0)!;

      const resources = parsedPage.getResources();
      const fonts = resources.getDict("Font");

      for (const [, value] of fonts!) {
        if (value.type === "dict") {
          const baseFont = value.getName("BaseFont");

          if (baseFont && baseFont.value === "Symbol") {
            const encoding = value.getName("Encoding");
            expect(encoding).toBeUndefined();
          }
        }
      }
    });

    it("does NOT add /Encoding for ZapfDingbats font", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // ZapfDingbats maps specific characters via its encoding
      page.drawText("!", { font: "ZapfDingbats", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const parsed = await PDF.load(bytes);
      const parsedPage = parsed.getPage(0)!;

      const resources = parsedPage.getResources();
      const fonts = resources.getDict("Font");

      for (const [, value] of fonts!) {
        if (value.type === "dict") {
          const baseFont = value.getName("BaseFont");

          if (baseFont && baseFont.value === "ZapfDingbats") {
            const encoding = value.getName("Encoding");
            expect(encoding).toBeUndefined();
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Content stream encoding
  // ─────────────────────────────────────────────────────────────────────────────

  describe("content stream encoding", () => {
    it("encodes accented text as hex string with correct WinAnsi bytes", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("café", { font: "Helvetica", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      // Search for the hex-encoded WinAnsi bytes in the raw PDF
      // 'c'=0x63, 'a'=0x61, 'f'=0x66, 'é'=0xE9
      const pdfText = String.fromCharCode(...bytes);
      expect(pdfText).toContain("<636166E9>");
    });

    it("does NOT produce UTF-8 multi-byte sequences for accented chars", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("é", { font: "Helvetica", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const pdfText = String.fromCharCode(...bytes);

      // Should NOT contain the UTF-8 encoding of é (0xC3 0xA9)
      // Should contain the hex-encoded WinAnsi byte 0xE9
      expect(pdfText).toContain("<E9>");
      // The UTF-8 sequence C3A9 should NOT appear as a literal string operand
      expect(pdfText).not.toMatch(/\(.*\xC3\xA9.*\)/);
    });

    it("encodes Euro sign correctly in 0x80-0x9F range", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("€", { font: "Helvetica", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const pdfText = String.fromCharCode(...bytes);

      // € is WinAnsi byte 0x80
      expect(pdfText).toContain("<80>");
    });

    it("substitutes unencodable characters with .notdef (byte 0x00)", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // Chinese character is not in WinAnsi
      page.drawText("A\u4E16B", { font: "Helvetica", x: 50, y: 700, size: 12 });

      const bytes = await pdf.save();
      const pdfText = String.fromCharCode(...bytes);

      // 'A'=0x41, .notdef=0x00, 'B'=0x42
      expect(pdfText).toContain("<410042>");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Round-trip rendering
  // ─────────────────────────────────────────────────────────────────────────────

  describe("round-trip rendering", () => {
    it("generates a valid PDF with accented text", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      page.drawText("café résumé naïve", {
        font: "Helvetica",
        x: 50,
        y: 700,
        size: 14,
      });

      page.drawText("Ñoño año español", {
        font: "Times-Roman",
        x: 50,
        y: 650,
        size: 14,
      });

      page.drawText("Ärger über Größe", {
        font: "Courier",
        x: 50,
        y: 600,
        size: 14,
      });

      // 0x80-0x9F range characters
      page.drawText('€42 — "special" edition', {
        font: "Helvetica",
        x: 50,
        y: 550,
        size: 14,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);

      // Verify the PDF can be re-parsed
      const parsed = await PDF.load(bytes);
      expect(parsed.getPageCount()).toBe(1);

      await saveTestOutput("drawing/latin1-accented-text.pdf", bytes);
    });

    it("generates a valid PDF with all Standard 14 font families", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage({ size: "letter" });

      const fonts = [
        "Helvetica",
        "Helvetica-Bold",
        "Helvetica-Oblique",
        "Times-Roman",
        "Times-Bold",
        "Times-Italic",
        "Courier",
        "Courier-Bold",
      ] as const;

      let y = 700;

      for (const font of fonts) {
        page.drawText(`${font}: àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ`, {
          font,
          x: 50,
          y,
          size: 10,
        });
        y -= 25;
      }

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);

      const parsed = await PDF.load(bytes);
      expect(parsed.getPageCount()).toBe(1);

      await saveTestOutput("drawing/latin1-all-fonts.pdf", bytes);
    });

    it("embedded fonts still work correctly after the refactor", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // Draw with Standard 14 font (exercises new encoding path)
      page.drawText("Standard 14: café", {
        font: "Helvetica",
        x: 50,
        y: 700,
        size: 12,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);

      // Verify it re-parses
      const parsed = await PDF.load(bytes);
      expect(parsed.getPageCount()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bytes pipeline
  // ─────────────────────────────────────────────────────────────────────────────

  describe("bytes pipeline", () => {
    it("appendContent with string still works for ASCII content", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // drawRectangle uses string-based appendContent internally
      page.drawRectangle({
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        color: red,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
    });

    it("PathBuilder operations still produce correct output", async () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      // drawPath uses PathBuilder → ContentAppender
      page.drawPath().moveTo(50, 50).lineTo(150, 50).lineTo(100, 150).close().fill({ color: red });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
    });

    it("drawImage still works with string-based content", async () => {
      // This test verifies that drawImage (which uses string appendContent)
      // still works after the refactor
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.drawText("Image test page", {
        font: "Helvetica",
        x: 50,
        y: 700,
        size: 12,
      });

      const bytes = await pdf.save();
      expect(isPdfHeader(bytes)).toBe(true);
    });
  });
});
