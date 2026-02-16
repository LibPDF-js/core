/**
 * Library comparison benchmarks.
 *
 * Compares @libpdf/core against pdf-lib for overlapping operations.
 * Results are machine-dependent and should be used for relative comparison only.
 */

import { PDFDocument } from "pdf-lib";
import { bench, describe } from "vitest";

import { PDF } from "../src";
import { getHeavyPdf, getSynthetic100, getSynthetic2000, loadFixture } from "./fixtures";

// Pre-load fixtures
const pdfBytes = await getHeavyPdf();
const synthetic100 = await getSynthetic100();
const synthetic2000 = await getSynthetic2000();

describe("Load PDF", () => {
  bench("libpdf", async () => {
    await PDF.load(pdfBytes);
  });

  bench("pdf-lib", async () => {
    await PDFDocument.load(pdfBytes);
  });
});

describe("Create blank PDF", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    await pdf.save();
  });
});

describe("Add 10 pages", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();

    for (let i = 0; i < 10; i++) {
      pdf.addPage();
    }

    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();

    for (let i = 0; i < 10; i++) {
      pdf.addPage();
    }

    await pdf.save();
  });
});

describe("Draw 50 rectangles", () => {
  bench("libpdf", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage();

    for (let i = 0; i < 50; i++) {
      page.drawRectangle({
        x: 50 + (i % 5) * 100,
        y: 50 + Math.floor(i / 5) * 70,
        width: 80,
        height: 50,
      });
    }

    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();

    for (let i = 0; i < 50; i++) {
      page.drawRectangle({
        x: 50 + (i % 5) * 100,
        y: 50 + Math.floor(i / 5) * 70,
        width: 80,
        height: 50,
      });
    }

    await pdf.save();
  });
});

describe("Load and save PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(pdfBytes);
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(pdfBytes);
    await pdf.save();
  });
});

describe("Load, modify, and save PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(pdfBytes);
    const page = pdf.getPage(0)!;
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await pdf.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPage(0);
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await pdf.save();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Page splitting comparison (issue #26)
// ─────────────────────────────────────────────────────────────────────────────

describe("Extract single page from 100-page PDF", () => {
  bench("libpdf", async () => {
    const pdf = await PDF.load(synthetic100);
    const extracted = await pdf.extractPages([0]);
    await extracted.save();
  });

  bench("pdf-lib", async () => {
    const pdf = await PDFDocument.load(synthetic100);
    const newDoc = await PDFDocument.create();
    const [page] = await newDoc.copyPages(pdf, [0]);
    newDoc.addPage(page);
    await newDoc.save();
  });
});

describe("Split 100-page PDF into single-page PDFs", () => {
  bench(
    "libpdf",
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
    "pdf-lib",
    async () => {
      const pdf = await PDFDocument.load(synthetic100);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 1, iterations: 3 },
  );
});

describe(`Split 2000-page PDF into single-page PDFs (${(synthetic2000.length / 1024 / 1024).toFixed(1)}MB)`, () => {
  bench(
    "libpdf",
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

  bench(
    "pdf-lib",
    async () => {
      const pdf = await PDFDocument.load(synthetic2000);
      const pageCount = pdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(pdf, [i]);
        newDoc.addPage(page);
        await newDoc.save();
      }
    },
    { warmupIterations: 0, iterations: 1, time: 0 },
  );
});

describe("Copy 10 pages between documents", () => {
  bench("libpdf", async () => {
    const source = await PDF.load(synthetic100);
    const dest = PDF.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    await dest.copyPagesFrom(source, indices);
    await dest.save();
  });

  bench("pdf-lib", async () => {
    const source = await PDFDocument.load(synthetic100);
    const dest = await PDFDocument.create();
    const indices = Array.from({ length: 10 }, (_, i) => i);
    const pages = await dest.copyPages(source, indices);

    for (const page of pages) {
      dest.addPage(page);
    }

    await dest.save();
  });
});

describe("Merge 2 x 100-page PDFs", () => {
  bench(
    "libpdf",
    async () => {
      const merged = await PDF.merge([synthetic100, synthetic100]);
      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );

  bench(
    "pdf-lib",
    async () => {
      const doc1 = await PDFDocument.load(synthetic100);
      const doc2 = await PDFDocument.load(synthetic100);
      const merged = await PDFDocument.create();

      const pages1 = await merged.copyPages(doc1, doc1.getPageIndices());

      for (const page of pages1) {
        merged.addPage(page);
      }

      const pages2 = await merged.copyPages(doc2, doc2.getPageIndices());

      for (const page of pages2) {
        merged.addPage(page);
      }

      await merged.save();
    },
    { warmupIterations: 1, iterations: 3 },
  );
});
