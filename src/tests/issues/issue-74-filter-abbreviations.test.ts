/**
 * Regression test for issue #74:
 * "Support abbreviated PDF stream filters such as /Fl for FlateDecode"
 *
 * ISO 32000-1 Table 6 defines abbreviations (Fl, LZW, RL, CCF, DCT, AHx,
 * A85) that readers must accept interchangeably with the full filter
 * names. FilterPipeline only registered the full names, so any stream
 * using an abbreviation failed with `Unknown filter`.
 *
 * @see https://github.com/LibPDF-js/core/issues/74
 */

import { PDF } from "#src/api/pdf";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Issue #74: abbreviated filter names", () => {
  it("decodes a content stream tagged /Fl", async () => {
    const bytes = await loadFixture("issues", "filter-abbrev-fl.pdf");
    const pdf = await PDF.load(bytes);

    const page = pdf.getPages()[0];

    expect(page.extractText().text).toBe("Hello Flate");
  });
});
