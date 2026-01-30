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

      // 1. Checkerboard pattern - top left
      const checkerPattern = pdf.createTilingPattern({
        bbox: [0, 0, 36, 36],
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
        bbox: [0, 0, 8, 8],
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
        bbox: [0, 0, 18, 18],
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
        bbox: [0, 0, 15, 15],
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
      const blendModeConfigs: {
        mode: "Multiply" | "Screen" | "Overlay" | "Difference";
        color: number[];
      }[] = [
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

      // Create Form XObjects for each stamp type - these are defined once
      // and reused across all pages

      // DRAFT stamp (red with outline) - no text since fonts need page registration
      const draftStamp = testPdf.createFormXObject({
        bbox: [0, 0, 100, 40],
        operators: [
          // Red outlined box
          ops.setStrokingRGB(0.8, 0.1, 0.1),
          ops.setNonStrokingRGB(1, 1, 1),
          ops.setLineWidth(2),
          ops.rectangle(0, 0, 100, 40),
          ops.fillAndStroke(),
          // Inner red box
          ops.setStrokingRGB(0.8, 0.1, 0.1),
          ops.setLineWidth(1),
          ops.rectangle(3, 3, 94, 34),
          ops.stroke(),
        ],
      });

      // APPROVED stamp (green filled box)
      const approvedStamp = testPdf.createFormXObject({
        bbox: [0, 0, 140, 35],
        operators: [
          ops.setNonStrokingRGB(0.2, 0.7, 0.35),
          ops.rectangle(0, 0, 140, 35),
          ops.fill(),
        ],
      });

      // CONFIDENTIAL stamp (navy background)
      const confidentialStamp = testPdf.createFormXObject({
        bbox: [0, 0, 180, 35],
        operators: [
          ops.setNonStrokingRGB(0.1, 0.15, 0.4),
          ops.rectangle(0, 0, 180, 35),
          ops.fill(),
        ],
      });

      // Create 3 pages with stamps - the XObjects are reused!
      for (let i = 0; i < 3; i++) {
        const page = testPdf.addPage({ width: 612, height: 792 }); // Letter size
        const titleFont = page.registerFont("Helvetica-Bold");
        const bodyFont = page.registerFont("Helvetica");

        // Register the XObjects on this page
        const draftName = page.registerXObject(draftStamp);
        const approvedName = page.registerXObject(approvedStamp);
        const confidentialName = page.registerXObject(confidentialStamp);

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

        // Draw DRAFT stamp - top right (with text overlay)
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.concatMatrix(Matrix.translate(470, 730)),
          ops.paintXObject(draftName),
          ops.popGraphicsState(),
          // Add text on top
          ops.beginText(),
          ops.setFont(titleFont, 24),
          ops.setNonStrokingRGB(0.8, 0.1, 0.1),
          ops.moveText(480, 740),
          ops.showText("DRAFT"),
          ops.endText(),
        ]);

        // Draw APPROVED stamp - middle right, rotated
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.concatMatrix(
            Matrix.identity()
              .translate(400, 350)
              .rotate((-20 * Math.PI) / 180),
          ),
          ops.paintXObject(approvedName),
          // Add text inside (already in rotated space)
          ops.beginText(),
          ops.setFont(titleFont, 20),
          ops.setNonStrokingRGB(1, 1, 1),
          ops.moveText(8, 8),
          ops.showText("APPROVED"),
          ops.endText(),
          ops.popGraphicsState(),
        ]);

        // Draw CONFIDENTIAL stamp - bottom left
        page.drawOperators([
          ops.pushGraphicsState(),
          ops.concatMatrix(Matrix.translate(50, 50)),
          ops.paintXObject(confidentialName),
          // Add text on top
          ops.beginText(),
          ops.setFont(titleFont, 18),
          ops.setNonStrokingRGB(1, 0.9, 0.2),
          ops.moveText(10, 10),
          ops.showText("CONFIDENTIAL"),
          ops.endText(),
          ops.popGraphicsState(),
        ]);
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

  describe("PathBuilder Advanced", () => {
    it("demonstrates PathBuilder with gradients and patterns", async () => {
      const page = pdf.addPage({ width: 612, height: 400 });
      const titleFont = page.registerFont("Helvetica-Bold");
      const bodyFont = page.registerFont("Helvetica");

      // Title
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 20),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 360),
        ops.showText("PathBuilder with Gradients & Patterns"),
        ops.endText(),
      ]);

      // Create gradients and wrap them in shading patterns
      // Shading patterns allow gradients to be used as fill colors via PathOptions.pattern

      // Gradient for rectangle at x=50 (50 to 200)
      const rectGradient = pdf.createShadingPattern({
        shading: pdf.createAxialShading({
          coords: [50, 0, 200, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 0.2, green: 0.5, blue: 0.9 } },
            { offset: 0.5, color: { type: "RGB", red: 0.9, green: 0.2, blue: 0.6 } },
            { offset: 1, color: { type: "RGB", red: 0.9, green: 0.9, blue: 0.2 } },
          ],
        }),
      });

      // Gradient for star at x=450-550
      const starGradient = pdf.createShadingPattern({
        shading: pdf.createAxialShading({
          coords: [450, 0, 550, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 0.2, green: 0.5, blue: 0.9 } },
            { offset: 0.5, color: { type: "RGB", red: 0.9, green: 0.2, blue: 0.6 } },
            { offset: 1, color: { type: "RGB", red: 0.9, green: 0.9, blue: 0.2 } },
          ],
        }),
      });

      // Gradient for ellipse at x=260-400
      const ellipseGradient = pdf.createShadingPattern({
        shading: pdf.createAxialShading({
          coords: [260, 0, 400, 0],
          stops: [
            { offset: 0, color: { type: "RGB", red: 0.2, green: 0.5, blue: 0.9 } },
            { offset: 0.5, color: { type: "RGB", red: 0.9, green: 0.2, blue: 0.6 } },
            { offset: 1, color: { type: "RGB", red: 0.9, green: 0.9, blue: 0.2 } },
          ],
        }),
      });

      // Create a tiling pattern for PathBuilder use
      const tilingPattern = pdf.createTilingPattern({
        bbox: [0, 0, 12, 12],
        xStep: 12,
        yStep: 12,
        operators: [
          ops.setNonStrokingRGB(0.3, 0.7, 0.4),
          ops.moveTo(6, 0),
          ops.lineTo(12, 6),
          ops.lineTo(6, 12),
          ops.lineTo(0, 6),
          ops.closePath(),
          ops.fill(),
        ],
      });

      // ===== Row 1: Rectangle with gradient =====
      // Using the new clean API: fill({ pattern: shadingPattern })
      page.drawPath().rectangle(50, 250, 150, 80).fill({ pattern: rectGradient });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(60, 235),
        ops.showText("Rectangle + Gradient"),
        ops.endText(),
      ]);

      // ===== Row 1: Circle with tiling pattern =====
      page.drawPath().circle(330, 290, 50).fill({ pattern: tilingPattern });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(290, 235),
        ops.showText("Circle + Pattern"),
        ops.endText(),
      ]);

      // ===== Row 1: Star with gradient =====
      const starPath = page.drawPath();
      const starCX = 500,
        starCY = 290,
        starOuterR = 50,
        starInnerR = 20;
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? starOuterR : starInnerR;
        const x = starCX + Math.cos(angle) * r;
        const y = starCY + Math.sin(angle) * r;
        if (i === 0) {
          starPath.moveTo(x, y);
        } else {
          starPath.lineTo(x, y);
        }
      }
      starPath.close().fill({ pattern: starGradient });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(470, 235),
        ops.showText("Star + Gradient"),
        ops.endText(),
      ]);

      // ===== Row 2: Complex path with tiling pattern =====
      page
        .drawPath()
        .moveTo(50, 180)
        .curveTo(100, 220, 150, 140, 200, 180)
        .lineTo(200, 120)
        .curveTo(150, 160, 100, 80, 50, 120)
        .close()
        .fill({ pattern: tilingPattern });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(70, 95),
        ops.showText("Bezier Shape + Pattern"),
        ops.endText(),
      ]);

      // ===== Row 2: Ellipse with gradient =====
      page.drawPath().ellipse(330, 150, 70, 40).fill({ pattern: ellipseGradient });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(295, 95),
        ops.showText("Ellipse + Gradient"),
        ops.endText(),
      ]);

      // ===== Row 2: Triangle with tiling pattern =====
      page
        .drawPath()
        .moveTo(500, 190)
        .lineTo(550, 110)
        .lineTo(450, 110)
        .close()
        .fill({ pattern: tilingPattern });

      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 11),
        ops.setNonStrokingGray(0.3),
        ops.moveText(460, 95),
        ops.showText("Triangle + Pattern"),
        ops.endText(),
      ]);

      // Footer
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.4),
        ops.moveText(50, 40),
        ops.showText("PathBuilder.fill({ pattern }) enables fluent gradient/pattern fills"),
        ops.endText(),
      ]);

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/pathbuilder-advanced.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });

  describe("High-Level Shape Methods with Patterns", () => {
    it("draws shapes with gradient patterns", async () => {
      const page = pdf.addPage({ width: 612, height: 792 });

      // Title
      const titleFont = page.registerFont("Helvetica-Bold");
      const bodyFont = page.registerFont("Helvetica");
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 24),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 740),
        ops.showText("High-Level Shapes with Patterns"),
        ops.endText(),
      ]);

      // Create gradient patterns
      const horizontalGradient = pdf.createAxialShading({
        coords: [0, 0, 150, 0],
        stops: [
          { offset: 0, color: rgb(1, 0, 0) },
          { offset: 0.5, color: rgb(1, 1, 0) },
          { offset: 1, color: rgb(0, 1, 0) },
        ],
      });
      const horizontalPattern = pdf.createShadingPattern({ shading: horizontalGradient });

      const verticalGradient = pdf.createAxialShading({
        coords: [0, 0, 0, 100],
        stops: [
          { offset: 0, color: rgb(0, 0, 1) },
          { offset: 1, color: rgb(0, 1, 1) },
        ],
      });
      const verticalPattern = pdf.createShadingPattern({ shading: verticalGradient });

      const radialGradient = pdf.createRadialShading({
        coords: [50, 50, 0, 50, 50, 60],
        stops: [
          { offset: 0, color: rgb(1, 1, 1) },
          { offset: 1, color: rgb(0.5, 0, 0.5) },
        ],
      });
      const radialPattern = pdf.createShadingPattern({ shading: radialGradient });

      // Section 1: Rectangle with gradient fill
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 680),
        ops.showText("drawRectangle with pattern:"),
        ops.endText(),
      ]);

      page.drawRectangle({
        x: 50,
        y: 550,
        width: 150,
        height: 100,
        pattern: horizontalPattern,
      });

      // Rectangle with pattern border
      page.drawRectangle({
        x: 220,
        y: 550,
        width: 150,
        height: 100,
        borderPattern: horizontalPattern,
        borderWidth: 8,
      });

      // Rectangle with rounded corners and gradient
      page.drawRectangle({
        x: 390,
        y: 550,
        width: 150,
        height: 100,
        pattern: verticalPattern,
        cornerRadius: 20,
      });

      // Section 2: Circle with gradient fill
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.moveText(50, 500),
        ops.showText("drawCircle with pattern:"),
        ops.endText(),
      ]);

      page.drawCircle({
        x: 120,
        y: 400,
        radius: 60,
        pattern: radialPattern,
      });

      page.drawCircle({
        x: 290,
        y: 400,
        radius: 60,
        pattern: horizontalPattern,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      page.drawCircle({
        x: 460,
        y: 400,
        radius: 60,
        borderPattern: verticalPattern,
        borderWidth: 10,
      });

      // Section 3: Ellipse with gradient fill
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.moveText(50, 300),
        ops.showText("drawEllipse with pattern:"),
        ops.endText(),
      ]);

      page.drawEllipse({
        x: 120,
        y: 210,
        xRadius: 80,
        yRadius: 50,
        pattern: horizontalPattern,
      });

      page.drawEllipse({
        x: 320,
        y: 210,
        xRadius: 80,
        yRadius: 50,
        pattern: verticalPattern,
        borderPattern: radialPattern,
        borderWidth: 5,
      });

      // Section 4: drawSvgPath with pattern
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 12),
        ops.moveText(50, 130),
        ops.showText("drawSvgPath with pattern:"),
        ops.endText(),
      ]);

      // Star shape
      const starPath =
        "M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z";
      page.drawSvgPath(starPath, {
        x: 70,
        y: 120,
        scale: 0.8,
        pattern: horizontalPattern,
      });

      page.drawSvgPath(starPath, {
        x: 200,
        y: 120,
        scale: 0.8,
        borderPattern: verticalPattern,
        borderWidth: 4,
      });

      page.drawSvgPath(starPath, {
        x: 330,
        y: 120,
        scale: 0.8,
        pattern: radialPattern,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Footer
      page.drawOperators([
        ops.beginText(),
        ops.setFont(bodyFont, 10),
        ops.setNonStrokingGray(0.4),
        ops.moveText(50, 30),
        ops.showText(
          "All high-level shape methods (drawRectangle, drawCircle, drawEllipse, drawSvgPath) support pattern fills",
        ),
        ops.endText(),
      ]);

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/high-level-patterns.pdf", bytes);
      expect(bytes).toBeDefined();
    });

    it("draws shapes with tiling patterns", async () => {
      const page = pdf.addPage({ width: 612, height: 400 });

      // Create a tiling pattern (checkerboard)
      const checkerPattern = pdf.createTilingPattern({
        bbox: [0, 0, 20, 20],
        xStep: 20,
        yStep: 20,
        operators: [
          ops.setNonStrokingGray(0.2),
          ops.rectangle(0, 0, 10, 10),
          ops.fill(),
          ops.rectangle(10, 10, 10, 10),
          ops.fill(),
          ops.setNonStrokingGray(0.8),
          ops.rectangle(10, 0, 10, 10),
          ops.fill(),
          ops.rectangle(0, 10, 10, 10),
          ops.fill(),
        ],
      });

      // Diagonal stripes pattern
      const stripesPattern = pdf.createTilingPattern({
        bbox: [0, 0, 10, 10],
        xStep: 10,
        yStep: 10,
        operators: [
          ops.setNonStrokingRGB(0.8, 0.8, 1),
          ops.rectangle(0, 0, 10, 10),
          ops.fill(),
          ops.setStrokingRGB(0, 0, 0.5),
          ops.setLineWidth(2),
          ops.moveTo(0, 0),
          ops.lineTo(10, 10),
          ops.stroke(),
        ],
      });

      // Title
      const titleFont = page.registerFont("Helvetica-Bold");
      page.drawOperators([
        ops.beginText(),
        ops.setFont(titleFont, 20),
        ops.setNonStrokingGray(0),
        ops.moveText(50, 360),
        ops.showText("Tiling Patterns in High-Level Shapes"),
        ops.endText(),
      ]);

      // Rectangle with checkerboard
      page.drawRectangle({
        x: 50,
        y: 200,
        width: 150,
        height: 120,
        pattern: checkerPattern,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      // Circle with stripes
      page.drawCircle({
        x: 320,
        y: 260,
        radius: 60,
        pattern: stripesPattern,
        borderColor: rgb(0, 0, 0.5),
        borderWidth: 2,
      });

      // Ellipse with checkerboard
      page.drawEllipse({
        x: 490,
        y: 260,
        xRadius: 70,
        yRadius: 50,
        pattern: checkerPattern,
      });

      // Rounded rectangle with stripes
      page.drawRectangle({
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        pattern: stripesPattern,
        cornerRadius: 15,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // SVG path with pattern
      const heartPath =
        "M 50 30 C 50 20, 40 10, 25 10 C 10 10, 0 25, 0 40 C 0 60, 25 80, 50 100 C 75 80, 100 60, 100 40 C 100 25, 90 10, 75 10 C 60 10, 50 20, 50 30 Z";
      page.drawSvgPath(heartPath, {
        x: 350,
        y: 150,
        scale: 0.8,
        pattern: checkerPattern,
        borderColor: rgb(0.5, 0, 0),
        borderWidth: 2,
      });

      const bytes = await pdf.save();
      await saveTestOutput("low-level-api/high-level-tiling-patterns.pdf", bytes);
      expect(bytes).toBeDefined();
    });
  });
});
