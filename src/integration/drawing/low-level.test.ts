/**
 * Integration tests for the low-level drawing API with visual output.
 *
 * These tests generate actual PDF files that can be visually inspected
 * in the test-output/low-level-api/ directory.
 */

import { ops, PDF, rgb, Matrix, ColorSpace } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing Integration", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

  describe("Matrix Transforms", () => {
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

        // Draw pivot point (dot)
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setNonStrokingGray(0),
          ops.moveTo(x - 3, y),
          ops.curveTo(x - 3, y + 1.65, x - 1.65, y + 3, x, y + 3),
          ops.curveTo(x + 1.65, y + 3, x + 3, y + 1.65, x + 3, y),
          ops.curveTo(x + 3, y - 1.65, x + 1.65, y - 3, x, y - 3),
          ops.curveTo(x - 1.65, y - 3, x - 3, y - 1.65, x - 3, y),
          ops.fill(),
          ops.popGraphicsState(),
        ]);

        // Draw rotated rectangle
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

        // Label angle
        page.drawOperators([
          ops.beginText(),
          ops.setFont(bodyFont, 12),
          ops.setNonStrokingGray(0),
          ops.moveText(x - 5, 530),
          ops.showText(String(angle)),
          ops.endText(),
        ]);
      }

      // "Abc" text with rotation (at right side)
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(Matrix.identity().translate(520, 620)),
        ops.beginText(),
        ops.setFont(titleFont, 24),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveText(0, 0),
        ops.showText("Abc"),
        ops.endText(),
        ops.popGraphicsState(),
      ]);

      // Subtitle for rotation
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.3),
        ops.moveText(50, 510),
        ops.showText("Rectangles rotate counter-clockwise around pivot (dot)"),
        ops.endText(),
      ]);

      // Section 2: Scale (same 30x20 rectangle)
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(50, 480),
        ops.showText("Scale (same 30x20 rectangle):"),
        ops.endText(),
      ]);

      const scaleFactors = [
        { sx: 1, sy: 1, label: "1x" },
        { sx: 1.5, sy: 1.5, label: "1.5x" },
        { sx: 2, sy: 2, label: "2x" },
        { sx: 2, sy: 1, label: "2x,1x" },
      ];
      const scaleX = [100, 190, 300, 430];

      for (let i = 0; i < scaleFactors.length; i++) {
        const { sx, sy, label } = scaleFactors[i];
        const x = scaleX[i];
        const y = 420;

        page.drawOperators([
          ops.pushGraphicsState(),
          ops.concatMatrix(Matrix.identity().translate(x, y).scale(sx, sy)),
          ops.setNonStrokingRGB(0.32, 0.53, 0.73),
          ops.rectangle(0, 0, 30, 20),
          ops.fill(),
          ops.popGraphicsState(),
        ]);

        // Label
        page.drawOperators([
          ops.beginText(),
          ops.setFont(bodyFont, 12),
          ops.setNonStrokingGray(0),
          ops.moveText(x, 395),
          ops.showText(label),
          ops.endText(),
        ]);
      }

      // "Abc" scaled text
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(Matrix.identity().translate(300, 455).scale(1, 1.5)),
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveText(0, 0),
        ops.showText("Abc"),
        ops.endText(),
        ops.popGraphicsState(),
      ]);

      // Section 3: Combined Transforms
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(350, 480),
        ops.showText("Combined Transforms:"),
        ops.endText(),
      ]);

      // Identity
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(Matrix.identity().translate(460, 450)),
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveText(0, 0),
        ops.showText("Abc"),
        ops.endText(),
        ops.popGraphicsState(),
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.3),
        ops.moveText(520, 450),
        ops.showText("Identity"),
        ops.endText(),
      ]);

      // Scale 1.5x
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(Matrix.identity().translate(410, 410).scale(1.5, 1.5)),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.rectangle(0, 0, 60, 16),
        ops.fill(),
        ops.popGraphicsState(),
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.3),
        ops.moveText(520, 418),
        ops.showText("Scale 1.5x"),
        ops.endText(),
      ]);

      // Rotate 12
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.3),
        ops.moveText(520, 386),
        ops.showText("Rotate 12"),
        ops.endText(),
      ]);

      // Scale+Rot
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(520, 340)
            .rotate((15 * Math.PI) / 180)
            .scale(1.3, 1.3),
        ),
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.setNonStrokingRGB(0.32, 0.53, 0.73),
        ops.moveText(0, 0),
        ops.showText("Abc"),
        ops.endText(),
        ops.popGraphicsState(),
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.3),
        ops.moveText(520, 355),
        ops.showText("Scale+Rot"),
        ops.endText(),
      ]);

      // Section 4: Practical Example - Diagonal Watermarks
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(50, 300),
        ops.showText("Practical Example - Diagonal Watermarks:"),
        ops.endText(),
      ]);

      // Draw two document mockups
      const docWidth = 200;
      const docHeight = 200;

      // Document 1 with DRAFT watermark
      const doc1X = 70;
      const doc1Y = 70;

      // Document border/background
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setStrokingGray(0.8),
        ops.setLineWidth(1),
        ops.rectangle(doc1X, doc1Y, docWidth, docHeight),
        ops.stroke(),
        ops.popGraphicsState(),
      ]);

      // Fake text lines
      for (let i = 0; i < 8; i++) {
        const lineY = doc1Y + docHeight - 40 - i * 20;
        const lineWidth = 120 + Math.random() * 50;
        page.drawOperators([
          ops.setNonStrokingGray(0.85),
          ops.rectangle(doc1X + 20, lineY, lineWidth, 8),
          ops.fill(),
        ]);
      }

      // DRAFT watermark (red, rotated)
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(doc1X + 50, doc1Y + 60)
            .rotate((-35 * Math.PI) / 180),
        ),
        ops.beginText(),
        ops.setFont(titleFont, 48),
        ops.setNonStrokingRGB(0.8, 0.4, 0.4),
        ops.moveText(0, 0),
        ops.showText("DRAFT"),
        ops.endText(),
        ops.popGraphicsState(),
      ]);

      // Document 2 with APPROVED watermark
      const doc2X = 330;
      const doc2Y = 70;

      // Document border/background
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setStrokingGray(0.8),
        ops.setLineWidth(1),
        ops.rectangle(doc2X, doc2Y, docWidth, docHeight),
        ops.stroke(),
        ops.popGraphicsState(),
      ]);

      // Fake text lines
      for (let i = 0; i < 8; i++) {
        const lineY = doc2Y + docHeight - 40 - i * 20;
        const lineWidth = 120 + Math.random() * 50;
        page.drawOperators([
          ops.setNonStrokingGray(0.85),
          ops.rectangle(doc2X + 20, lineY, lineWidth, 8),
          ops.fill(),
        ]);
      }

      // APPROVED watermark (green, rotated)
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.concatMatrix(
          Matrix.identity()
            .translate(doc2X + 30, doc2Y + 50)
            .rotate((-35 * Math.PI) / 180),
        ),
        ops.beginText(),
        ops.setFont(titleFont, 36),
        ops.setNonStrokingRGB(0.2, 0.6, 0.4),
        ops.moveText(0, 0),
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

  describe("Gradients", () => {
    it("demonstrates axial and radial gradients", async () => {
      const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

      // Title
      const titleFont = page.registerFont("Helvetica-Bold");
      const bodyFont = page.registerFont("Helvetica");
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 24),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 740),
        ops.showText("Low-Level Drawing API: Gradients"),
        ops.endText(),
      ]);

      // 1. Horizontal gradient (red to blue) - top left
      const gradient1 = pdf.createAxialShading({
        coords: [50, 550, 300, 550],
        stops: [
          { offset: 0, color: rgb(1, 0, 0) },
          { offset: 1, color: rgb(0, 0, 1) },
        ],
      });
      const sh1 = page.registerShading(gradient1);

      page.drawOperators([
        ops.pushGraphicsState(),
        ops.rectangle(50, 530, 250, 150),
        ops.clip(),
        ops.endPath(),
        ops.paintShading(sh1),
        ops.popGraphicsState(),
      ]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 510),
        ops.showText("Horizontal (red to blue)"),
        ops.endText(),
      ]);

      // 2. Vertical gradient (yellow to green) - top right
      const gradient2 = pdf.createAxialShading({
        coords: [350, 680, 350, 530],
        stops: [
          { offset: 0, color: rgb(0.1, 0.7, 0.1) }, // green at top
          { offset: 1, color: rgb(1, 1, 0) }, // yellow at bottom
        ],
      });
      const sh2 = page.registerShading(gradient2);

      page.drawOperators([
        ops.pushGraphicsState(),
        ops.rectangle(350, 530, 220, 150),
        ops.clip(),
        ops.endPath(),
        ops.paintShading(sh2),
        ops.popGraphicsState(),
      ]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(350, 510),
        ops.showText("Vertical (yellow to green)"),
        ops.endText(),
      ]);

      // 3. Rainbow gradient (7 color stops) - middle left
      const gradient3 = pdf.createAxialShading({
        coords: [50, 380, 300, 380],
        stops: [
          { offset: 0, color: rgb(1, 0, 0) }, // red
          { offset: 0.17, color: rgb(1, 0.5, 0) }, // orange
          { offset: 0.33, color: rgb(1, 1, 0) }, // yellow
          { offset: 0.5, color: rgb(0, 1, 0) }, // green
          { offset: 0.67, color: rgb(0, 1, 1) }, // cyan
          { offset: 0.83, color: rgb(0, 0, 1) }, // blue
          { offset: 1, color: rgb(0.5, 0, 0.5) }, // purple
        ],
      });
      const sh3 = page.registerShading(gradient3);

      page.drawOperators([
        ops.pushGraphicsState(),
        ops.rectangle(50, 300, 300, 130),
        ops.clip(),
        ops.endPath(),
        ops.paintShading(sh3),
        ops.popGraphicsState(),
      ]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 280),
        ops.showText("Rainbow (7 color stops)"),
        ops.endText(),
      ]);

      // 4. Radial gradient (white to dark) - middle right (sphere effect)
      // Create a radial gradient that looks like a 3D sphere
      const centerX = 470;
      const centerY = 380;
      const radius = 90;

      // Offset the inner center slightly for 3D effect
      const gradient4 = pdf.createRadialShading({
        coords: [centerX - 25, centerY + 30, 0, centerX, centerY, radius],
        stops: [
          { offset: 0, color: rgb(1, 1, 1) }, // white highlight
          { offset: 0.3, color: rgb(0.6, 0.6, 0.7) }, // light blue-gray
          { offset: 1, color: rgb(0.2, 0.2, 0.35) }, // dark blue-gray
        ],
      });
      const sh4 = page.registerShading(gradient4);

      // Draw circular clip path for sphere
      page.drawOperators([
        ops.pushGraphicsState(),
        // Circle using bezier curves
        ops.moveTo(centerX + radius, centerY),
        ops.curveTo(
          centerX + radius,
          centerY + radius * 0.552,
          centerX + radius * 0.552,
          centerY + radius,
          centerX,
          centerY + radius,
        ),
        ops.curveTo(
          centerX - radius * 0.552,
          centerY + radius,
          centerX - radius,
          centerY + radius * 0.552,
          centerX - radius,
          centerY,
        ),
        ops.curveTo(
          centerX - radius,
          centerY - radius * 0.552,
          centerX - radius * 0.552,
          centerY - radius,
          centerX,
          centerY - radius,
        ),
        ops.curveTo(
          centerX + radius * 0.552,
          centerY - radius,
          centerX + radius,
          centerY - radius * 0.552,
          centerX + radius,
          centerY,
        ),
        ops.clip(),
        ops.endPath(),
        ops.paintShading(sh4),
        ops.popGraphicsState(),
      ]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(400, 280),
        ops.showText("Radial (white to dark)"),
        ops.endText(),
      ]);

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/gradients.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });

  describe("Patterns", () => {
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

      // Helper to draw checkerboard pattern manually
      const drawCheckerboard = (
        x: number,
        y: number,
        width: number,
        height: number,
        cellSize: number,
      ) => {
        const ops_: ReturnType<typeof ops.pushGraphicsState>[] = [];
        ops_.push(ops.pushGraphicsState());

        for (let row = 0; row < Math.ceil(height / cellSize); row++) {
          for (let col = 0; col < Math.ceil(width / cellSize); col++) {
            // Alternate colors
            if ((row + col) % 2 === 0) {
              const cellX = x + col * cellSize;
              const cellY = y + row * cellSize;
              const cellW = Math.min(cellSize, x + width - cellX);
              const cellH = Math.min(cellSize, y + height - cellY);

              if (cellW > 0 && cellH > 0) {
                ops_.push(ops.setNonStrokingGray(0.3));
                ops_.push(ops.rectangle(cellX, cellY, cellW, cellH));
                ops_.push(ops.fill());
              }
            }
          }
        }
        ops_.push(ops.popGraphicsState());
        return ops_;
      };

      // 1. Checkerboard pattern - top left
      const checkX = 50;
      const checkY = 480;
      const checkSize = 200;

      // Background
      page.drawOperators([
        ops.setNonStrokingGray(0.9),
        ops.rectangle(checkX, checkY, checkSize, checkSize),
        ops.fill(),
      ]);

      // Draw checkerboard
      page.drawOperators(drawCheckerboard(checkX, checkY, checkSize, checkSize, 18));

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(checkX, checkY - 20),
        ops.showText("Checkerboard"),
        ops.endText(),
      ]);

      // 2. Diagonal Lines pattern - top right
      const diagX = 310;
      const diagY = 480;
      const diagSize = 200;

      // Background
      page.drawOperators([
        ops.setNonStrokingGray(0.95),
        ops.rectangle(diagX, diagY, diagSize, diagSize),
        ops.fill(),
      ]);

      // Draw diagonal lines
      page.drawOperators([ops.pushGraphicsState()]);
      page.drawOperators([ops.setStrokingGray(0.5), ops.setLineWidth(0.5)]);

      // Clip to the rectangle
      page.drawOperators([
        ops.rectangle(diagX, diagY, diagSize, diagSize),
        ops.clip(),
        ops.endPath(),
      ]);

      // Draw diagonal lines
      const lineSpacing = 8;
      for (let i = -diagSize; i < diagSize * 2; i += lineSpacing) {
        page.drawOperators([
          ops.moveTo(diagX + i, diagY),
          ops.lineTo(diagX + i + diagSize, diagY + diagSize),
          ops.stroke(),
        ]);
      }
      page.drawOperators([ops.popGraphicsState()]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(diagX, diagY - 20),
        ops.showText("Diagonal Lines"),
        ops.endText(),
      ]);

      // 3. Polka Dots pattern - bottom left
      const dotsX = 50;
      const dotsY = 210;
      const dotsSize = 200;
      const dotRadius = 4;
      const dotSpacing = 18;

      // Background
      page.drawOperators([
        ops.setNonStrokingGray(1),
        ops.rectangle(dotsX, dotsY, dotsSize, dotsSize),
        ops.fill(),
      ]);

      // Draw polka dots
      page.drawOperators([ops.pushGraphicsState()]);
      page.drawOperators([ops.setNonStrokingRGB(0.32, 0.53, 0.73)]);

      for (let row = 0; row < Math.ceil(dotsSize / dotSpacing); row++) {
        for (let col = 0; col < Math.ceil(dotsSize / dotSpacing); col++) {
          const cx = dotsX + col * dotSpacing + dotSpacing / 2;
          const cy = dotsY + row * dotSpacing + dotSpacing / 2;

          if (cx + dotRadius <= dotsX + dotsSize && cy + dotRadius <= dotsY + dotsSize) {
            // Draw circle using bezier curves
            const k = 0.552; // bezier control point ratio for circle
            page.drawOperators([
              ops.moveTo(cx + dotRadius, cy),
              ops.curveTo(
                cx + dotRadius,
                cy + dotRadius * k,
                cx + dotRadius * k,
                cy + dotRadius,
                cx,
                cy + dotRadius,
              ),
              ops.curveTo(
                cx - dotRadius * k,
                cy + dotRadius,
                cx - dotRadius,
                cy + dotRadius * k,
                cx - dotRadius,
                cy,
              ),
              ops.curveTo(
                cx - dotRadius,
                cy - dotRadius * k,
                cx - dotRadius * k,
                cy - dotRadius,
                cx,
                cy - dotRadius,
              ),
              ops.curveTo(
                cx + dotRadius * k,
                cy - dotRadius,
                cx + dotRadius,
                cy - dotRadius * k,
                cx + dotRadius,
                cy,
              ),
              ops.fill(),
            ]);
          }
        }
      }
      page.drawOperators([ops.popGraphicsState()]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(dotsX, dotsY - 20),
        ops.showText("Polka Dots"),
        ops.endText(),
      ]);

      // 4. Crosshatch pattern - bottom right
      const crossX = 310;
      const crossY = 210;
      const crossSize = 200;

      // Background
      page.drawOperators([
        ops.setNonStrokingGray(1),
        ops.rectangle(crossX, crossY, crossSize, crossSize),
        ops.fill(),
      ]);

      // Draw crosshatch (grid lines)
      page.drawOperators([ops.pushGraphicsState()]);
      page.drawOperators([ops.setStrokingRGB(0.8, 0.5, 0.1), ops.setLineWidth(0.5)]);

      // Clip to the rectangle
      page.drawOperators([
        ops.rectangle(crossX, crossY, crossSize, crossSize),
        ops.clip(),
        ops.endPath(),
      ]);

      // Vertical lines
      const gridSpacing = 15;
      for (let i = 0; i <= crossSize; i += gridSpacing) {
        page.drawOperators([
          ops.moveTo(crossX + i, crossY),
          ops.lineTo(crossX + i, crossY + crossSize),
          ops.stroke(),
        ]);
      }

      // Horizontal lines
      for (let i = 0; i <= crossSize; i += gridSpacing) {
        page.drawOperators([
          ops.moveTo(crossX, crossY + i),
          ops.lineTo(crossX + crossSize, crossY + i),
          ops.stroke(),
        ]);
      }
      page.drawOperators([ops.popGraphicsState()]);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(crossX, crossY - 20),
        ops.showText("Crosshatch"),
        ops.endText(),
      ]);

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/patterns.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });

  describe("Transparency", () => {
    it("demonstrates opacity and blend modes", async () => {
      const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

      // Title
      const titleFont = page.registerFont("Helvetica-Bold");
      const bodyFont = page.registerFont("Helvetica");
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 24),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 740),
        ops.showText("Transparency & Blend Modes"),
        ops.endText(),
      ]);

      // Section 1: Fill Opacity
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(50, 700),
        ops.showText("Fill Opacity (red squares over blue background):"),
        ops.endText(),
      ]);

      const opacities = [1.0, 0.75, 0.5, 0.25];
      const opacityLabels = ["100%", "75%", "50%", "25%"];
      const opacityX = [70, 195, 320, 445];

      for (let i = 0; i < opacities.length; i++) {
        const x = opacityX[i];
        const y = 590;

        // Blue rectangle (background)
        page.drawOperators([
          ops.setNonStrokingRGB(0.2, 0.4, 0.9),
          ops.rectangle(x, y, 100, 80),
          ops.fill(),
        ]);

        // Red rectangle with opacity (overlapping)
        const gsOpacity = pdf.createExtGState({ fillOpacity: opacities[i] });
        const gsName = page.registerExtGState(gsOpacity);
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setGraphicsState(gsName),
          ops.setNonStrokingRGB(0.9, 0.2, 0.2),
          ops.rectangle(x + 25, y + 15, 80, 80),
          ops.fill(),
          ops.popGraphicsState(),
        ]);

        // Label
        page.drawOperators([
          ops.beginText(),
          ops.setFont(bodyFont, 12),
          ops.setNonStrokingGray(0),
          ops.moveText(x + 35, y - 20),
          ops.showText(opacityLabels[i]),
          ops.endText(),
        ]);
      }

      // Section 2: Blend Modes comparison
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(50, 530),
        ops.showText("Blend Modes (left=Normal, right=Blend Mode):"),
        ops.endText(),
      ]);

      // Each blend mode has a different foreground color to demonstrate the effect
      const blendModeConfigs = [
        { mode: "Multiply", color: [0.9, 0.5, 0.1] }, // Orange - multiplies with gray to make brown
        { mode: "Screen", color: [0.1, 0.5, 0.9] }, // Blue - screens with gray to make light blue
        { mode: "Overlay", color: [0.8, 0.2, 0.6] }, // Magenta - overlays with gray
        { mode: "Difference", color: [0.9, 0.9, 0.2] }, // Yellow - difference with gray makes olive
      ];
      const blendX = [60, 190, 320, 450];

      for (let i = 0; i < blendModeConfigs.length; i++) {
        const { mode, color } = blendModeConfigs[i];
        const x = blendX[i];
        const y = 420;

        // Label
        page.drawOperators([
          ops.beginText(),
          ops.setFont(titleFont, 11),
          ops.setNonStrokingGray(0),
          ops.moveText(x, y + 60),
          ops.showText(mode),
          ops.endText(),
        ]);

        // Left: Normal blend (gray background with colored square)
        page.drawOperators([ops.setNonStrokingGray(0.5), ops.rectangle(x, y, 50, 50), ops.fill()]);

        // Color square (normal - no blend mode)
        page.drawOperators([
          ops.setNonStrokingRGB(color[0], color[1], color[2]),
          ops.rectangle(x + 8, y + 10, 35, 30),
          ops.fill(),
        ]);

        // Right: With blend mode (gray background with blended colored square)
        page.drawOperators([
          ops.setNonStrokingGray(0.5),
          ops.rectangle(x + 60, y, 50, 50),
          ops.fill(),
        ]);

        // Color square with blend mode
        const gsBlend = pdf.createExtGState({ blendMode: mode });
        const gsBlendName = page.registerExtGState(gsBlend);
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setGraphicsState(gsBlendName),
          ops.setNonStrokingRGB(color[0], color[1], color[2]),
          ops.rectangle(x + 68, y + 10, 35, 30),
          ops.fill(),
          ops.popGraphicsState(),
        ]);

        // Smaller labels
        page.drawOperators([
          ops.beginText(),
          ops.setFont(bodyFont, 9),
          ops.setNonStrokingGray(0.3),
          ops.moveText(x + 10, y - 15),
          ops.showText("Normal"),
          ops.endText(),
          ops.beginText(),
          ops.setFont(bodyFont, 9),
          ops.setNonStrokingGray(0.3),
          ops.moveText(x + 65, y - 15),
          ops.showText(mode),
          ops.endText(),
        ]);
      }

      // Section 3: Transparency in Action
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 14),
        ops.moveText(50, 370),
        ops.showText("Transparency in Action:"),
        ops.endText(),
      ]);

      // RGB circles (Venn diagram style) with 60% opacity
      const gs60 = pdf.createExtGState({ fillOpacity: 0.6 });
      const gs60Name = page.registerExtGState(gs60);

      const circleRadius = 45;
      const circleBaseX = 95;
      const circleBaseY = 260;

      // Helper to draw filled circle
      const drawCircle = (
        cx: number,
        cy: number,
        r: number,
        red: number,
        green: number,
        blue: number,
      ) => {
        const k = 0.552;
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setGraphicsState(gs60Name),
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

      // Red circle (left)
      drawCircle(circleBaseX, circleBaseY + 20, circleRadius, 1, 0.2, 0.2);
      // Green circle (right)
      drawCircle(circleBaseX + 50, circleBaseY + 20, circleRadius, 0.2, 0.8, 0.2);
      // Blue circle (bottom)
      drawCircle(circleBaseX + 25, circleBaseY - 25, circleRadius, 0.2, 0.4, 1);

      // Label
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(55, 175),
        ops.showText("60% RGB circles"),
        ops.endText(),
      ]);

      // Blend mode examples - properly spaced
      // Multiply: Yellow background + Blue foreground = Green result
      const multiplyX = 260;
      const multiplyY = 220;

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0),
        ops.moveText(multiplyX + 30, multiplyY + 110),
        ops.showText("Multiply"),
        ops.endText(),
      ]);

      // Light yellow background
      page.drawOperators([
        ops.setNonStrokingRGB(1, 1, 0.7),
        ops.rectangle(multiplyX, multiplyY, 100, 100),
        ops.fill(),
      ]);

      // Blue rectangle with multiply - creates green
      const gsMultiply = pdf.createExtGState({ blendMode: "Multiply" });
      const gsMultiplyName = page.registerExtGState(gsMultiply);
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setGraphicsState(gsMultiplyName),
        ops.setNonStrokingRGB(0.3, 0.5, 0.9),
        ops.rectangle(multiplyX + 20, multiplyY + 20, 60, 60),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 9),
        ops.setNonStrokingGray(0.3),
        ops.moveText(multiplyX + 5, multiplyY - 15),
        ops.showText("Yellow+Blue=Green"),
        ops.endText(),
      ]);

      // Screen: Dark background + Light foreground = Lighter result
      const screenX = 390;
      const screenY = 220;

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0),
        ops.moveText(screenX + 35, screenY + 110),
        ops.showText("Screen"),
        ops.endText(),
      ]);

      // Dark navy background (matching reference PNG)
      page.drawOperators([
        ops.setNonStrokingRGB(0.2, 0.2, 0.3),
        ops.rectangle(screenX, screenY, 100, 100),
        ops.fill(),
      ]);

      // Tan/cream rectangle with screen blend - will lighten
      const gsScreen = pdf.createExtGState({ blendMode: "Screen" });
      const gsScreenName = page.registerExtGState(gsScreen);
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setGraphicsState(gsScreenName),
        ops.setNonStrokingRGB(0.9, 0.7, 0.3),
        ops.rectangle(screenX + 20, screenY + 20, 60, 60),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 9),
        ops.setNonStrokingGray(0.3),
        ops.moveText(screenX + 5, screenY - 15),
        ops.showText("Dark+Light=Lighter"),
        ops.endText(),
      ]);

      // Difference: White background - Cyan foreground = Red result
      const diffX = 520;
      const diffY = 220;

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0),
        ops.moveText(diffX + 15, diffY + 110),
        ops.showText("Difference"),
        ops.endText(),
      ]);

      // White background with border
      page.drawOperators([
        ops.setNonStrokingRGB(1, 1, 1),
        ops.rectangle(diffX, diffY, 80, 100),
        ops.fill(),
        ops.setStrokingGray(0.8),
        ops.setLineWidth(1),
        ops.rectangle(diffX, diffY, 80, 100),
        ops.stroke(),
      ]);

      // Cyan rectangle with difference - produces red on white
      const gsDiff = pdf.createExtGState({ blendMode: "Difference" });
      const gsDiffName = page.registerExtGState(gsDiff);
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setGraphicsState(gsDiffName),
        ops.setNonStrokingRGB(0, 0.8, 0.8), // Cyan - will show as red on white via difference
        ops.rectangle(diffX + 15, diffY + 20, 50, 60),
        ops.fill(),
        ops.popGraphicsState(),
      ]);

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 9),
        ops.setNonStrokingGray(0.3),
        ops.moveText(diffX + 3, diffY - 15),
        ops.showText("White-Cyan=Red"),
        ops.endText(),
      ]);

      // Footer
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingRGB(0.2, 0.5, 0.3),
        ops.moveText(50, 100),
        ops.showText("ExtGState: fillOpacity (ca), strokeOpacity (CA), blendMode (BM)"),
        ops.endText(),
      ]);

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/transparency.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });

  describe("Form XObjects", () => {
    it("demonstrates reusable Form XObjects (stamps)", async () => {
      // Create new PDF for this test
      const testPdf = PDF.create();

      // Helper to draw DRAFT stamp (red with outline)
      const drawDraftStamp = (
        page: ReturnType<typeof testPdf.addPage>,
        x: number,
        y: number,
        fontName: string,
      ) => {
        page.drawOperators([
          ops.pushGraphicsState(),
          // Red outlined box
          ops.setStrokingRGB(0.8, 0.1, 0.1),
          ops.setNonStrokingRGB(1, 1, 1),
          ops.setLineWidth(2),
          ops.rectangle(x, y, 100, 40),
          ops.fillAndStroke(),
          // Inner red box
          ops.setStrokingRGB(0.8, 0.1, 0.1),
          ops.setLineWidth(1),
          ops.rectangle(x + 3, y + 3, 94, 34),
          ops.stroke(),
          ops.popGraphicsState(),
          // Text
          ops.beginText(),
          ops.setFont(fontName, 24),
          ops.setNonStrokingRGB(0.8, 0.1, 0.1),
          ops.moveText(x + 10, y + 10),
          ops.showText("DRAFT"),
          ops.endText(),
        ]);
      };

      // Helper to draw APPROVED stamp (green, rotated)
      const drawApprovedStamp = (
        page: ReturnType<typeof testPdf.addPage>,
        x: number,
        y: number,
        fontName: string,
        angle: number,
      ) => {
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.concatMatrix(
            Matrix.identity()
              .translate(x, y)
              .rotate((angle * Math.PI) / 180),
          ),
          // Green filled box
          ops.setNonStrokingRGB(0.2, 0.7, 0.35),
          ops.rectangle(0, 0, 140, 35),
          ops.fill(),
          ops.popGraphicsState(),
          // Text (also rotated)
          ops.pushGraphicsState(),
          ops.concatMatrix(
            Matrix.identity()
              .translate(x, y)
              .rotate((angle * Math.PI) / 180),
          ),
          ops.beginText(),
          ops.setFont(fontName, 20),
          ops.setNonStrokingRGB(1, 1, 1),
          ops.moveText(8, 8),
          ops.showText("APPROVED"),
          ops.endText(),
          ops.popGraphicsState(),
        ]);
      };

      // Helper to draw CONFIDENTIAL stamp (yellow on navy)
      const drawConfidentialStamp = (
        page: ReturnType<typeof testPdf.addPage>,
        x: number,
        y: number,
        fontName: string,
      ) => {
        page.drawOperators([
          ops.pushGraphicsState(),
          // Navy background
          ops.setNonStrokingRGB(0.1, 0.15, 0.4),
          ops.rectangle(x, y, 180, 35),
          ops.fill(),
          ops.popGraphicsState(),
          // Yellow text
          ops.beginText(),
          ops.setFont(fontName, 18),
          ops.setNonStrokingRGB(1, 0.9, 0.2),
          ops.moveText(x + 10, y + 10),
          ops.showText("CONFIDENTIAL"),
          ops.endText(),
        ]);
      };

      // Create 3 pages with stamps
      for (let i = 0; i < 3; i++) {
        const page = testPdf.addPage({ width: 612, height: 792 }); // Letter size
        const titleFont = page.registerFont("Helvetica-Bold");
        const bodyFont = page.registerFont("Helvetica");

        // Page content
        page.drawOperators([
          // Title
          ops.beginText(),
          ops.setFont(titleFont, 28),
          ops.setNonStrokingGray(0),
          ops.moveText(50, 700),
          ops.showText(`Document Page ${i + 1}`),
          ops.endText(),
          // Description
          ops.beginText(),
          ops.setFont(bodyFont, 14),
          ops.setNonStrokingGray(0.3),
          ops.moveText(50, 660),
          ops.showText("This page demonstrates reusable Form XObjects (stamps)."),
          ops.endText(),
          ops.beginText(),
          ops.setFont(bodyFont, 14),
          ops.setNonStrokingGray(0.3),
          ops.moveText(50, 640),
          ops.showText("The same stamp objects are reused across all pages."),
          ops.endText(),
        ]);

        // Draw stamps
        // DRAFT stamp - top right
        drawDraftStamp(page, 470, 730, titleFont);

        // APPROVED stamp - middle right, rotated
        drawApprovedStamp(page, 400, 350, titleFont, -20);

        // CONFIDENTIAL stamp - bottom left
        drawConfidentialStamp(page, 50, 50, titleFont);
      }

      const bytes = await testPdf.save();
      await saveTestOutput("low-level-api/stamps.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });

  describe("Combined Demo", () => {
    it("demonstrates all features combined in a complex scene", async () => {
      const page = pdf.addPage({ width: 612, height: 792 }); // Letter size

      // White background
      page.drawOperators([
        ops.setNonStrokingRGB(1, 1, 1),
        ops.rectangle(0, 0, 612, 792),
        ops.fill(),
      ]);

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
      const dashArray = new (await import("#src/objects/pdf-array")).PdfArray([
        (await import("#src/objects/pdf-number")).PdfNumber.of(8),
        (await import("#src/objects/pdf-number")).PdfNumber.of(4),
      ]);
      page.drawOperators([
        ops.setNonStrokingRGB(0.85, 0.95, 0.85),
        ops.rectangle(170, 370, 100, 70),
        ops.fill(),
        ops.setStrokingRGB(0.3, 0.6, 0.35),
        ops.setLineWidth(2),
        ops.setDashPattern(dashArray, 0),
        ops.rectangle(170, 370, 100, 70),
        ops.stroke(),
        ops.setDashPattern(new (await import("#src/objects/pdf-array")).PdfArray([]), 0), // Reset
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
      const dotArray = new (await import("#src/objects/pdf-array")).PdfArray([
        (await import("#src/objects/pdf-number")).PdfNumber.of(2),
        (await import("#src/objects/pdf-number")).PdfNumber.of(4),
      ]);
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
        ops.setDashPattern(new (await import("#src/objects/pdf-array")).PdfArray([]), 0), // Reset
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
});
