/**
 * Button appearance stream generation.
 *
 * Handles:
 * - Checkboxes
 * - Radio buttons
 * - Push buttons
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import {
  beginText,
  endText,
  fill,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFont,
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
  buildZapfDingbatsResources,
  drawCircle,
  generateBackgroundAndBorder,
  getFontMetrics,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  mapToStandardFontName,
  PADDING,
  type ParsedDA,
  parseDAString,
} from "./appearance-utils";
import type { ButtonField, CheckboxField, RadioField, RgbColor } from "./fields";
import { ExistingFont, type FormFont, isEmbeddedFont, isExistingFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * ZapfDingbats glyph codes for checkbox/radio.
 */
const ZAPF_CHECKMARK = "\x34"; // "4" = checkmark in ZapfDingbats
const ZAPF_CIRCLE = "\x6C"; // "l" = filled circle in ZapfDingbats

/**
 * Context for button appearance generation.
 */
export interface ButtonAppearanceContext {
  acroForm: AcroForm;
  registry: ObjectRegistry;
  fontResourceNames: Map<FormFont, string>;
  fontNameCounter: number;
}

/**
 * Generate appearance streams for a checkbox.
 */
export function generateCheckboxAppearance(
  _ctx: ButtonAppearanceContext,
  _field: CheckboxField,
  widget: WidgetAnnotation,
  _onValue: string,
): { on: PdfStream; off: PdfStream } {
  const { width, height } = widget;

  const mk = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();

  const borderColor = mk?.borderColor;
  const borderWidth = borderColor ? (bs?.width ?? 1) : 0;

  const bgBorderOps = generateBackgroundAndBorder(
    width,
    height,
    mk?.backgroundColor,
    borderColor,
    borderWidth,
  );

  const size = Math.min(width, height) * 0.7;
  const fontSize = size;
  const x = (width - size) / 2;
  const y = (height - size) / 2 + size * 0.15;

  const onContent = ContentStreamBuilder.from([
    ...bgBorderOps,
    pushGraphicsState(),
    beginText(),
    setFont("/ZaDb", fontSize),
    setNonStrokingGray(0),
    moveText(x, y),
    showText(PdfString.fromString(ZAPF_CHECKMARK)),
    endText(),
    popGraphicsState(),
  ]);

  const offContent = ContentStreamBuilder.from([...bgBorderOps]);

  const resources = buildZapfDingbatsResources();

  return {
    on: onContent.toFormXObject([0, 0, width, height], resources),
    off: offContent.toFormXObject([0, 0, width, height], new PdfDict()),
  };
}

/**
 * Generate appearance streams for a radio button.
 */
export function generateRadioAppearance(
  _ctx: ButtonAppearanceContext,
  _field: RadioField,
  widget: WidgetAnnotation,
  _value: string,
): { selected: PdfStream; off: PdfStream } {
  const { width, height } = widget;

  const mk = widget.getAppearanceCharacteristics();
  const bs = widget.getBorderStyle();

  const borderColor = mk?.borderColor;
  const borderWidth = borderColor ? (bs?.width ?? 1) : 0;

  const bgBorderOps = generateBackgroundAndBorder(
    width,
    height,
    mk?.backgroundColor,
    borderColor,
    borderWidth,
  );

  const size = Math.min(width, height) * 0.6;
  const fontSize = size;
  const x = (width - size) / 2;
  const y = (height - size) / 2 + size * 0.15;

  const selectedContent = ContentStreamBuilder.from([
    ...bgBorderOps,
    pushGraphicsState(),
    beginText(),
    setFont("/ZaDb", fontSize),
    setNonStrokingGray(0),
    moveText(x, y),
    showText(PdfString.fromString(ZAPF_CIRCLE)),
    endText(),
    popGraphicsState(),
  ]);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = size / 2;

  const offContent = ContentStreamBuilder.from([
    ...bgBorderOps,
    pushGraphicsState(),
    setStrokingGray(0),
    ...drawCircle(centerX, centerY, radius),
    stroke(),
    popGraphicsState(),
  ]);

  const resources = buildZapfDingbatsResources();

  return {
    selected: selectedContent.toFormXObject([0, 0, width, height], resources),
    off: offContent.toFormXObject([0, 0, width, height], new PdfDict()),
  };
}

/**
 * Generate appearance stream for a push button.
 */
export function generateButtonAppearance(
  ctx: ButtonAppearanceContext,
  field: ButtonField,
  widget: WidgetAnnotation,
): { stream: PdfStream; fontNameCounter: number } {
  const { width, height } = widget;

  const mk = widget.getAppearanceCharacteristics();
  const caption = mk?.caption ?? "";

  if (!caption) {
    return {
      stream: new ContentStreamBuilder().toFormXObject([0, 0, width, height], new PdfDict()),
      fontNameCounter: ctx.fontNameCounter,
    };
  }

  const font = resolveFont(ctx, field);

  const { name: fontName, counter } = getFontResourceName(ctx, font);

  ctx.fontNameCounter = counter;

  const daInfo = parseDefaultAppearance(ctx, field);
  let fontSize = field.getFontSize() ?? daInfo.fontSize ?? ctx.acroForm.getDefaultFontSize();

  if (fontSize === 0) {
    fontSize = calculateAutoFontSize(caption, width, height, font);
  }

  const textColor = field.getTextColor();
  const metrics = getFontMetrics(font);

  const textWidth = metrics.getTextWidth(caption, fontSize);
  const x = (width - textWidth) / 2;
  const capHeight = metrics.capHeight * fontSize;
  const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);

  const content = ContentStreamBuilder.from([pushGraphicsState()]);

  if (mk?.backgroundColor) {
    const bg = mk.backgroundColor;

    if (bg.length === 1) {
      content.add(setNonStrokingGray(bg[0]));
    } else if (bg.length === 3) {
      content.add(setNonStrokingRGB(bg[0], bg[1], bg[2]));
    }

    content.add(rectangle(0, 0, width, height));
    content.add(fill());
  }

  content
    .add(beginText())
    .add(setFont(fontName, fontSize))
    .add(...getColorOperators(textColor, daInfo))
    .add(moveText(x, y))
    .add(showText(encodeTextForFont(caption, font)))
    .add(endText())
    .add(popGraphicsState());

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
  ctx: ButtonAppearanceContext,
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
  ctx: ButtonAppearanceContext,
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
  ctx: ButtonAppearanceContext,
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

import type { Operator } from "#src/content/operators";
import { setNonStrokingCMYK } from "#src/helpers/operators";

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

function buildResources(ctx: ButtonAppearanceContext, font: FormFont, fontName: string): PdfDict {
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
