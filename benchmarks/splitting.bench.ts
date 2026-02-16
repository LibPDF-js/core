/**
 * PDF page-splitting benchmarks.
 *
 * Tests the performance of splitting a PDF into individual single-page PDFs.
 * This is the primary benchmark requested in issue #26 for users who need
 * to split 2000+ page documents at high throughput.
 *
 * Scenarios:
 * - Extract single page (baseline)
 * - Split 100-page PDF into individual pages
 * - Split 2000-page PDF into individual pages
 */

import { bench, describe } from "vitest";

import { PDF } from "../src";
import { getSynthetic100, getSynthetic2000, loadFixture, mediumPdfPath } from "./fixtures";

// Pre-load fixtures outside benchmarks to isolate I/O from measurements
const mediumPdf = await loadFixture(mediumPdfPath);
const synthetic100 = await getSynthetic100();
const synthetic2000 = await getSynthetic2000();

// ─────────────────────────────────────────────────────────────────────────────
// Single page extraction (baseline)
// ─────────────────────────────────────────────────────────────────────────────

describe("Extract single page", () => {
  bench("extractPages (1 page from small PDF)", async () => {
    const pdf = await PDF.load(mediumPdf);
    const extracted = await pdf.extractPages([0]);
    await extracted.save();
  });

  bench("extractPages (1 page from 100-page PDF)", async () => {
    const pdf = await PDF.load(synthetic100);
    const extracted = await pdf.extractPages([0]);
    await extracted.save();
  });

  bench("extractPages (1 page from 2000-page PDF)", async () => {
    const pdf = await PDF.load(synthetic2000);
    const extracted = await pdf.extractPages([0]);
    await extracted.save();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full split: every page into its own PDF
// ─────────────────────────────────────────────────────────────────────────────

describe("Split into single-page PDFs", () => {
  bench(
    `split 100-page PDF (${(synthetic100.length / 1024 / 1024).toFixed(1)}MB)`,
    async () => {
      const pdf = await PDF.load(synthetic100);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const single = await pdf.extractPages([i]);
        await single.save();
      }
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    `split 2000-page PDF (${(synthetic2000.length / 1024 / 1024).toFixed(1)}MB)`,
    async () => {
      const pdf = await PDF.load(synthetic2000);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const single = await pdf.extractPages([i]);
        await single.save();
      }
    },
    { warmupIterations: 0, iterations: 1, time: 0 },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch extraction: extract ranges of pages
// ─────────────────────────────────────────────────────────────────────────────

describe("Batch page extraction", () => {
  bench(
    "extract first 10 pages from 2000-page PDF",
    async () => {
      const pdf = await PDF.load(synthetic2000);
      const indices = Array.from({ length: 10 }, (_, i) => i);
      const extracted = await pdf.extractPages(indices);
      await extracted.save();
    },
    { warmupIterations: 1, iterations: 5 },
  );

  bench(
    "extract first 100 pages from 2000-page PDF",
    async () => {
      const pdf = await PDF.load(synthetic2000);
      const indices = Array.from({ length: 100 }, (_, i) => i);
      const extracted = await pdf.extractPages(indices);
      await extracted.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "extract every 10th page from 2000-page PDF (200 pages)",
    async () => {
      const pdf = await PDF.load(synthetic2000);
      const indices = Array.from({ length: 200 }, (_, i) => i * 10);
      const extracted = await pdf.extractPages(indices);
      await extracted.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );
});
