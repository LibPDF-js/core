/**
 * PDF page-copying and merging benchmarks.
 *
 * Tests the performance of copying pages between documents and merging
 * multiple PDFs. These operations are closely related to splitting
 * (issue #26) and represent the other side of the workflow.
 */

import { bench, describe } from "vitest";

import { PDF } from "../src";
import { getSynthetic100, loadFixture, mediumPdfPath } from "./fixtures";

// Pre-load fixtures
const mediumPdf = await loadFixture(mediumPdfPath);
const synthetic100 = await getSynthetic100();

// ─────────────────────────────────────────────────────────────────────────────
// Page copying
// ─────────────────────────────────────────────────────────────────────────────

describe("Copy pages between documents", () => {
  bench("copy 1 page", async () => {
    const source = await PDF.load(mediumPdf);
    const dest = PDF.create();
    await dest.copyPagesFrom(source, [0]);
    await dest.save();
  });

  bench("copy 10 pages from 100-page PDF", async () => {
    const source = await PDF.load(synthetic100);
    const dest = PDF.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    await dest.copyPagesFrom(source, indices);
    await dest.save();
  });

  bench(
    "copy all 100 pages",
    async () => {
      const source = await PDF.load(synthetic100);
      const dest = PDF.create();
      const indices = Array.from({ length: 100 }, (_, i) => i);
      await dest.copyPagesFrom(source, indices);
      await dest.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-copy (page duplication)
// ─────────────────────────────────────────────────────────────────────────────

describe("Duplicate pages within same document", () => {
  bench("duplicate page 0", async () => {
    const pdf = await PDF.load(mediumPdf);
    await pdf.copyPagesFrom(pdf, [0]);
    await pdf.save();
  });

  bench("duplicate all pages (double the document)", async () => {
    const pdf = await PDF.load(mediumPdf);
    const indices = Array.from({ length: pdf.getPageCount() }, (_, i) => i);
    await pdf.copyPagesFrom(pdf, indices);
    await pdf.save();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Merging
// ─────────────────────────────────────────────────────────────────────────────

describe("Merge PDFs", () => {
  bench("merge 2 small PDFs", async () => {
    const merged = await PDF.merge([mediumPdf, mediumPdf]);
    await merged.save();
  });

  bench("merge 10 small PDFs", async () => {
    const sources = Array.from({ length: 10 }, () => mediumPdf);
    const merged = await PDF.merge(sources);
    await merged.save();
  });

  bench(
    "merge 2 x 100-page PDFs",
    async () => {
      const merged = await PDF.merge([synthetic100, synthetic100]);
      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );
});
