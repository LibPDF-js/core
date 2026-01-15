/**
 * Shared utilities for appearance stream generation.
 */

import type { Operator } from "#src/content/operators";
import {
  closePath,
  curveTo,
  fill,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setLineWidth,
  setNonStrokingCMYK,
  setNonStrokingGray,
  setNonStrokingRGB,
  setStrokingCMYK,
  setStrokingGray,
  setStrokingRGB,
  stroke,
} from "#src/helpers/operators";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfStream } from "#src/objects/pdf-stream";

import { type FormFont, isEmbeddedFont } from "./form-font";

/**
 * Parsed default appearance string components.
 */
export interface ParsedDA {
  /** Font name (e.g., "/Helv", "/F1") */
  fontName: string;
  /** Font size (0 = auto-size) */
  fontSize: number;
  /** Color operator ("g", "rg", or "k") */
  colorOp: string;
  /** Color arguments */
  colorArgs: number[];
}

/**
 * Styling extracted from an existing appearance stream.
 */
export interface ExtractedAppearanceStyle {
  /** Background fill color */
  backgroundColor?: number[];
  /** Border stroke color */
  borderColor?: number[];
  /** Border width */
  borderWidth?: number;
  /** Text color (inside BT...ET block) */
  textColor?: number[];
  /** Font name */
  fontName?: string;
  /** Font size */
  fontSize?: number;
}

/**
 * Font metrics for layout calculations.
 */
export interface FontMetrics {
  ascent: number;
  descent: number;
  capHeight: number;
  getTextWidth(text: string, fontSize: number): number;
}

/**
 * Constants for appearance generation.
 */
export const PADDING = 2;
export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 14;
export const DEFAULT_HIGHLIGHT_COLOR = { r: 153 / 255, g: 193 / 255, b: 218 / 255 };

/**
 * Extract styling information from an existing appearance stream.
 *
 * Parses the content stream to find colors, fonts, and border widths
 * so they can be reused when regenerating the appearance.
 */
export async function extractAppearanceStyle(stream: PdfStream): Promise<ExtractedAppearanceStyle> {
  const style: ExtractedAppearanceStyle = {};

  try {
    const data = await stream.getDecodedData();

    const content = new TextDecoder().decode(data);

    // Extract background color (first fill color before any BT block)
    // Look for: r g b rg (RGB) or g g (gray) or c m y k k (CMYK)
    const btIndex = content.indexOf("BT");
    const preBT = btIndex > 0 ? content.slice(0, btIndex) : content;

    // RGB fill: "0.5 0.5 0.5 rg"
    const rgMatch = preBT.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);

    if (rgMatch) {
      style.backgroundColor = [
        Number.parseFloat(rgMatch[1]),
        Number.parseFloat(rgMatch[2]),
        Number.parseFloat(rgMatch[3]),
      ];
    }

    // Gray fill: "0.5 g" (but not "0 g" which resets)

    if (!style.backgroundColor) {
      const gMatch = preBT.match(/([\d.]+)\s+g(?!\w)/);

      if (gMatch && Number.parseFloat(gMatch[1]) !== 0) {
        style.backgroundColor = [Number.parseFloat(gMatch[1])];
      }
    }

    // Extract border color (stroke color before BT block)
    // Only extract if there's actually a stroke operation (S or s) - otherwise the
    // stroke color setting wasn't used to draw a visible border
    const hasStrokeOp = /\bS\b/.test(preBT);

    if (hasStrokeOp) {
      // RGB stroke: "0.5 0.5 0.5 RG"
      const RGMatch = preBT.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+RG/);

      if (RGMatch) {
        style.borderColor = [
          Number.parseFloat(RGMatch[1]),
          Number.parseFloat(RGMatch[2]),
          Number.parseFloat(RGMatch[3]),
        ];
      }

      // Gray stroke: "0.5 G"

      if (!style.borderColor) {
        const GMatch = preBT.match(/([\d.]+)\s+G(?!\w)/);

        if (GMatch) {
          style.borderColor = [Number.parseFloat(GMatch[1])];
        }
      }

      // Border width: "2 w" - only meaningful if there's a stroke
      const wMatch = preBT.match(/([\d.]+)\s+w/);

      if (wMatch) {
        style.borderWidth = Number.parseFloat(wMatch[1]);
      }
    }

    // Extract text color (inside BT...ET block)
    const btMatch = content.match(/BT[\s\S]*?ET/);

    if (btMatch) {
      const btContent = btMatch[0];

      // RGB text color
      const textRgMatch = btContent.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);

      if (textRgMatch) {
        style.textColor = [
          Number.parseFloat(textRgMatch[1]),
          Number.parseFloat(textRgMatch[2]),
          Number.parseFloat(textRgMatch[3]),
        ];
      }

      // Gray text color

      if (!style.textColor) {
        const textGMatch = btContent.match(/([\d.]+)\s+g(?!\w)/);

        if (textGMatch) {
          style.textColor = [Number.parseFloat(textGMatch[1])];
        }
      }
    }

    // Extract font info: "/Helv 12 Tf"
    const fontMatch = content.match(/\/(\w+)\s+([\d.]+)\s+Tf/);

    if (fontMatch) {
      style.fontName = fontMatch[1];
      style.fontSize = Number.parseFloat(fontMatch[2]);
    }
  } catch {
    // If parsing fails, return empty style
  }

  return style;
}

/**
 * Parse Default Appearance string.
 */
export function parseDAString(da: string): ParsedDA {
  const result: ParsedDA = {
    fontName: "/Helv",
    fontSize: 0,
    colorOp: "g",
    colorArgs: [0],
  };

  if (!da) {
    return result;
  }

  // Extract font: /Name size Tf
  const fontMatch = da.match(/\/(\S+)\s+([\d.]+)\s+Tf/);

  if (fontMatch) {
    result.fontName = `/${fontMatch[1]}`;
    result.fontSize = Number.parseFloat(fontMatch[2]);
  }

  // Extract color: look for g, rg, or k
  const grayMatch = da.match(/([\d.]+)\s+g(?:\s|$)/);

  if (grayMatch) {
    result.colorOp = "g";
    result.colorArgs = [Number.parseFloat(grayMatch[1])];

    return result;
  }

  const rgbMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg(?:\s|$)/);

  if (rgbMatch) {
    result.colorOp = "rg";
    result.colorArgs = [
      Number.parseFloat(rgbMatch[1]),
      Number.parseFloat(rgbMatch[2]),
      Number.parseFloat(rgbMatch[3]),
    ];

    return result;
  }

  const cmykMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k(?:\s|$)/);

  if (cmykMatch) {
    result.colorOp = "k";
    result.colorArgs = [
      Number.parseFloat(cmykMatch[1]),
      Number.parseFloat(cmykMatch[2]),
      Number.parseFloat(cmykMatch[3]),
      Number.parseFloat(cmykMatch[4]),
    ];
  }

  return result;
}

/**
 * Generate operators for background fill and border stroke.
 */
export function generateBackgroundAndBorder(
  width: number,
  height: number,
  bgColor?: number[],
  borderColor?: number[],
  borderWidth = 1,
): Operator[] {
  const ops: Operator[] = [];

  // Draw background if specified

  if (bgColor && bgColor.length > 0) {
    ops.push(pushGraphicsState());
    ops.push(...setFillColor(bgColor));
    ops.push(rectangle(0, 0, width, height));
    ops.push(fill());
    ops.push(popGraphicsState());
  }

  // Draw border if specified

  if (borderColor && borderColor.length > 0 && borderWidth > 0) {
    ops.push(pushGraphicsState());
    ops.push(...setStrokeColor(borderColor));
    ops.push(setLineWidth(borderWidth));
    // Inset by half border width so stroke is inside the rect
    const inset = borderWidth / 2;
    ops.push(rectangle(inset, inset, width - borderWidth, height - borderWidth));
    ops.push(stroke());
    ops.push(popGraphicsState());
  }

  return ops;
}

/**
 * Create operators to set fill color based on color array length.
 */
export function setFillColor(color: number[]): Operator[] {
  if (color.length === 1) {
    return [setNonStrokingGray(color[0])];
  }

  if (color.length === 3) {
    return [setNonStrokingRGB(color[0], color[1], color[2])];
  }

  if (color.length === 4) {
    return [setNonStrokingCMYK(color[0], color[1], color[2], color[3])];
  }

  return [];
}

/**
 * Create operators to set stroke color based on color array length.
 */
export function setStrokeColor(color: number[]): Operator[] {
  if (color.length === 1) {
    return [setStrokingGray(color[0])];
  }

  if (color.length === 3) {
    return [setStrokingRGB(color[0], color[1], color[2])];
  }

  if (color.length === 4) {
    return [setStrokingCMYK(color[0], color[1], color[2], color[3])];
  }

  return [];
}

/**
 * Draw a circle using cubic Bezier curves.
 */
export function drawCircle(cx: number, cy: number, r: number): Operator[] {
  // Approximate circle with 4 Bezier curves
  const k = 0.5523; // Magic number for circle approximation

  return [
    moveTo(cx + r, cy),
    // Top-right quadrant
    curveTo(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r),
    // Top-left quadrant
    curveTo(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy),
    // Bottom-left quadrant
    curveTo(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r),
    // Bottom-right quadrant
    curveTo(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy),
    closePath(),
  ];
}

/**
 * Build resources dict with ZapfDingbats.
 */
export function buildZapfDingbatsResources(): PdfDict {
  const fontDict = new PdfDict();

  fontDict.set("Type", PdfName.of("Font"));
  fontDict.set("Subtype", PdfName.of("Type1"));
  fontDict.set("BaseFont", PdfName.of("ZapfDingbats"));

  const fonts = new PdfDict();
  fonts.set("ZaDb", fontDict);

  const resources = new PdfDict();
  resources.set("Font", fonts);

  return resources;
}

/**
 * Get font metrics.
 */
export function getFontMetrics(font: FormFont): FontMetrics {
  if (isEmbeddedFont(font)) {
    const desc = font.descriptor;

    return {
      ascent: desc ? desc.ascent / 1000 : 0.8,
      descent: desc ? desc.descent / 1000 : -0.2,
      capHeight: desc ? desc.capHeight / 1000 : 0.7,
      getTextWidth: (text: string, fontSize: number) => font.getTextWidth(text, fontSize),
    };
  }

  // ExistingFont
  return {
    ascent: font.getAscent(1),
    descent: font.getDescent(1),
    capHeight: font.getCapHeight(1),
    getTextWidth: (text: string, fontSize: number) => font.getTextWidth(text, fontSize),
  };
}

/**
 * Map font names to Standard 14 font names.
 */
export function mapToStandardFontName(name: string): string {
  const aliases: Record<string, string> = {
    Helv: "Helvetica",
    HeBo: "Helvetica-Bold",
    TiRo: "Times-Roman",
    TiBo: "Times-Bold",
    Cour: "Courier",
    CoBo: "Courier-Bold",
    ZaDb: "ZapfDingbats",
    Symb: "Symbol",
  };

  return aliases[name] || name;
}
