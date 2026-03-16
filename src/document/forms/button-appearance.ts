/**
 * Button appearance stream generation.
 *
 * Handles:
 * - Checkboxes
 * - Radio buttons
 * - Push buttons
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
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
import type { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";

import {
  type AppearanceContext,
  buildFontResources,
  buildZapfDingbatsResources,
  calculateAutoFontSize,
  drawCircle,
  encodeTextForFont,
  generateBackgroundAndBorder,
  getColorOperators,
  getFontMetrics,
  getFontResourceName,
  parseDefaultAppearance,
  resolveAppearanceFont,
} from "./appearance-utils";
import type { ButtonField, CheckboxField, RadioField } from "./fields";
import type { FormFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * ZapfDingbats glyph codes for checkbox/radio.
 */
const ZAPF_CHECKMARK = "\x34"; // "4" = checkmark in ZapfDingbats
const ZAPF_CIRCLE = "\x6C"; // "l" = filled circle in ZapfDingbats

/**
 * Context for button appearance generation.
 */
export type ButtonAppearanceContext = AppearanceContext;

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

  const font = resolveAppearanceFont(ctx.acroForm, field, caption);

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

  const resources = buildFontResources(font, fontName);

  return {
    stream: content.toFormXObject([0, 0, width, height], resources),
    fontNameCounter: ctx.fontNameCounter,
  };
}
