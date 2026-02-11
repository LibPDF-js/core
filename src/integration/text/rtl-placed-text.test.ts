/**
 * Regression test for reversed text extraction from design-tool PDFs.
 *
 * Some design tools (e.g. Figma, Canva) export PDFs where characters are
 * placed RIGHT-TO-LEFT in user space via TJ positioning adjustments, even
 * though the text is LTR (English). The font has near-zero glyph widths,
 * and all positioning is done via positive TJ adjustments (which move the
 * pen left). Characters appear in correct reading order in the content
 * stream, but their x-positions decrease.
 *
 * The line grouper sorts characters by x-position (left to right), which
 * reverses the correct reading order for these PDFs.
 */
import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("RTL-placed LTR text (design-tool PDFs)", () => {
  it("extracts text in correct reading order, not reversed", async () => {
    const bytes = await loadFixture("text", "rtl-placed-ltr-text.pdf");
    const pdf = await PDF.load(bytes);
    const page = pdf.getPage(0);

    expect(page).not.toBeNull();

    const pageText = page!.extractText();

    // The fixture has lorem ipsum text placed right-to-left via TJ adjustments.
    // Text should read correctly, not reversed.
    expect(pageText.text).toContain("Lorem ipsum dolor sit amet consectetur");
    expect(pageText.text).not.toContain("rutetcesnoc tema tis rolod muspi meroL");
  });
});
