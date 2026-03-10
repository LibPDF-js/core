/**
 * Choice field appearance stream generation.
 *
 * Handles:
 * - Dropdowns (combo boxes)
 * - List boxes
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
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
  setNonStrokingGray,
  setNonStrokingRGB,
  showText,
} from "#src/helpers/operators";
import type { PdfStream } from "#src/objects/pdf-stream";

import {
  type AppearanceContext,
  buildFontResources,
  calculateAutoFontSize,
  DEFAULT_HIGHLIGHT_COLOR,
  encodeTextForFont,
  getColorOperators,
  getFontMetrics,
  getFontResourceName,
  PADDING,
  parseDefaultAppearance,
  resolveAppearanceFont,
} from "./appearance-utils";
import type { DropdownField, ListBoxField } from "./fields";
import type { FormFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * Context for choice appearance generation.
 */
export type ChoiceAppearanceContext = AppearanceContext;

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

  const font = resolveAppearanceFont(ctx.acroForm, field, displayText);
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

  const resources = buildFontResources(font, fontName);

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

  const font = resolveAppearanceFont(
    ctx.acroForm,
    field,
    options.map(option => option.display).join(""),
  );
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

  const resources = buildFontResources(font, fontName);

  return {
    stream: content.toFormXObject([0, 0, width, height], resources),
    fontNameCounter: ctx.fontNameCounter,
  };
}
