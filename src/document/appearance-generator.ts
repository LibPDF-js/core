/**
 * Appearance stream generation for form fields.
 *
 * Generates Form XObjects (appearance streams) for text fields
 * based on field value, fonts, and layout.
 *
 * PDF Reference: Section 12.5.5 "Appearance Streams"
 */

import { ContentStreamBuilder } from "#src/content/content-stream";
import type { Operator } from "#src/content/operators";
import {
  beginMarkedContent,
  beginText,
  clip,
  endMarkedContent,
  endPath,
  endText,
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
import type { PdfStream } from "#src/objects/pdf-stream";
import { PdfString } from "#src/objects/pdf-string";
import type { AcroForm } from "./acro-form";
import type { TextField } from "./form-field";
import type { ObjectRegistry } from "./object-registry";
import type { WidgetAnnotation } from "./widget-annotation";

/**
 * Parsed default appearance string components.
 */
interface ParsedDA {
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
 * Generator for form field appearance streams.
 */
export class AppearanceGenerator {
  private readonly acroForm: AcroForm;

  constructor(acroForm: AcroForm, _registry: ObjectRegistry) {
    this.acroForm = acroForm;
  }

  /**
   * Generate appearance stream for a text field widget.
   */
  generateTextAppearance(field: TextField, widget: WidgetAnnotation): PdfStream {
    const value = field.getValue();

    const { width, height } = widget;

    // Parse default appearance
    const da = this.parseDefaultAppearance(field);

    // Calculate font size (auto-size if 0)
    let fontSize = da.fontSize;

    if (fontSize === 0) {
      fontSize = this.calculateAutoFontSize(value, width, height);
    }

    // Calculate text position based on alignment
    const { x, y } = this.calculateTextPosition(value, width, height, fontSize, field.alignment);

    // Build content stream
    const content = new ContentStreamBuilder()
      .add(beginMarkedContent("/Tx"))
      .add(pushGraphicsState())
      // Clip to field bounds with small margin
      .add(rectangle(1, 1, width - 2, height - 2))
      .add(clip())
      .add(endPath())
      // Text
      .add(beginText())
      .add(setFont(da.fontName, fontSize))
      .add(...this.colorOperators(da))
      .add(moveText(x, y))
      .add(showText(PdfString.fromString(value)))
      .add(endText())
      .add(popGraphicsState())
      .add(endMarkedContent());

    // Create Form XObject with resources
    const resources = this.buildResources(da.fontName);

    return content.toFormXObject([0, 0, width, height], resources);
  }

  /**
   * Parse /DA string into components.
   *
   * Format: "/FontName fontSize Tf [colorArgs] colorOp"
   * Example: "/Helv 12 Tf 0 g" or "/F1 0 Tf 0.5 0.5 0.5 rg"
   */
  private parseDefaultAppearance(field: TextField): ParsedDA {
    const daStr = field.defaultAppearance ?? this.acroForm.defaultAppearance;

    return parseDAString(daStr);
  }

  /**
   * Calculate font size to fit text in field.
   */
  private calculateAutoFontSize(text: string, width: number, height: number): number {
    const padding = 4;

    // Height-based: fit vertically (typical text is ~70% of point size)
    const heightBased = (height - padding) * 0.7;

    // Width-based: approximate (proper would need font metrics)
    // Assume average char width ~0.5 * fontSize
    const avgCharWidth = 0.5;
    const charCount = text.length || 1; // Avoid division by zero
    const widthBased = (width - padding) / charCount / avgCharWidth;

    // Use smaller of the two, with min/max bounds
    const autoSize = Math.min(heightBased, widthBased);
    return Math.max(4, Math.min(autoSize, 14));
  }

  /**
   * Calculate text position based on alignment.
   */
  private calculateTextPosition(
    text: string,
    width: number,
    height: number,
    fontSize: number,
    alignment: number,
  ): { x: number; y: number } {
    const padding = 2;

    // Approximate text width (proper implementation would use font metrics)
    const textWidth = text.length * fontSize * 0.5;

    let x: number;
    switch (alignment) {
      case 1: // center
        x = (width - textWidth) / 2;
        break;
      case 2: // right
        x = width - textWidth - padding;
        break;
      default: // left (0)
        x = padding;
    }

    // Vertical center (approximate baseline position)
    const y = (height - fontSize) / 2 + fontSize * 0.2;

    return { x: Math.max(padding, x), y: Math.max(padding, y) };
  }

  /**
   * Build color operators from parsed DA.
   */
  private colorOperators(da: ParsedDA): Operator[] {
    switch (da.colorOp) {
      case "g":
        return [setNonStrokingGray(da.colorArgs[0] ?? 0)];
      case "rg":
        return [
          setNonStrokingRGB(da.colorArgs[0] ?? 0, da.colorArgs[1] ?? 0, da.colorArgs[2] ?? 0),
        ];
      case "k":
        return [
          setNonStrokingCMYK(
            da.colorArgs[0] ?? 0,
            da.colorArgs[1] ?? 0,
            da.colorArgs[2] ?? 0,
            da.colorArgs[3] ?? 0,
          ),
        ];
      default:
        return [setNonStrokingGray(0)]; // Default to black
    }
  }

  /**
   * Build resources dict with font reference.
   */
  private buildResources(_fontName: string): PdfDict {
    // For now, return empty resources
    // A full implementation would:
    // 1. Look up the font in AcroForm's /DR
    // 2. Create a font subset if embedding
    // 3. Build proper /Font dict
    return new PdfDict();
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

  // Extract font: /Name size Tf
  const fontMatch = da.match(/\/(\S+)\s+([\d.]+)\s+Tf/);

  if (fontMatch) {
    result.fontName = `/${fontMatch[1]}`;
    result.fontSize = Number.parseFloat(fontMatch[2]);
  }

  // Extract color: look for g, rg, or k at end
  const grayMatch = da.match(/([\d.]+)\s+g\s*$/);

  if (grayMatch) {
    result.colorOp = "g";
    result.colorArgs = [Number.parseFloat(grayMatch[1])];

    return result;
  }

  const rgbMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg\s*$/);

  if (rgbMatch) {
    result.colorOp = "rg";
    result.colorArgs = [
      Number.parseFloat(rgbMatch[1]),
      Number.parseFloat(rgbMatch[2]),
      Number.parseFloat(rgbMatch[3]),
    ];

    return result;
  }

  const cmykMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k\s*$/);

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
