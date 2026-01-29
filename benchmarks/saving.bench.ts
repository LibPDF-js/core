/**
 * PDF saving benchmarks.
 *
 * Tests PDF.save() performance with different scenarios.
 */

import { bench } from "vitest";

import { PDF } from "../src";
import { getHeavyPdf, loadFixture, mediumPdfPath } from "./fixtures";

// Pre-load fixtures
const mediumPdf = await loadFixture(mediumPdfPath);
const heavyPdf = await getHeavyPdf();

bench("save unmodified (19KB)", async () => {
  const pdf = await PDF.load(mediumPdf);
  await pdf.save();
});

bench("save with modifications (19KB)", async () => {
  const pdf = await PDF.load(mediumPdf);
  const page = pdf.getPage(0)!;
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  await pdf.save();
});

bench("incremental save (19KB)", async () => {
  const pdf = await PDF.load(mediumPdf);
  const page = pdf.getPage(0)!;
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  await pdf.save({ incremental: true });
});

bench(`save heavy PDF (${(heavyPdf.length / 1024 / 1024).toFixed(1)}MB)`, async () => {
  const pdf = await PDF.load(heavyPdf);
  await pdf.save();
});

bench(`incremental save heavy PDF (${(heavyPdf.length / 1024 / 1024).toFixed(1)}MB)`, async () => {
  const pdf = await PDF.load(heavyPdf);
  const page = pdf.getPage(0)!;
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  await pdf.save({ incremental: true });
});
