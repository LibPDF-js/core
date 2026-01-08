/**
 * Appearance stream generation for form fields.
 *
 * Generates Form XObjects (appearance streams) for all field types:
 * - Text fields (single-line, multiline, comb)
 * - Checkboxes
 * - Radio buttons
 * - Dropdowns
 * - List boxes
 * - Push buttons
 *
 * PDF Reference: Section 12.5.5 "Appearance Streams"
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import type { Operator } from "#src/content/operators";
import type { EmbeddedFont } from "#src/fonts/embedded-font";
import {
  beginMarkedContent,
  beginText,
  clip,
  closePath,
  curveTo,
  endMarkedContent,
  endPath,
  endText,
  fill,
  lineTo,
  moveText,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFont,
  setLeading,
  setLineWidth,
  setNonStrokingCMYK,
  setNonStrokingGray,
  setNonStrokingRGB,
  setStrokingCMYK,
  setStrokingGray,
  setStrokingRGB,
  showText,
  stroke,
} from "#src/helpers/operators";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import type { ObjectRegistry } from "../object-registry";
import type { AcroForm } from "./acro-form";
import type {
  ButtonField,
  CheckboxField,
  DropdownField,
  ListBoxField,
  RadioField,
  RgbColor,
  TextField,
} from "./fields";
import { ExistingFont, type FormFont, isEmbeddedFont, isExistingFont } from "./form-font";
import type { WidgetAnnotation } from "./widget-annotation";

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
interface FontMetrics {
  ascent: number;
  descent: number;
  capHeight: number;
  getTextWidth(text: string, fontSize: number): number;
}

/**
 * Constants for appearance generation.
 */
const PADDING = 2;
const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 14;
const DEFAULT_HIGHLIGHT_COLOR = { r: 153 / 255, g: 193 / 255, b: 218 / 255 };

/**
 * ZapfDingbats glyph codes for checkbox/radio.
 * Character 4 is a checkmark in ZapfDingbats encoding.
 */
const ZAPF_CHECKMARK = "\x34"; // "4" = checkmark in ZapfDingbats
const ZAPF_CIRCLE = "\x6C"; // "l" = filled circle in ZapfDingbats
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
 * Generator for form field appearance streams.
 */
export class AppearanceGenerator {
  private readonly acroForm: AcroForm;
  private readonly registry: ObjectRegistry;

  /** Counter for generating unique font names in resources */
  private fontNameCounter = 0;

  /** Map of fonts to their resource names for this generation session */
  private fontResourceNames: Map<FormFont, string> = new Map();

  constructor(acroForm: AcroForm, registry: ObjectRegistry) {
    this.acroForm = acroForm;
    this.registry = registry;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Text Field
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a text field widget.
   *
   * @param field The text field
   * @param widget The widget annotation
   * @param existingStyle Optional styling extracted from existing appearance
   */
  generateTextAppearance(
    field: TextField,
    widget: WidgetAnnotation,
    existingStyle?: ExtractedAppearanceStyle,
  ): PdfStream {
    const value = field.getValue();
    let { width, height } = widget;

    // Get rotation and swap dimensions if needed
    // For 90° and 270° rotation, the appearance stream is drawn in a
    // "pre-rotation" coordinate system, so width/height are swapped
    const mk = widget.getAppearanceCharacteristics();
    const rotation = mk?.rotation ?? 0;

    if (rotation === 90 || rotation === 270) {
      [width, height] = [height, width];
    }

    // Resolve font - prefer field setting, then existing, then defaults
    const font = this.resolveFont(field, existingStyle?.fontName);
    const fontName = this.getFontResourceName(font);

    // Resolve font size - prefer field setting, then existing, then DA, then auto
    const daInfo = this.parseDefaultAppearance(field);
    let fontSize =
      field.getFontSize() ??
      existingStyle?.fontSize ??
      daInfo.fontSize ??
      this.acroForm.getDefaultFontSize();

    if (fontSize === 0) {
      fontSize = this.calculateAutoFontSize(value, width, height, font, field.isMultiline);
    }

    // Resolve text color - prefer field setting, then existing, then DA
    let textColor = field.getTextColor();

    if (!textColor && existingStyle?.textColor && existingStyle.textColor.length === 3) {
      textColor = {
        r: existingStyle.textColor[0],
        g: existingStyle.textColor[1],
        b: existingStyle.textColor[2],
      };
    }

    // Get font metrics
    const metrics = this.getFontMetrics(font);

    // Check if comb field

    if (field.isComb && field.maxLength > 0 && !field.isMultiline) {
      return this.generateCombAppearance(
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
      );
    }

    // Check if multiline

    if (field.isMultiline) {
      return this.generateMultilineAppearance(
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
      );
    }

    // Single-line text
    return this.generateSingleLineAppearance(
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
    );
  }

  /**
   * Generate single-line text appearance.
   */
  private generateSingleLineAppearance(
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
    // Get appearance characteristics for background/border
    // Prefer existing style, then MK dictionary, then nothing
    const mk = widget.getAppearanceCharacteristics();
    const bs = widget.getBorderStyle();

    const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
    const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
    // Only use a default border width if there's explicitly a border color specified
    // Otherwise, don't draw a border at all (borderWidth 0 or undefined means no border)
    const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

    // PDFBox-style padding: padding is at least 1, but increases with border width
    const padding = Math.max(1, borderWidth);

    // Clip rect is inset by padding from the bbox (per PDFBox: applyPadding(bbox, padding))
    const clipX = padding;
    const clipY = padding;
    const clipWidth = width - 2 * padding;
    const clipHeight = height - 2 * padding;

    // Content rect is inset by an additional padding from the clip rect
    // This is where text actually starts
    const contentPadding = padding; // Same as outer padding
    const contentX = clipX + contentPadding;
    const contentWidth = clipWidth - 2 * contentPadding;

    // Generate background and border operators
    const bgBorderOps = this.generateBackgroundAndBorder(
      width,
      height,
      bgColor,
      borderColor,
      borderWidth,
    );

    // Calculate text position (per PDFBox approach)
    const textWidth = metrics.getTextWidth(value, fontSize);

    // X position: center within content rect, offset from BBox origin
    const x = this.calculateXPosition(textWidth, contentWidth, alignment, contentX);

    // Y position: center cap height within clip rect (per PDFBox)
    // y = clipY + (clipHeight - capHeight) / 2
    const capHeight = metrics.capHeight * fontSize;
    const y = clipY + (clipHeight - capHeight) / 2;

    // Encode text for the font
    const encodedText = this.encodeTextForFont(value, font);

    // Build content stream
    const content = ContentStreamBuilder.from([
      ...bgBorderOps,
      beginMarkedContent("/Tx"),
      pushGraphicsState(),
      rectangle(clipX, clipY, clipWidth, clipHeight),
      clip(),
      endPath(),
      beginText(),
      setFont(fontName, fontSize),
      ...this.getColorOperators(textColor, daInfo),
      moveText(x, y),
      showText(encodedText),
      endText(),
      popGraphicsState(),
      endMarkedContent(),
    ]);

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  /**
   * Generate multiline text appearance with word wrap.
   */
  private generateMultilineAppearance(
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
    // Get appearance characteristics for background/border
    // Prefer existing style, then MK dictionary, then nothing
    const mk = widget.getAppearanceCharacteristics();
    const bs = widget.getBorderStyle();

    const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
    const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
    // Only use a default border width if there's explicitly a border color specified
    const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

    // PDFBox-style padding: padding is at least 1, but increases with border width
    const padding = Math.max(1, borderWidth);

    // Clip rect is inset by padding from the bbox
    const clipX = padding;
    const clipY = padding;
    const clipWidth = width - 2 * padding;
    const clipHeight = height - 2 * padding;

    // Content rect is inset by an additional padding from the clip rect
    const contentPadding = padding;
    const contentX = clipX + contentPadding;
    const contentWidth = clipWidth - 2 * contentPadding;

    // Generate background and border operators
    const bgBorderOps = this.generateBackgroundAndBorder(
      width,
      height,
      bgColor,
      borderColor,
      borderWidth,
    );

    // Line height based on font metrics
    const lineHeight = fontSize * 1.2;

    // Word wrap the text
    const lines = this.wrapText(value, contentWidth, font, fontSize, metrics);

    // Calculate starting Y position (top of clip rect minus ascent)
    const ascent = metrics.ascent * fontSize;
    const startY = clipY + clipHeight - ascent;

    // Build content stream
    const content = ContentStreamBuilder.from([
      ...bgBorderOps,
      beginMarkedContent("/Tx"),
      pushGraphicsState(),
      rectangle(clipX, clipY, clipWidth, clipHeight),
      clip(),
      endPath(),
      beginText(),
      setFont(fontName, fontSize),
      ...this.getColorOperators(textColor, daInfo),
      setLeading(lineHeight),
    ]);

    // Draw each line
    let currentY = startY;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineWidth = metrics.getTextWidth(line, fontSize);
      const x = this.calculateXPosition(lineWidth, contentWidth, alignment, contentX);

      if (i === 0) {
        content.add(moveText(x, currentY));
      } else {
        // Use nextLine for subsequent lines, adjusting X position
        const prevX = this.calculateXPosition(
          metrics.getTextWidth(lines[i - 1], fontSize),
          contentWidth,
          alignment,
          contentX,
        );
        content.add(moveText(x - prevX, -lineHeight));
      }

      content.add(showText(this.encodeTextForFont(line, font)));
      currentY -= lineHeight;
    }

    content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  /**
   * Generate comb field appearance with character cells.
   */
  private generateCombAppearance(
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

    // Get appearance characteristics for background/border
    // Prefer existing style, then MK dictionary, then nothing
    const mk = widget.getAppearanceCharacteristics();
    const bs = widget.getBorderStyle();

    const bgColor = existingStyle?.backgroundColor ?? mk?.backgroundColor;
    const borderColor = existingStyle?.borderColor ?? mk?.borderColor;
    // Only use a default border width if there's explicitly a border color specified
    const borderWidth = borderColor ? (existingStyle?.borderWidth ?? bs?.width ?? 1) : 0;

    // Generate background and border operators
    const bgBorderOps = this.generateBackgroundAndBorder(
      width,
      height,
      bgColor,
      borderColor,
      borderWidth,
    );

    // Calculate vertical center
    const capHeight = metrics.capHeight * fontSize;
    const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);

    // Build content stream
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

    // Draw each character centered in its cell
    content.add(beginText());
    content.add(setFont(fontName, fontSize));
    content.add(...this.getColorOperators(textColor, daInfo));

    // Calculate starting cell based on alignment (per PDFBox)
    // - Left (0): Start at first cell
    // - Center (1): Offset by floor((maxLen - numChars) / 2) cells
    // - Right (2): Offset by (maxLen - numChars) cells
    let startCell = 0;

    if (alignment === 1) {
      // Center
      startCell = Math.floor((maxLength - value.length) / 2);
    } else if (alignment === 2) {
      // Right
      startCell = maxLength - value.length;
    }

    // Track X position for relative moves
    let lastX = 0;

    for (let i = 0; i < value.length && i + startCell < maxLength; i++) {
      const char = value[i];
      const charWidth = metrics.getTextWidth(char, fontSize);
      const cellIndex = i + startCell;
      const cellCenterX = (cellIndex + 0.5) * cellWidth;
      const charX = cellCenterX - charWidth / 2;

      content.add(moveText(i === 0 ? charX : charX - lastX, i === 0 ? y : 0));
      content.add(showText(this.encodeTextForFont(char, font)));
      lastX = charX;
    }

    content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Checkbox
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance streams for a checkbox.
   */
  generateCheckboxAppearance(
    _field: CheckboxField,
    widget: WidgetAnnotation,
    _onValue: string,
  ): { on: PdfStream; off: PdfStream } {
    const { width, height } = widget;

    // Get appearance characteristics for background/border
    const mk = widget.getAppearanceCharacteristics();
    const bs = widget.getBorderStyle();
    // Only use a default border width if there's explicitly a border color specified
    const borderColor = mk?.borderColor;
    const borderWidth = borderColor ? (bs?.width ?? 1) : 0;

    // Background and border operators
    const bgBorderOps = this.generateBackgroundAndBorder(
      width,
      height,
      mk?.backgroundColor,
      borderColor,
      borderWidth,
    );

    // Calculate checkmark size and position
    const size = Math.min(width, height) * 0.7;
    const fontSize = size;
    const x = (width - size) / 2;
    const y = (height - size) / 2 + size * 0.15; // Adjust for baseline

    // ON state: background + border + checkmark using ZapfDingbats
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

    // OFF state: background + border only
    const offContent = ContentStreamBuilder.from([...bgBorderOps]);

    // Build resources with ZapfDingbats
    const resources = this.buildZapfDingbatsResources();

    return {
      on: onContent.toFormXObject([0, 0, width, height], resources),
      off: offContent.toFormXObject([0, 0, width, height], new PdfDict()),
    };
  }

  /**
   * Generate operators for background fill and border stroke.
   */
  private generateBackgroundAndBorder(
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
      ops.push(...this.setFillColor(bgColor));
      ops.push(rectangle(0, 0, width, height));
      ops.push(fill());
      ops.push(popGraphicsState());
    }

    // Draw border if specified

    if (borderColor && borderColor.length > 0 && borderWidth > 0) {
      ops.push(pushGraphicsState());
      ops.push(...this.setStrokeColor(borderColor));
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
  private setFillColor(color: number[]): Operator[] {
    if (color.length === 1) {
      return [setNonStrokingGray(color[0])];
    } else if (color.length === 3) {
      return [setNonStrokingRGB(color[0], color[1], color[2])];
    } else if (color.length === 4) {
      return [setNonStrokingCMYK(color[0], color[1], color[2], color[3])];
    }
    return [];
  }

  /**
   * Create operators to set stroke color based on color array length.
   */
  private setStrokeColor(color: number[]): Operator[] {
    if (color.length === 1) {
      return [setStrokingGray(color[0])];
    } else if (color.length === 3) {
      return [setStrokingRGB(color[0], color[1], color[2])];
    } else if (color.length === 4) {
      return [setStrokingCMYK(color[0], color[1], color[2], color[3])];
    }
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Radio Button
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance streams for a radio button.
   */
  generateRadioAppearance(
    _field: RadioField,
    widget: WidgetAnnotation,
    _value: string,
  ): { selected: PdfStream; off: PdfStream } {
    const { width, height } = widget;

    // Get appearance characteristics for background/border
    const mk = widget.getAppearanceCharacteristics();
    const bs = widget.getBorderStyle();
    // Only use a default border width if there's explicitly a border color specified
    const borderColor = mk?.borderColor;
    const borderWidth = borderColor ? (bs?.width ?? 1) : 0;

    // Background and border operators
    const bgBorderOps = this.generateBackgroundAndBorder(
      width,
      height,
      mk?.backgroundColor,
      borderColor,
      borderWidth,
    );

    // Calculate circle size and position
    const size = Math.min(width, height) * 0.6;
    const fontSize = size;
    const x = (width - size) / 2;
    const y = (height - size) / 2 + size * 0.15;

    // Selected state: background + border + filled circle using ZapfDingbats
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

    // OFF state: background + border + empty circle outline
    // Draw a circle using arc approximation
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = size / 2;

    const offContent = ContentStreamBuilder.from([
      ...bgBorderOps,
      pushGraphicsState(),
      setStrokingGray(0),
      ...this.drawCircle(centerX, centerY, radius),
      stroke(),
      popGraphicsState(),
    ]);

    const resources = this.buildZapfDingbatsResources();

    return {
      selected: selectedContent.toFormXObject([0, 0, width, height], resources),
      off: offContent.toFormXObject([0, 0, width, height], new PdfDict()),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dropdown
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a dropdown (combo box).
   */
  generateDropdownAppearance(field: DropdownField, widget: WidgetAnnotation): PdfStream {
    const value = field.getValue();
    const { width, height } = widget;

    // Find display text for current value
    const options = field.getOptions();
    const selectedOption = options.find(opt => opt.value === value);
    const displayText = selectedOption?.display ?? value;

    // Resolve font
    const font = this.resolveFont(field);
    const fontName = this.getFontResourceName(font);
    const daInfo = this.parseDefaultAppearance(field);
    let fontSize = field.getFontSize() ?? daInfo.fontSize ?? this.acroForm.getDefaultFontSize();

    if (fontSize === 0) {
      fontSize = this.calculateAutoFontSize(displayText, width, height, font, false);
    }

    const textColor = field.getTextColor();
    const metrics = this.getFontMetrics(font);

    // Calculate text position (always left-aligned for dropdowns)
    const capHeight = metrics.capHeight * fontSize;
    const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);
    const x = PADDING;

    // Clip to leave room for dropdown arrow
    const clipWidth = width - 20; // Leave space for arrow
    const content = ContentStreamBuilder.from([
      beginMarkedContent("/Tx"),
      pushGraphicsState(),
      rectangle(1, 1, clipWidth - 2, height - 2),
      clip(),
      endPath(),
      beginText(),
      setFont(fontName, fontSize),
      ...this.getColorOperators(textColor, daInfo),
      moveText(x, y),
      showText(this.encodeTextForFont(displayText, font)),
      endText(),
      popGraphicsState(),
      endMarkedContent(),
    ]);

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // List Box
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a list box.
   *
   * Following PDFBox's approach:
   * - Uses font bounding box height for highlight rectangles
   * - Accounts for topIndex (scroll offset)
   * - Draws selection highlights before text
   */
  generateListBoxAppearance(field: ListBoxField, widget: WidgetAnnotation): PdfStream {
    const selectedValues = new Set(field.getValue());
    const options = field.getOptions();
    const { width, height } = widget;

    // Resolve font
    const font = this.resolveFont(field);
    const fontName = this.getFontResourceName(font);
    const daInfo = this.parseDefaultAppearance(field);
    let fontSize = field.getFontSize() ?? daInfo.fontSize ?? this.acroForm.getDefaultFontSize();

    if (fontSize === 0) {
      fontSize = 12; // Default for list boxes
    }

    const textColor = field.getTextColor();
    const metrics = this.getFontMetrics(font);

    // Get the top index (scroll offset) - first visible option
    const topIndex = field.getTopIndex();

    // Calculate line height based on font bounding box (per PDFBox)
    // The bounding box height = ascent - descent
    const fontBBoxHeight = (metrics.ascent - metrics.descent) * fontSize;
    const lineHeight = fontBBoxHeight;
    const ascent = metrics.ascent * fontSize;

    // Padding area (per PDFBox: applyPadding with 1 unit)
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

    // Build selected indices set for fast lookup
    const selectedIndices = new Set<number>();

    for (let i = 0; i < options.length; i++) {
      if (selectedValues.has(options[i].value)) {
        selectedIndices.add(i);
      }
    }

    // Draw selection highlights (per PDFBox: insertGeneratedListboxSelectionHighlight)
    // Y position is calculated from top, accounting for scroll offset (topIndex)
    for (const selectedIndex of selectedIndices) {
      // Calculate Y position for this selection
      // The formula matches PDFBox: upperRightY - highlightBoxHeight * (selectedIndex - topIndex + 1) + 2
      const visibleRow = selectedIndex - topIndex;

      if (visibleRow < 0) {
        continue;
      }

      // Before visible area
      const highlightY = paddingEdge.y + paddingEdge.height - lineHeight * (visibleRow + 1) + 2;

      if (highlightY < paddingEdge.y - lineHeight) {
        continue;
      }

      // Below visible area
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

    // Reset to black for text
    content.add(setNonStrokingGray(0));

    // Draw text
    content.add(beginText());
    content.add(setFont(fontName, fontSize));
    content.add(...this.getColorOperators(textColor, daInfo));

    // Start Y position: top of padding area minus ascent
    let y = paddingEdge.y + paddingEdge.height - ascent + 2;

    // Start from topIndex

    for (let i = topIndex; i < options.length; i++) {
      const option = options[i];

      if (y < paddingEdge.y - lineHeight) {
        break; // Below visible area
      }

      if (i === topIndex) {
        content.add(moveText(PADDING, y));
      } else {
        content.add(moveText(0, -lineHeight));
      }

      content.add(showText(this.encodeTextForFont(option.display, font)));
      y -= lineHeight;
    }

    content.add(endText()).add(popGraphicsState()).add(endMarkedContent());

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Push Button
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate appearance stream for a push button.
   */
  generateButtonAppearance(field: ButtonField, widget: WidgetAnnotation): PdfStream {
    const { width, height } = widget;

    // Get caption from /MK
    const mk = widget.getAppearanceCharacteristics();
    const caption = mk?.caption ?? "";

    if (!caption) {
      // Empty button
      return new ContentStreamBuilder().toFormXObject([0, 0, width, height], new PdfDict());
    }

    // Resolve font
    const font = this.resolveFont(field);
    const fontName = this.getFontResourceName(font);
    const daInfo = this.parseDefaultAppearance(field);
    let fontSize = field.getFontSize() ?? daInfo.fontSize ?? this.acroForm.getDefaultFontSize();

    if (fontSize === 0) {
      fontSize = this.calculateAutoFontSize(caption, width, height, font, false);
    }

    const textColor = field.getTextColor();
    const metrics = this.getFontMetrics(font);

    // Center caption
    const textWidth = metrics.getTextWidth(caption, fontSize);
    const x = (width - textWidth) / 2;
    const capHeight = metrics.capHeight * fontSize;
    const y = (height - capHeight) / 2 + Math.abs(metrics.descent * fontSize);

    // Draw button background if specified
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

    // Draw caption
    content
      .add(beginText())
      .add(setFont(fontName, fontSize))
      .add(...this.getColorOperators(textColor, daInfo))
      .add(moveText(x, y))
      .add(showText(this.encodeTextForFont(caption, font)))
      .add(endText())
      .add(popGraphicsState());

    return this.buildFormXObject(content, width, height, font, fontName, widget);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the font to use for a field.
   *
   * Resolution order:
   * 1. Field's explicitly set font
   * 2. Form's default font
   * 3. Existing appearance font (if provided)
   * 4. Existing font from DA string
   * 5. Helvetica fallback
   */
  private resolveFont(
    field: {
      getFont(): FormFont | null;
      defaultAppearance?: string | null;
    },
    existingFontName?: string,
  ): FormFont {
    // 1. Field's explicit font
    const fieldFont = field.getFont();

    if (fieldFont) {
      return fieldFont;
    }

    // 2. Form's default font
    const defaultFont = this.acroForm.getDefaultFont();

    if (defaultFont) {
      return defaultFont;
    }

    // 3. Try existing appearance font name

    if (existingFontName) {
      const existingFont = this.acroForm.getExistingFont(existingFontName);

      if (existingFont) {
        return existingFont;
      }
    }

    // 4. Try to get from DA string
    const da =
      "defaultAppearance" in field
        ? (field.defaultAppearance ?? this.acroForm.defaultAppearance)
        : this.acroForm.defaultAppearance;
    const daInfo = parseDAString(da);
    const existingFont = this.acroForm.getExistingFont(daInfo.fontName);

    if (existingFont) {
      return existingFont;
    }

    // 5. Fallback to Helvetica
    return new ExistingFont("Helv", null, null);
  }

  /**
   * Get or create a resource name for a font.
   */
  private getFontResourceName(font: FormFont): string {
    if (this.fontResourceNames.has(font)) {
      // biome-ignore lint/style/noNonNullAssertion: checked with has()
      return this.fontResourceNames.get(font)!;
    }

    let name: string;

    if (isExistingFont(font)) {
      // Use existing font name
      name = font.name.startsWith("/") ? font.name : `/${font.name}`;
    } else {
      // Generate new name for embedded font
      name = `/F${++this.fontNameCounter}`;
    }

    this.fontResourceNames.set(font, name);

    return name;
  }

  /**
   * Parse default appearance string for a field.
   */
  private parseDefaultAppearance(field: { defaultAppearance?: string | null }): ParsedDA {
    const da =
      "defaultAppearance" in field
        ? (field.defaultAppearance ?? this.acroForm.defaultAppearance)
        : this.acroForm.defaultAppearance;

    return parseDAString(da);
  }

  /**
   * Get font metrics.
   */
  private getFontMetrics(font: FormFont): FontMetrics {
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
   * Calculate auto font size to fit text.
   */
  private calculateAutoFontSize(
    text: string,
    width: number,
    height: number,
    font: FormFont,
    isMultiline: boolean,
  ): number {
    const contentWidth = width - 2 * PADDING;
    const contentHeight = height - 2 * PADDING;

    if (isMultiline) {
      // For multiline, use a reasonable default that fits most cases
      return Math.max(MIN_FONT_SIZE, Math.min(12, contentHeight * 0.15));
    }

    // Height-based: fit vertically
    const heightBased = contentHeight * 0.7;

    // Width-based: fit text horizontally
    // Start with height-based size and check if it fits
    let fontSize = heightBased;
    const metrics = this.getFontMetrics(font);
    let textWidth = metrics.getTextWidth(text || "X", fontSize);

    // Reduce until it fits
    while (textWidth > contentWidth && fontSize > MIN_FONT_SIZE) {
      fontSize -= 1;
      textWidth = metrics.getTextWidth(text || "X", fontSize);
    }

    return Math.max(MIN_FONT_SIZE, Math.min(fontSize, MAX_FONT_SIZE));
  }

  /**
   * Calculate X position based on alignment.
   *
   * Per PDFBox: text is positioned within the content rect.
   * - contentWidth: width of the content area
   * - contentOffset: X position where content area starts (from BBox origin)
   *
   * For center: x = contentOffset + (contentWidth - textWidth) / 2
   * For right:  x = contentOffset + contentWidth - textWidth
   * For left:   x = contentOffset
   */
  private calculateXPosition(
    textWidth: number,
    contentWidth: number,
    alignment: number,
    contentOffset: number,
  ): number {
    switch (alignment) {
      case 1: // Center
        // Center text within content area
        // If text is wider than content, it will extend beyond but clip will handle it
        return contentOffset + (contentWidth - textWidth) / 2;
      case 2: // Right
        return contentOffset + contentWidth - textWidth;
      default: // Left (0)
        return contentOffset;
    }
  }

  /**
   * Word wrap text to fit width.
   */
  private wrapText(
    text: string,
    maxWidth: number,
    _font: FormFont,
    fontSize: number,
    metrics: FontMetrics,
  ): string[] {
    const lines: string[] = [];

    // Split by explicit newlines first
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

          // Check if single word is too long
          if (metrics.getTextWidth(word, fontSize) > maxWidth) {
            // Break the word
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

  /**
   * Encode text for a font.
   */
  private encodeTextForFont(text: string, font: FormFont): PdfString {
    if (isEmbeddedFont(font)) {
      // Mark the font as used in a form field to prevent subsetting
      // (users can type any character at runtime)
      font.markUsedInForm();

      // For embedded fonts, encode and check
      if (!font.canEncode(text)) {
        const unencodable = (font as EmbeddedFont).getUnencodableCharacters(text);
        const firstBad = unencodable[0];

        throw new Error(
          `Font cannot encode character '${firstBad}' (U+${firstBad.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")})`,
        );
      }

      // Encode to glyph IDs for PDF content stream
      // With CIDToGIDMap /Identity, the content stream must contain GIDs
      const gids = font.encodeTextToGids(text);

      // For Identity-H encoding, GIDs are 16-bit
      const bytes = new Uint8Array(gids.length * 2);

      for (let i = 0; i < gids.length; i++) {
        bytes[i * 2] = (gids[i] >> 8) & 0xff;
        bytes[i * 2 + 1] = gids[i] & 0xff;
      }

      return PdfString.fromBytes(bytes);
    }

    // For existing fonts, use direct string encoding
    return PdfString.fromString(text);
  }

  /**
   * Get color operators from field settings or DA.
   */
  private getColorOperators(textColor: RgbColor | null, daInfo: ParsedDA): Operator[] {
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
   * Draw a circle using cubic Bezier curves.
   */
  private drawCircle(cx: number, cy: number, r: number): Operator[] {
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
   * Helper for Bezier curve.
   */

  /**
   * Build resources dict with ZapfDingbats.
   */
  private buildZapfDingbatsResources(): PdfDict {
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
   * Build Form XObject with resources.
   *
   * For rotated fields, the appearance stream includes a Matrix that handles
   * the rotation. This follows the PDFBox approach where rotation is baked
   * into the appearance stream, not applied during rendering/flattening.
   */
  private buildFormXObject(
    content: ContentStreamBuilder,
    width: number,
    height: number,
    font: FormFont,
    fontName: string,
    widget: WidgetAnnotation,
  ): PdfStream {
    const resources = this.buildResources(font, fontName);

    // Get rotation from widget's MK dictionary
    const mk = widget.getAppearanceCharacteristics();
    const rotation = mk?.rotation ?? 0;

    // Calculate rotation matrix if needed
    // The matrix transforms the BBox coordinate system to handle rotation
    const matrix = this.calculateAppearanceMatrix(width, height, rotation);

    return content.toFormXObject([0, 0, width, height], resources, matrix);
  }

  /**
   * Calculate the appearance stream Matrix for a given rotation.
   *
   * The Matrix transforms coordinates from the appearance's BBox space
   * into the "pre-rotation" space. When the viewer applies this matrix,
   * the content appears correctly rotated.
   *
   * For rotation R degrees clockwise:
   * - 0°:   Identity [1, 0, 0, 1, 0, 0]
   * - 90°:  Rotate and translate [0, 1, -1, 0, height, 0]
   * - 180°: Rotate and translate [-1, 0, 0, -1, width, height]
   * - 270°: Rotate and translate [0, -1, 1, 0, 0, width]
   */
  private calculateAppearanceMatrix(
    width: number,
    height: number,
    rotation: number,
  ): [number, number, number, number, number, number] | undefined {
    switch (rotation) {
      case 90:
        // 90° clockwise: x' = y, y' = height - x
        // Matrix: [cos(90), sin(90), -sin(90), cos(90), tx, ty]
        //       = [0, 1, -1, 0, height, 0]
        return [0, 1, -1, 0, height, 0];
      case 180:
        // 180°: x' = width - x, y' = height - y
        return [-1, 0, 0, -1, width, height];
      case 270:
        // 270° clockwise (90° CCW): x' = width - y, y' = x
        return [0, -1, 1, 0, 0, width];
      default:
        // No rotation - don't add matrix (identity)
        return undefined;
    }
  }

  /**
   * Build resources dictionary for appearance stream.
   */
  private buildResources(font: FormFont, fontName: string): PdfDict {
    const resources = new PdfDict();
    const fonts = new PdfDict();

    // Clean font name (remove leading slash)
    const cleanName = fontName.startsWith("/") ? fontName.slice(1) : fontName;

    if (isEmbeddedFont(font)) {
      // For embedded fonts, we'll add a reference later during save
      // For now, create a placeholder that will be resolved
      const fontRef = this.registry.register(this.buildEmbeddedFontDict(font));
      fonts.set(cleanName, fontRef);
    } else if (isExistingFont(font) && font.ref) {
      // Use existing font reference
      fonts.set(cleanName, font.ref);
    } else {
      // Standard font - create Type1 font dict
      const fontDict = new PdfDict();

      fontDict.set("Type", PdfName.of("Font"));
      fontDict.set("Subtype", PdfName.of("Type1"));
      fontDict.set("BaseFont", PdfName.of(this.mapToStandardFontName(cleanName)));

      fonts.set(cleanName, fontDict);
    }

    resources.set("Font", fonts);

    return resources;
  }

  /**
   * Build font dictionary for embedded font.
   */
  private buildEmbeddedFontDict(font: EmbeddedFont): PdfDict {
    // This is a simplified version - full implementation would include:
    // - CIDFont dict
    // - CIDToGIDMap
    // - FontDescriptor with FontFile2
    // - ToUnicode CMap
    const dict = new PdfDict();

    dict.set("Type", PdfName.of("Font"));
    dict.set("Subtype", PdfName.of("Type0"));
    dict.set("BaseFont", PdfName.of(font.baseFontName));
    dict.set("Encoding", PdfName.of("Identity-H"));

    return dict;
  }

  /**
   * Map font names to Standard 14 font names.
   */
  private mapToStandardFontName(name: string): string {
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
