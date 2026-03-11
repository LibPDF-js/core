/**
 * Shared utilities for appearance stream generation.
 */

import type { Operator } from "#src/content/operators";
import { ContentStreamParser } from "#src/content/parsing/content-stream-parser";
import { isParsedOperation, type ContentToken } from "#src/content/parsing/types";
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
import { PdfString } from "#src/objects/pdf-string";

import type { ObjectRegistry } from "../object-registry";
import type { AcroForm } from "./acro-form";
import type { FormField, RgbColor } from "./fields";
import {
  ExistingFont,
  type FormFont,
  isEmbeddedFont,
  isExistingFont,
  mapToStandardFont,
} from "./form-font";

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

export interface AppearanceFontSource {
  getFont(): FormFont | null;
  defaultAppearance?: string | null;
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
 * Uses the content stream parser to walk operations while tracking
 * the graphics state stack (q/Q). This correctly identifies:
 * - Background color: fill color when a rectangle is filled outside text
 * - Border color/width: stroke color/width when stroked outside text
 * - Text color: fill color at the time text is actually shown
 * - Font: the Tf setting active when text is shown
 *
 * Handles all color spaces: gray (g/G), RGB (rg/RG), and CMYK (k/K).
 */
export function extractAppearanceStyle(stream: PdfStream): ExtractedAppearanceStyle {
  const style: ExtractedAppearanceStyle = {};

  try {
    const data = stream.getDecodedData();
    const parser = new ContentStreamParser(data);
    const { operations } = parser.parse();

    // Graphics state tracking
    interface GState {
      fillColor: number[] | null;
      strokeColor: number[] | null;
      lineWidth: number | null;
      fontName: string | null;
      fontSize: number | null;
    }

    const stateStack: GState[] = [];
    let state: GState = {
      fillColor: null,
      strokeColor: null,
      lineWidth: null,
      fontName: null,
      fontSize: null,
    };

    let inTextBlock = false;
    let hasSeenTextShowOp = false;

    // State captured at time of text showing (most accurate)
    let shownTextColor: number[] | null = null;
    let shownFontName: string | null = null;
    let shownFontSize: number | null = null;

    // Last font/color set inside a text block (fallback for empty fields)
    let textBlockFontName: string | null = null;
    let textBlockFontSize: number | null = null;
    let textBlockFillColor: number[] | null = null;

    for (const op of operations) {
      if (!isParsedOperation(op)) {
        continue;
      }

      const { operator, operands } = op;

      switch (operator) {
        // ── Graphics state stack ──
        case "q":
          stateStack.push({ ...state });
          break;
        case "Q":
          if (stateStack.length > 0) {
            // biome-ignore lint/style/noNonNullAssertion: length check above
            state = stateStack.pop()!;
          }
          break;

        // ── Fill colors (g, rg, k) ──
        case "g":
          state.fillColor = [num(operands[0])];
          break;
        case "rg":
          state.fillColor = [num(operands[0]), num(operands[1]), num(operands[2])];
          break;
        case "k":
          state.fillColor = [
            num(operands[0]),
            num(operands[1]),
            num(operands[2]),
            num(operands[3]),
          ];
          break;

        // ── Stroke colors (G, RG, K) ──
        case "G":
          state.strokeColor = [num(operands[0])];
          break;
        case "RG":
          state.strokeColor = [num(operands[0]), num(operands[1]), num(operands[2])];
          break;
        case "K":
          state.strokeColor = [
            num(operands[0]),
            num(operands[1]),
            num(operands[2]),
            num(operands[3]),
          ];
          break;

        // ── Line width ──
        case "w":
          state.lineWidth = num(operands[0]);
          break;

        // ── Font ──
        case "Tf":
          state.fontName = nameStr(operands[0]);
          state.fontSize = num(operands[1]);

          if (inTextBlock) {
            textBlockFontName = state.fontName;
            textBlockFontSize = state.fontSize;
          }
          break;

        // ── Fill operations (background detection) ──
        // Only treat as background if we haven't entered a text block yet
        case "f":
        case "F":
        case "f*":
          if (!inTextBlock && !hasSeenTextShowOp && state.fillColor) {
            style.backgroundColor = [...state.fillColor];
          }
          break;

        // ── Combined fill+stroke ──
        case "B":
        case "B*":
        case "b":
        case "b*":
          if (!inTextBlock && !hasSeenTextShowOp) {
            if (state.fillColor) {
              style.backgroundColor = [...state.fillColor];
            }
            if (state.strokeColor) {
              style.borderColor = [...state.strokeColor];
            }
            if (state.lineWidth != null) {
              style.borderWidth = state.lineWidth;
            }
          }
          break;

        // ── Stroke operations (border detection) ──
        case "S":
        case "s":
          if (!inTextBlock && !hasSeenTextShowOp) {
            if (state.strokeColor) {
              style.borderColor = [...state.strokeColor];
            }
            if (state.lineWidth != null) {
              style.borderWidth = state.lineWidth;
            }
          }
          break;

        // ── Text blocks ──
        case "BT":
          inTextBlock = true;
          break;
        case "ET":
          inTextBlock = false;
          break;

        // ── Text showing operations ──
        // The fill color at text-show time IS the text color (render mode 0)
        case "Tj":
        case "TJ":
        case "'":
        case '"':
          hasSeenTextShowOp = true;
          if (state.fillColor) {
            shownTextColor = [...state.fillColor];
          }
          if (state.fontName) {
            shownFontName = state.fontName;
            shownFontSize = state.fontSize;
          }
          break;
      }

      // Track fill color changes inside text blocks (for empty field fallback)
      if (
        inTextBlock &&
        (operator === "g" || operator === "rg" || operator === "k") &&
        state.fillColor
      ) {
        textBlockFillColor = [...state.fillColor];
      }
    }

    // Assign text color: prefer shown, then text-block, then nothing
    if (shownTextColor) {
      style.textColor = shownTextColor;
    } else if (textBlockFillColor) {
      style.textColor = textBlockFillColor;
    }

    // Assign font: prefer shown, then text-block, then last seen
    const fontName = shownFontName ?? textBlockFontName ?? state.fontName;
    const fontSize = shownFontSize ?? textBlockFontSize ?? state.fontSize;

    if (fontName) {
      style.fontName = fontName;
      if (fontSize != null && fontSize > 0) {
        style.fontSize = fontSize;
      }
    }
  } catch {
    // If parsing fails, return empty style
  }

  return style;
}

/**
 * Resolve the first font candidate that can be used for the given appearance text.
 */
export function chooseAppearanceFont(
  text: string,
  candidates: Iterable<FormFont | null | undefined>,
): FormFont {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (isExistingFont(candidate)) {
      if (candidate.canUseForAppearance(text)) {
        return candidate;
      }

      continue;
    }

    if (isEmbeddedFont(candidate)) {
      if (candidate.canEncode(text)) {
        return candidate;
      }

      continue;
    }

    return candidate;
  }

  return new ExistingFont("Helv", null, null);
}

/**
 * Resolve the best available font for generating an appearance.
 */
export function resolveAppearanceFont(
  acroForm: AcroForm,
  field: AppearanceFontSource,
  text: string,
  existingFontName?: string,
): FormFont {
  const candidates: FormFont[] = [];
  const fieldFont = field.getFont();
  const defaultFont = acroForm.getDefaultFont();

  if (fieldFont) {
    candidates.push(fieldFont);
  }

  if (defaultFont) {
    candidates.push(defaultFont);
  }

  if (existingFontName) {
    const existingFont = acroForm.getExistingFont(existingFontName);

    if (existingFont) {
      candidates.push(existingFont);
    }
  }

  const da = field.defaultAppearance ?? acroForm.defaultAppearance;
  const daInfo = parseDAString(da);
  const daFont = acroForm.getExistingFont(daInfo.fontName);

  if (daFont) {
    candidates.push(daFont);
  }

  for (const availableFont of acroForm.getAvailableFonts()) {
    if (!candidates.includes(availableFont)) {
      candidates.push(availableFont);
    }
  }

  return chooseAppearanceFont(text, candidates);
}

/** Extract numeric value from a content token operand. */
function num(token?: ContentToken): number {
  if (token && token.type === "number" && typeof token.value === "number") {
    return token.value;
  }

  return 0;
}

/** Extract name string from a content token operand (strips leading slash). */
function nameStr(token: ContentToken): string {
  if (token && token.type === "name" && typeof token.value === "string") {
    return token.value;
  }

  return "";
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared Appearance Context & Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared context for appearance stream generation.
 *
 * All appearance generators (text, button, choice) share this context
 * to coordinate font resource naming across a generation session.
 */
export interface AppearanceContext {
  acroForm: AcroForm;
  registry: ObjectRegistry;
  fontResourceNames: Map<FormFont, string>;
  fontNameCounter: number;
}

/**
 * Assign a resource name for a font in the current generation session.
 */
export function getFontResourceName(
  ctx: AppearanceContext,
  font: FormFont,
): { name: string; counter: number } {
  if (ctx.fontResourceNames.has(font)) {
    return {
      // biome-ignore lint/style/noNonNullAssertion: checked above
      name: ctx.fontResourceNames.get(font)!,
      counter: ctx.fontNameCounter,
    };
  }

  let name: string;

  if (isExistingFont(font)) {
    name = font.name.startsWith("/") ? font.name : `/${font.name}`;
  } else {
    ctx.fontNameCounter++;
    name = `/F${ctx.fontNameCounter}`;
  }

  ctx.fontResourceNames.set(font, name);

  return {
    name,
    counter: ctx.fontNameCounter,
  };
}

/**
 * Resolve the default appearance string from field or form defaults, and parse it.
 */
export function parseDefaultAppearance(ctx: AppearanceContext, field: FormField): ParsedDA {
  const da = field.defaultAppearance ?? ctx.acroForm.defaultAppearance ?? "";

  return parseDAString(da);
}

/**
 * Calculate font size to fit text within given dimensions.
 */
export function calculateAutoFontSize(
  text: string,
  width: number,
  height: number,
  font: FormFont,
  isMultiline = false,
): number {
  const contentWidth = width - 2 * PADDING;
  const contentHeight = height - 2 * PADDING;

  if (isMultiline) {
    return Math.max(MIN_FONT_SIZE, Math.min(12, contentHeight * 0.15));
  }

  const heightBased = contentHeight * 0.7;

  let fontSize = heightBased;
  const metrics = getFontMetrics(font);
  let textWidth = metrics.getTextWidth(text || "X", fontSize);

  while (textWidth > contentWidth && fontSize > MIN_FONT_SIZE) {
    fontSize -= 1;
    textWidth = metrics.getTextWidth(text || "X", fontSize);
  }

  return Math.max(MIN_FONT_SIZE, Math.min(fontSize, MAX_FONT_SIZE));
}

/**
 * Encode text for use in a PDF content stream with the given font.
 */
export function encodeTextForFont(text: string, font: FormFont): PdfString {
  if (isEmbeddedFont(font)) {
    font.markUsedInForm();

    if (!font.canEncode(text)) {
      const unencodable = font.getUnencodableCharacters(text);
      const firstBad = unencodable[0];

      throw new Error(
        `Font cannot encode character '${firstBad}' (U+${firstBad.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")})`,
      );
    }

    const gids = font.encodeTextToGids(text);
    const bytes = new Uint8Array(gids.length * 2);

    for (let i = 0; i < gids.length; i++) {
      bytes[i * 2] = (gids[i] >> 8) & 0xff;
      bytes[i * 2 + 1] = gids[i] & 0xff;
    }

    return PdfString.fromBytes(bytes);
  }

  if (isExistingFont(font) && font.isCIDFont) {
    return PdfString.fromBytes(font.encodeTextToBytes(text));
  }

  return PdfString.fromString(text);
}

/**
 * Generate color operators for text rendering.
 */
export function getColorOperators(textColor: RgbColor | null, daInfo: ParsedDA): Operator[] {
  if (textColor) {
    return [setNonStrokingRGB(textColor.r, textColor.g, textColor.b)];
  }

  switch (daInfo.colorOp) {
    case "g":
      return [setNonStrokingGray(daInfo.colorArgs[0] ?? 0)];
    case "rg":
      return [
        setNonStrokingRGB(
          daInfo.colorArgs[0] ?? 0,
          daInfo.colorArgs[1] ?? 0,
          daInfo.colorArgs[2] ?? 0,
        ),
      ];
    case "k":
      return [
        setNonStrokingCMYK(
          daInfo.colorArgs[0] ?? 0,
          daInfo.colorArgs[1] ?? 0,
          daInfo.colorArgs[2] ?? 0,
          daInfo.colorArgs[3] ?? 0,
        ),
      ];
    default:
      return [setNonStrokingGray(0)];
  }
}

/**
 * Build a resources dictionary containing a single font entry.
 */
export function buildFontResources(font: FormFont, fontName: string): PdfDict {
  const resources = new PdfDict();
  const fonts = new PdfDict();

  const cleanName = fontName.startsWith("/") ? fontName.slice(1) : fontName;

  if (isEmbeddedFont(font)) {
    fonts.set(cleanName, font.ref);
  } else if (isExistingFont(font) && font.ref) {
    fonts.set(cleanName, font.ref);
  } else {
    const fontDict = new PdfDict();

    fontDict.set("Type", PdfName.of("Font"));
    fontDict.set("Subtype", PdfName.of("Type1"));
    fontDict.set("BaseFont", PdfName.of(mapToStandardFont(cleanName) ?? cleanName));

    fonts.set(cleanName, fontDict);
  }

  resources.set("Font", fonts);

  return resources;
}
