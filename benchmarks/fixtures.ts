/**
 * Benchmark fixture helpers.
 *
 * Provides utilities for loading PDF fixtures for benchmarks.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Heavy PDF - downloaded on first run (~10MB)
const HEAVY_PDF_PATH = "fixtures/benchmarks/cc-journalists-guide.pdf";
const HEAVY_PDF_URL =
  "https://creativecommons.org/wp-content/uploads/2023/05/A-Journalists-Guide-to-Creative-Commons-2.0.pdf";

// Fallback large PDF - use existing fixture from pdfbox malformed tests (2MB)
const LARGE_PDF_FALLBACK = "fixtures/malformed/pdfbox/PDFBOX-3947.pdf";

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

// Pre-load common fixtures
export const smallPdfPath = "fixtures/basic/rot0.pdf";
export const mediumPdfPath = "fixtures/basic/sample.pdf";
export const formPdfPath = "fixtures/forms/sample_form.pdf";
