/**
 * Integration tests for SVG path support in the Drawing API.
 *
 * These tests generate actual PDF files that can be visually inspected
 * in the test-output directory.
 */

import { black, blue, grayscale, green, red, rgb } from "#src/helpers/colors";
import { PdfStream } from "#src/objects/pdf-stream";
import { isPdfHeader, saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "../pdf";

describe("SVG Path Integration", () => {
  it("fills SVG paths with black by default", () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    page.drawSvgPath("M 0 0 L 10 0 L 0 10 Z");

    const contents = page.dict.get("Contents", pdf.context.resolve.bind(pdf.context));
    expect(contents).toBeInstanceOf(PdfStream);

    const contentText = new TextDecoder().decode((contents as PdfStream).data);
    expect(contentText).toMatch(/(^|\n)0 g(\n|$)/);
    expect(contentText).toMatch(/(^|\n)f(\n|$)/);
  });

  it("draws SVG paths with drawSvgPath and appendSvgPath", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    // Title
    page.drawText("SVG Path Support", {
      x: 50,
      y: 720,
      font: "Helvetica-Bold",
      size: 24,
      color: black,
    });

    page.drawLine({
      start: { x: 50, y: 710 },
      end: { x: 400, y: 710 },
      color: grayscale(0.5),
    });

    page.drawText("All paths use standard SVG coordinates (Y-down), automatically transformed.", {
      x: 50,
      y: 695,
      size: 9,
      color: grayscale(0.5),
    });

    // Simple triangle pointing down (in SVG, Y increases downward)
    page.drawText("Triangle (points down):", { x: 50, y: 660, size: 10, color: black });
    page.drawSvgPath("M 0 0 L 50 0 L 25 40 Z", { x: 60, y: 645, color: red });

    // 5-pointed star (standard SVG star path)
    page.drawText("Star:", { x: 150, y: 660, size: 10, color: black });
    const starPath =
      "M 25 0 L 31 18 L 50 18 L 35 29 L 40 47 L 25 36 L 10 47 L 15 29 L 0 18 L 19 18 Z";
    page.drawSvgPath(starPath, { x: 160, y: 650, color: rgb(1, 0.8, 0) });

    // Heart shape using bezier curves
    page.drawText("Heart (beziers):", { x: 270, y: 660, size: 10, color: black });
    // Classic heart: two lobes at top, point at bottom
    const heartPath =
      "M 25 8 C 25 0 15 0 10 5 C 0 15 0 20 25 40 C 50 20 50 15 40 5 C 35 0 25 0 25 8 Z";
    page.drawSvgPath(heartPath, { x: 280, y: 655, color: rgb(1, 0.2, 0.4) });

    // Wave pattern using cubic beziers
    page.drawText("Wave (cubic beziers):", { x: 400, y: 660, size: 10, color: black });
    page.drawSvgPath("M 0 20 C 20 0 40 40 60 20 C 80 0 100 40 120 20 C 140 0 160 40 180 20", {
      x: 400,
      y: 645,
      borderColor: blue,
      borderWidth: 2,
    });

    // Staircase using relative commands (going down-right in SVG = going up-right in PDF)
    page.drawText("Staircase (relative):", { x: 50, y: 560, size: 10, color: black });
    page.drawSvgPath("M 0 0 l 25 0 l 0 15 l 25 0 l 0 15 l 25 0 l 0 15 l 25 0 l 0 15", {
      x: 50,
      y: 545,
      borderColor: green,
      borderWidth: 2,
    });

    // Grid using H and V commands
    page.drawText("Grid (H/V lines):", { x: 220, y: 560, size: 10, color: black });
    page.drawSvgPath(
      "M 0 0 H 80 V 60 H 0 V 0 M 20 0 V 60 M 40 0 V 60 M 60 0 V 60 M 0 20 H 80 M 0 40 H 80",
      { x: 220, y: 555, borderColor: grayscale(0.3), borderWidth: 1 },
    );

    // Smooth cubic curves (S command)
    page.drawText("Smooth curves (S):", { x: 380, y: 560, size: 10, color: black });
    page.drawSvgPath("M 0 30 C 0 0 30 0 30 30 S 60 60 60 30 S 90 0 90 30", {
      x: 380,
      y: 545,
      borderColor: rgb(0.6, 0.2, 0.8),
      borderWidth: 2,
    });

    // Quadratic curves (Q command)
    page.drawText("Quadratic curves (Q):", { x: 50, y: 460, size: 10, color: black });
    page.drawSvgPath("M 0 0 Q 40 50 80 0 Q 120 50 160 0 Q 200 50 240 0", {
      x: 50,
      y: 450,
      borderColor: rgb(0.8, 0.4, 0),
      borderWidth: 2,
    });

    // Smooth quadratic (T command)
    page.drawText("Smooth quadratic (T):", { x: 350, y: 460, size: 10, color: black });
    page.drawSvgPath("M 0 20 Q 20 0 40 20 T 80 20 T 120 20 T 160 20", {
      x: 350,
      y: 450,
      borderColor: rgb(0, 0.6, 0.6),
      borderWidth: 2,
    });

    // Smiley face using arcs
    page.drawText("Arcs - Smiley:", { x: 50, y: 360, size: 10, color: black });
    // Face outline (circle using two arcs)
    page.drawSvgPath("M 40 0 A 40 40 0 1 1 40 80 A 40 40 0 1 1 40 0", {
      x: 60,
      y: 350,
      borderColor: rgb(0.9, 0.7, 0.1),
      borderWidth: 3,
    });
    // Left eye
    page.drawSvgPath("M 25 25 A 5 5 0 1 1 25 35 A 5 5 0 1 1 25 25", {
      x: 60,
      y: 350,
      color: black,
    });
    // Right eye
    page.drawSvgPath("M 55 25 A 5 5 0 1 1 55 35 A 5 5 0 1 1 55 25", {
      x: 60,
      y: 350,
      color: black,
    });
    // Smile (arc curving down in SVG = smile in PDF)
    page.drawSvgPath("M 20 50 A 25 25 0 0 0 60 50", {
      x: 60,
      y: 350,
      borderColor: black,
      borderWidth: 2,
    });

    // Even-odd fill rule - nested squares (creates hole)
    page.drawText("Even-odd fill (hole):", { x: 200, y: 360, size: 10, color: black });
    page.drawSvgPath("M 0 0 L 80 0 L 80 80 L 0 80 Z M 20 20 L 60 20 L 60 60 L 20 60 Z", {
      x: 200,
      y: 355,
      color: blue,
      windingRule: "evenodd",
    });

    // Multiple subpaths - checkerboard pattern
    page.drawText("Multiple subpaths:", { x: 320, y: 360, size: 10, color: black });
    page.drawSvgPath(
      "M 0 0 L 20 0 L 20 20 L 0 20 Z " +
        "M 40 0 L 60 0 L 60 20 L 40 20 Z " +
        "M 20 20 L 40 20 L 40 40 L 20 40 Z " +
        "M 0 40 L 20 40 L 20 60 L 0 60 Z " +
        "M 40 40 L 60 40 L 60 60 L 40 60 Z",
      { x: 320, y: 355, color: black },
    );

    // Arrow icon (custom path, not from any icon library)
    page.drawText("Arrow icon:", { x: 440, y: 360, size: 10, color: black });
    const arrowPath = "M 0 15 L 30 15 L 30 5 L 50 25 L 30 45 L 30 35 L 0 35 Z";
    page.drawSvgPath(arrowPath, { x: 440, y: 355, color: rgb(0.3, 0.3, 0.7) });

    // Chaining with PathBuilder methods
    page.drawText("Chaining with PathBuilder:", { x: 50, y: 240, size: 10, color: black });
    page
      .drawPath()
      .moveTo(50, 220)
      .appendSvgPath("l 30 0 l -15 -30 z", { flipY: false }) // triangle in PDF coords
      .fill({ color: rgb(0.5, 0.8, 0.5) });

    // Leaf shape using quadratic curves
    page.drawText("Leaf shape:", { x: 150, y: 240, size: 10, color: black });
    const leafPath = "M 25 0 Q 50 25 25 50 Q 0 25 25 0 Z";
    page.drawSvgPath(leafPath, { x: 160, y: 230, color: rgb(0.3, 0.7, 0.3) });

    // Crescent moon using arcs
    page.drawText("Crescent:", { x: 250, y: 240, size: 10, color: black });
    const crescentPath = "M 20 0 A 20 20 0 1 1 20 40 A 15 15 0 1 0 20 0 Z";
    page.drawSvgPath(crescentPath, { x: 260, y: 235, color: rgb(0.9, 0.8, 0.2) });

    // Footer
    page.drawLine({
      start: { x: 50, y: 50 },
      end: { x: 562, y: 50 },
      color: grayscale(0.7),
    });

    page.drawText("SVG path commands: M, L, H, V, C, S, Q, T, A, Z (and lowercase relative)", {
      x: 50,
      y: 35,
      size: 9,
      color: grayscale(0.5),
    });

    const bytes = await pdf.save();
    expect(isPdfHeader(bytes)).toBe(true);
    await saveTestOutput("drawing/svg-paths.pdf", bytes);
  });

  it("draws paths designed for PDF coordinates", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    // Title
    page.drawText("SVG Paths in PDF Coordinate System", {
      x: 50,
      y: 720,
      font: "Helvetica-Bold",
      size: 20,
      color: black,
    });

    page.drawLine({
      start: { x: 50, y: 710 },
      end: { x: 450, y: 710 },
      color: grayscale(0.5),
    });

    page.drawText("Note: PDF uses bottom-left origin (Y increases upward)", {
      x: 50,
      y: 690,
      size: 10,
      color: grayscale(0.5),
    });

    // Row 1: Basic shapes drawn with SVG paths
    // NOTE: flipY: false because these paths use raw PDF coordinates (Y-up)
    page.drawText("Heart (beziers):", { x: 50, y: 650, size: 10, color: black });
    // Heart shape - designed for PDF coordinates (Y up)
    page.drawSvgPath(
      "M 100 600 C 100 620 80 635 60 635 C 35 635 20 615 20 595 C 20 565 60 540 100 515 C 140 540 180 565 180 595 C 180 615 165 635 140 635 C 120 635 100 620 100 600 Z",
      { color: rgb(0.9, 0.2, 0.3), flipY: false },
    );

    page.drawText("Star (lines):", { x: 220, y: 650, size: 10, color: black });
    // 5-pointed star
    page.drawSvgPath(
      "M 280 640 L 290 610 L 320 610 L 295 590 L 305 560 L 280 578 L 255 560 L 265 590 L 240 610 L 270 610 Z",
      { color: rgb(1, 0.8, 0), flipY: false },
    );

    page.drawText("Arrow (mixed):", { x: 370, y: 650, size: 10, color: black });
    // Right-pointing arrow
    page.drawSvgPath(
      "M 380 600 L 380 620 L 440 620 L 440 635 L 480 605 L 440 575 L 440 590 L 380 590 Z",
      { color: rgb(0.2, 0.6, 0.9), flipY: false },
    );

    // Row 2: Curves
    page.drawText("Spiral (arcs):", { x: 50, y: 530, size: 10, color: black });
    page.drawSvgPath(
      "M 100 480 A 15 15 0 0 1 100 510 A 20 20 0 0 1 100 470 A 25 25 0 0 1 100 520 A 30 30 0 0 1 100 460",
      { borderColor: rgb(0.5, 0.2, 0.7), borderWidth: 2, flipY: false },
    );

    page.drawText("Waves (cubic):", { x: 180, y: 530, size: 10, color: black });
    page.drawSvgPath(
      "M 180 490 C 200 520 220 460 240 490 C 260 520 280 460 300 490 C 320 520 340 460 360 490",
      { borderColor: rgb(0.2, 0.7, 0.5), borderWidth: 2, flipY: false },
    );

    page.drawText("Smooth S-curve:", { x: 400, y: 530, size: 10, color: black });
    page.drawSvgPath("M 400 490 C 420 520 440 520 460 490 S 500 460 520 490", {
      borderColor: rgb(0.8, 0.4, 0.2),
      borderWidth: 2,
      flipY: false,
    });

    // Row 3: Shapes with holes (even-odd)
    page.drawText("Donut (even-odd):", { x: 50, y: 420, size: 10, color: black });
    // Outer circle, then inner circle - even-odd creates hole
    page.drawSvgPath("M 100 410 A 30 30 0 1 0 100 410.01 Z M 100 395 A 15 15 0 1 1 100 394.99 Z", {
      color: rgb(0.6, 0.4, 0.2),
      windingRule: "evenodd",
      flipY: false,
    });

    page.drawText("Frame (even-odd):", { x: 180, y: 420, size: 10, color: black });
    page.drawSvgPath(
      "M 180 400 L 280 400 L 280 340 L 180 340 Z M 200 380 L 260 380 L 260 360 L 200 360 Z",
      { color: rgb(0.3, 0.5, 0.7), windingRule: "evenodd", flipY: false },
    );

    page.drawText("Badge:", { x: 320, y: 420, size: 10, color: black });
    // Shield/badge shape
    page.drawSvgPath(
      "M 370 400 L 420 400 L 420 360 C 420 340 395 320 395 320 C 395 320 370 340 370 360 Z",
      {
        color: rgb(0.8, 0.2, 0.2),
        borderColor: rgb(0.6, 0.1, 0.1),
        borderWidth: 2,
        flipY: false,
      },
    );

    // Row 4: Relative commands demonstration
    page.drawText("Relative staircase:", { x: 50, y: 300, size: 10, color: black });
    page.drawSvgPath("M 50 280 l 20 0 l 0 20 l 20 0 l 0 20 l 20 0 l 0 20 l 20 0", {
      borderColor: grayscale(0.3),
      borderWidth: 2,
      flipY: false,
    });

    page.drawText("Relative zigzag:", { x: 180, y: 300, size: 10, color: black });
    page.drawSvgPath("M 180 260 l 20 30 l 20 -30 l 20 30 l 20 -30 l 20 30 l 20 -30", {
      borderColor: rgb(0.9, 0.5, 0.1),
      borderWidth: 2,
      flipY: false,
    });

    page.drawText("H/V lines grid:", { x: 350, y: 300, size: 10, color: black });
    page.drawSvgPath(
      "M 350 280 H 430 V 220 H 350 V 280 M 370 280 V 220 M 390 280 V 220 M 410 280 V 220 M 350 260 H 430 M 350 240 H 430",
      { borderColor: grayscale(0.4), borderWidth: 1, flipY: false },
    );

    // Row 5: Quadratic curves
    page.drawText("Quadratic bounce:", { x: 50, y: 190, size: 10, color: black });
    page.drawSvgPath("M 50 150 Q 80 190 110 150 T 170 150 T 230 150", {
      borderColor: rgb(0.2, 0.6, 0.8),
      borderWidth: 2,
      flipY: false,
    });

    page.drawText("Leaf shape:", { x: 280, y: 190, size: 10, color: black });
    page.drawSvgPath("M 330 170 Q 350 130 380 150 Q 410 170 380 190 Q 350 210 330 170 Z", {
      color: rgb(0.3, 0.7, 0.3),
      flipY: false,
    });

    // Footer
    page.drawLine({
      start: { x: 50, y: 60 },
      end: { x: 562, y: 60 },
      color: grayscale(0.7),
    });
    page.drawText(
      "All paths drawn using SVG path syntax with coordinates designed for PDF (Y increases upward)",
      {
        x: 50,
        y: 45,
        size: 9,
        color: grayscale(0.5),
      },
    );

    const bytes = await pdf.save();
    expect(isPdfHeader(bytes)).toBe(true);
    await saveTestOutput("drawing/svg-paths-showcase.pdf", bytes);
  });

  it("draws SVG icons with automatic coordinate transform", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    page.drawText("SVG Path Transform Demo", { x: 50, y: 750, size: 24, color: black });
    page.drawLine({
      start: { x: 50, y: 740 },
      end: { x: 550, y: 740 },
      color: grayscale(0.5),
    });
    page.drawText("drawSvgPath() automatically converts SVG coordinates (Y-down) to PDF (Y-up).", {
      x: 50,
      y: 720,
      size: 10,
      color: grayscale(0.5),
    });
    page.drawText("Use x, y to position and scale to resize.", {
      x: 50,
      y: 705,
      size: 10,
      color: grayscale(0.5),
    });

    // Simple triangle - in SVG this points DOWN (Y increases downward)
    // After transform it should point DOWN in PDF too (visually correct)
    const trianglePath = "M 0 0 L 50 0 L 25 40 Z";

    page.drawText("Triangle: M 0 0 L 50 0 L 25 40 Z", { x: 50, y: 650, size: 11, color: black });
    page.drawText("(Points down in SVG, renders pointing down)", {
      x: 50,
      y: 635,
      size: 9,
      color: grayscale(0.5),
    });

    page.drawSvgPath(trianglePath, {
      x: 70,
      y: 620,
      color: rgb(0.2, 0.5, 0.9),
    });

    // Arrow pointing right in SVG coordinates
    const arrowPath = "M 0 15 L 30 15 L 30 5 L 50 25 L 30 45 L 30 35 L 0 35 Z";

    page.drawText("Right arrow:", { x: 50, y: 530, size: 11, color: black });
    page.drawSvgPath(arrowPath, {
      x: 70,
      y: 525,
      color: rgb(0.2, 0.7, 0.3),
    });

    // Same arrow scaled down
    page.drawText("Same arrow at 50% scale:", { x: 200, y: 530, size: 11, color: black });
    page.drawSvgPath(arrowPath, {
      x: 220,
      y: 520,
      scale: 0.5,
      color: rgb(0.8, 0.3, 0.3),
    });

    // Custom heart icon (original path, not from any library)
    const heartPath = "M 12 4 C 12 4 8 0 4 4 C 0 8 0 12 12 22 C 24 12 24 8 20 4 C 16 0 12 4 12 4 Z";

    page.drawText("Heart icon (custom 24x24):", {
      x: 50,
      y: 420,
      size: 11,
      color: black,
    });

    // At original size
    page.drawText("1x:", { x: 70, y: 390, size: 10, color: black });
    page.drawSvgPath(heartPath, {
      x: 90,
      y: 395,
      color: rgb(0.9, 0.2, 0.2),
    });

    // Scaled 2x
    page.drawText("2x:", { x: 150, y: 390, size: 10, color: black });
    page.drawSvgPath(heartPath, {
      x: 170,
      y: 400,
      scale: 2,
      color: rgb(0.9, 0.2, 0.2),
    });

    // Scaled 3x
    page.drawText("3x:", { x: 270, y: 390, size: 10, color: black });
    page.drawSvgPath(heartPath, {
      x: 290,
      y: 410,
      scale: 3,
      color: rgb(0.9, 0.2, 0.2),
    });

    // Checkmark icon (custom path)
    const checkPath = "M 2 12 L 9 19 L 22 6 L 20 4 L 9 15 L 4 10 Z";

    page.drawText("Checkmark icon:", { x: 50, y: 280, size: 11, color: black });
    page.drawSvgPath(checkPath, {
      x: 70,
      y: 285,
      scale: 2,
      color: rgb(0.2, 0.7, 0.3),
    });

    // Close/X icon (custom path)
    const closePath =
      "M 4 4 L 12 12 L 4 20 L 6 22 L 14 14 L 22 22 L 24 20 L 16 12 L 24 4 L 22 2 L 14 10 L 6 2 Z";

    page.drawText("Close icon:", { x: 200, y: 280, size: 11, color: black });
    page.drawSvgPath(closePath, {
      x: 220,
      y: 285,
      scale: 2,
      color: rgb(0.8, 0.2, 0.2),
    });

    // Plus icon (custom path)
    const plusPath =
      "M 10 2 L 14 2 L 14 10 L 22 10 L 22 14 L 14 14 L 14 22 L 10 22 L 10 14 L 2 14 L 2 10 L 10 10 Z";

    page.drawText("Plus icon:", { x: 350, y: 280, size: 11, color: black });
    page.drawSvgPath(plusPath, {
      x: 370,
      y: 285,
      scale: 2,
      color: rgb(0.2, 0.5, 0.8),
    });

    // Note
    page.drawRectangle({
      x: 50,
      y: 60,
      width: 500,
      height: 50,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: grayscale(0.7),
      borderWidth: 0.5,
    });
    page.drawText("SVG paths are automatically transformed:", {
      x: 60,
      y: 95,
      size: 10,
      color: black,
    });
    page.drawText("Y coordinates flipped, then scaled and translated to (x, y) position.", {
      x: 60,
      y: 80,
      size: 9,
      color: grayscale(0.4),
    });

    const bytes = await pdf.save();
    expect(isPdfHeader(bytes)).toBe(true);
    await saveTestOutput("drawing/svg-paths-transform.pdf", bytes);
  });

  it("draws complex real-world SVG icons", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ size: "letter" });

    page.drawText("Complex Real-World SVG Icons", { x: 50, y: 750, size: 20, color: black });
    page.drawLine({
      start: { x: 50, y: 740 },
      end: { x: 550, y: 740 },
      color: grayscale(0.5),
    });

    // === Simple Icons (CC0 licensed) - Complex filled brand logos ===
    // These are 24x24 viewBox, filled paths

    // Simple Icons: GitHub (24x24) - CC0
    const siGithub =
      "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

    page.drawText("Simple Icons: GitHub (24x24):", { x: 50, y: 710, size: 11, color: black });
    page.drawSvgPath(siGithub, {
      x: 50,
      y: 700,
      scale: 2,
      color: grayscale(0.1),
    });

    // Simple Icons: TypeScript (24x24) - CC0
    const siTypescript =
      "M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z";

    page.drawText("Simple Icons: TypeScript (24x24):", {
      x: 160,
      y: 710,
      size: 11,
      color: black,
    });
    page.drawSvgPath(siTypescript, {
      x: 160,
      y: 700,
      scale: 2,
      color: rgb(0.19, 0.47, 0.71),
    });

    // Simple Icons: npm (24x24) - CC0
    const siNpm =
      "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z";

    page.drawText("Simple Icons: npm (24x24):", { x: 280, y: 710, size: 11, color: black });
    page.drawSvgPath(siNpm, {
      x: 280,
      y: 700,
      scale: 2,
      color: rgb(0.8, 0.22, 0.17),
    });

    // Simple Icons: Docker (24x24) - CC0
    const siDocker =
      "M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z";

    page.drawText("Simple Icons: Docker (24x24):", { x: 400, y: 710, size: 11, color: black });
    page.drawSvgPath(siDocker, {
      x: 400,
      y: 700,
      scale: 2,
      color: rgb(0.09, 0.46, 0.82),
    });

    // === Lucide Icons (MIT licensed) - Stroke-based UI icons ===
    // These are 24x24 viewBox, stroke paths (use borderColor, not color)

    // Lucide: heart (24x24) - MIT
    const lucideHeart =
      "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

    page.drawText("Lucide: Heart (stroke):", { x: 50, y: 580, size: 11, color: black });
    page.drawSvgPath(lucideHeart, {
      x: 50,
      y: 570,
      scale: 2,
      borderColor: rgb(0.9, 0.2, 0.2),
      borderWidth: 2,
    });

    // Lucide: star (24x24) - MIT
    const lucideStar =
      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

    page.drawText("Lucide: Star (stroke):", { x: 160, y: 580, size: 11, color: black });
    page.drawSvgPath(lucideStar, {
      x: 160,
      y: 570,
      scale: 2,
      borderColor: rgb(0.9, 0.7, 0.1),
      borderWidth: 2,
    });

    // Lucide: user (24x24) - MIT
    const lucideUser =
      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z";

    page.drawText("Lucide: User (stroke):", { x: 280, y: 580, size: 11, color: black });
    page.drawSvgPath(lucideUser, {
      x: 280,
      y: 570,
      scale: 2,
      borderColor: rgb(0.3, 0.5, 0.8),
      borderWidth: 2,
    });

    // Lucide: mail (24x24) - MIT
    const lucideMail =
      "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6";

    page.drawText("Lucide: Mail (stroke):", { x: 400, y: 580, size: 11, color: black });
    page.drawSvgPath(lucideMail, {
      x: 400,
      y: 570,
      scale: 2,
      borderColor: rgb(0.6, 0.3, 0.7),
      borderWidth: 2,
    });

    // Lucide: home (24x24) - MIT
    const lucideHome = "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10";

    page.drawText("Lucide: Home (stroke):", { x: 50, y: 450, size: 11, color: black });
    page.drawSvgPath(lucideHome, {
      x: 50,
      y: 440,
      scale: 2,
      borderColor: rgb(0.2, 0.6, 0.4),
      borderWidth: 2,
    });

    // Lucide: settings (24x24) - MIT
    const lucideSettings =
      "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z";

    page.drawText("Lucide: Settings (stroke):", { x: 160, y: 450, size: 11, color: black });
    page.drawSvgPath(lucideSettings, {
      x: 160,
      y: 440,
      scale: 2,
      borderColor: grayscale(0.4),
      borderWidth: 1.5,
    });

    // Lucide: search (24x24) - MIT
    const lucideSearch = "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35";

    page.drawText("Lucide: Search (stroke):", { x: 280, y: 450, size: 11, color: black });
    page.drawSvgPath(lucideSearch, {
      x: 280,
      y: 440,
      scale: 2,
      borderColor: rgb(0.4, 0.4, 0.8),
      borderWidth: 2,
    });

    // Lucide: bell (24x24) - MIT
    const lucideBell = "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0";

    page.drawText("Lucide: Bell (stroke):", { x: 400, y: 450, size: 11, color: black });
    page.drawSvgPath(lucideBell, {
      x: 400,
      y: 440,
      scale: 2,
      borderColor: rgb(0.8, 0.5, 0.1),
      borderWidth: 2,
    });

    // === Decorative paths ===

    // Wave pattern using quadratic bezier curves
    const wavePath = "M0 20 Q 15 0 30 20 T 60 20 T 90 20 T 120 20";

    page.drawText("Wave pattern (Q curves):", { x: 50, y: 330, size: 11, color: black });
    page.drawSvgPath(wavePath, {
      x: 50,
      y: 310,
      scale: 1.5,
      borderColor: rgb(0.2, 0.6, 0.8),
      borderWidth: 2,
    });

    // Lucide: file-text (24x24) - MIT
    const lucideFileText =
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8";

    page.drawText("Lucide: File (stroke):", { x: 300, y: 330, size: 11, color: black });
    page.drawSvgPath(lucideFileText, {
      x: 300,
      y: 320,
      scale: 2,
      borderColor: rgb(0.5, 0.3, 0.6),
      borderWidth: 1.5,
    });

    // More Simple Icons for variety

    // Simple Icons: Bun (24x24) - CC0
    const siBun =
      "M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687v.001ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869v.001Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z";

    page.drawText("Simple Icons: Bun (24x24):", { x: 50, y: 230, size: 11, color: black });
    page.drawSvgPath(siBun, {
      x: 50,
      y: 220,
      scale: 2,
      color: rgb(0.98, 0.76, 0.62),
    });

    // Simple Icons: Node.js (24x24) - CC0
    const siNodejs =
      "M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z";

    page.drawText("Simple Icons: Node.js (24x24):", { x: 160, y: 230, size: 11, color: black });
    page.drawSvgPath(siNodejs, {
      x: 160,
      y: 220,
      scale: 2,
      color: rgb(0.2, 0.52, 0.29),
    });

    // Simple Icons: Rust (24x24) - CC0
    const siRust =
      "M23.8346 11.7033l-1.0073-.6236a13.7268 13.7268 0 00-.0283-.2936l.8656-.8069a.3483.3483 0 00-.1154-.578l-1.1066-.414a8.4958 8.4958 0 00-.087-.2856l.6904-.9587a.3462.3462 0 00-.2257-.5446l-1.1663-.1894a9.3574 9.3574 0 00-.1407-.2622l.49-1.0761a.3437.3437 0 00-.0274-.3361.3486.3486 0 00-.3006-.154l-1.1845.0416a6.7444 6.7444 0 00-.1873-.2268l.2723-1.153a.3472.3472 0 00-.417-.4172l-1.1532.2724a14.0183 14.0183 0 00-.2278-.1873l.0415-1.1845a.3442.3442 0 00-.49-.328l-1.076.491c-.0872-.0476-.1742-.0952-.2623-.1407l-.1903-1.1673A.3483.3483 0 0016.256.955l-.9597.6905a8.4867 8.4867 0 00-.2855-.086l-.414-1.1066a.3483.3483 0 00-.5781-.1154l-.8069.8666a9.2936 9.2936 0 00-.2936-.0284L12.2946.1683a.3462.3462 0 00-.5892 0l-.6236 1.0073a13.7383 13.7383 0 00-.2936.0284L9.9803.3374a.3462.3462 0 00-.578.1154l-.4141 1.1065c-.0962.0274-.1903.0567-.2855.086L7.744.955a.3483.3483 0 00-.5447.2258L7.009 2.348a9.3574 9.3574 0 00-.2622.1407l-1.0762-.491a.3462.3462 0 00-.49.328l.0416 1.1845a7.9826 7.9826 0 00-.2278.1873L3.8413 3.425a.3472.3472 0 00-.4171.4171l.2713 1.1531c-.0628.075-.1255.1509-.1863.2268l-1.1845-.0415a.3462.3462 0 00-.328.49l.491 1.0761a9.167 9.167 0 00-.1407.2622l-1.1662.1894a.3483.3483 0 00-.2258.5446l.6904.9587a13.303 13.303 0 00-.087.2855l-1.1065.414a.3483.3483 0 00-.1155.5781l.8656.807a9.2936 9.2936 0 00-.0283.2935l-1.0073.6236a.3442.3442 0 000 .5892l1.0073.6236c.008.0982.0182.1964.0283.2936l-.8656.8079a.3462.3462 0 00.1155.578l1.1065.4141c.0273.0962.0567.1914.087.2855l-.6904.9587a.3452.3452 0 00.2268.5447l1.1662.1893c.0456.088.0922.1751.1408.2622l-.491 1.0762a.3462.3462 0 00.328.49l1.1834-.0415c.0618.0769.1235.1528.1873.2277l-.2713 1.1541a.3462.3462 0 00.4171.4161l1.153-.2713c.075.0638.151.1255.2279.1863l-.0415 1.1845a.3442.3442 0 00.49.327l1.0761-.49c.087.0486.1741.0951.2622.1407l.1903 1.1662a.3483.3483 0 00.5447.2268l.9587-.6904a9.299 9.299 0 00.2855.087l.414 1.1066a.3452.3452 0 00.5781.1154l.8079-.8656c.0972.0111.1954.0203.2936.0294l.6236 1.0073a.3472.3472 0 00.5892 0l.6236-1.0073c.0982-.0091.1964-.0183.2936-.0294l.8069.8656a.3483.3483 0 00.578-.1154l.4141-1.1066a8.4626 8.4626 0 00.2855-.087l.9587.6904a.3452.3452 0 00.5447-.2268l.1903-1.1662c.088-.0456.1751-.0931.2622-.1407l1.0762.49a.3472.3472 0 00.49-.327l-.0415-1.1845a6.7267 6.7267 0 00.2267-.1863l1.1531.2713a.3472.3472 0 00.4171-.416l-.2713-1.1542c.0628-.0749.1255-.1508.1863-.2278l1.1845.0415a.3442.3442 0 00.328-.49l-.49-1.076c.0475-.0872.0951-.1742.1407-.2623l1.1662-.1893a.3483.3483 0 00.2258-.5447l-.6904-.9587.087-.2855 1.1066-.414a.3462.3462 0 00.1154-.5781l-.8656-.8079c.0101-.0972.0202-.1954.0283-.2936l1.0073-.6236a.3442.3442 0 000-.5892zm-6.7413 8.3551a.7138.7138 0 01.2986-1.396.714.714 0 11-.2997 1.396zm-.3422-2.3142a.649.649 0 00-.7715.5l-.3573 1.6685c-1.1035.501-2.3285.7795-3.6193.7795a8.7368 8.7368 0 01-3.6951-.814l-.3574-1.6684a.648.648 0 00-.7714-.499l-1.473.3158a8.7216 8.7216 0 01-.7613-.898h7.1676c.081 0 .1356-.0141.1356-.088v-2.536c0-.074-.0536-.0881-.1356-.0881h-2.0966v-1.6077h2.2677c.2065 0 1.1065.0587 1.394 1.2088.0901.3533.2875 1.5044.4232 1.8729.1346.413.6833 1.2381 1.2685 1.2381h3.5716a.7492.7492 0 00.1296-.0131 8.7874 8.7874 0 01-.8119.9526zM6.8369 20.024a.714.714 0 11-.2997-1.396.714.714 0 01.2997 1.396zM4.1177 8.9972a.7137.7137 0 11-1.304.5791.7137.7137 0 011.304-.579zm-.8352 1.9813l1.5347-.6824a.65.65 0 00.33-.8585l-.3158-.7147h1.2432v5.6025H3.5669a8.7753 8.7753 0 01-.2834-3.348zm6.7343-.5437V8.7836h2.9601c.153 0 1.0792.1772 1.0792.8697 0 .575-.7107.7815-1.2948.7815zm10.7574 1.4862c0 .2187-.008.4363-.0243.651h-.9c-.09 0-.1265.0586-.1265.1477v.413c0 .973-.5487 1.1846-1.0296 1.2382-.4576.0517-.9648-.1913-1.0275-.4717-.2704-1.5186-.7198-1.8436-1.4305-2.4034.8817-.5599 1.799-1.386 1.799-2.4915 0-1.1936-.819-1.9458-1.3769-2.3153-.7825-.5163-1.6491-.6195-1.883-.6195H5.4682a8.7651 8.7651 0 014.907-2.7699l1.0974 1.151a.648.648 0 00.9182.0213l1.227-1.1743a8.7753 8.7753 0 016.0044 4.2762l-.8403 1.8982a.652.652 0 00.33.8585l1.6178.7188c.0283.2875.0425.577.0425.8717zm-9.3006-9.5993a.7128.7128 0 11.984 1.0316.7137.7137 0 01-.984-1.0316zm8.3389 6.71a.7107.7107 0 01.9395-.3625.7137.7137 0 11-.9405.3635z";

    page.drawText("Simple Icons: Rust (24x24):", { x: 280, y: 230, size: 11, color: black });
    page.drawSvgPath(siRust, {
      x: 280,
      y: 220,
      scale: 2,
      color: grayscale(0.15),
    });

    // Note
    page.drawRectangle({
      x: 50,
      y: 60,
      width: 500,
      height: 60,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: grayscale(0.7),
      borderWidth: 0.5,
    });
    page.drawText("Icons from open source libraries with permissive licenses:", {
      x: 60,
      y: 105,
      size: 10,
      color: black,
    });
    page.drawText("Simple Icons (CC0): GitHub, TypeScript, npm, Docker, Bun, Node.js, Rust", {
      x: 60,
      y: 90,
      size: 9,
      color: grayscale(0.4),
    });
    page.drawText("Lucide (MIT): Heart, Star, User, Mail, Home, Settings, Search, Bell, File", {
      x: 60,
      y: 75,
      size: 9,
      color: grayscale(0.4),
    });

    const bytes = await pdf.save();
    expect(isPdfHeader(bytes)).toBe(true);
    await saveTestOutput("drawing/svg-icons-complex.pdf", bytes);
  });

  it("tiles a large sewing pattern across multiple pages", async () => {
    // This test demonstrates the use case from Reddit:
    // "I am currently using both PDFKit and pdfjs to create printable sewing patterns
    // from SVG data. I currently have to take all my SVG path data, put it into an A0 PDF,
    // load that PDF into a canvas element, then chop up the canvas image data into US letter sizes."
    //
    // With libpdf, you can directly render the SVG path to multiple pages without
    // the intermediate canvas step.

    const pdf = PDF.create();

    // A large sewing pattern - this would typically come from your SVG file
    // This is a simplified dress/shirt pattern piece with:
    // - Curved neckline, armhole, and hem
    // - Notches for alignment
    // - Grain line indicator
    // Pattern is designed at ~800x1200 points (roughly A3 size)
    const patternWidth = 800;
    const patternHeight = 1200;

    // Main pattern piece outline (bodice front)
    const patternOutline = `
      M 100 50
      L 100 100
      Q 80 150 100 200
      L 100 1100
      Q 150 1150 400 1150
      Q 650 1150 700 1100
      L 700 200
      Q 720 150 700 100
      L 700 50
      Q 600 0 400 0
      Q 200 0 100 50
      Z
    `;

    // Neckline curve (cut out)
    const neckline = `
      M 250 50
      Q 300 120 400 120
      Q 500 120 550 50
    `;

    // Left armhole
    const leftArmhole = `
      M 100 200
      Q 50 300 80 400
      Q 100 450 100 500
    `;

    // Right armhole
    const rightArmhole = `
      M 700 200
      Q 750 300 720 400
      Q 700 450 700 500
    `;

    // Grain line (arrow indicating fabric grain direction)
    const grainLine = `
      M 400 300
      L 400 900
      M 380 340
      L 400 300
      L 420 340
      M 380 860
      L 400 900
      L 420 860
    `;

    // Notches for alignment (small triangles)
    const notches = `
      M 100 600 L 85 615 L 100 630
      M 700 600 L 715 615 L 700 630
      M 300 1150 L 300 1170 L 320 1150
      M 500 1150 L 500 1170 L 480 1150
    `;

    // Dart markings
    const darts = `
      M 250 800 L 300 600 L 350 800
      M 450 800 L 500 600 L 550 800
    `;

    // Seam allowance line (dashed, 15pt inside the edge)
    const seamAllowance = `
      M 115 65
      L 115 115
      Q 95 160 115 210
      L 115 1085
      Q 160 1135 400 1135
      Q 640 1135 685 1085
      L 685 210
      Q 705 160 685 115
      L 685 65
      Q 590 15 400 15
      Q 210 15 115 65
    `;

    // Target page size (US Letter)
    const pageWidth = 612; // 8.5 inches
    const pageHeight = 792; // 11 inches
    const margin = 36; // 0.5 inch margin for printer

    // Calculate printable area
    const printableWidth = pageWidth - 2 * margin;
    const printableHeight = pageHeight - 2 * margin;

    // With overlap, each tile (except the first) covers less new area
    // First tile covers printableWidth, subsequent tiles cover (printableWidth - overlap)
    // So: patternWidth = printableWidth + (pagesX - 1) * (printableWidth - overlap)
    // Solving for pagesX: pagesX = 1 + ceil((patternWidth - printableWidth) / (printableWidth - overlap))
    const overlapAmount = 18; // Will be used later, defined here for calculation
    const effectiveTileWidth = printableWidth - overlapAmount;
    const effectiveTileHeight = printableHeight - overlapAmount;

    const pagesX =
      patternWidth <= printableWidth
        ? 1
        : 1 + Math.ceil((patternWidth - printableWidth) / effectiveTileWidth);
    const pagesY =
      patternHeight <= printableHeight
        ? 1
        : 1 + Math.ceil((patternHeight - printableHeight) / effectiveTileHeight);
    const totalPages = pagesX * pagesY;

    // Overlap amount - pages overlap by this much when assembled
    const overlap = overlapAmount;

    // Helper to draw pattern content on a tile
    const drawPatternOnPage = (
      page: ReturnType<typeof pdf.addPage>,
      pageCol: number,
      pageRow: number,
    ) => {
      // Draw page info
      page.drawText(`Sewing Pattern - Page ${pageRow * pagesX + pageCol + 1} of ${totalPages}`, {
        x: margin,
        y: pageHeight - 20,
        size: 10,
        color: grayscale(0.5),
      });
      page.drawText(`Tile: Column ${pageCol + 1} of ${pagesX}, Row ${pageRow + 1} of ${pagesY}`, {
        x: margin,
        y: pageHeight - 32,
        size: 8,
        color: grayscale(0.6),
      });

      // Draw registration marks for overlapping assembly
      // These marks appear in the overlap region so adjacent pages can be aligned
      const markSize = 10;

      // Helper to draw a cross mark at a position
      const drawCrossMark = (cx: number, cy: number) => {
        page.drawLine({
          start: { x: cx - markSize / 2, y: cy },
          end: { x: cx + markSize / 2, y: cy },
          color: black,
          thickness: 0.5,
        });
        page.drawLine({
          start: { x: cx, y: cy - markSize / 2 },
          end: { x: cx, y: cy + markSize / 2 },
          color: black,
          thickness: 0.5,
        });
      };

      // Draw marks on all four edges (in the overlap regions)
      // These will align with corresponding marks on adjacent pages

      // Top edge marks (will align with bottom of page above)
      if (pageRow > 0) {
        drawCrossMark(margin + printableWidth * 0.25, pageHeight - margin);
        drawCrossMark(margin + printableWidth * 0.5, pageHeight - margin);
        drawCrossMark(margin + printableWidth * 0.75, pageHeight - margin);
      }

      // Bottom edge marks (will align with top of page below)
      if (pageRow < pagesY - 1) {
        drawCrossMark(margin + printableWidth * 0.25, margin);
        drawCrossMark(margin + printableWidth * 0.5, margin);
        drawCrossMark(margin + printableWidth * 0.75, margin);
      }

      // Left edge marks (will align with right of page to the left)
      if (pageCol > 0) {
        drawCrossMark(margin, margin + printableHeight * 0.25);
        drawCrossMark(margin, margin + printableHeight * 0.5);
        drawCrossMark(margin, margin + printableHeight * 0.75);
      }

      // Right edge marks (will align with left of page to the right)
      if (pageCol < pagesX - 1) {
        drawCrossMark(pageWidth - margin, margin + printableHeight * 0.25);
        drawCrossMark(pageWidth - margin, margin + printableHeight * 0.5);
        drawCrossMark(pageWidth - margin, margin + printableHeight * 0.75);
      }

      // Draw corner L-marks for outer edges only (the actual paper boundary)
      const cornerSize = 15;

      // Top-left corner (only if this is a top-left edge of the assembled pattern)
      if (pageCol === 0 && pageRow === 0) {
        page.drawLine({
          start: { x: margin, y: pageHeight - margin },
          end: { x: margin + cornerSize, y: pageHeight - margin },
          color: black,
          thickness: 0.75,
        });
        page.drawLine({
          start: { x: margin, y: pageHeight - margin },
          end: { x: margin, y: pageHeight - margin - cornerSize },
          color: black,
          thickness: 0.75,
        });
      }

      // Top-right corner
      if (pageCol === pagesX - 1 && pageRow === 0) {
        page.drawLine({
          start: { x: pageWidth - margin, y: pageHeight - margin },
          end: { x: pageWidth - margin - cornerSize, y: pageHeight - margin },
          color: black,
          thickness: 0.75,
        });
        page.drawLine({
          start: { x: pageWidth - margin, y: pageHeight - margin },
          end: { x: pageWidth - margin, y: pageHeight - margin - cornerSize },
          color: black,
          thickness: 0.75,
        });
      }

      // Bottom-left corner
      if (pageCol === 0 && pageRow === pagesY - 1) {
        page.drawLine({
          start: { x: margin, y: margin },
          end: { x: margin + cornerSize, y: margin },
          color: black,
          thickness: 0.75,
        });
        page.drawLine({
          start: { x: margin, y: margin },
          end: { x: margin, y: margin + cornerSize },
          color: black,
          thickness: 0.75,
        });
      }

      // Bottom-right corner
      if (pageCol === pagesX - 1 && pageRow === pagesY - 1) {
        page.drawLine({
          start: { x: pageWidth - margin, y: margin },
          end: { x: pageWidth - margin - cornerSize, y: margin },
          color: black,
          thickness: 0.75,
        });
        page.drawLine({
          start: { x: pageWidth - margin, y: margin },
          end: { x: pageWidth - margin, y: margin + cornerSize },
          color: black,
          thickness: 0.75,
        });
      }

      // Calculate the offset into the SVG pattern for this tile
      // pageCol=0 means we show the left portion of the pattern (SVG x starting at 0)
      // pageRow=0 means we show the TOP portion of the pattern (SVG y starting at 0)
      //
      // Since SVG Y increases downward and PDF Y increases upward, we need to:
      // 1. Flip the Y coordinates (done by drawSvgPath with flipY: true by default)
      // 2. Position so the correct portion of the flipped pattern appears in the printable area
      //
      // For row 0 (top printed row), we want SVG y=0 to appear at the top of the printable area
      // After Y-flip, SVG y=0 becomes PDF y=0, and SVG y=patternHeight becomes PDF y=-patternHeight
      // So we need to translate up by patternHeight to get the top at the top
      //
      // With overlap: each tile (except the first in each direction) starts `overlap` earlier
      // to include the overlap region from the previous tile

      const effectiveTileWidth = printableWidth - overlap;
      const effectiveTileHeight = printableHeight - overlap;
      const svgOffsetX = pageCol * effectiveTileWidth;
      const svgOffsetY = pageRow * effectiveTileHeight;

      // Position calculation:
      // - Start at the margin (left edge of printable area)
      // - Subtract svgOffsetX to shift the pattern left, revealing the correct horizontal portion
      const x = margin - svgOffsetX;

      // For Y positioning with flipY=true:
      // - The SVG is flipped, so y=0 in SVG becomes the "top" visually
      // - We want the top of the printable area (pageHeight - margin) to show SVG y=svgOffsetY
      // - drawSvgPath places the SVG origin at (x, y) after flipping
      // - After flip, the pattern extends DOWNWARD from y in PDF space
      // - So y should be at the top of printable area, adjusted for the row offset
      const y = pageHeight - margin + svgOffsetY;

      // Common options for all path draws
      const pathOptions = { x, y };

      // Draw main pattern outline
      page.drawSvgPath(patternOutline, {
        ...pathOptions,
        borderColor: black,
        borderWidth: 1.5,
      });

      // Draw neckline
      page.drawSvgPath(neckline, {
        ...pathOptions,
        borderColor: black,
        borderWidth: 1.5,
      });

      // Draw armholes
      page.drawSvgPath(leftArmhole, {
        ...pathOptions,
        borderColor: black,
        borderWidth: 1.5,
      });
      page.drawSvgPath(rightArmhole, {
        ...pathOptions,
        borderColor: black,
        borderWidth: 1.5,
      });

      // Draw grain line
      page.drawSvgPath(grainLine, {
        ...pathOptions,
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 1,
      });

      // Draw notches
      page.drawSvgPath(notches, {
        ...pathOptions,
        borderColor: black,
        borderWidth: 1,
      });

      // Draw darts
      page.drawSvgPath(darts, {
        ...pathOptions,
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 0.75,
      });

      // Draw seam allowance
      page.drawSvgPath(seamAllowance, {
        ...pathOptions,
        borderColor: grayscale(0.6),
        borderWidth: 0.5,
      });

      // Add text labels - these need manual positioning since they're not SVG paths
      // "FRONT" label at SVG coordinates (350, 500)
      const frontLabelSvgX = 350;
      const frontLabelSvgY = 500;
      const frontLabelPdfX = x + frontLabelSvgX;
      const frontLabelPdfY = y - frontLabelSvgY; // Subtract because Y is flipped

      if (
        frontLabelPdfX > margin &&
        frontLabelPdfX < pageWidth - margin - 60 &&
        frontLabelPdfY > margin &&
        frontLabelPdfY < pageHeight - margin
      ) {
        page.drawText("FRONT", {
          x: frontLabelPdfX,
          y: frontLabelPdfY,
          size: 24,
          color: grayscale(0.4),
        });
      }

      // "Cut 2 on fold" at SVG coordinates (350, 700)
      const cutLabelSvgY = 700;
      const cutLabelPdfY = y - cutLabelSvgY;

      if (
        frontLabelPdfX > margin &&
        frontLabelPdfX < pageWidth - margin - 80 &&
        cutLabelPdfY > margin &&
        cutLabelPdfY < pageHeight - margin
      ) {
        page.drawText("Cut 2 on fold", {
          x: frontLabelPdfX,
          y: cutLabelPdfY,
          size: 12,
          color: grayscale(0.5),
        });
      }
    };

    // Generate all pages
    for (let row = 0; row < pagesY; row++) {
      for (let col = 0; col < pagesX; col++) {
        const page = pdf.addPage({ size: "letter" });
        drawPatternOnPage(page, col, row);
      }
    }

    // Add an assembly guide as the last page
    const guidePage = pdf.addPage({ size: "letter" });
    guidePage.drawText("Assembly Guide", {
      x: 50,
      y: 750,
      size: 24,
      color: black,
    });
    guidePage.drawLine({
      start: { x: 50, y: 740 },
      end: { x: 300, y: 740 },
      color: grayscale(0.5),
    });

    guidePage.drawText("1. Print all pages at 100% scale (no scaling)", {
      x: 50,
      y: 700,
      size: 12,
      color: black,
    });
    guidePage.drawText("2. Cut along the outer edges of each page", {
      x: 50,
      y: 680,
      size: 12,
      color: black,
    });
    guidePage.drawText("3. Align corner marks between adjacent pages", {
      x: 50,
      y: 660,
      size: 12,
      color: black,
    });
    guidePage.drawText("4. Tape pages together to form complete pattern", {
      x: 50,
      y: 640,
      size: 12,
      color: black,
    });

    // Draw a mini layout diagram
    guidePage.drawText("Page Layout:", { x: 50, y: 580, size: 14, color: black });

    // Scale diagram to fit nicely on the page
    // Each cell is roughly 100x130 points (scaled down from 540x720)
    const diagramScale = 0.18;
    const diagramX = 50;
    const diagramY = 350;
    const cellWidth = printableWidth * diagramScale;
    const cellHeight = printableHeight * diagramScale;
    const cellGap = 5;

    for (let row = 0; row < pagesY; row++) {
      for (let col = 0; col < pagesX; col++) {
        const x = diagramX + col * (cellWidth + cellGap);
        const y = diagramY + (pagesY - 1 - row) * (cellHeight + cellGap);

        guidePage.drawRectangle({
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          borderColor: black,
          borderWidth: 1,
          color: rgb(0.95, 0.95, 1),
        });

        guidePage.drawText(`${row * pagesX + col + 1}`, {
          x: x + cellWidth / 2 - 5,
          y: y + cellHeight / 2 - 5,
          size: 14,
          color: black,
        });
      }
    }

    // Draw the pattern outline scaled down on the guide
    const miniPatternScale = 0.2;
    guidePage.drawSvgPath(patternOutline, {
      x: 300,
      y: 580,
      scale: miniPatternScale,
      borderColor: black,
      borderWidth: 1,
    });
    guidePage.drawText("Pattern Preview", { x: 300, y: 590, size: 10, color: grayscale(0.5) });

    const bytes = await pdf.save();
    expect(isPdfHeader(bytes)).toBe(true);
    expect(pdf.getPageCount()).toBe(totalPages + 1); // Pattern pages + guide
    await saveTestOutput("drawing/sewing-pattern-tiled.pdf", bytes);
  });
});
