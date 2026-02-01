/**
 * Integration tests for Form XObjects in the low-level drawing API.
 */

import { ops, PDF, Matrix } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { describe, expect, it } from "vitest";

describe("Low-Level Drawing: Form XObjects", () => {
  it("demonstrates reusable Form XObjects (stamps)", async () => {
    // Create new PDF for this test
    const testPdf = PDF.create();

    // Create Form XObjects for each stamp type - these are defined once
    // and reused across all pages

    // DRAFT stamp (red with outline) - no text since fonts need page registration
    const draftStamp = testPdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 100, height: 40 },
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
      bbox: { x: 0, y: 0, width: 140, height: 35 },
      operators: [ops.setNonStrokingRGB(0.2, 0.7, 0.35), ops.rectangle(0, 0, 140, 35), ops.fill()],
    });

    // CONFIDENTIAL stamp (navy background)
    const confidentialStamp = testPdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 180, height: 35 },
      operators: [ops.setNonStrokingRGB(0.1, 0.15, 0.4), ops.rectangle(0, 0, 180, 35), ops.fill()],
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
