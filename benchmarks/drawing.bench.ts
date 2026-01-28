/**
 * PDF drawing benchmarks.
 *
 * Tests performance of drawing operations on a page.
 */

import { bench } from "vitest";

import { PDF } from "../src";

bench("draw 100 rectangles", async () => {
  const pdf = PDF.create();
  const page = pdf.addPage();

  for (let i = 0; i < 100; i++) {
    page.drawRectangle({
      x: 50 + (i % 10) * 50,
      y: 50 + Math.floor(i / 10) * 70,
      width: 40,
      height: 60,
    });
  }

  await pdf.save();
});

bench("draw 100 circles", async () => {
  const pdf = PDF.create();
  const page = pdf.addPage();

  for (let i = 0; i < 100; i++) {
    page.drawCircle({
      x: 70 + (i % 10) * 50,
      y: 80 + Math.floor(i / 10) * 70,
      radius: 20,
    });
  }

  await pdf.save();
});

bench("draw 100 lines", async () => {
  const pdf = PDF.create();
  const page = pdf.addPage();

  for (let i = 0; i < 100; i++) {
    page.drawLine({
      start: { x: 50, y: 50 + i * 7 },
      end: { x: 550, y: 50 + i * 7 },
    });
  }

  await pdf.save();
});

bench("draw 100 text lines (standard font)", async () => {
  const pdf = PDF.create();
  const page = pdf.addPage();

  for (let i = 0; i < 100; i++) {
    page.drawText(`Line ${i + 1}: The quick brown fox jumps over the lazy dog.`, {
      x: 50,
      y: 750 - i * 7,
      font: "Helvetica",
      size: 6,
    });
  }

  await pdf.save();
});

bench("create 10 pages with mixed content", async () => {
  const pdf = PDF.create();

  for (let p = 0; p < 10; p++) {
    const page = pdf.addPage();

    // Add some rectangles
    for (let i = 0; i < 5; i++) {
      page.drawRectangle({
        x: 50 + i * 100,
        y: 700,
        width: 80,
        height: 50,
      });
    }

    // Add some text
    for (let i = 0; i < 10; i++) {
      page.drawText(`Page ${p + 1}, Line ${i + 1}`, {
        x: 50,
        y: 600 - i * 20,
        font: "Helvetica",
        size: 12,
      });
    }
  }

  await pdf.save();
});
