/**
 * Integration tests for tiling patterns in the low-level drawing API.
 */

import { ops, PDF, ColorSpace } from "#src/index";
import { loadFixture, saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: Patterns", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

  it("demonstrates tiling patterns", async () => {
    const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

    // Title
    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 24),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 740),
      ops.showText("Low-Level API: Tiling Patterns"),
      ops.endText(),
    ]);

    // 1. Checkerboard pattern - top left
    const checkerPattern = pdf.createTilingPattern({
      bbox: { x: 0, y: 0, width: 36, height: 36 },
      xStep: 36,
      yStep: 36,
      operators: [
        // Light gray background (fills entire cell)
        ops.setNonStrokingGray(0.9),
        ops.rectangle(0, 0, 36, 36),
        ops.fill(),
        // Dark gray squares
        ops.setNonStrokingGray(0.3),
        ops.rectangle(0, 0, 18, 18),
        ops.fill(),
        ops.rectangle(18, 18, 18, 18),
        ops.fill(),
      ],
    });
    const checkerName = page.registerPattern(checkerPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(checkerName),
      ops.rectangle(50, 480, 200, 200),
      ops.fill(),
    ]);

    // Label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 460),
      ops.showText("Checkerboard"),
      ops.endText(),
    ]);

    // 2. Diagonal Lines pattern - top right
    const diagPattern = pdf.createTilingPattern({
      bbox: { x: 0, y: 0, width: 8, height: 8 },
      xStep: 8,
      yStep: 8,
      operators: [
        // Light background
        ops.setNonStrokingGray(0.95),
        ops.rectangle(0, 0, 8, 8),
        ops.fill(),
        // Diagonal line
        ops.setStrokingGray(0.5),
        ops.setLineWidth(0.5),
        ops.moveTo(0, 0),
        ops.lineTo(8, 8),
        ops.stroke(),
      ],
    });
    const diagName = page.registerPattern(diagPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(diagName),
      ops.rectangle(310, 480, 200, 200),
      ops.fill(),
    ]);

    // Label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(310, 460),
      ops.showText("Diagonal Lines"),
      ops.endText(),
    ]);

    // 3. Polka Dots pattern - bottom left
    const cx = 9;
    const cy = 9;
    const r = 4;
    const k = 0.552;
    const dotPattern = pdf.createTilingPattern({
      bbox: { x: 0, y: 0, width: 18, height: 18 },
      xStep: 18,
      yStep: 18,
      operators: [
        // White background
        ops.setNonStrokingGray(1),
        ops.rectangle(0, 0, 18, 18),
        ops.fill(),
        // Blue dot (circle using bezier curves)
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveTo(cx + r, cy),
        ops.curveTo(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r),
        ops.curveTo(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy),
        ops.curveTo(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r),
        ops.curveTo(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy),
        ops.fill(),
      ],
    });
    const dotName = page.registerPattern(dotPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(dotName),
      ops.rectangle(50, 210, 200, 200),
      ops.fill(),
    ]);

    // Label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 190),
      ops.showText("Polka Dots"),
      ops.endText(),
    ]);

    // 4. Crosshatch pattern - bottom right
    const crossPattern = pdf.createTilingPattern({
      bbox: { x: 0, y: 0, width: 15, height: 15 },
      xStep: 15,
      yStep: 15,
      operators: [
        // White background
        ops.setNonStrokingGray(1),
        ops.rectangle(0, 0, 15, 15),
        ops.fill(),
        // Orange grid lines
        ops.setStrokingRGB(0.8, 0.5, 0.1),
        ops.setLineWidth(0.5),
        // Vertical line
        ops.moveTo(7.5, 0),
        ops.lineTo(7.5, 15),
        ops.stroke(),
        // Horizontal line
        ops.moveTo(0, 7.5),
        ops.lineTo(15, 7.5),
        ops.stroke(),
      ],
    });
    const crossName = page.registerPattern(crossPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(crossName),
      ops.rectangle(310, 210, 200, 200),
      ops.fill(),
    ]);

    // Label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(310, 190),
      ops.showText("Crosshatch"),
      ops.endText(),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/patterns.pdf", bytes);
    expect(bytes).toBeDefined();
  });

  it("demonstrates image patterns with different tile sizes", async () => {
    const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

    // Load test images
    const textureBytes = await loadFixture("images", "gradient-circle.png");
    const texture = pdf.embedImage(textureBytes);

    // Title
    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 24),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 740),
      ops.showText("Image Patterns (createImagePattern)"),
      ops.endText(),
    ]);

    // 1. Small tiles (20x20) - top left
    const smallPattern = pdf.createImagePattern({
      image: texture,
      width: 20,
      height: 20,
    });
    const smallName = page.registerPattern(smallPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(smallName),
      ops.rectangle(50, 480, 200, 200),
      ops.fill(),
    ]);

    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 460),
      ops.showText("Small tiles (20x20)"),
      ops.endText(),
    ]);

    // 2. Medium tiles (40x40) - top right
    const mediumPattern = pdf.createImagePattern({
      image: texture,
      width: 40,
      height: 40,
    });
    const mediumName = page.registerPattern(mediumPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(mediumName),
      ops.rectangle(310, 480, 200, 200),
      ops.fill(),
    ]);

    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(310, 460),
      ops.showText("Medium tiles (40x40)"),
      ops.endText(),
    ]);

    // 3. Large tiles (80x80) - bottom left
    const largePattern = pdf.createImagePattern({
      image: texture,
      width: 80,
      height: 80,
    });
    const largeName = page.registerPattern(largePattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(largeName),
      ops.rectangle(50, 210, 200, 200),
      ops.fill(),
    ]);

    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 190),
      ops.showText("Large tiles (80x80)"),
      ops.endText(),
    ]);

    // 4. Non-square tiles (60x30) - bottom right
    const rectPattern = pdf.createImagePattern({
      image: texture,
      width: 60,
      height: 30,
    });
    const rectName = page.registerPattern(rectPattern);

    page.drawOperators([
      ops.setNonStrokingColorSpace(ColorSpace.Pattern),
      ops.setNonStrokingColorN(rectName),
      ops.rectangle(310, 210, 200, 200),
      ops.fill(),
    ]);

    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0),
      ops.moveText(310, 190),
      ops.showText("Non-square tiles (60x30)"),
      ops.endText(),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/image-patterns.pdf", bytes);
    expect(bytes).toBeDefined();
  });
});
