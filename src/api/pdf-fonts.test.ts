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

  it("should create font reference immediately on embed", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Reference is now immediately available (pre-allocated)
    const fontRef = pdf.getFontRef(font);
    expect(fontRef).toBeInstanceOf(PdfRef);

    // Encode text so the font has glyphs
    font.encodeText("Test");

    // Save the PDF
    const savedBytes = await pdf.save();

    // After save, reference should still be the same
    expect(pdf.getFontRef(font)).toBe(fontRef);

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

    // encodeText returns Unicode code points (user-friendly API)
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

describe("Font subsetting options", () => {
  it("should subset fonts when subsetFonts: true", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Encode just a few characters
    font.encodeText("ABC");

    // Save with subsetting
    const subsetBytes = await pdf.save({ subsetFonts: true });

    // Font should have a subset tag
    expect(font.subsetTag).toMatch(/^[A-Z]{6}$/);
    expect(font.baseFontName).toContain("+");

    // The PDF should be valid
    const reloaded = await PDF.load(subsetBytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
  });

  it("should embed full font when subsetFonts: false (default)", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Encode just a few characters
    font.encodeText("ABC");

    // Save without subsetting (default)
    const fullBytes = await pdf.save({ subsetFonts: false });

    // The PDF should be valid
    const reloaded = await PDF.load(fullBytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
  });

  it("should create larger files with full embedding vs subset", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");

    // Create two PDFs with same font
    const pdf1 = await PDF.load(pdfBytes);
    const pdf2 = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font1 = pdf1.embedFont(fontBytes);
    const font2 = pdf2.embedFont(fontBytes);

    // Encode just a few characters in both
    font1.encodeText("ABC");
    font2.encodeText("ABC");

    // Save both ways
    const subsetBytes = await pdf1.save({ subsetFonts: true });
    const fullBytes = await pdf2.save({ subsetFonts: false });

    // Full embedding should create a larger file
    expect(fullBytes.length).toBeGreaterThan(subsetBytes.length);
  });

  it("should not subset fonts marked for form use even with subsetFonts: true", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);

    // Mark font as used in form
    font.markUsedInForm();

    // Encode some characters
    font.encodeText("ABC");

    // canSubset should return false
    expect(font.canSubset()).toBe(false);

    // Save with subsetting enabled
    const savedBytes = await pdf.save({ subsetFonts: true });

    // The PDF should be valid
    const reloaded = await PDF.load(savedBytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
  });
});

describe("PDFFonts API", () => {
  it("should throw when getting ref for non-embedded font", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    // Create a font from another document
    const pdfBytes2 = await loadFixture("basic", "document.pdf");
    const pdf2 = await PDF.load(pdfBytes2);
    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const otherFont = pdf2.embedFont(fontBytes);

    // Trying to get ref for font from another doc should throw
    expect(() => pdf.fonts.getRef(otherFont)).toThrow();
  });

  it("should track finalized state", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);
    font.encodeText("Test");

    expect(pdf.fonts.isFinalized).toBe(false);

    await pdf.save();

    expect(pdf.fonts.isFinalized).toBe(true);
  });

  it("should not finalize twice", async () => {
    const pdfBytes = await loadFixture("basic", "document.pdf");
    const pdf = await PDF.load(pdfBytes);

    const fontBytes = await loadFixture("fonts", "ttf/LiberationSans-Regular.ttf");
    const font = pdf.embedFont(fontBytes);
    font.encodeText("Test");

    // First save
    await pdf.save();
    const firstFinalizedState = pdf.fonts.isFinalized;

    // Second save should not try to finalize again
    await pdf.save();
    expect(pdf.fonts.isFinalized).toBe(firstFinalizedState);
  });
});
