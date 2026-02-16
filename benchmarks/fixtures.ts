/**
 * Benchmark fixture helpers.
 *
 * Provides utilities for loading PDF fixtures for benchmarks,
 * including synthetic large PDFs built by copying pages from
 * existing fixtures.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { PDF } from "../src";

// Heavy PDF - downloaded on first run (~10MB)
const HEAVY_PDF_PATH = "fixtures/benchmarks/cc-journalists-guide.pdf";
const HEAVY_PDF_URL =
  "https://creativecommons.org/wp-content/uploads/2023/05/A-Journalists-Guide-to-Creative-Commons-2.0.pdf";

// Fallback large PDF - use existing fixture from pdfbox malformed tests (2MB)
const LARGE_PDF_FALLBACK = "fixtures/malformed/pdfbox/PDFBOX-3947.pdf";

// Synthetic PDFs - generated on first run, cached locally
const SYNTHETIC_DIR = "fixtures/benchmarks";
const SYNTHETIC_100_PATH = `${SYNTHETIC_DIR}/synthetic-100p.pdf`;
const SYNTHETIC_2000_PATH = `${SYNTHETIC_DIR}/synthetic-2000p.pdf`;

/**
 * Load a fixture file as bytes.
 */
export async function loadFixture(path: string): Promise<Uint8Array> {
  const buffer = await readFile(path);

  return new Uint8Array(buffer);
}

/**
 * Get the heavy PDF fixture (~10MB).
 * Downloads on first run, cached locally.
 */
export async function getHeavyPdf(): Promise<Uint8Array> {
  // Return cached file if it exists
  if (existsSync(HEAVY_PDF_PATH)) {
    return loadFixture(HEAVY_PDF_PATH);
  }

  // Download and cache
  console.log(`Downloading heavy PDF fixture from ${HEAVY_PDF_URL}...`);

  const response = await fetch(HEAVY_PDF_URL);

  if (!response.ok) {
    console.warn(`Failed to download heavy PDF: ${response.status}, using fallback`);

    return loadFixture(LARGE_PDF_FALLBACK);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  // Ensure directory exists
  mkdirSync("fixtures/benchmarks", { recursive: true });
  writeFileSync(HEAVY_PDF_PATH, bytes);

  console.log(
    `Cached heavy PDF to ${HEAVY_PDF_PATH} (${(bytes.length / 1024 / 1024).toFixed(1)}MB)`,
  );

  return bytes;
}

/**
 * Get the large PDF fixture (2MB fallback).
 */
export async function getLargePdf(): Promise<Uint8Array> {
  return loadFixture(LARGE_PDF_FALLBACK);
}

/**
 * Build a synthetic PDF with the given number of pages by copying
 * pages from sample.pdf. Each page gets unique text to simulate
 * real-world content variation.
 */
async function buildSyntheticPdf(pageCount: number): Promise<Uint8Array> {
  const sourceBytes = await loadFixture(mediumPdfPath);
  const source = await PDF.load(sourceBytes);
  const sourcePageCount = source.getPageCount();

  // Start by copying the source pages
  const pdf = await PDF.load(sourceBytes);

  // Copy pages from source repeatedly until we reach the target count
  const pagesNeeded = pageCount - sourcePageCount;

  if (pagesNeeded > 0) {
    // Build an array of source page indices to copy in bulk
    const indices: number[] = [];

    for (let i = 0; i < pagesNeeded; i++) {
      indices.push(i % sourcePageCount);
    }

    await pdf.copyPagesFrom(source, indices);
  }

  // Add unique text to each page so content varies
  for (let i = 0; i < pdf.getPageCount(); i++) {
    const page = pdf.getPage(i);

    if (page) {
      page.drawText(`Page ${i + 1} of ${pageCount}`, {
        x: 50,
        y: 20,
        font: "Helvetica",
        size: 8,
      });
    }
  }

  return pdf.save();
}

/**
 * Get or create a synthetic PDF cached to disk.
 */
async function getOrCreateSynthetic(path: string, pageCount: number): Promise<Uint8Array> {
  if (existsSync(path)) {
    return loadFixture(path);
  }

  console.log(`Building synthetic ${pageCount}-page PDF...`);
  const start = performance.now();

  const bytes = await buildSyntheticPdf(pageCount);

  mkdirSync(SYNTHETIC_DIR, { recursive: true });
  writeFileSync(path, bytes);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  const size = (bytes.length / 1024 / 1024).toFixed(1);

  console.log(`Cached ${pageCount}-page PDF to ${path} (${size}MB) in ${elapsed}s`);

  return bytes;
}

/**
 * Get a synthetic 100-page PDF.
 * Built by copying pages from sample.pdf. Cached on disk after first build.
 */
export async function getSynthetic100(): Promise<Uint8Array> {
  return getOrCreateSynthetic(SYNTHETIC_100_PATH, 100);
}

/**
 * Get a synthetic 2000-page PDF.
 * Built by copying pages from sample.pdf. Cached on disk after first build.
 */
export async function getSynthetic2000(): Promise<Uint8Array> {
  return getOrCreateSynthetic(SYNTHETIC_2000_PATH, 2000);
}

// Pre-load common fixtures
export const smallPdfPath = "fixtures/basic/rot0.pdf";
export const mediumPdfPath = "fixtures/basic/sample.pdf";
export const formPdfPath = "fixtures/forms/sample_form.pdf";
