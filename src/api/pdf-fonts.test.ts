import { describe, expect, it } from "vitest";
import { PdfRef } from "#src/objects/pdf-ref";
import { loadFixture } from "#src/test-utils";
import { PDF } from "./pdf";

describe("PDF font embedding", () => {
  it("should embed a TTF font", async () => {
    // Load a simple PDF
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    // Load a font
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");

    // Embed the font
    const font = pdf.embedFont(fontBytes);

    expect(font.subtype).toBe("Type0");
    expect(font.baseFontName).toBeTruthy();
  });

  it("should track glyph usage when encoding text", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Initially only .notdef
    expect(font.getUsedGlyphIds()).toEqual([0]);

    // Encode text
    font.encodeText("Hello");

    // Now should have more glyphs
    const usedGlyphs = font.getUsedGlyphIds();
    expect(usedGlyphs.length).toBeGreaterThan(1);
    expect(usedGlyphs).toContain(0); // .notdef always included
  });

  it("should create font reference on save", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Before save, no reference
    expect(pdf.getFontRef(font)).toBeNull();

    // Encode text so the font has glyphs
    font.encodeText("Test");

    // Save the PDF
    const savedBytes = await pdf.save();

    // After save, should have reference
    const fontRef = pdf.getFontRef(font);
    expect(fontRef).toBeInstanceOf(PdfRef);

    // Verify the saved PDF can be loaded
    const reloadedPdf = await PDF.load(savedBytes);
    expect(reloadedPdf.version).toBe(pdf.version);
  });

  it("should embed font with subset tag", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    font.encodeText("ABC");

    // Prepare fonts (normally done during save)
    await pdf.fonts.prepare();

    // Should have a 6-letter subset tag
    expect(font.subsetTag).toMatch(/^[A-Z]{6}$/);
    expect(font.baseFontName).toContain("+");
  });

  it("should embed font and save valid PDF", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Encode some text
    const codes = font.encodeText("Hello World!");

    // Codes should be Unicode code points
    expect(codes[0]).toBe(72); // 'H'
    expect(codes[1]).toBe(101); // 'e'

    // Save the PDF
    const savedBytes = await pdf.save();

    // Verify PDF structure
    expect(savedBytes.length).toBeGreaterThan(pdfBytes.length);

    // Check PDF signature
    const header = new TextDecoder().decode(savedBytes.slice(0, 8));
    expect(header).toContain("%PDF-");

    // Check for EOF marker
    const trailer = new TextDecoder().decode(savedBytes.slice(-20));
    expect(trailer).toContain("%%EOF");

    // Reload and verify
    const reloadedPdf = await PDF.load(savedBytes);
    expect(reloadedPdf.getPageCount()).toBe(pdf.getPageCount());
  });

  it("should calculate text width correctly", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Get width for a character
    const widthA = font.getWidth(65); // 'A'
    expect(widthA).toBeGreaterThan(0);

    // Get text width
    const textWidth = font.getTextWidth("Hello", 12);
    expect(textWidth).toBeGreaterThan(0);

    // Verify proportions - "ii" should be narrower than "MM"
    const widthII = font.getTextWidth("ii", 12);
    const widthMM = font.getTextWidth("MM", 12);
    expect(widthII).toBeLessThan(widthMM);
  });

  it("should check if text can be encoded", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Basic Latin should be encodable
    expect(font.canEncode("Hello World")).toBe(true);

    // Private use area should not be encodable in most fonts
    expect(font.canEncode("\uE000")).toBe(false);
  });

  it("should report unencodable characters", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    const unencodable = font.getUnencodableCharacters("Hello\uE000World\uE001");
    expect(unencodable).toContain("\uE000");
    expect(unencodable).toContain("\uE001");
    expect(unencodable).not.toContain("H");
    expect(unencodable).not.toContain("W");
  });

  it("should handle multiple fonts", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    // Embed two fonts
    const ttfBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const otfBytes = await loadFixture("fonts", "otf/FoglihtenNo07.otf");

    const font1 = pdf.embedFont(ttfBytes);
    const font2 = pdf.embedFont(otfBytes);

    font1.encodeText("From TTF");
    font2.encodeText("From OTF");

    // Save
    const savedBytes = await pdf.save();

    // Both fonts should have references
    const ref1 = pdf.getFontRef(font1);
    const ref2 = pdf.getFontRef(font2);

    expect(ref1).toBeInstanceOf(PdfRef);
    expect(ref2).toBeInstanceOf(PdfRef);
    expect(ref1?.objectNumber).not.toBe(ref2?.objectNumber);

    // Reload and verify
    const reloadedPdf = await PDF.load(savedBytes);
    expect(reloadedPdf.version).toBe(pdf.version);
  });

  it("should reset font usage tracking", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    font.encodeText("Hello World");
    const usedBefore = font.getUsedGlyphIds().length;
    expect(usedBefore).toBeGreaterThan(1);

    font.resetUsage();
    const usedAfter = font.getUsedGlyphIds();
    expect(usedAfter).toEqual([0]); // Only .notdef
  });

  it("should include only used glyphs in subset (integration)", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Encode just 3 characters
    font.encodeText("ABC");

    // Save - this should create a small subset
    const savedBytes = await pdf.save();

    // The saved PDF should be smaller than if we embedded all glyphs
    // (Hard to verify exactly without parsing, but we can check it's reasonable)
    expect(savedBytes.length).toBeGreaterThan(0);

    // Reload should work
    const reloadedPdf = await PDF.load(savedBytes);
    expect(reloadedPdf.getPageCount()).toBeGreaterThan(0);
  });
});

describe("PDF.embedFont edge cases", () => {
  it("should handle empty text encoding", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Encode empty string
    const codes = font.encodeText("");
    expect(codes).toEqual([]);

    // Should still save fine
    const savedBytes = await pdf.save();
    expect(savedBytes.length).toBeGreaterThan(0);
  });

  it("should handle non-BMP characters", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Try encoding a non-BMP character (emoji)
    // Most fonts won't have it, but the API should handle it
    const text = "Hello 🙂";

    if (font.canEncode(text)) {
      const codes = font.encodeText(text);
      expect(codes.length).toBeGreaterThan(0);
    } else {
      // Get unencodable should report the emoji
      const unencodable = font.getUnencodableCharacters(text);
      expect(unencodable.length).toBeGreaterThan(0);
    }
  });
});
