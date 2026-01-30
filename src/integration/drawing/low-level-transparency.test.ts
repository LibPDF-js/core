/**
 * Integration tests for transparency and blend modes in the low-level drawing API.
 */

import { ops, PDF } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

describe("Low-Level Drawing: Transparency", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

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
