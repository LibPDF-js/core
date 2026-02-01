/**
 * Integration tests for gradients in the low-level drawing API.
 */

import { ops, PDF, rgb } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: Gradients", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

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
