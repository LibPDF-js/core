/**
 * Integration tests for soft masks, transparency groups, and gradient stop opacity
 * in the low-level drawing API.
 *
 * This suite generates visual PDF fixtures covering:
 * - Gradient stop opacity (varying and uniform)
 * - Luminosity soft masks (explicit)
 * - Alpha soft masks (explicit)
 * - Soft mask composability with blend modes and constant opacity
 * - Radial gradient opacity
 * - Multi-stop gradient opacity
 * - Stroke pathway soft masks
 * - SMask reset (/SMask /None)
 * - Opaque gradient control (no transparency resources)
 */

import { ops, PDF, PdfDict, PdfName, PdfRef, rgb } from "#src/index";
import { saveTestOutput } from "#src/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveDict(pdf: PDF, entry: unknown): PdfDict | null {
  if (entry instanceof PdfDict) {
    return entry;
  }
  if (entry instanceof PdfRef) {
    const resolved = pdf.getObject(entry);
    return resolved instanceof PdfDict ? resolved : null;
  }
  return null;
}

function toVersionNumber(version: string): number {
  const [major, minor] = version.split(".").map(Number);
  return major * 10 + (minor || 0);
}

/** Draw text using low-level operators (requires registered fonts). */
function textOps(
  fontName: string,
  size: number,
  x: number,
  y: number,
  text: string,
  gray = 0,
): ReturnType<typeof ops.beginText>[] {
  return [
    ops.beginText(),
    ops.setFont(fontName, size),
    ops.setNonStrokingGray(gray),
    ops.moveText(x, y),
    ops.showText(text),
    ops.endText(),
  ];
}

/** Draw a light background panel behind a demo area. */
function panelOps(
  x: number,
  y: number,
  width: number,
  height: number,
): ReturnType<typeof ops.setNonStrokingRGB>[] {
  return [
    ops.setNonStrokingRGB(0.96, 0.96, 0.98),
    ops.rectangle(x, y, width, height),
    ops.fill(),
    ops.setStrokingRGB(0.82, 0.82, 0.88),
    ops.setLineWidth(0.5),
    ops.rectangle(x, y, width, height),
    ops.stroke(),
  ];
}

describe("Low-Level Drawing: Soft Masks & Gradient Opacity", () => {
  let pdf: PDF;

  beforeEach(() => {
    pdf = PDF.create();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Page 1: Gradient stop opacity
  // ─────────────────────────────────────────────────────────────────────────────

  it("demonstrates gradient stop opacity", async () => {
    const page = pdf.addPage({ width: 612, height: 792 });

    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");

    // ── Title ────────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 22, 50, 740, "Gradient Stop Opacity"),
      ...textOps(
        bodyFont,
        10,
        50,
        722,
        "ColorStop.opacity controls per-stop transparency via soft masks",
        0.3,
      ),
    ]);

    // ── Section 1: Varying opacity (fade to transparent) ────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 694, "1. Varying stop opacity (fade to transparent)"),
      ...textOps(
        bodyFont,
        10,
        50,
        678,
        "Left = fully opaque red, right = fully transparent red",
        0.35,
      ),
    ]);

    // Control: solid red (no opacity) for comparison
    page.drawOperators([
      ...panelOps(50, 608, 120, 55),
      ...textOps(bodyFont, 9, 55, 597, "Control: solid red", 0.4),
    ]);
    page.drawRectangle({
      x: 55,
      y: 613,
      width: 110,
      height: 45,
      color: rgb(0.9, 0.2, 0.2),
    });

    // Test: fade-to-transparent gradient
    page.drawOperators([
      ...panelOps(190, 608, 220, 55),
      ...textOps(bodyFont, 9, 195, 597, "Gradient: opacity 1 -> 0 (should fade right)", 0.4),
    ]);

    const fadeGradient = pdf.createLinearGradient({
      angle: 90,
      length: 210,
      stops: [
        { offset: 0, color: rgb(0.9, 0.2, 0.2), opacity: 1 },
        { offset: 1, color: rgb(0.9, 0.2, 0.2), opacity: 0 },
      ],
    });
    const fadePattern = pdf.createShadingPattern({
      shading: fadeGradient,
      matrix: [1, 0, 0, 1, 195, 0],
    });

    page.drawRectangle({
      x: 195,
      y: 613,
      width: 210,
      height: 45,
      pattern: fadePattern,
    });

    // Test: reverse fade (transparent to opaque)
    page.drawOperators([
      ...panelOps(430, 608, 160, 55),
      ...textOps(bodyFont, 9, 435, 597, "Reverse: opacity 0 -> 1", 0.4),
    ]);

    const reverseFade = pdf.createLinearGradient({
      angle: 90,
      length: 150,
      stops: [
        { offset: 0, color: rgb(0.2, 0.6, 0.9), opacity: 0 },
        { offset: 1, color: rgb(0.2, 0.6, 0.9), opacity: 1 },
      ],
    });
    const reversePattern = pdf.createShadingPattern({
      shading: reverseFade,
      matrix: [1, 0, 0, 1, 435, 0],
    });

    page.drawRectangle({
      x: 435,
      y: 613,
      width: 150,
      height: 45,
      pattern: reversePattern,
    });

    // ── Section 2: Uniform stop opacity ─────────────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 570, "2. Uniform stop opacity (all stops same)"),
      ...textOps(
        bodyFont,
        10,
        50,
        554,
        "Uses constant alpha (ca) only — no soft mask needed",
        0.35,
      ),
    ]);

    const uniformOpacities = [1.0, 0.75, 0.5, 0.25];
    const uniformLabels = ["100% (control)", "75% uniform", "50% uniform", "25% uniform"];
    const colX = [50, 190, 330, 470];

    for (let i = 0; i < uniformOpacities.length; i++) {
      const x = colX[i];
      page.drawOperators([
        ...panelOps(x, 482, 120, 55),
        ...textOps(bodyFont, 9, x + 5, 471, uniformLabels[i], 0.4),
      ]);

      const gradient = pdf.createLinearGradient({
        angle: 90,
        length: 110,
        stops: [
          { offset: 0, color: rgb(0.2, 0.7, 0.3), opacity: uniformOpacities[i] },
          { offset: 1, color: rgb(0.9, 0.8, 0.1), opacity: uniformOpacities[i] },
        ],
      });
      const pattern = pdf.createShadingPattern({
        shading: gradient,
        matrix: [1, 0, 0, 1, x + 5, 0],
      });

      page.drawRectangle({
        x: x + 5,
        y: 487,
        width: 110,
        height: 45,
        pattern,
      });
    }

    // ── Section 3: Varying + draw opacity composition ───────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 444, "3. Gradient opacity + draw opacity composition"),
      ...textOps(
        bodyFont,
        10,
        50,
        428,
        "Gradient opacity multiplied with drawRectangle opacity",
        0.35,
      ),
    ]);

    // Same gradient (opacity 1 -> 0.3) with varying draw opacity so the
    // difference in overall opacity is clearly visible across all four panels.
    const composeConfigs = [
      { drawOp: 1.0, label: "draw 100% (full)" },
      { drawOp: 0.7, label: "draw 70%" },
      { drawOp: 0.4, label: "draw 40%" },
      { drawOp: 0.15, label: "draw 15%" },
    ];

    for (let i = 0; i < composeConfigs.length; i++) {
      const x = colX[i];
      const { drawOp, label } = composeConfigs[i];
      page.drawOperators([
        ...panelOps(x, 356, 120, 55),
        ...textOps(bodyFont, 8, x + 5, 345, label, 0.4),
      ]);

      const gradient = pdf.createLinearGradient({
        angle: 90,
        length: 110,
        stops: [
          { offset: 0, color: rgb(0.8, 0.1, 0.5), opacity: 1 },
          { offset: 1, color: rgb(0.8, 0.1, 0.5), opacity: 0.3 },
        ],
      });
      const pattern = pdf.createShadingPattern({
        shading: gradient,
        matrix: [1, 0, 0, 1, x + 5, 0],
      });

      page.drawRectangle({
        x: x + 5,
        y: 361,
        width: 110,
        height: 45,
        pattern,
        opacity: drawOp,
      });
    }

    // ── Section 4: Multi-stop gradient opacity ──────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 318, "4. Multi-stop gradient opacity"),
      ...textOps(bodyFont, 10, 50, 302, "Three or more stops with different opacities", 0.35),
    ]);

    // 3-stop: opaque-transparent-opaque
    page.drawOperators([
      ...panelOps(50, 230, 240, 55),
      ...textOps(bodyFont, 9, 55, 219, "3 stops: 1.0 -> 0.0 -> 1.0 (dip in center)", 0.4),
    ]);

    const threeStop = pdf.createLinearGradient({
      angle: 90,
      length: 230,
      stops: [
        { offset: 0, color: rgb(0.1, 0.5, 0.9), opacity: 1 },
        { offset: 0.5, color: rgb(0.1, 0.5, 0.9), opacity: 0 },
        { offset: 1, color: rgb(0.1, 0.5, 0.9), opacity: 1 },
      ],
    });
    const threeStopPattern = pdf.createShadingPattern({
      shading: threeStop,
      matrix: [1, 0, 0, 1, 55, 0],
    });

    page.drawRectangle({
      x: 55,
      y: 235,
      width: 230,
      height: 45,
      pattern: threeStopPattern,
    });

    // 5-stop gradient: color changes with opacity changes
    page.drawOperators([
      ...panelOps(310, 230, 280, 55),
      ...textOps(bodyFont, 9, 315, 219, "5 stops: color + varying opacity per stop", 0.4),
    ]);

    const fiveStop = pdf.createLinearGradient({
      angle: 90,
      length: 270,
      stops: [
        { offset: 0, color: rgb(1, 0, 0), opacity: 0.8 },
        { offset: 0.25, color: rgb(1, 0.5, 0), opacity: 0.2 },
        { offset: 0.5, color: rgb(0, 1, 0), opacity: 1 },
        { offset: 0.75, color: rgb(0, 0.5, 1), opacity: 0.3 },
        { offset: 1, color: rgb(0.5, 0, 1), opacity: 0.9 },
      ],
    });
    const fiveStopPattern = pdf.createShadingPattern({
      shading: fiveStop,
      matrix: [1, 0, 0, 1, 315, 0],
    });

    page.drawRectangle({
      x: 315,
      y: 235,
      width: 270,
      height: 45,
      pattern: fiveStopPattern,
    });

    // ── Section 5: Radial gradient with opacity ─────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 192, "5. Radial gradient with stop opacity"),
      ...textOps(bodyFont, 10, 50, 176, "Radial gradients also support per-stop opacity", 0.35),
    ]);

    // Control: opaque radial
    page.drawOperators([
      ...panelOps(50, 80, 120, 80),
      ...textOps(bodyFont, 9, 55, 69, "Control: opaque radial", 0.4),
    ]);

    const opaqueRadial = pdf.createRadialShading({
      coords: [110, 120, 0, 110, 120, 55],
      stops: [
        { offset: 0, color: rgb(1, 1, 0) },
        { offset: 1, color: rgb(0.8, 0.2, 0) },
      ],
    });
    const opaqueRadialPattern = pdf.createShadingPattern({ shading: opaqueRadial });

    page.drawRectangle({
      x: 55,
      y: 85,
      width: 110,
      height: 70,
      pattern: opaqueRadialPattern,
    });

    // Test: radial with edge fade
    page.drawOperators([
      ...panelOps(190, 80, 120, 80),
      ...textOps(bodyFont, 9, 195, 69, "Radial: edge fade out", 0.4),
    ]);

    const radialFade = pdf.createRadialShading({
      coords: [250, 120, 0, 250, 120, 55],
      stops: [
        { offset: 0, color: rgb(0.2, 0.5, 1), opacity: 1 },
        { offset: 0.7, color: rgb(0.2, 0.5, 1), opacity: 0.8 },
        { offset: 1, color: rgb(0.2, 0.5, 1), opacity: 0 },
      ],
    });
    const radialFadePattern = pdf.createShadingPattern({ shading: radialFade });

    page.drawRectangle({
      x: 195,
      y: 85,
      width: 110,
      height: 70,
      pattern: radialFadePattern,
    });

    // Test: radial with center transparent
    page.drawOperators([
      ...panelOps(330, 80, 120, 80),
      ...textOps(bodyFont, 9, 335, 69, "Radial: center hollow", 0.4),
    ]);

    const radialHollow = pdf.createRadialShading({
      coords: [390, 120, 0, 390, 120, 55],
      stops: [
        { offset: 0, color: rgb(0.9, 0.3, 0.5), opacity: 0 },
        { offset: 0.5, color: rgb(0.9, 0.3, 0.5), opacity: 1 },
        { offset: 1, color: rgb(0.9, 0.3, 0.5), opacity: 0.6 },
      ],
    });
    const radialHollowPattern = pdf.createShadingPattern({ shading: radialHollow });

    page.drawRectangle({
      x: 335,
      y: 85,
      width: 110,
      height: 70,
      pattern: radialHollowPattern,
    });

    // ── Footer ──────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(
        bodyFont,
        9,
        50,
        45,
        "Expected: opaque controls should be fully solid; fading gradients should show",
        0.3,
      ),
      ...textOps(
        bodyFont,
        9,
        50,
        33,
        "smooth transparency transitions; uniform-opacity versions use ca only (no SMask).",
        0.3,
      ),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/soft-masks-gradient-opacity.pdf", bytes);
    expect(bytes).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Page 2: Explicit soft masks (Luminosity & Alpha)
  // ─────────────────────────────────────────────────────────────────────────────

  it("demonstrates explicit luminosity and alpha soft masks", async () => {
    const page = pdf.addPage({ width: 612, height: 792 });

    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");

    // ── Title ────────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 22, 50, 740, "Explicit Soft Masks"),
      ...textOps(
        bodyFont,
        10,
        50,
        722,
        "Manual ExtGState SMask with Luminosity and Alpha subtypes",
        0.3,
      ),
    ]);

    // ── Section 1: Luminosity soft mask basics ──────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 694, "1. Luminosity soft mask"),
      ...textOps(
        bodyFont,
        10,
        50,
        678,
        "White mask pixels = visible, black mask pixels = hidden",
        0.35,
      ),
    ]);

    // Control: no mask
    page.drawOperators([
      ...panelOps(50, 600, 120, 60),
      ...textOps(bodyFont, 9, 55, 589, "Control: no mask", 0.4),
    ]);
    page.drawOperators([
      ops.setNonStrokingRGB(0.2, 0.5, 0.9),
      ops.rectangle(55, 605, 110, 50),
      ops.fill(),
    ]);

    // Test: luminosity mask - left half white (visible), right half black (hidden)
    page.drawOperators([
      ...panelOps(190, 600, 160, 60),
      ...textOps(bodyFont, 9, 195, 589, "Luminosity: left visible", 0.4),
    ]);

    const lumMask1 = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceGray", isolated: true },
      operators: [
        // Black background (hidden)
        ops.setNonStrokingGray(0),
        ops.rectangle(0, 0, 612, 792),
        ops.fill(),
        // White left half of rectangle area (visible)
        ops.setNonStrokingGray(1),
        ops.rectangle(195, 605, 75, 50),
        ops.fill(),
      ],
    });
    const lumGs1 = pdf.createExtGState({
      softMask: { subtype: "Luminosity", group: lumMask1 },
    });
    const lumGs1Name = page.registerExtGState(lumGs1);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(lumGs1Name),
      ops.setNonStrokingRGB(0.2, 0.5, 0.9),
      ops.rectangle(195, 605, 150, 50),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    // Test: luminosity mask with gradient (smooth transition)
    page.drawOperators([
      ...panelOps(370, 600, 210, 60),
      ...textOps(bodyFont, 9, 375, 589, "Luminosity: gradient mask (smooth)", 0.4),
    ]);

    // Create a gradient shading for the mask itself
    const maskGradient = pdf.createAxialShading({
      coords: [375, 630, 575, 630],
      stops: [
        { offset: 0, color: rgb(1, 1, 1) },
        { offset: 1, color: rgb(0, 0, 0) },
      ],
    });
    const maskGradientName = "MaskSh";
    const maskResources = PdfDict.of({
      Shading: PdfDict.of({
        [maskGradientName]: maskGradient.ref,
      }),
    });

    const lumMask2 = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceGray", isolated: true },
      resources: maskResources,
      operators: [
        ops.pushGraphicsState(),
        ops.rectangle(375, 605, 200, 50),
        ops.clip(),
        ops.endPath(),
        ops.paintShading(maskGradientName),
        ops.popGraphicsState(),
      ],
    });
    const lumGs2 = pdf.createExtGState({
      softMask: { subtype: "Luminosity", group: lumMask2 },
    });
    const lumGs2Name = page.registerExtGState(lumGs2);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(lumGs2Name),
      ops.setNonStrokingRGB(0.9, 0.3, 0.1),
      ops.rectangle(375, 605, 200, 50),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    // ── Section 2: Alpha soft mask ──────────────────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 562, "2. Alpha soft mask"),
      ...textOps(
        bodyFont,
        10,
        50,
        546,
        "Mask group alpha channel controls visibility (not luminance)",
        0.35,
      ),
    ]);

    // Control: no mask
    page.drawOperators([
      ...panelOps(50, 468, 120, 60),
      ...textOps(bodyFont, 9, 55, 457, "Control: no mask", 0.4),
    ]);
    page.drawOperators([
      ops.setNonStrokingRGB(0.9, 0.5, 0.2),
      ops.rectangle(55, 473, 110, 50),
      ops.fill(),
    ]);

    // Test: alpha mask with 45% opacity region
    page.drawOperators([
      ...panelOps(190, 468, 160, 60),
      ...textOps(bodyFont, 9, 195, 457, "Alpha: 45% opacity mask", 0.4),
    ]);

    const alphaInnerGs = pdf.createExtGState({ fillOpacity: 0.45 });
    const alphaMaskResources = PdfDict.of({
      ExtGState: PdfDict.of({
        GSInner: alphaInnerGs.ref,
      }),
    });
    const alphaMask1 = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceRGB", isolated: true },
      resources: alphaMaskResources,
      operators: [
        ops.pushGraphicsState(),
        ops.setGraphicsState("GSInner"),
        ops.setNonStrokingRGB(1, 1, 1),
        ops.rectangle(195, 473, 150, 50),
        ops.fill(),
        ops.popGraphicsState(),
      ],
    });
    const alphaGs1 = pdf.createExtGState({
      softMask: { subtype: "Alpha", group: alphaMask1 },
    });
    const alphaGs1Name = page.registerExtGState(alphaGs1);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(alphaGs1Name),
      ops.setNonStrokingRGB(0.9, 0.5, 0.2),
      ops.rectangle(195, 473, 150, 50),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    // Test: alpha mask — fully opaque comparison
    page.drawOperators([
      ...panelOps(370, 468, 160, 60),
      ...textOps(bodyFont, 9, 375, 457, "Alpha: 100% mask (= control)", 0.4),
    ]);

    const alphaFullGs = pdf.createExtGState({ fillOpacity: 1 });
    const alphaFullMaskResources = PdfDict.of({
      ExtGState: PdfDict.of({
        GSFull: alphaFullGs.ref,
      }),
    });
    const alphaMask2 = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceRGB", isolated: true },
      resources: alphaFullMaskResources,
      operators: [
        ops.pushGraphicsState(),
        ops.setGraphicsState("GSFull"),
        ops.setNonStrokingRGB(1, 1, 1),
        ops.rectangle(375, 473, 150, 50),
        ops.fill(),
        ops.popGraphicsState(),
      ],
    });
    const alphaGs2 = pdf.createExtGState({
      softMask: { subtype: "Alpha", group: alphaMask2 },
    });
    const alphaGs2Name = page.registerExtGState(alphaGs2);

    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(alphaGs2Name),
      ops.setNonStrokingRGB(0.9, 0.5, 0.2),
      ops.rectangle(375, 473, 150, 50),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    // ── Section 3: Composability — SMask + blend mode + constant opacity ────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 430, "3. Composability: SMask + blend mode + constant opacity"),
      ...textOps(
        bodyFont,
        10,
        50,
        414,
        "All three features applied simultaneously via a single ExtGState",
        0.35,
      ),
    ]);

    // Background for blend mode demos (need a colored base to see blending)
    const blendConfigs = [
      { blend: "Multiply" as const, ca: 0.85, label: "Luminosity + Multiply + ca=0.85" },
      { blend: "Screen" as const, ca: 0.6, label: "Alpha + Screen + ca=0.6" },
      { blend: "Overlay" as const, ca: 0.9, label: "Luminosity + Overlay + ca=0.9" },
    ];
    const blendY = [340, 250, 160];

    for (let i = 0; i < blendConfigs.length; i++) {
      const { blend, ca, label } = blendConfigs[i];
      const y = blendY[i];

      page.drawOperators([...textOps(bodyFont, 10, 55, y + 55, label, 0.2)]);

      // Dark background to show blending effect
      page.drawOperators([...panelOps(50, y, 250, 48)]);
      page.drawOperators([
        ops.setNonStrokingRGB(0.15, 0.2, 0.3),
        ops.rectangle(55, y + 5, 240, 38),
        ops.fill(),
      ]);

      if (i === 1) {
        // Alpha soft mask
        const innerGs = pdf.createExtGState({ fillOpacity: 0.5 });
        const innerResources = PdfDict.of({
          ExtGState: PdfDict.of({ GSi: innerGs.ref }),
        });
        const maskGroup = pdf.createFormXObject({
          bbox: { x: 0, y: 0, width: 612, height: 792 },
          group: { colorSpace: "DeviceRGB", isolated: true },
          resources: innerResources,
          operators: [
            ops.pushGraphicsState(),
            ops.setGraphicsState("GSi"),
            ops.setNonStrokingRGB(1, 1, 1),
            ops.rectangle(55, y + 5, 240, 38),
            ops.fill(),
            ops.popGraphicsState(),
          ],
        });
        const gs = pdf.createExtGState({
          softMask: { subtype: "Alpha", group: maskGroup },
          fillOpacity: ca,
          blendMode: blend,
        });
        const gsName = page.registerExtGState(gs);

        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setGraphicsState(gsName),
          ops.setNonStrokingRGB(0.9, 0.6, 0.2),
          ops.rectangle(55, y + 5, 240, 38),
          ops.fill(),
          ops.popGraphicsState(),
        ]);
      } else {
        // Luminosity soft mask
        const maskGroup = pdf.createFormXObject({
          bbox: { x: 0, y: 0, width: 612, height: 792 },
          group: { colorSpace: "DeviceGray", isolated: true },
          operators: [
            ops.setNonStrokingGray(0),
            ops.rectangle(0, 0, 612, 792),
            ops.fill(),
            ops.setNonStrokingGray(1),
            ops.rectangle(55, y + 5, 240, 38),
            ops.fill(),
          ],
        });
        const gs = pdf.createExtGState({
          softMask: { subtype: "Luminosity", group: maskGroup },
          fillOpacity: ca,
          blendMode: blend,
        });
        const gsName = page.registerExtGState(gs);

        page.drawOperators([
          ops.pushGraphicsState(),
          ops.setGraphicsState(gsName),
          ops.setNonStrokingRGB(0.3, 0.7, 0.9),
          ops.rectangle(55, y + 5, 240, 38),
          ops.fill(),
          ops.popGraphicsState(),
        ]);
      }

      // Control: same color without mask/blend, at same ca
      page.drawOperators([
        ...textOps(bodyFont, 9, 320, y + 55, `Control: no mask, no blend, ca=${ca}`, 0.4),
        ...panelOps(315, y, 250, 48),
      ]);
      page.drawOperators([
        ops.setNonStrokingRGB(0.15, 0.2, 0.3),
        ops.rectangle(320, y + 5, 240, 38),
        ops.fill(),
      ]);

      const controlGs = pdf.createExtGState({ fillOpacity: ca });
      const controlGsName = page.registerExtGState(controlGs);
      page.drawOperators([
        ops.pushGraphicsState(),
        ops.setGraphicsState(controlGsName),
        ops.setNonStrokingRGB(i === 1 ? 0.9 : 0.3, i === 1 ? 0.6 : 0.7, i === 1 ? 0.2 : 0.9),
        ops.rectangle(320, y + 5, 240, 38),
        ops.fill(),
        ops.popGraphicsState(),
      ]);
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(
        bodyFont,
        9,
        50,
        130,
        "Expected: Luminosity mask uses grayscale to control visibility;",
        0.3,
      ),
      ...textOps(
        bodyFont,
        9,
        50,
        118,
        "Alpha mask uses source alpha; composability stacks all three effects.",
        0.3,
      ),
      ...textOps(
        bodyFont,
        9,
        50,
        106,
        "Controls on the right should look like the blend-masked version minus the blend effect.",
        0.3,
      ),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/soft-masks-explicit.pdf", bytes);
    expect(bytes).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Page 3: Stroke pathway soft masks & SMask reset
  // ─────────────────────────────────────────────────────────────────────────────

  it("demonstrates stroke pathway soft masks and SMask reset", async () => {
    const page = pdf.addPage({ width: 612, height: 792 });

    const titleFont = page.registerFont("Helvetica-Bold");
    const bodyFont = page.registerFont("Helvetica");

    // ── Title ────────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 22, 50, 740, "Stroke Soft Masks & SMask Reset"),
      ...textOps(
        bodyFont,
        10,
        50,
        722,
        "Opacity on stroke pathways and explicit SMask /None reset",
        0.3,
      ),
    ]);

    // ── Section 1: Stroke gradient with varying opacity ─────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 694, "1. Stroke with varying gradient opacity"),
      ...textOps(bodyFont, 10, 50, 678, "borderPattern with per-stop opacity on stroke path", 0.35),
    ]);

    // Control: opaque solid stroke
    page.drawOperators([
      ...panelOps(50, 590, 240, 70),
      ...textOps(bodyFont, 9, 55, 579, "Control: solid color stroke (14pt)", 0.4),
    ]);

    // Light interior so stroke is visible
    page.drawRectangle({ x: 60, y: 600, width: 220, height: 50, color: rgb(0.92, 0.96, 0.93) });
    page
      .drawPath()
      .rectangle(60, 600, 220, 50)
      .stroke({ borderColor: rgb(0.2, 0.8, 0.4), borderWidth: 14 });

    // Test: fade stroke (opaque left, transparent right)
    page.drawOperators([
      ...panelOps(310, 590, 270, 70),
      ...textOps(bodyFont, 9, 315, 579, "Fade stroke: opacity 1 -> 0 (14pt)", 0.4),
    ]);

    page.drawRectangle({ x: 320, y: 600, width: 250, height: 50, color: rgb(0.92, 0.96, 0.93) });

    const strokeFade = pdf.createLinearGradient({
      angle: 90,
      length: 250,
      stops: [
        { offset: 0, color: rgb(0.2, 0.8, 0.4), opacity: 1 },
        { offset: 1, color: rgb(0.2, 0.8, 0.4), opacity: 0 },
      ],
    });
    const strokeFadePattern = pdf.createShadingPattern({
      shading: strokeFade,
      matrix: [1, 0, 0, 1, 320, 0],
    });

    page
      .drawPath()
      .rectangle(320, 600, 250, 50)
      .stroke({ borderPattern: strokeFadePattern, borderWidth: 14 });

    // ── Section 2: Stroke + draw opacity composition ────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 552, "2. Stroke opacity composition"),
      ...textOps(
        bodyFont,
        10,
        50,
        536,
        "Varying gradient opacity * borderOpacity on stroke path",
        0.35,
      ),
    ]);

    // Use the same gradient (opacity 1 -> 0.2) with decreasing borderOpacity.
    // The gradient doesn't fade to 0 so even at low borderOpacity values
    // the stroke remains visible.
    const strokeCompConfigs = [
      { borderOp: undefined, label: "borderOpacity = 1.0" },
      { borderOp: 0.5, label: "borderOpacity = 0.5" },
      { borderOp: 0.2, label: "borderOpacity = 0.2" },
    ];

    for (let i = 0; i < strokeCompConfigs.length; i++) {
      const x = 50 + i * 185;
      const { borderOp, label } = strokeCompConfigs[i];

      page.drawOperators([
        ...panelOps(x, 450, 170, 70),
        ...textOps(bodyFont, 8, x + 5, 439, label, 0.4),
      ]);

      // Colored interior so the fading stroke is visible against it
      page.drawRectangle({
        x: x + 20,
        y: 467,
        width: 135,
        height: 36,
        color: rgb(0.95, 0.92, 0.9),
      });

      const gradient = pdf.createLinearGradient({
        angle: 90,
        length: 155,
        stops: [
          { offset: 0, color: rgb(0.9, 0.2, 0.1), opacity: 1 },
          { offset: 1, color: rgb(0.9, 0.2, 0.1), opacity: 0.2 },
        ],
      });
      const pattern = pdf.createShadingPattern({
        shading: gradient,
        matrix: [1, 0, 0, 1, x + 10, 0],
      });

      page
        .drawPath()
        .rectangle(x + 10, 460, 155, 50)
        .stroke({ borderPattern: pattern, borderWidth: 12, borderOpacity: borderOp });
    }

    // ── Section 3: SMask reset (/SMask /None) ───────────────────────────────
    page.drawOperators([
      ...textOps(titleFont, 14, 50, 410, "3. SMask reset with /SMask /None"),
      ...textOps(
        bodyFont,
        10,
        50,
        394,
        "After applying a soft mask, reset with SMask='None' to clear it",
        0.35,
      ),
    ]);

    // Row 1: Before mask, with mask, after mask (no reset)
    // Wrapped in gsave/grestore so the mask doesn't leak into Row 2
    page.drawOperators([...textOps(bodyFont, 10, 55, 366, "Without reset — mask persists:", 0.2)]);

    // The mask only reveals a 100x50 region at (55, 290) — the "With mask" slot
    const persistMask = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceGray", isolated: true },
      operators: [
        ops.setNonStrokingGray(0),
        ops.rectangle(0, 0, 612, 792),
        ops.fill(),
        ops.setNonStrokingGray(1),
        ops.rectangle(180, 290, 100, 50),
        ops.fill(),
      ],
    });
    const persistGs = pdf.createExtGState({
      softMask: { subtype: "Luminosity", group: persistMask },
    });
    const persistGsName = page.registerExtGState(persistGs);
    const resetNoneGs = pdf.createExtGState({ softMask: "None" });
    const resetNoneGsName = page.registerExtGState(resetNoneGs);

    // Label positions
    page.drawOperators([
      ...panelOps(50, 285, 110, 60),
      ...textOps(bodyFont, 8, 55, 276, "Before mask (full)", 0.4),

      ...panelOps(175, 285, 110, 60),
      ...textOps(bodyFont, 8, 180, 276, "With mask (visible)", 0.4),

      ...panelOps(300, 285, 110, 60),
      ...textOps(bodyFont, 8, 305, 276, "No reset (hidden!)", 0.4),
    ]);

    // Before: draw without mask — should be fully visible
    page.drawOperators([
      ops.setNonStrokingRGB(0.2, 0.7, 0.4),
      ops.rectangle(55, 290, 100, 50),
      ops.fill(),
    ]);

    // Apply mask, then draw two rectangles without resetting.
    // Only the one inside the mask region should be visible.
    // Use gsave/grestore to isolate this whole demo from Row 2.
    page.drawOperators([
      ops.pushGraphicsState(),
      ops.setGraphicsState(persistGsName),
      // "With mask" — at (180, 290) which IS in the mask's white region
      ops.setNonStrokingRGB(0.2, 0.7, 0.4),
      ops.rectangle(180, 290, 100, 50),
      ops.fill(),
      // "No reset" — at (305, 290) which is NOT in the mask's white region
      ops.setNonStrokingRGB(0.2, 0.7, 0.4),
      ops.rectangle(305, 290, 100, 50),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    // Row 2: With proper reset using /SMask /None
    page.drawOperators([
      ...textOps(bodyFont, 10, 55, 256, "With reset — mask cleared after use:", 0.2),
    ]);

    // Mask reveals only the "With mask" slot at (180, 180)
    const resetMask = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 612, height: 792 },
      group: { colorSpace: "DeviceGray", isolated: true },
      operators: [
        ops.setNonStrokingGray(0),
        ops.rectangle(0, 0, 612, 792),
        ops.fill(),
        ops.setNonStrokingGray(1),
        ops.rectangle(180, 180, 100, 50),
        ops.fill(),
      ],
    });
    const resetMaskGs = pdf.createExtGState({
      softMask: { subtype: "Luminosity", group: resetMask },
    });
    const resetMaskGsName = page.registerExtGState(resetMaskGs);

    page.drawOperators([
      ...panelOps(50, 175, 110, 60),
      ...textOps(bodyFont, 8, 55, 166, "Before mask (full)", 0.4),

      ...panelOps(175, 175, 110, 60),
      ...textOps(bodyFont, 8, 180, 166, "With mask (visible)", 0.4),

      ...panelOps(300, 175, 110, 60),
      ...textOps(bodyFont, 8, 305, 166, "After reset (full!)", 0.4),
    ]);

    page.drawOperators([
      // Before mask — no mask active, should be fully visible
      ops.setNonStrokingRGB(0.8, 0.3, 0.5),
      ops.rectangle(55, 180, 100, 50),
      ops.fill(),
      // Apply mask — only region at (180, 180) is revealed
      ops.setGraphicsState(resetMaskGsName),
      ops.setNonStrokingRGB(0.8, 0.3, 0.5),
      ops.rectangle(180, 180, 100, 50),
      ops.fill(),
      // Reset mask with /SMask /None — should make subsequent draws fully visible
      ops.setGraphicsState(resetNoneGsName),
      ops.setNonStrokingRGB(0.8, 0.3, 0.5),
      ops.rectangle(305, 180, 100, 50),
      ops.fill(),
    ]);

    // ── Footer ──────────────────────────────────────────────────────────────
    page.drawOperators([
      ...textOps(
        bodyFont,
        9,
        50,
        140,
        "Expected: stroke fade should show gradient transparency on stroke paths;",
        0.3,
      ),
      ...textOps(
        bodyFont,
        9,
        50,
        128,
        "SMask persists across draws until reset; after /SMask /None, shapes render fully.",
        0.3,
      ),
    ]);

    const bytes = await pdf.save();
    await saveTestOutput("low-level-api/soft-masks-stroke-and-reset.pdf", bytes);
    expect(bytes).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Structural validation tests (round-trip parse)
  // ─────────────────────────────────────────────────────────────────────────────

  it("validates varying-opacity gradient produces correct SMask structure", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 400, height: 300 });

    const gradient = pdf.createLinearGradient({
      angle: 90,
      length: 220,
      stops: [
        { offset: 0, color: rgb(0.9, 0.2, 0.2), opacity: 1 },
        { offset: 1, color: rgb(0.9, 0.2, 0.2), opacity: 0 },
      ],
    });
    const pattern = pdf.createShadingPattern({ shading: gradient });

    page.drawRectangle({
      x: 50,
      y: 120,
      width: 240,
      height: 80,
      pattern,
      opacity: 0.75,
    });

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);
    const parsedPage = parsed.getPage(0)!;
    const extGState = parsedPage.getResources().getDict("ExtGState");

    expect(extGState).toBeDefined();

    let foundMaskState = false;

    for (const [, value] of extGState ?? []) {
      const gsDict = resolveDict(parsed, value);
      if (!gsDict) {
        continue;
      }

      const smask = gsDict.getDict("SMask");
      if (!smask) {
        continue;
      }

      foundMaskState = true;

      // Verify Luminosity subtype
      expect(smask.getName("S")).toEqual(PdfName.of("Luminosity"));

      // Verify draw opacity is applied
      expect(gsDict.getNumber("ca")?.value).toBeCloseTo(0.75, 6);

      // Verify mask group
      const maskGroupRef = smask.getRef("G");
      expect(maskGroupRef).toBeDefined();

      if (maskGroupRef) {
        const maskGroup = parsed.getObject(maskGroupRef);
        expect(maskGroup).toBeInstanceOf(PdfDict);

        if (maskGroup instanceof PdfDict) {
          const group = maskGroup.getDict("Group");
          expect(group?.getName("CS")).toEqual(PdfName.of("DeviceGray"));
          expect(group?.getBool("I")?.value).toBe(true);
        }
      }
    }

    expect(foundMaskState).toBe(true);
  });

  it("validates uniform stop opacity uses constant alpha without SMask", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 300, height: 200 });

    const gradient = pdf.createLinearGradient({
      angle: 0,
      length: 150,
      stops: [
        { offset: 0, color: rgb(0.1, 0.6, 0.9), opacity: 0.5 },
        { offset: 1, color: rgb(0.9, 0.6, 0.1), opacity: 0.5 },
      ],
    });
    const pattern = pdf.createShadingPattern({ shading: gradient });

    page.drawRectangle({
      x: 20,
      y: 60,
      width: 180,
      height: 70,
      pattern,
      opacity: 0.8,
    });

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);
    const parsedPage = parsed.getPage(0)!;
    const extGState = parsedPage.getResources().getDict("ExtGState");

    expect(extGState).toBeDefined();

    let foundCombinedOpacity = false;

    for (const [, value] of extGState ?? []) {
      const gsDict = resolveDict(parsed, value);
      if (!gsDict) {
        continue;
      }

      const ca = gsDict.getNumber("ca")?.value;
      if (ca === undefined) {
        continue;
      }

      // 0.5 (uniform) * 0.8 (draw) = 0.4
      if (Math.abs(ca - 0.4) < 1e-8) {
        foundCombinedOpacity = true;
        expect(gsDict.get("SMask")).toBeUndefined();
      }
    }

    expect(foundCombinedOpacity).toBe(true);
  });

  it("validates stroke pathway produces CA (not ca) in ExtGState", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 350, height: 250 });

    const gradient = pdf.createLinearGradient({
      angle: 180,
      length: 180,
      stops: [
        { offset: 0, color: rgb(0.2, 0.8, 0.4), opacity: 0 },
        { offset: 1, color: rgb(0.2, 0.8, 0.4), opacity: 1 },
      ],
    });
    const pattern = pdf.createShadingPattern({ shading: gradient });

    page
      .drawPath()
      .rectangle(40, 60, 220, 120)
      .stroke({ borderPattern: pattern, borderWidth: 14, borderOpacity: 0.5 });

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);
    const parsedPage = parsed.getPage(0)!;
    const extGState = parsedPage.getResources().getDict("ExtGState");

    expect(extGState).toBeDefined();

    let foundStrokeMask = false;

    for (const [, value] of extGState ?? []) {
      const gsDict = resolveDict(parsed, value);
      if (!gsDict) {
        continue;
      }

      const smask = gsDict.getDict("SMask");
      if (!smask) {
        continue;
      }

      const strokeOpacity = gsDict.getNumber("CA")?.value;
      if (strokeOpacity !== undefined && Math.abs(strokeOpacity - 0.5) < 1e-8) {
        foundStrokeMask = true;
        expect(smask.getName("S")).toEqual(PdfName.of("Luminosity"));
      }
    }

    expect(foundStrokeMask).toBe(true);
  });

  it("validates opaque gradient produces no ExtGState resources", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 320, height: 180 });

    const opaqueGradient = pdf.createLinearGradient({
      angle: 45,
      length: 180,
      stops: [
        { offset: 0, color: rgb(0.2, 0.6, 0.9) },
        { offset: 1, color: rgb(0.9, 0.4, 0.2) },
      ],
    });
    const opaquePattern = pdf.createShadingPattern({ shading: opaqueGradient });

    page.drawRectangle({ x: 30, y: 40, width: 220, height: 80, pattern: opaquePattern });

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);
    const parsedPage = parsed.getPage(0)!;
    const extGState = parsedPage.getResources().getDict("ExtGState");

    expect(extGState).toBeUndefined();
  });

  it("validates PDF version is >= 1.4 when transparency is used", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 300, height: 200 });

    const gradient = pdf.createLinearGradient({
      angle: 90,
      length: 200,
      stops: [
        { offset: 0, color: rgb(1, 0, 0), opacity: 1 },
        { offset: 1, color: rgb(1, 0, 0), opacity: 0 },
      ],
    });
    const pattern = pdf.createShadingPattern({ shading: gradient });

    page.drawRectangle({ x: 10, y: 10, width: 200, height: 100, pattern });

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);

    expect(toVersionNumber(parsed.version)).toBeGreaterThanOrEqual(14);
  });

  it("validates composable ExtGState with SMask + blend + opacity", async () => {
    const pdf = PDF.create();
    const page = pdf.addPage({ width: 400, height: 300 });

    const maskGroup = pdf.createFormXObject({
      bbox: { x: 0, y: 0, width: 400, height: 300 },
      group: { colorSpace: "DeviceGray", isolated: true },
      operators: [
        ops.setNonStrokingGray(0),
        ops.rectangle(0, 0, 400, 300),
        ops.fill(),
        ops.setNonStrokingGray(1),
        ops.rectangle(50, 50, 200, 100),
        ops.fill(),
      ],
    });

    const gs = pdf.createExtGState({
      softMask: { subtype: "Luminosity", group: maskGroup },
      fillOpacity: 0.85,
      blendMode: "Multiply",
    });
    const gsName = page.registerExtGState(gs);

    page.drawOperators([
      ops.setNonStrokingRGB(0.5, 0.5, 0.5),
      ops.rectangle(0, 0, 400, 300),
      ops.fill(),
      ops.pushGraphicsState(),
      ops.setGraphicsState(gsName),
      ops.setNonStrokingRGB(0.2, 0.5, 0.9),
      ops.rectangle(50, 50, 200, 100),
      ops.fill(),
      ops.popGraphicsState(),
    ]);

    const bytes = await pdf.save();
    const parsed = await PDF.load(bytes);
    const parsedPage = parsed.getPage(0)!;
    const extGState = parsedPage.getResources().getDict("ExtGState");

    expect(extGState).toBeDefined();

    let found = false;

    for (const [, value] of extGState ?? []) {
      const gsDict = resolveDict(parsed, value);
      if (!gsDict) {
        continue;
      }

      const smask = gsDict.getDict("SMask");
      if (!smask) {
        continue;
      }

      const subtype = smask.getName("S")?.value;
      const blendMode = gsDict.getName("BM")?.value;
      const fillOpacity = gsDict.getNumber("ca")?.value;

      if (
        subtype === "Luminosity" &&
        blendMode === "Multiply" &&
        fillOpacity !== undefined &&
        Math.abs(fillOpacity - 0.85) < 1e-8
      ) {
        found = true;

        // Verify mask group has DeviceGray colorSpace
        const groupRef = smask.getRef("G");
        expect(groupRef).toBeDefined();

        if (groupRef) {
          const groupObj = parsed.getObject(groupRef);
          if (groupObj instanceof PdfDict) {
            const group = groupObj.getDict("Group");
            expect(group?.getName("CS")).toEqual(PdfName.of("DeviceGray"));
            expect(group?.getBool("I")?.value).toBe(true);
          }
        }
      }
    }

    expect(found).toBe(true);
  });
});
