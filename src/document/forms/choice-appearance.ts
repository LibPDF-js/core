/**
 * Choice field appearance stream generation.
 *
 * Handles:
 * - Dropdowns (combo boxes)
 * - List boxes
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
  fill,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFont,
  setNonStrokingCMYK,
  setNonStrokingGray,
  setNonStrokingRGB,
  showText,
} from "#src/helpers/operators";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";

import type { ObjectRegistry } from "../object-registry";
import type { AcroForm } from "./acro-form";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  getFontMetrics,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  mapToStandardFontName,
  PADDING,
  type ParsedDA,
  parseDAString,
} from "./appearance-utils";
import type { DropdownField, ListBoxField, RgbColor } from "./fields";
import { ExistingFont, type FormFont, isEmbeddedFont, isExistingFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * Context for choice appearance generation.
 */
export interface ChoiceAppearanceContext {
  acroForm: AcroForm;
  registry: ObjectRegistry;
  fontResourceNames: Map<FormFont, string>;
  fontNameCounter: number;
}

/**
 * Generate appearance stream for a dropdown (combo box).
 */
export function generateDropdownAppearance(
  ctx: ChoiceAppearanceContext,
  field: DropdownField,
  widget: WidgetAnnotation,
): { stream: PdfStream; fontNameCounter: number } {
  const value = field.getValue();
  const { width, height } = widget;

  const options = field.getOptions();
  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.display ?? value;

  const font = resolveFont(ctx, field);
  const { name: fontName, counter } = getFontResourceName(ctx, font);
  ctx.fontNameCounter = counter;

  const daInfo = parseDefaultAppearance(ctx, field);
  let fontSize = field.getFontSize() ?? daInfo.fontSize ?? ctx.acroForm.getDefaultFontSize();

  if (fontSize === 0) {
    fontSize = calculateAutoFontSize(displayText, width, height, font);
  }

  const textColor = field.getTextColor();
  const metrics = getFontMetrics(font);

  const capHeight = metrics.capHeight * fontSize;
  const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);
  const x = PADDING;

  const clipWidth = width - 20;
  const content = ContentStreamBuilder.from([
    beginMarkedContent("/Tx"),
    pushGraphicsState(),
    rectangle(1, 1, clipWidth - 2, height - 2),
    clip(),
    endPath(),
    beginText(),
    setFont(fontName, fontSize),
    ...getColorOperators(textColor, daInfo),
    moveText(x, y),
    showText(encodeTextForFont(displayText, font)),
    endText(),
    popGraphicsState(),
    endMarkedContent(),
  ]);

  const resources = buildResources(ctx, font, fontName);

  return {
    stream: content.toFormXObject([0, 0, width, height], resources),
    fontNameCounter: ctx.fontNameCounter,
  };
}

/**
 * Generate appearance stream for a list box.
 */
export function generateListBoxAppearance(
  ctx: ChoiceAppearanceContext,
  field: ListBoxField,
  widget: WidgetAnnotation,
): { stream: PdfStream; fontNameCounter: number } {
  const selectedValues = new Set(field.getValue());
  const options = field.getOptions();
  const { width, height } = widget;

  const font = resolveFont(ctx, field);
  const { name: fontName, counter } = getFontResourceName(ctx, font);
  ctx.fontNameCounter = counter;

  const daInfo = parseDefaultAppearance(ctx, field);
  let fontSize = field.getFontSize() ?? daInfo.fontSize ?? ctx.acroForm.getDefaultFontSize();

  if (fontSize === 0) {
    fontSize = 12;
  }

  const textColor = field.getTextColor();
  const metrics = getFontMetrics(font);

  const topIndex = field.getTopIndex();

  const fontBBoxHeight = (metrics.ascent - metrics.descent) * fontSize;
  const lineHeight = fontBBoxHeight;
  const ascent = metrics.ascent * fontSize;

  const paddingEdge = {
    x: 1,
    y: 1,
    width: width - 2,
    height: height - 2,
  };

  const content = ContentStreamBuilder.from([
    beginMarkedContent("/Tx"),
    pushGraphicsState(),
    rectangle(paddingEdge.x, paddingEdge.y, paddingEdge.width, paddingEdge.height),
    clip(),
    endPath(),
  ]);

  const selectedIndices = new Set<number>();

  for (let i = 0; i < options.length; i++) {
    if (selectedValues.has(options[i].value)) {
      selectedIndices.add(i);
    }
  }

  for (const selectedIndex of selectedIndices) {
    const visibleRow = selectedIndex - topIndex;

    if (visibleRow < 0) {
      continue;
    }

    const highlightY = paddingEdge.y + paddingEdge.height - lineHeight * (visibleRow + 1) + 2;

    if (highlightY < paddingEdge.y - lineHeight) {
      continue;
    }

    content.add(
      setNonStrokingRGB(
        DEFAULT_HIGHLIGHT_COLOR.r,
        DEFAULT_HIGHLIGHT_COLOR.g,
        DEFAULT_HIGHLIGHT_COLOR.b,
      ),
    );
    content.add(rectangle(paddingEdge.x, highlightY, paddingEdge.width, lineHeight));
    content.add(fill());
  }

  content.add(setNonStrokingGray(0));

  content.add(beginText());
  content.add(setFont(fontName, fontSize));
  content.add(...getColorOperators(textColor, daInfo));

  let y = paddingEdge.y + paddingEdge.height - ascent + 2;

  for (let i = topIndex; i < options.length; i++) {
    const option = options[i];

    if (y < paddingEdge.y - lineHeight) {
      break;
    }

    if (i === topIndex) {
      content.add(moveText(PADDING, y));
    } else {
      content.add(moveText(0, -lineHeight));
    }

    content.add(showText(encodeTextForFont(option.display, font)));
    y -= lineHeight;
  }

  content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

  const resources = buildResources(ctx, font, fontName);

  return {
    stream: content.toFormXObject([0, 0, width, height], resources),
    fontNameCounter: ctx.fontNameCounter,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function resolveFont(
  ctx: ChoiceAppearanceContext,
  field: { getFont(): FormFont | null; defaultAppearance?: string | null },
): FormFont {
  const fieldFont = field.getFont();

  if (fieldFont) {
    return fieldFont;
  }

  const defaultFont = ctx.acroForm.getDefaultFont();

  if (defaultFont) {
    return defaultFont;
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
  ctx: ChoiceAppearanceContext,
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
  ctx: ChoiceAppearanceContext,
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
): number {
  const contentWidth = width - 2 * PADDING;
  const contentHeight = height - 2 * PADDING;

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

function buildResources(ctx: ChoiceAppearanceContext, font: FormFont, fontName: string): PdfDict {
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
