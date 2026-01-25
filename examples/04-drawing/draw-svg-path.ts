/**
 * Example: Draw SVG Path
 *
 * This example demonstrates how to render SVG path data onto PDF pages.
 * Useful for icons, logos, and importing vector graphics from SVG files.
 *
 * Run: npx tsx examples/04-drawing/draw-svg-path.ts
 */

import { black, blue, grayscale, PDF, red, rgb } from "../../src/index";
import { formatBytes, saveOutput } from "../utils";

async function main() {
  console.log("Drawing SVG paths...\n");

  const pdf = PDF.create();
  const page = pdf.addPage({ size: "letter" });
  const { height } = page;

  // Title
  page.drawText("SVG Path Support", {
    x: 200,
    y: height - 40,
    size: 20,
    color: black,
  });

  // === Simple Triangle ===
  console.log("Drawing triangle from SVG path...");

  page.drawText("Triangle:", { x: 50, y: height - 80, size: 12, color: black });

  // SVG path for a triangle pointing down (in SVG coordinates)
  // drawSvgPath automatically transforms SVG coords (Y-down) to PDF (Y-up)
  page.drawSvgPath("M 0 0 L 60 0 L 30 50 Z", {
    x: 50,
    y: height - 90,
    color: red,
  });

  // === Star Shape ===
  console.log("Drawing star from SVG path...");

  page.drawText("Star:", { x: 200, y: height - 80, size: 12, color: black });

  // 5-pointed star (SVG coordinates)
  const starPath =
    "M 25 0 L 31 18 L 50 18 L 35 29 L 40 47 L 25 36 L 10 47 L 15 29 L 0 18 L 19 18 Z";
  page.drawSvgPath(starPath, {
    x: 200,
    y: height - 90,
    color: rgb(1, 0.8, 0),
  });

  // === Arrow Icon ===
  console.log("Drawing arrow icon...");

  page.drawText("Arrow:", { x: 350, y: height - 80, size: 12, color: black });

  const arrowPath = "M 0 15 L 30 15 L 30 5 L 50 25 L 30 45 L 30 35 L 0 35 Z";
  page.drawSvgPath(arrowPath, {
    x: 350,
    y: height - 90,
    color: blue,
  });

  // === Bezier Curves ===
  console.log("Drawing curves from SVG path...");

  page.drawText("Cubic Bezier (C command):", { x: 50, y: height - 200, size: 12, color: black });

  page.drawSvgPath("M 0 30 C 20 0 60 60 80 30 C 100 0 140 60 160 30", {
    x: 50,
    y: height - 215,
    borderColor: rgb(0.8, 0.2, 0.5),
    borderWidth: 2,
  });

  page.drawText("Quadratic Bezier (Q command):", {
    x: 300,
    y: height - 200,
    size: 12,
    color: black,
  });

  page.drawSvgPath("M 0 0 Q 40 50 80 0 Q 120 50 160 0", {
    x: 300,
    y: height - 215,
    borderColor: rgb(0.2, 0.6, 0.8),
    borderWidth: 2,
  });

  // === Relative Commands ===
  console.log("Drawing with relative commands...");

  page.drawText("Relative commands (lowercase):", {
    x: 50,
    y: height - 300,
    size: 12,
    color: black,
  });

  // Staircase using relative line commands
  page.drawSvgPath("M 0 0 l 30 0 l 0 20 l 30 0 l 0 20 l 30 0 l 0 20", {
    x: 50,
    y: height - 320,
    borderColor: grayscale(0.3),
    borderWidth: 2,
  });

  // === Horizontal/Vertical Lines ===
  page.drawText("H/V commands:", { x: 300, y: height - 300, size: 12, color: black });

  // Grid pattern using H and V
  page.drawSvgPath(
    "M 0 0 H 80 V 60 H 0 V 0 M 20 0 V 60 M 40 0 V 60 M 60 0 V 60 M 0 20 H 80 M 0 40 H 80",
    {
      x: 300,
      y: height - 320,
      borderColor: grayscale(0.4),
      borderWidth: 1,
    },
  );

  // === Arcs ===
  console.log("Drawing arcs...");

  page.drawText("Arcs (A command):", { x: 50, y: height - 420, size: 12, color: black });

  // Smiley face using arcs
  // Face outline
  page.drawSvgPath("M 40 0 A 40 40 0 1 1 40 80 A 40 40 0 1 1 40 0", {
    x: 50,
    y: height - 440,
    borderColor: rgb(0.9, 0.7, 0.1),
    borderWidth: 3,
  });

  // Left eye
  page.drawSvgPath("M 25 25 A 5 5 0 1 1 25 35 A 5 5 0 1 1 25 25", {
    x: 50,
    y: height - 440,
    color: black,
  });

  // Right eye
  page.drawSvgPath("M 55 25 A 5 5 0 1 1 55 35 A 5 5 0 1 1 55 25", {
    x: 50,
    y: height - 440,
    color: black,
  });

  // Smile
  page.drawSvgPath("M 20 50 A 25 25 0 0 0 60 50", {
    x: 50,
    y: height - 440,
    borderColor: black,
    borderWidth: 2,
  });

  // === Even-Odd Fill Rule ===
  console.log("Drawing with even-odd fill...");

  page.drawText("Even-odd fill (hole):", { x: 250, y: height - 420, size: 12, color: black });

  // Nested squares - creates a hole with even-odd
  page.drawSvgPath("M 0 0 L 80 0 L 80 80 L 0 80 Z M 20 20 L 60 20 L 60 60 L 20 60 Z", {
    x: 250,
    y: height - 440,
    color: blue,
    windingRule: "evenodd",
  });

  // === Scaling ===
  console.log("Drawing scaled icons...");

  page.drawText("Scaled icons:", { x: 50, y: height - 560, size: 12, color: black });

  // Heart icon at different scales
  const heartPath = "M 12 4 C 12 4 8 0 4 4 C 0 8 0 12 12 22 C 24 12 24 8 20 4 C 16 0 12 4 12 4 Z";

  page.drawText("1x", { x: 55, y: height - 600, size: 10, color: grayscale(0.5) });
  page.drawSvgPath(heartPath, {
    x: 50,
    y: height - 585,
    color: red,
  });

  page.drawText("2x", { x: 115, y: height - 600, size: 10, color: grayscale(0.5) });
  page.drawSvgPath(heartPath, {
    x: 100,
    y: height - 590,
    scale: 2,
    color: red,
  });

  page.drawText("3x", { x: 215, y: height - 600, size: 10, color: grayscale(0.5) });
  page.drawSvgPath(heartPath, {
    x: 200,
    y: height - 600,
    scale: 3,
    color: red,
  });

  // === PathBuilder Integration ===
  console.log("Using appendSvgPath with PathBuilder...");

  page.drawText("PathBuilder chaining:", { x: 50, y: height - 680, size: 12, color: black });

  // Mix SVG path with PathBuilder methods
  page
    .drawPath()
    .moveTo(50, height - 750)
    .lineTo(100, height - 750)
    .appendSvgPath("l 30 -30 l 30 30", { flipY: false }) // relative SVG continues from current point
    .lineTo(210, height - 750)
    .stroke({ borderColor: rgb(0.5, 0.3, 0.7), borderWidth: 2 });

  // Save the document
  console.log("\n=== Saving Document ===");
  const savedBytes = await pdf.save();
  const outputPath = await saveOutput("04-drawing/svg-path-examples.pdf", savedBytes);

  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${formatBytes(savedBytes.length)}`);
}

main().catch(console.error);
