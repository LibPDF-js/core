/**
 * Integration tests for combined features in the low-level drawing API.
 */

import { ops, PDF, rgb, Matrix } from "#src/index";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfNumber } from "#src/objects/pdf-number";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: Combined Demo", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

  it("demonstrates all features combined in a complex scene", async () => {
    const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

    // White background
    page.drawOperators([ops.setNonStrokingRGB(1, 1, 1), ops.rectangle(0, 0, 612, 792), ops.fill()]);

    // Title
    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");

    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 28),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 740),
      ops.showText("Low-Level Drawing API Demo"),
      ops.endText(),
      // Subtitle
      ops.beginText(),
      ops.setFont(bodyFont, 12),
      ops.setNonStrokingGray(0.3),
      ops.moveText(50, 718),
      ops.showText("Demonstrates gradients, patterns, XObjects, transparency, and transforms"),
      ops.endText(),
    ]);

    // ======= Section 1: Background with tiling pattern and overlapping circles =======

    // Light blue background box
    page.drawOperators([
      ops.setNonStrokingRGB(0.85, 0.9, 0.95),
      ops.rectangle(50, 490, 300, 200),
      ops.fill(),
    ]);

    // "Tiling Pattern" label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.4),
      ops.moveText(60, 675),
      ops.showText("Tiling Pattern"),
      ops.endText(),
    ]);

    // Draw checkerboard pattern inside the box
    const patternStartX = 60;
    const patternStartY = 530;
    const patternCellSize = 12;
    const patternRows = 10;
    const patternCols = 12;

    for (let row = 0; row < patternRows; row++) {
      for (let col = 0; col < patternCols; col++) {
        if ((row + col) % 2 === 0) {
          page.drawOperators([
            ops.setNonStrokingRGB(0.6, 0.7, 0.85),
            ops.rectangle(
              patternStartX + col * patternCellSize,
              patternStartY + row * patternCellSize,
              patternCellSize,
              patternCellSize,
            ),
            ops.fill(),
          ]);
        }
      }
    }

    // Draw overlapping RGB circles (Venn diagram) with transparency
    const gs50 = pdf.createExtGState({ fillOpacity: 0.6 });
    const gs50Name = page.registerExtGState(gs50);

    const circleBaseX = 270;
    const circleBaseY = 580;
    const circleR = 40;
    const k = 0.552;

    // Helper to draw filled circle
    const drawFilledCircle = (
      cx: number,
      cy: number,
      r: number,
      red: number,
      green: number,
      blue: number,
    ) => {
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setGraphicsState(gs50Name),
        ops.setNonStrokingRGB(red, green, blue),
        ops.moveTo(cx + r, cy),
        ops.curveTo(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r),
        ops.curveTo(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy),
        ops.curveTo(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r),
        ops.curveTo(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy),
        ops.fill(),
        ops.popGraphicsState(),
      ]);
    };

    // Red circle (top)
    drawFilledCircle(circleBaseX, circleBaseY + 25, circleR, 0.85, 0.3, 0.35);
    // Green circle (bottom-right)
    drawFilledCircle(circleBaseX + 30, circleBaseY - 15, circleR, 0.3, 0.7, 0.4);
    // Blue circle (bottom-left)
    drawFilledCircle(circleBaseX - 30, circleBaseY - 15, circleR, 0.35, 0.5, 0.85);

    // "Axial Gradient (3-stop)" label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.4),
      ops.moveText(60, 500),
      ops.showText("Axial Gradient (3-stop)"),
      ops.endText(),
    ]);

    // ======= Section 2: Form XObjects & Transforms (NEW! badges) =======

    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.setNonStrokingGray(0),
      ops.moveText(380, 680),
      ops.showText("Form XObjects & Transforms"),
      ops.endText(),
    ]);

    // Helper to draw NEW! badge
    const drawNewBadge = (x: number, y: number, angle: number) => {
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(x, y)
            .rotate((angle * Math.PI) / 180),
        ),
        // Green background
        ops.setNonStrokingRGB(0.25, 0.65, 0.35),
        ops.rectangle(0, 0, 55, 22),
        ops.fill(),
        ops.popGraphicsState(),
        // White text
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(x, y)
            .rotate((angle * Math.PI) / 180),
        ),
        ops.beginText(),
        ops.setFont(titleFont, 12),
        ops.setNonStrokingRGB(1, 1, 1),
        ops.moveText(8, 5),
        ops.showText("NEW!"),
        ops.endText(),
        ops.popGraphicsState(),
      ]);
    };

    // Draw NEW! badges at different angles
    drawNewBadge(400, 640, -10);
    drawNewBadge(500, 655, 15);
    drawNewBadge(460, 600, 0);

    // Label
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.4),
      ops.moveText(430, 570),
      ops.showText("Reusable XObject badges"),
      ops.endText(),
    ]);

    // ======= SAMPLE watermark (rotated, gray) =======

    const gsWatermark = pdf.createExtGState({ fillOpacity: 0.15 });
    const gsWatermarkName = page.registerExtGState(gsWatermark);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(gsWatermarkName),
      ops.concatMatrix(
        Matrix.identity()
          .translate(250, 420)
          .rotate((-45 * Math.PI) / 180),
      ),
      ops.beginText(),
      ops.setFont(titleFont, 72),
      ops.setNonStrokingGray(0.3),
      ops.moveText(0, 0),
      ops.showText("SAMPLE"),
      ops.endText(),
      ops.popGraphicsState(),
    ]);

    // ======= Section 3: Stroke Styles & Colors =======

    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 460),
      ops.showText("Stroke Styles & Colors"),
      ops.endText(),
    ]);

    // 3pt solid stroke (orange)
    page.drawOperators([
      ops.setNonStrokingRGB(1, 0.95, 0.8),
      ops.rectangle(50, 370, 100, 70),
      ops.fill(),
      ops.setStrokingRGB(0.85, 0.55, 0.2),
      ops.setLineWidth(3),
      ops.rectangle(50, 370, 100, 70),
      ops.stroke(),
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(65, 355),
      ops.showText("3pt solid stroke"),
      ops.endText(),
    ]);

    // Dashed [8,4] (green)
    const dashArray = new PdfArray([PdfNumber.of(8), PdfNumber.of(4)]);
    page.drawOperators([
      ops.setNonStrokingRGB(0.85, 0.95, 0.85),
      ops.rectangle(170, 370, 100, 70),
      ops.fill(),
      ops.setStrokingRGB(0.3, 0.6, 0.35),
      ops.setLineWidth(2),
      ops.setDashPattern(dashArray, 0),
      ops.rectangle(170, 370, 100, 70),
      ops.stroke(),
      ops.setDashPattern(new PdfArray([]), 0), // Reset
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(185, 355),
      ops.showText("Dashed [8,4]"),
      ops.endText(),
    ]);

    // Dotted (round) - blue
    const dotArray = new PdfArray([PdfNumber.of(2), PdfNumber.of(4)]);
    page.drawOperators([
      ops.setNonStrokingRGB(0.85, 0.9, 0.95),
      ops.rectangle(290, 370, 100, 70),
      ops.fill(),
      ops.setStrokingRGB(0.3, 0.45, 0.7),
      ops.setLineWidth(2),
      ops.setLineCap(1), // Round cap
      ops.setDashPattern(dotArray, 0),
      ops.rectangle(290, 370, 100, 70),
      ops.stroke(),
      ops.setLineCap(0), // Reset
      ops.setDashPattern(new PdfArray([]), 0), // Reset
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(300, 355),
      ops.showText("Dotted (round)"),
      ops.endText(),
    ]);

    // Gradient fill
    const gradientFill = pdf.createLinearGradient({
      angle: 45,
      length: 100,
      stops: [
        { offset: 0, color: rgb(1, 0.7, 0.6) },
        { offset: 1, color: rgb(0.7, 0.7, 1) },
      ],
    });
    const gradFillName = page.registerShading(gradientFill);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.concatMatrix(Matrix.translate(410, 370)),
      ops.rectangle(0, 0, 100, 70),
      ops.clip(),
      ops.endPath(),
      ops.paintShading(gradFillName),
      ops.popGraphicsState(),
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(430, 355),
      ops.showText("Gradient fill"),
      ops.endText(),
    ]);

    // ======= Section 4: Shape Primitives =======

    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 310),
      ops.showText("Shape Primitives"),
      ops.endText(),
    ]);

    // Triangle (orange)
    const triCenterX = 100;
    const triBaseY = 180;
    const triHeight = 100;
    const triHalfWidth = 50;

    page.drawOperators([
      ops.setNonStrokingRGB(0.95, 0.55, 0.25),
      ops.moveTo(triCenterX, triBaseY + triHeight),
      ops.lineTo(triCenterX - triHalfWidth, triBaseY),
      ops.lineTo(triCenterX + triHalfWidth, triBaseY),
      ops.closePath(),
      ops.fill(),
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 11),
      ops.setNonStrokingGray(0.3),
      ops.moveText(75, 160),
      ops.showText("Triangle"),
      ops.endText(),
    ]);

    // Star (yellow)
    const starCenterX = 230;
    const starCenterY = 230;
    const starOuterR = 45;
    const starInnerR = 20;
    const starPoints = 5;

    page.drawOperators([ops.setNonStrokingRGB(1, 0.85, 0.2)]);
    for (let i = 0; i < starPoints * 2; i++) {
      const angle = (i * Math.PI) / starPoints - Math.PI / 2;
      const r = i % 2 === 0 ? starOuterR : starInnerR;
      const x = starCenterX + Math.cos(angle) * r;
      const y = starCenterY + Math.sin(angle) * r;

      if (i === 0) {
        page.drawOperators([ops.moveTo(x, y)]);
      } else {
        page.drawOperators([ops.lineTo(x, y)]);
      }
    }
    page.drawOperators([ops.closePath(), ops.fill()]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 11),
      ops.setNonStrokingGray(0.3),
      ops.moveText(215, 160),
      ops.showText("Star"),
      ops.endText(),
    ]);

    // Circle (blue)
    const shapeCX = 360;
    const shapeCY = 230;
    const shapeR = 45;

    page.drawOperators([
      ops.setNonStrokingRGB(0.4, 0.6, 0.85),
      ops.moveTo(shapeCX + shapeR, shapeCY),
      ops.curveTo(
        shapeCX + shapeR,
        shapeCY + shapeR * k,
        shapeCX + shapeR * k,
        shapeCY + shapeR,
        shapeCX,
        shapeCY + shapeR,
      ),
      ops.curveTo(
        shapeCX - shapeR * k,
        shapeCY + shapeR,
        shapeCX - shapeR,
        shapeCY + shapeR * k,
        shapeCX - shapeR,
        shapeCY,
      ),
      ops.curveTo(
        shapeCX - shapeR,
        shapeCY - shapeR * k,
        shapeCX - shapeR * k,
        shapeCY - shapeR,
        shapeCX,
        shapeCY - shapeR,
      ),
      ops.curveTo(
        shapeCX + shapeR * k,
        shapeCY - shapeR,
        shapeCX + shapeR,
        shapeCY - shapeR * k,
        shapeCX + shapeR,
        shapeCY,
      ),
      ops.fill(),
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 11),
      ops.setNonStrokingGray(0.3),
      ops.moveText(345, 160),
      ops.showText("Circle"),
      ops.endText(),
    ]);

    // Rounded Rectangle (purple)
    const rrX = 440;
    const rrY = 185;
    const rrW = 90;
    const rrH = 90;
    const rrRadius = 15;
    const rrK = 0.552;

    page.drawOperators([
      ops.setNonStrokingRGB(0.65, 0.4, 0.7),
      // Start at top-left, after the corner
      ops.moveTo(rrX + rrRadius, rrY + rrH),
      // Top edge
      ops.lineTo(rrX + rrW - rrRadius, rrY + rrH),
      // Top-right corner
      ops.curveTo(
        rrX + rrW - rrRadius + rrRadius * rrK,
        rrY + rrH,
        rrX + rrW,
        rrY + rrH - rrRadius + rrRadius * rrK,
        rrX + rrW,
        rrY + rrH - rrRadius,
      ),
      // Right edge
      ops.lineTo(rrX + rrW, rrY + rrRadius),
      // Bottom-right corner
      ops.curveTo(
        rrX + rrW,
        rrY + rrRadius - rrRadius * rrK,
        rrX + rrW - rrRadius + rrRadius * rrK,
        rrY,
        rrX + rrW - rrRadius,
        rrY,
      ),
      // Bottom edge
      ops.lineTo(rrX + rrRadius, rrY),
      // Bottom-left corner
      ops.curveTo(
        rrX + rrRadius - rrRadius * rrK,
        rrY,
        rrX,
        rrY + rrRadius - rrRadius * rrK,
        rrX,
        rrY + rrRadius,
      ),
      // Left edge
      ops.lineTo(rrX, rrY + rrH - rrRadius),
      // Top-left corner
      ops.curveTo(
        rrX,
        rrY + rrH - rrRadius + rrRadius * rrK,
        rrX + rrRadius - rrRadius * rrK,
        rrY + rrH,
        rrX + rrRadius,
        rrY + rrH,
      ),
      ops.fill(),
    ]);
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 11),
      ops.setNonStrokingGray(0.3),
      ops.moveText(448, 160),
      ops.showText("Rounded Rect"),
      ops.endText(),
    ]);

    // Footer
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.4),
      ops.moveText(50, 60),
      ops.showText(
        "Features: Axial gradient | Tiling pattern | ExtGState opacity | Form XObject | Matrix rotation | Stroke styles",
      ),
      ops.endText(),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/combined-demo.pdf", bytes);
    expect(bytes).toBeDefined();
  });
});
