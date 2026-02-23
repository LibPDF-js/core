/**
 * CPU profiling script for load-modify-save workflow.
 *
 * Usage: bun --cpu-prof-md scripts/profile-load-save.ts
 *
 * Runs the load → modify → save cycle multiple times to get
 * a representative CPU profile showing where time is spent.
 */

import { readFileSync } from "node:fs";

import { PDF } from "../src/index.ts";

const HEAVY_PDF = "fixtures/benchmarks/cc-journalists-guide.pdf";
const ITERATIONS = 20;

const pdfBytes = new Uint8Array(readFileSync(HEAVY_PDF));
console.log(`PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(1)}MB`);

// Warm up
{
  const pdf = await PDF.load(pdfBytes);
  const page = pdf.getPage(0)!;
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  await pdf.save();
}

console.log(`Running ${ITERATIONS} iterations of load → modify → save...`);

const start = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
  const pdf = await PDF.load(pdfBytes);
  const page = pdf.getPage(0)!;
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  await pdf.save();
}

const elapsed = performance.now() - start;
console.log(`Total: ${elapsed.toFixed(0)}ms`);
console.log(`Average: ${(elapsed / ITERATIONS).toFixed(1)}ms per iteration`);
