/**
 * Text field appearance stream generation.
 *
 * Handles:
 * - Single-line text fields
 * - Multiline text fields
 * - Comb fields (character cells)
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import type { Operator } from "#src/content/operators";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import {
  beginMarkedContent,
  beginText,
  clip,
  endMarkedContent,
  endPath,
  endText,
  lineTo,
  moveText,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFont,
  setLeading,
  setNonStrokingCMYK,
  setNonStrokingGray,
  setNonStrokingRGB,
  setStrokingGray,
  showText,
  stroke,
} from "#src/helpers/operators";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";

import type { ObjectRegistry } from "../object-registry";
import type { AcroForm } from "./acro-form";
import {
  type ExtractedAppearanceStyle,
  type FontMetrics,
  generateBackgroundAndBorder,
  getFontMetrics,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  mapToStandardFontName,
  PADDING,
  type ParsedDA,
  parseDAString,
} from "./appearance-utils";
import type { RgbColor, TextField } from "./fields";
import { ExistingFont, type FormFont, isEmbeddedFont, isExistingFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * Context for text appearance generation.
 */
export interface TextAppearanceContext {
  acroForm: AcroForm;
  registry: ObjectRegistry;
  fontResourceNames: Map<FormFont, string>;
  fontNameCounter: number;
}

/**
 * Generate appearance stream for a text field widget.
 */
export function generateTextAppearance(
  ctx: TextAppearanceContext,
  field: TextField,
  widget: WidgetAnnotation,
  existingStyle?: ExtractedAppearanceStyle,
): { stream: PdfStream; fontNameCounter: number } {
  const value = field.getValue();
  let { width, height } = widget;

  // Get rotation and swap dimensions if needed
  const mk = widget.getAppearanceCharacteristics();
  const rotation = mk?.rotation ?? 0;

  if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) {
    [width, height] = [height, width];
  }

  // Resolve font
  const font = resolveFont(ctx, field, existingStyle?.fontName);
  const { name: fontName, counter } = getFontResourceName(ctx, font);
  ctx.fontNameCounter = counter;

  // Resolve font size
  const daInfo = parseDefaultAppearance(ctx, field);
  let fontSize =
    field.getFontSize() ??
    existingStyle?.fontSize ??
    daInfo.fontSize ??
    ctx.acroForm.getDefaultFontSize();

  if (fontSize === 0) {
    fontSize = calculateAutoFontSize(value, width, height, font, field.isMultiline);
  }

  // Resolve text color
  let textColor = field.getTextColor();

  if (!textColor && existingStyle?.textColor && existingStyle.textColor.length === 3) {
    textColor = {
      r: existingStyle.textColor[0],
      g: existingStyle.textColor[1],
      b: existingStyle.textColor[2],
    };
  }

  const metrics = getFontMetrics(font);

  // Check if comb field
  if (field.isComb && field.maxLength > 0 && !field.isMultiline) {
    return {
      stream: generateCombAppearance(
        ctx,
        value,
        width,
        height,
        font,
        fontName,
        fontSize,
        textColor,
        daInfo,
        field.maxLength,
        field.alignment,
        widget,
        metrics,
        existingStyle,
      ),
      fontNameCounter: ctx.fontNameCounter,
    };
  }

  // Check if multiline
  if (field.isMultiline) {
    return {
      stream: generateMultilineAppearance(
        ctx,
        value,
        width,
        height,
        font,
        fontName,
        fontSize,
        textColor,
        daInfo,
        field.alignment,
        widget,
        metrics,
        existingStyle,
      ),
      fontNameCounter: ctx.fontNameCounter,
    };
  }

  // Single-line text
  return {
    stream: generateSingleLineAppearance(
      ctx,
      value,
      width,
      height,
      font,
      fontName,
      fontSize,
      textColor,
      daInfo,
      field.alignment,
      widget,
      metrics,
      existingStyle,
    ),
    fontNameCounter: ctx.fontNameCounter,
  };
}

/**
 * Generate single-line text appearance.
 */
function generateSingleLineAppearance(
  ctx: TextAppearanceContext,
  value: string,
  width: number,
  height: number,
  font: FormFont,
  fontName: string,
  fontSize: number,
  textColor: RgbColor | null,
  daInfo: ParsedDA,
  alignment: number,
  widget: WidgetAnnotation,
  metrics: FontMetrics,
  existingStyle?: ExtractedAppearanceStyle,
): PdfStream {
  const mk = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();

  const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
  const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
  const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

  const padding = Math.max(1, borderWidth);
  const clipX = padding;
  const clipY = padding;
  const clipWidth = width - 2 * padding;
  const clipHeight = height - 2 * padding;

  const contentPadding = padding;
  const contentX = clipX + contentPadding;
  const contentWidth = clipWidth - 2 * contentPadding;

  const bgBorderOps = generateBackgroundAndBorder(width, height, bgColor, borderColor, borderWidth);

  const textWidth = metrics.getTextWidth(value, fontSize);
  const x = calculateXPosition(textWidth, contentWidth, alignment, contentX);

  const capHeight = metrics.capHeight * fontSize;
  const y = clipY + (clipHeight - capHeight) / 2;

  const encodedText = encodeTextForFont(value, font);

  const content = ContentStreamBuilder.from([
    ...bgBorderOps,
    beginMarkedContent("/Tx"),
    pushGraphicsState(),
    rectangle(clipX, clipY, clipWidth, clipHeight),
    clip(),
    endPath(),
    beginText(),
    setFont(fontName, fontSize),
    ...getColorOperators(textColor, daInfo),
    moveText(x, y),
    showText(encodedText),
    endText(),
    popGraphicsState(),
    endMarkedContent(),
  ]);

  return buildFormXObject(ctx, content, width, height, font, fontName, widget);
}

/**
 * Generate multiline text appearance with word wrap.
 */
function generateMultilineAppearance(
  ctx: TextAppearanceContext,
  value: string,
  width: number,
  height: number,
  font: FormFont,
  fontName: string,
  fontSize: number,
  textColor: RgbColor | null,
  daInfo: ParsedDA,
  alignment: number,
  widget: WidgetAnnotation,
  metrics: FontMetrics,
  existingStyle?: ExtractedAppearanceStyle,
): PdfStream {
  const mk = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();

  const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
  const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
  const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

  const padding = Math.max(1, borderWidth);
  const clipX = padding;
  const clipY = padding;
  const clipWidth = width - 2 * padding;
  const clipHeight = height - 2 * padding;

  const contentPadding = padding;
  const contentX = clipX + contentPadding;
  const contentWidth = clipWidth - 2 * contentPadding;

  const bgBorderOps = generateBackgroundAndBorder(width, height, bgColor, borderColor, borderWidth);

  const lineHeight = fontSize * 1.2;
  const lines = wrapText(value, contentWidth, fontSize, metrics);

  const ascent = metrics.ascent * fontSize;
  const startY = clipY + clipHeight - ascent;

  const content = ContentStreamBuilder.from([
    ...bgBorderOps,
    beginMarkedContent("/Tx"),
    pushGraphicsState(),
    rectangle(clipX, clipY, clipWidth, clipHeight),
    clip(),
    endPath(),
    beginText(),
    setFont(fontName, fontSize),
    ...getColorOperators(textColor, daInfo),
    setLeading(lineHeight),
  ]);

  let currentY = startY;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = metrics.getTextWidth(line, fontSize);
    const x = calculateXPosition(lineWidth, contentWidth, alignment, contentX);

    if (i === 0) {
      content.add(moveText(x, currentY));
    } else {
      const prevX = calculateXPosition(
        metrics.getTextWidth(lines[i - 1], fontSize),
        contentWidth,
        alignment,
        contentX,
      );
      content.add(moveText(x - prevX, -lineHeight));
    }

    content.add(showText(encodeTextForFont(line, font)));
    currentY -= lineHeight;
  }

  content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

  return buildFormXObject(ctx, content, width, height, font, fontName, widget);
}

/**
 * Generate comb field appearance with character cells.
 */
function generateCombAppearance(
  ctx: TextAppearanceContext,
  value: string,
  width: number,
  height: number,
  font: FormFont,
  fontName: string,
  fontSize: number,
  textColor: RgbColor | null,
  daInfo: ParsedDA,
  maxLength: number,
  alignment: number,
  widget: WidgetAnnotation,
  metrics: FontMetrics,
  existingStyle?: ExtractedAppearanceStyle,
): PdfStream {
  const cellWidth = width / maxLength;

  const mk = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();

  const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
  const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
  const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

  const bgBorderOps = generateBackgroundAndBorder(width, height, bgColor, borderColor, borderWidth);

  const capHeight = metrics.capHeight * fontSize;
  const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);

  const content = ContentStreamBuilder.from([
    ...bgBorderOps,
    beginMarkedContent("/Tx"),
    pushGraphicsState(),
  ]);

  if (mk?.borderColor || bs) {
    content.add(setStrokingGray(0.5));

    for (let i = 1; i < maxLength; i++) {
      const x = i * cellWidth;
      content.add(moveTo(x, 0));
      content.add(lineTo(x, height));
    }

    content.add(stroke());
  }

  content.add(beginText());
  content.add(setFont(fontName, fontSize));
  content.add(...getColorOperators(textColor, daInfo));

  let startCell = 0;

  if (alignment === 1) {
    startCell = Math.floor((maxLength - value.length) / 2);
  } else if (alignment === 2) {
    startCell = maxLength - value.length;
  }

  let lastX = 0;

  for (let i = 0; i < value.length && i + startCell < maxLength; i++) {
    const char = value[i];
    const charWidth = metrics.getTextWidth(char, fontSize);
    const cellIndex = i + startCell;
    const cellCenterX = (cellIndex + 0.5) * cellWidth;
    const charX = cellCenterX - charWidth / 2;

    content.add(moveText(i === 0 ? charX : charX - lastX, i === 0 ? y : 0));
    content.add(showText(encodeTextForFont(char, font)));
    lastX = charX;
  }

  content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

  return buildFormXObject(ctx, content, width, height, font, fontName, widget);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function resolveFont(
  ctx: TextAppearanceContext,
  field: { getFont(): FormFont | null; defaultAppearance?: string | null },
  existingFontName?: string,
): FormFont {
  const fieldFont = field.getFont();

  if (fieldFont) {
    return fieldFont;
  }

  const defaultFont = ctx.acroForm.getDefaultFont();

  if (defaultFont) {
    return defaultFont;
  }

  if (existingFontName) {
    const existingFont = ctx.acroForm.getExistingFont(existingFontName);

    if (existingFont) {
      return existingFont;
    }
  }

  const da =
    "defaultAppearance" in field
      ? (field.defaultAppearance ?? ctx.acroForm.defaultAppearance)
      : ctx.acroForm.defaultAppearance;
  const daInfo = parseDAString(da);
  const existingFont = ctx.acroForm.getExistingFont(daInfo.fontName);

  if (existingFont) {
    return existingFont;
  }

  return new ExistingFont("Helv", null, null);
}

function getFontResourceName(
  ctx: TextAppearanceContext,
  font: FormFont,
): { name: string; counter: number } {
  if (ctx.fontResourceNames.has(font)) {
    return {
      // biome-ignore lint/style/noNonNullAssertion: fontResourceNames is guaranteed to have a value
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

function parseDefaultAppearance(
  ctx: TextAppearanceContext,
  field: { defaultAppearance?: string | null },
): ParsedDA {
  const da =
    "defaultAppearance" in field
      ? (field.defaultAppearance ?? ctx.acroForm.defaultAppearance)
      : ctx.acroForm.defaultAppearance;

  return parseDAString(da);
}

function calculateAutoFontSize(
  text: string,
  width: number,
  height: number,
  font: FormFont,
  isMultiline: boolean,
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

function calculateXPosition(
  textWidth: number,
  contentWidth: number,
  alignment: number,
  contentOffset: number,
): number {
  switch (alignment) {
    case 1:
      return contentOffset + (contentWidth - textWidth) / 2;
    case 2:
      return contentOffset + contentWidth - textWidth;
    default:
      return contentOffset;
  }
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  metrics: FontMetrics,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r\n|\r|\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = metrics.getTextWidth(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }

        if (metrics.getTextWidth(word, fontSize) > maxWidth) {
          let remaining = word;

          while (remaining) {
            let i = remaining.length;

            while (i > 0 && metrics.getTextWidth(remaining.slice(0, i), fontSize) > maxWidth) {
              i--;
            }

            if (i === 0) {
              i = 1;
            }

            lines.push(remaining.slice(0, i));
            remaining = remaining.slice(i);
          }

          currentLine = "";
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function encodeTextForFont(text: string, font: FormFont): PdfString {
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

  return PdfString.fromString(text);
}

function getColorOperators(textColor: RgbColor | null, daInfo: ParsedDA): Operator[] {
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

function buildFormXObject(
  ctx: TextAppearanceContext,
  content: ContentStreamBuilder,
  width: number,
  height: number,
  font: FormFont,
  fontName: string,
  widget: WidgetAnnotation,
): PdfStream {
  const resources = buildResources(ctx, font, fontName);

  const mk = widget.getAppearanceCharacteristics();
  const rotation = mk?.rotation ?? 0;

  const matrix = calculateAppearanceMatrix(width, height, rotation);

  return content.toFormXObject([0, 0, width, height], resources, matrix);
}

function buildResources(ctx: TextAppearanceContext, font: FormFont, fontName: string): PdfDict {
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
    fontDict.set("BaseFont", PdfName.of(mapToStandardFontName(cleanName)));

    fonts.set(cleanName, fontDict);
  }

  resources.set("Font", fonts);

  return resources;
}

function calculateAppearanceMatrix(
  width: number,
  height: number,
  rotation: number,
): [number, number, number, number, number, number] | undefined {
  switch (Math.abs(rotation)) {
    case 90:
      return [0, 1, -1, 0, height, 0];
    case 180:
      return [-1, 0, 0, -1, width, height];
    case 270:
      return [0, -1, 1, 0, 0, width];
    default:
      return undefined;
  }
}
