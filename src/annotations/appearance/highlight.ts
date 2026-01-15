/**
 * Highlight annotation appearance generation.
 *
 * Highlights use a transparency group with Multiply blend mode
 * to allow text to show through.
 */

import { type Color, colorToArray } from "#src/helpers/colors";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfBool } from "#src/objects/pdf-bool";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfStream } from "#src/objects/pdf-stream";

import type { Rect } from "../types";

/**
 * Generate the normal appearance stream for a highlight annotation.
 *
 * @param quadPoints - Array of quads, each quad is 8 numbers defining corners
 * @param color - Highlight color
 * @param rect - Bounding rectangle
 * @param opacity - Opacity (0-1)
 * @returns A PdfStream appearance XObject
 */
export function generateHighlightAppearance(
  quadPoints: number[][],
  color: Color,
  rect: Rect,
  opacity = 1,
): PdfStream {
  const colorComponents = colorToArray(color);

  // Build the content stream
  // For highlight, we draw filled quads in the highlight color
  let content = "";

  // Set fill color based on color type
  if (colorComponents.length === 1) {
    content += `${formatNumber(colorComponents[0])} g\n`;
  } else if (colorComponents.length === 3) {
    content += `${formatNumber(colorComponents[0])} ${formatNumber(colorComponents[1])} ${formatNumber(colorComponents[2])} rg\n`;
  } else if (colorComponents.length === 4) {
    content += `${formatNumber(colorComponents[0])} ${formatNumber(colorComponents[1])} ${formatNumber(colorComponents[2])} ${formatNumber(colorComponents[3])} k\n`;
  }

  // Draw each quad as a filled path
  for (const quad of quadPoints) {
    if (quad.length < 8) {
      continue;
    }

    // Translate coordinates to appearance stream coordinate system
    // (origin at rect.x, rect.y)
    const x1 = quad[0] - rect.x;
    const y1 = quad[1] - rect.y;
    const x2 = quad[2] - rect.x;
    const y2 = quad[3] - rect.y;
    const x3 = quad[4] - rect.x;
    const y3 = quad[5] - rect.y;
    const x4 = quad[6] - rect.x;
    const y4 = quad[7] - rect.y;

    // PDF QuadPoints order: top-left, top-right, bottom-left, bottom-right
    // We need to draw: top-left -> top-right -> bottom-right -> bottom-left -> close
    content += `${formatNumber(x1)} ${formatNumber(y1)} m\n`;
    content += `${formatNumber(x2)} ${formatNumber(y2)} l\n`;
    content += `${formatNumber(x4)} ${formatNumber(y4)} l\n`;
    content += `${formatNumber(x3)} ${formatNumber(y3)} l\n`;
    content += "h f\n";
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

  // Set up transparency group for proper blending
  const group = PdfDict.of({
    S: PdfName.of("Transparency"),
    CS: PdfName.of("DeviceRGB"),
    I: PdfBool.of(true), // Isolated
    K: PdfBool.of(false), // Non-knockout
  });
  stream.set("Group", group);

  // Resources with blend mode
  const extGState = PdfDict.of({
    GS0: PdfDict.of({
      Type: PdfName.of("ExtGState"),
      BM: PdfName.of("Multiply"),
      ca: PdfNumber.of(opacity),
      CA: PdfNumber.of(opacity),
    }),
  });
  const resources = PdfDict.of({
    ExtGState: extGState,
  });
  stream.set("Resources", resources);

  // Update content to use graphics state
  const contentWithGS = `/GS0 gs\n${content}`;
  stream.setData(new TextEncoder().encode(contentWithGS));

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
