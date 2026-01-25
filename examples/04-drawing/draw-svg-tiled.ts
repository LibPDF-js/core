/**
 * Example: Draw Tiled SVG Paths
 *
 * This example demonstrates how to tile SVG paths across a page, useful for:
 * - Sewing patterns that need to be printed on multiple sheets
 * - Large technical drawings split across pages
 * - Repeating patterns and backgrounds
 *
 * Run: npx tsx examples/04-drawing/draw-svg-tiled.ts
 */

import { black, blue, grayscale, PDF, red, rgb } from "../../src/index";
import { formatBytes, saveOutput } from "../utils";

// A complex sewing pattern-like path (simplified dress pattern piece)
const PATTERN_PATH = `
  M 0 0
  L 80 0
  C 85 20 90 60 85 100
  L 80 180
  C 75 200 60 220 50 230
  L 40 230
  C 30 220 15 200 10 180
  L 5 100
  C 0 60 5 20 10 0
  Z
  M 35 40
  A 10 10 0 1 1 35 60
  A 10 10 0 1 1 35 40
`;

// A decorative tile pattern (floral-ish)
const TILE_PATTERN = `
  M 25 5
  C 30 0 35 5 35 10
  C 40 5 45 10 45 15
  C 50 15 50 25 45 25
  C 50 30 45 35 40 35
  C 45 40 40 45 35 45
  C 35 50 25 50 25 45
  C 20 50 15 45 15 40
  C 10 45 5 40 5 35
  C 0 35 0 25 5 25
  C 0 20 5 15 10 15
  C 5 10 10 5 15 5
  C 15 0 25 0 25 5
  Z
`;

async function main() {
  console.log("Drawing tiled SVG paths...\n");

  const pdf = PDF.create();

  // ==========================================================================
  // Page 1: Tiled background pattern
  // ==========================================================================
  console.log("Creating tiled background pattern...");

  const page1 = pdf.addPage({ size: "letter" });
  const { width: w1, height: h1 } = page1;

  page1.drawText("Tiled Background Pattern", {
    x: 180,
    y: h1 - 40,
    size: 20,
    color: black,
  });

  // Draw a grid of decorative tiles
  const tileSize = 50;
  const tileScale = 1;
  const tilesX = Math.ceil(w1 / tileSize);
  const tilesY = Math.ceil((h1 - 100) / tileSize);

  for (let row = 0; row < tilesY; row++) {
    for (let col = 0; col < tilesX; col++) {
      const x = col * tileSize;
      const y = h1 - 80 - row * tileSize;

      // Alternate colors for checkerboard effect
      const isEven = (row + col) % 2 === 0;
      const color = isEven ? rgb(0.85, 0.9, 0.95) : rgb(0.9, 0.85, 0.9);

      page1.drawSvgPath(TILE_PATTERN, {
        x,
        y,
        scale: tileScale,
        color,
        borderColor: grayscale(0.7),
        borderWidth: 0.5,
      });
    }
  }

  // Add text on top
  page1.drawRectangle({
    x: 100,
    y: h1 / 2 - 30,
    width: w1 - 200,
    height: 60,
    color: rgb(1, 1, 1),
    borderColor: grayscale(0.3),
    borderWidth: 1,
    cornerRadius: 8,
  });

  page1.drawText("Content on top of tiled background", {
    x: 160,
    y: h1 / 2 - 5,
    size: 16,
    color: black,
  });

  // ==========================================================================
  // Page 2: Large pattern split across the page (simulating multi-page print)
  // ==========================================================================
  console.log("Creating large pattern with tile markers...");

  const page2 = pdf.addPage({ size: "letter" });
  const { width: w2, height: h2 } = page2;

  page2.drawText("Large Pattern with Print Tiles", {
    x: 160,
    y: h2 - 40,
    size: 20,
    color: black,
  });

  page2.drawText("Pattern scaled large, with tile boundaries shown for multi-sheet printing", {
    x: 90,
    y: h2 - 60,
    size: 10,
    color: grayscale(0.5),
  });

  // Draw the pattern large
  const patternScale = 4;
  const patternX = 100;
  const patternY = h2 - 100;

  page2.drawSvgPath(PATTERN_PATH, {
    x: patternX,
    y: patternY,
    scale: patternScale,
    color: rgb(0.95, 0.9, 0.85),
    borderColor: rgb(0.6, 0.4, 0.2),
    borderWidth: 2,
  });

  // Draw tile boundaries (simulating how it would be split for printing)
  const tileW = 150;
  const tileH = 200;
  const patternWidth = 90 * patternScale;
  const patternHeight = 230 * patternScale;

  // Draw tile grid
  page2.drawText("Tile boundaries:", { x: 400, y: h2 - 100, size: 10, color: grayscale(0.5) });

  for (let ty = 0; ty * tileH < patternHeight; ty++) {
    for (let tx = 0; tx * tileW < patternWidth; tx++) {
      const tileX = patternX + tx * tileW;
      const tileY = patternY - ty * tileH;

      // Draw dashed tile boundary
      page2.drawRectangle({
        x: tileX,
        y: tileY - tileH,
        width: tileW,
        height: tileH,
        borderColor: red,
        borderWidth: 1,
      });

      // Label the tile
      page2.drawText(`${ty + 1}-${tx + 1}`, {
        x: tileX + 5,
        y: tileY - 15,
        size: 8,
        color: red,
      });
    }
  }

  // ==========================================================================
  // Page 3: Actual multi-page tiling (pattern split across pages)
  // ==========================================================================
  console.log("Creating multi-page tiled output...");

  // For this demo, we'll create a 2x2 grid of pages showing different parts
  // of a large pattern

  const largePatternScale = 8;
  const sourceWidth = 90 * largePatternScale; // ~720
  const sourceHeight = 230 * largePatternScale; // ~1840

  // Tile size matches a portion of a letter page (with margins)
  const printTileW = 500;
  const printTileH = 700;

  const tilesAcross = Math.ceil(sourceWidth / printTileW);
  const tilesDown = Math.ceil(sourceHeight / printTileH);

  console.log(`  Pattern size: ${sourceWidth} x ${sourceHeight} points`);
  console.log(`  Tiles needed: ${tilesAcross} x ${tilesDown} = ${tilesAcross * tilesDown} pages`);

  for (let tileRow = 0; tileRow < tilesDown; tileRow++) {
    for (let tileCol = 0; tileCol < tilesAcross; tileCol++) {
      const tilePage = pdf.addPage({ size: "letter" });
      const { width: tw, height: th } = tilePage;

      // Calculate offset to show this portion of the pattern
      const offsetX = -tileCol * printTileW;
      const offsetY = tileRow * printTileH;

      // Header
      tilePage.drawText(`Tile ${tileRow + 1}-${tileCol + 1}`, {
        x: 50,
        y: th - 30,
        size: 14,
        color: black,
      });

      tilePage.drawText(
        `(Row ${tileRow + 1} of ${tilesDown}, Column ${tileCol + 1} of ${tilesAcross})`,
        {
          x: 50,
          y: th - 45,
          size: 9,
          color: grayscale(0.5),
        },
      );

      const margin = 50;
      const markLen = 20;

      // Draw the pattern with offset FIRST (so it's behind everything)
      // Position the pattern so the correct portion is visible
      tilePage.drawSvgPath(PATTERN_PATH, {
        x: margin + offsetX,
        y: th - margin - 30 + offsetY,
        scale: largePatternScale,
        color: rgb(0.95, 0.92, 0.88),
        borderColor: rgb(0.5, 0.35, 0.2),
        borderWidth: 1.5,
      });

      // Draw crop marks at corners (on top of pattern)
      // Top-left
      tilePage.drawLine({
        start: { x: margin, y: th - margin - markLen },
        end: { x: margin, y: th - margin },
        color: grayscale(0.3),
      });
      tilePage.drawLine({
        start: { x: margin, y: th - margin },
        end: { x: margin + markLen, y: th - margin },
        color: grayscale(0.3),
      });

      // Top-right
      tilePage.drawLine({
        start: { x: tw - margin, y: th - margin - markLen },
        end: { x: tw - margin, y: th - margin },
        color: grayscale(0.3),
      });
      tilePage.drawLine({
        start: { x: tw - margin - markLen, y: th - margin },
        end: { x: tw - margin, y: th - margin },
        color: grayscale(0.3),
      });

      // Bottom-left
      tilePage.drawLine({
        start: { x: margin, y: margin },
        end: { x: margin, y: margin + markLen },
        color: grayscale(0.3),
      });
      tilePage.drawLine({
        start: { x: margin, y: margin },
        end: { x: margin + markLen, y: margin },
        color: grayscale(0.3),
      });

      // Bottom-right
      tilePage.drawLine({
        start: { x: tw - margin, y: margin },
        end: { x: tw - margin, y: margin + markLen },
        color: grayscale(0.3),
      });
      tilePage.drawLine({
        start: { x: tw - margin - markLen, y: margin },
        end: { x: tw - margin, y: margin },
        color: grayscale(0.3),
      });

      // Clip region border (on top of pattern)
      tilePage.drawRectangle({
        x: margin,
        y: margin,
        width: tw - margin * 2,
        height: th - margin * 2 - 30,
        borderColor: grayscale(0.8),
        borderWidth: 0.5,
      });

      // Registration marks for alignment
      if (tileCol > 0) {
        // Left edge alignment mark
        tilePage.drawText("<< align", {
          x: margin + 5,
          y: th / 2,
          size: 8,
          color: blue,
        });
      }
      if (tileCol < tilesAcross - 1) {
        // Right edge alignment mark
        tilePage.drawText("align >>", {
          x: tw - margin - 40,
          y: th / 2,
          size: 8,
          color: blue,
        });
      }
    }
  }

  // ==========================================================================
  // Final page: Assembly instructions
  // ==========================================================================
  console.log("Adding assembly instructions...");

  const instrPage = pdf.addPage({ size: "letter" });
  const { width: wi, height: hi } = instrPage;

  instrPage.drawText("Assembly Instructions", {
    x: 200,
    y: hi - 50,
    size: 20,
    color: black,
  });

  const instructions = [
    "1. Print all tile pages at 100% scale (no scaling)",
    "2. Cut along the crop marks on each page",
    "3. Arrange tiles in a grid:",
    "",
    "   +-------+-------+",
    "   | 1-1   | 1-2   |",
    "   +-------+-------+",
    "   | 2-1   | 2-2   |",
    "   +-------+-------+",
    "   | 3-1   | 3-2   |",
    "   +-------+-------+",
    "",
    "4. Align the << and >> marks between adjacent tiles",
    "5. Tape tiles together from the back",
    "6. Cut out the pattern along the solid line",
  ];

  let instrY = hi - 100;
  for (const line of instructions) {
    instrPage.drawText(line, {
      x: 100,
      y: instrY,
      size: 12,
      font: "Courier",
      color: black,
    });
    instrY -= 20;
  }

  // Save the document
  console.log("\n=== Saving Document ===");
  const savedBytes = await pdf.save();
  const outputPath = await saveOutput("04-drawing/svg-tiled-examples.pdf", savedBytes);

  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${formatBytes(savedBytes.length)}`);
  console.log(`Pages: ${pdf.getPageCount()}`);
}

main().catch(console.error);
