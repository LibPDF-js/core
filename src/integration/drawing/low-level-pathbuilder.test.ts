/**
 * Integration tests for PathBuilder with advanced features in the low-level drawing API.
 */

import { ops, PDF } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: PathBuilder Advanced", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

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
      bbox: { x: 0, y: 0, width: 12, height: 12 },
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
