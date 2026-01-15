/**
 * Underline annotation appearance generation.
 *
 * Draws a line under the text region defined by QuadPoints.
 */

import { type Color, colorToArray } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";

import type { Rect } from "../types";

/**
 * Generate the normal appearance stream for an underline annotation.
 *
 * @param quadPoints - Array of quads, each quad is 8 numbers defining corners
 * @param color - Line color
 * @param rect - Bounding rectangle
 * @param opacity - Opacity (0-1)
 * @param lineWidth - Line width
 * @returns A PdfStream appearance XObject
 */
export function generateUnderlineAppearance(
  quadPoints: number[][],
  color: Color,
  rect: Rect,
  opacity = 1,
  lineWidth = 1,
): PdfStream {
  const colorComponents = colorToArray(color);

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

  // Draw underlines for each quad
  for (const quad of quadPoints) {
    if (quad.length < 8) {
      continue;
    }

    // Bottom-left and bottom-right points (indices 4,5 and 6,7)
    const x1 = quad[4] - rect.x;
    const y1 = quad[5] - rect.y;
    const x2 = quad[6] - rect.x;
    const y2 = quad[7] - rect.y;

    // Draw line at the bottom of the quad
    content += `${formatNumber(x1)} ${formatNumber(y1)} m\n`;
    content += `${formatNumber(x2)} ${formatNumber(y2)} l\n`;
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
