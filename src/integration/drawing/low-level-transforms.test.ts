/**
 * Integration tests for Matrix transforms in the low-level drawing API.
 */

import { ops, PDF, Matrix } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: Matrix Transforms", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

  it("demonstrates matrix transformations", async () => {
    const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

    // Title
    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 24),
      ops.setNonStrokingGray(0),
      ops.moveText(50, 740),
      ops.showText("Matrix Transforms"),
      ops.endText(),
    ]);

    // Section 1: Rotation (showing 0, 30, 60, 90 degrees)
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.moveText(50, 700),
      ops.showText("Rotation (showing 0, 30, 60, 90 degrees):"),
      ops.endText(),
    ]);

    const rotationAngles = [0, 30, 60, 90];
    const rotationX = [120, 220, 320, 420];

    for (let i = 0; i < rotationAngles.length; i++) {
      const angle = rotationAngles[i];
      const x = rotationX[i];
      const y = 620;

      // Draw rotated rectangle first (so pivot dot appears on top)
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(x, y)
            .rotate((angle * Math.PI) / 180),
        ),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73), // Steel blue
        ops.rectangle(0, 0, 60, 20),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      // Draw pivot point (larger red dot for visibility)
      const dotRadius = 4;
      const k = dotRadius * 0.5522847498;
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setNonStrokingRGB(0.8, 0.2, 0.2), // Red dot
        ops.moveTo(x - dotRadius, y),
        ops.curveTo(x - dotRadius, y + k, x - k, y + dotRadius, x, y + dotRadius),
        ops.curveTo(x + k, y + dotRadius, x + dotRadius, y + k, x + dotRadius, y),
        ops.curveTo(x + dotRadius, y - k, x + k, y - dotRadius, x, y - dotRadius),
        ops.curveTo(x - k, y - dotRadius, x - dotRadius, y - k, x - dotRadius, y),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      // Label angle (centered below)
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(x - 8, 555),
        ops.showText(`${angle}°`),
        ops.endText(),
      ]);
    }

    // Subtitle for rotation
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(50, 545),
      ops.showText("Rectangles rotate counter-clockwise around pivot (red dot)"),
      ops.endText(),
    ]);

    // Section 2: Scale (same 30x20 rectangle)
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.moveText(50, 510),
      ops.showText("Scale (30x20 rect):"),
      ops.endText(),
    ]);

    const scaleFactors = [
      { sx: 1, sy: 1, label: "1x" },
      { sx: 1.5, sy: 1.5, label: "1.5x" },
      { sx: 2, sy: 2, label: "2x" },
      { sx: 2, sy: 1, label: "2x,1x" },
    ];
    const scaleX = [70, 140, 230, 350];

    for (let i = 0; i < scaleFactors.length; i++) {
      const { sx, sy, label } = scaleFactors[i];
      const x = scaleX[i];
      const y = 450;

      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(Matrix.identity().translate(x, y).scale(sx, sy)),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.rectangle(0, 0, 30, 20),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      // Label below
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0),
        ops.moveText(x, 435),
        ops.showText(label),
        ops.endText(),
      ]);
    }

    // Section 3: Combined Transforms on text
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.moveText(50, 400),
      ops.showText("Combined Transforms:"),
      ops.endText(),
    ]);

    const combExamples = [
      { x: 50, y: 355, transform: Matrix.identity(), label: "Identity" },
      { x: 140, y: 355, transform: Matrix.identity().scale(1.5, 1.5), label: "Scale 1.5x" },
      {
        x: 260,
        y: 355,
        transform: Matrix.identity().rotate((15 * Math.PI) / 180),
        label: "Rotate 15°",
      },
      {
        x: 380,
        y: 355,
        transform: Matrix.identity()
          .scale(1.2, 1.2)
          .rotate((20 * Math.PI) / 180),
        label: "Scale+Rot",
      },
      {
        x: 500,
        y: 355,
        transform: Matrix.identity().scale(1, 2),
        label: "Stretch Y",
      },
    ];

    for (const { x, y, transform, label } of combExamples) {
      // Draw transformed "Abc"
      // Transform first, then translate (transform * translate puts origin at x,y)
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(transform.multiply(Matrix.translate(x, y))),
        ops.beginText(),
        ops.setFont(titleFont, 16),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveText(0, 0),
        ops.showText("Abc"),
        ops.endText(),
        ops.popGraphicsState(),
      ]);

      // Label below
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 9),
        ops.setNonStrokingGray(0.3),
        ops.moveText(x, 320),
        ops.showText(label),
        ops.endText(),
      ]);
    }

    // Section 4: Practical Example - Diagonal Watermarks
    page.drawOperators([
      ops.beginText(),
      ops.setFont(titleFont, 14),
      ops.moveText(50, 300),
      ops.showText("Practical Example - Diagonal Watermarks:"),
      ops.endText(),
    ]);

    // Draw two document mockups
    const docWidth = 180;
    const docHeight = 220;

    // Document 1 with DRAFT watermark
    const doc1X = 60;
    const doc1Y = 55;

    // Document border/background
    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setNonStrokingGray(0.98),
      ops.rectangle(doc1X, doc1Y, docWidth, docHeight),
      ops.fill(),
      ops.setStrokingGray(0.7),
      ops.setLineWidth(1),
      ops.rectangle(doc1X, doc1Y, docWidth, docHeight),
      ops.stroke(),
      ops.popGraphicsState(),
    ]);

    // Fake text lines
    for (let i = 0; i < 9; i++) {
      const lineY = doc1Y + docHeight - 30 - i * 22;
      const lineWidth = 100 + (i % 3) * 30;
      page.drawOperators([
        ops.setNonStrokingGray(0.8),
        ops.rectangle(doc1X + 15, lineY, lineWidth, 10),
        ops.fill(),
      ]);
    }

    // DRAFT watermark (red, rotated) - centered in document
    const draft1CenterX = doc1X + docWidth / 2;
    const draft1CenterY = doc1Y + docHeight / 2;
    page.drawOperators([
      ops.pushGraphicsState(),
      ops.concatMatrix(
        Matrix.identity()
          .translate(draft1CenterX, draft1CenterY)
          .rotate((-30 * Math.PI) / 180),
      ),
      ops.beginText(),
      ops.setFont(titleFont, 44),
      ops.setNonStrokingRGB(0.9, 0.3, 0.3),
      // Center the text (DRAFT is ~5 chars, ~25pt each at 44pt = ~110pt wide)
      ops.moveText(-55, -15),
      ops.showText("DRAFT"),
      ops.endText(),
      ops.popGraphicsState(),
    ]);

    // Document 2 with APPROVED watermark
    const doc2X = 320;
    const doc2Y = 55;

    // Document border/background
    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setNonStrokingGray(0.98),
      ops.rectangle(doc2X, doc2Y, docWidth, docHeight),
      ops.fill(),
      ops.setStrokingGray(0.7),
      ops.setLineWidth(1),
      ops.rectangle(doc2X, doc2Y, docWidth, docHeight),
      ops.stroke(),
      ops.popGraphicsState(),
    ]);

    // Fake text lines
    for (let i = 0; i < 9; i++) {
      const lineY = doc2Y + docHeight - 30 - i * 22;
      const lineWidth = 100 + (i % 3) * 30;
      page.drawOperators([
        ops.setNonStrokingGray(0.8),
        ops.rectangle(doc2X + 15, lineY, lineWidth, 10),
        ops.fill(),
      ]);
    }

    // APPROVED watermark (green, rotated) - centered in document
    const draft2CenterX = doc2X + docWidth / 2;
    const draft2CenterY = doc2Y + docHeight / 2;
    page.drawOperators([
      ops.pushGraphicsState(),
      ops.concatMatrix(
        Matrix.identity()
          .translate(draft2CenterX, draft2CenterY)
          .rotate((-30 * Math.PI) / 180),
      ),
      ops.beginText(),
      ops.setFont(titleFont, 32),
      ops.setNonStrokingRGB(0.2, 0.7, 0.3),
      // Center the text (APPROVED is ~8 chars)
      ops.moveText(-65, -10),
      ops.showText("APPROVED"),
      ops.endText(),
      ops.popGraphicsState(),
    ]);

    // Footer text
    page.drawOperators([
      ops.beginText(),
      ops.setFont(bodyFont, 10),
      ops.setNonStrokingGray(0.3),
      ops.moveText(50, 40),
      ops.showText(
        "Matrix operations: translate(tx,ty), scale(sx,sy), rotate(degrees), multiply(matrix)",
      ),
      ops.endText(),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/matrix-transforms.pdf", bytes);
    expect(bytes).toBeDefined();
  });
});
