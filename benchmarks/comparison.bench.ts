/**
 * Library comparison benchmarks.
 *
 * Compares @libpdf/core against pdf-lib for overlapping operations.
 * Results are machine-dependent and should be used for relative comparison only.
 */

import { PDFDocument } from "pdf-lib";
import { bench, describe } from "vitest";

import { PDF } from "../src";
import { loadFixture, getHeavyPdf } from "./fixtures";

// Pre-load fixture
const pdfBytes = await getHeavyPdf();

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
