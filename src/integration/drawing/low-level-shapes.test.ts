/**
 * Integration tests for high-level shape methods with patterns in the low-level drawing API.
 */

import { ops, PDF, rgb } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: High-Level Shape Methods with Patterns", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

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
      bbox: { x: 0, y: 0, width: 20, height: 20 },
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
      bbox: { x: 0, y: 0, width: 10, height: 10 },
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
