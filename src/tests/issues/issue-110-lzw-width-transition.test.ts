/**
 * Regression test for issue #110:
 * "LZW decoding fails at code-width transitions (`Invalid LZW code`)"
 *
 * The decoder widened its bit reader one dictionary entry too late: the
 * 9→10 bit transition (and the later ones) must happen when
 * `nextCode + EarlyChange` reaches the next power of two, matching the
 * encoder and other implementations (pdf.js, PDFBox). Streams long enough
 * to cross that boundary decoded garbage until an out-of-range code threw.
 *
 * @see https://github.com/LibPDF-js/core/issues/110
 */

import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Issue #110: LZW code-width transitions", () => {
  it("decodes a stream that crosses the 9→10 bit boundary", async () => {
    const bytes = await loadFixture("issues", "lzw-code-width-transition.pdf");
    const pdf = await PDF.load(bytes);

    // This is the call from the issue report; it threw
    // `Invalid LZW code: 545` before the fix.
    const page = pdf.getPages()[0];
    const matches = page.findText(/\{\{([^}]+)\}\}/g);

    expect(matches).toEqual([]);

    const text = page.extractText().text;

    expect(text).toContain("Synthetic LZW decoder reproduction");
  });
});
