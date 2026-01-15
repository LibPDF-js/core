/**
 * Squiggly annotation appearance generation.
 *
 * Draws a wavy underline using a sine wave approximation.
 */

import { type Color, colorToArray } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";

import type { Rect } from "../types";

/**
 * Generate the normal appearance stream for a squiggly annotation.
 *
 * @param quadPoints - Array of quads, each quad is 8 numbers defining corners
 * @param color - Line color
 * @param rect - Bounding rectangle
 * @param opacity - Opacity (0-1)
 * @param lineWidth - Line width
 * @returns A PdfStream appearance XObject
 */
export function generateSquigglyAppearance(
  quadPoints: number[][],
  color: Color,
  rect: Rect,
  opacity = 1,
  lineWidth = 0.5,
): PdfStream {
  const colorComponents = colorToArray(color);

  // Parameters for the wave
  const waveHeight = 2; // Height of wave peaks
  const waveLength = 4; // Length of one wave cycle

  // Build the content stream
  let content = "";

  // Set stroke color
  if (colorComponents.length === 1) {
    content += `${formatNumber(colorComponents[0])} G\n`;
  } else if (colorComponents.length === 3) {
    content += `${formatNumber(colorComponents[0])} ${formatNumber(colorComponents[1])} ${formatNumber(colorComponents[2])} RG\n`;
  } else if (colorComponents.length === 4) {
    content += `${formatNumber(colorComponents[0])} ${formatNumber(colorComponents[1])} ${formatNumber(colorComponents[2])} ${formatNumber(colorComponents[3])} K\n`;
  }

  // Set line width
  content += `${formatNumber(lineWidth)} w\n`;

  // Draw squiggly for each quad
  for (const quad of quadPoints) {
    if (quad.length < 8) {
      continue;
    }

    // Bottom-left and bottom-right points
    const x1 = quad[4] - rect.x;
    const y1 = quad[5] - rect.y;
    const x2 = quad[6] - rect.x;
    const y2 = quad[7] - rect.y;

    const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const numWaves = Math.max(1, Math.floor(lineLength / waveLength));
    const actualWaveLength = lineLength / numWaves;

    // Direction vector
    const dx = (x2 - x1) / lineLength;
    const dy = (y2 - y1) / lineLength;

    // Perpendicular vector (for wave height)
    const px = -dy;
    const py = dx;

    // Start at first point
    content += `${formatNumber(x1)} ${formatNumber(y1)} m\n`;

    // Draw wave using Bezier curves
    for (let i = 0; i < numWaves; i++) {
      const startX = x1 + dx * i * actualWaveLength;
      const startY = y1 + dy * i * actualWaveLength;

      // Control points for a sine-wave-like curve using cubic Bezier
      // Each half-wave is one Bezier curve
      const halfLen = actualWaveLength / 2;

      // First half-wave (going up)
      const cp1x = startX + dx * halfLen * 0.5 + px * waveHeight;
      const cp1y = startY + dy * halfLen * 0.5 + py * waveHeight;
      const midX = startX + dx * halfLen;
      const midY = startY + dy * halfLen;

      content += `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(midX)} ${formatNumber(midY + waveHeight / 2)} ${formatNumber(midX)} ${formatNumber(midY)} c\n`;

      // Second half-wave (going down)
      const cp2x = midX + dx * halfLen * 0.5 - px * waveHeight;
      const cp2y = midY + dy * halfLen * 0.5 - py * waveHeight;
      const endX = startX + dx * actualWaveLength;
      const endY = startY + dy * actualWaveLength;

      content += `${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY - waveHeight / 2)} ${formatNumber(endX)} ${formatNumber(endY)} c\n`;
    }

    content += "S\n";
  }

  const bytes = new TextEncoder().encode(content);
  const stream = new PdfStream([], bytes);

  // Set up as Form XObject
  stream.set("Type", PdfName.of("XObject"));
  stream.set("Subtype", PdfName.of("Form"));
  stream.set("FormType", PdfNumber.of(1));
  stream.set(
    "BBox",
    new PdfArray([
      PdfNumber.of(0),
      PdfNumber.of(0),
      PdfNumber.of(rect.width),
      PdfNumber.of(rect.height),
    ]),
  );

  // Add resources for opacity if needed
  if (opacity < 1) {
    const extGState = PdfDict.of({
      GS0: PdfDict.of({
        Type: PdfName.of("ExtGState"),
        CA: PdfNumber.of(opacity),
        ca: PdfNumber.of(opacity),
      }),
    });
    const resources = PdfDict.of({
      ExtGState: extGState,
    });
    stream.set("Resources", resources);

    // Prepend graphics state
    const contentWithGS = `/GS0 gs\n${content}`;
    stream.setData(new TextEncoder().encode(contentWithGS));
  }

  return stream;
}

/**
 * Format a number for PDF content stream.
 */
function formatNumber(n: number): string {
  const rounded = Math.round(n * 10000) / 10000;

  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toString();
}
