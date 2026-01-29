/**
 * PDF loading benchmarks.
 *
 * Tests PDF.load() performance with various file sizes.
 */

import { bench } from "vitest";

import { PDF } from "../src";
import { formPdfPath, getHeavyPdf, loadFixture, mediumPdfPath, smallPdfPath } from "./fixtures";

// Pre-load fixtures outside benchmark to avoid I/O in measurements
const smallPdf = await loadFixture(smallPdfPath);
const mediumPdf = await loadFixture(mediumPdfPath);
const formPdf = await loadFixture(formPdfPath);
const heavyPdf = await getHeavyPdf();

bench("load small PDF (888B)", async () => {
  await PDF.load(smallPdf);
});

bench("load medium PDF (19KB)", async () => {
  await PDF.load(mediumPdf);
});

bench("load form PDF (116KB)", async () => {
  await PDF.load(formPdf);
});

bench(`load heavy PDF (${(heavyPdf.length / 1024 / 1024).toFixed(1)}MB)`, async () => {
  await PDF.load(heavyPdf);
});
