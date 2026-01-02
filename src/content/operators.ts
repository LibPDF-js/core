/**
 * PDF content stream operators.
 *
 * Content streams are sequences of operators with operands:
 * ```
 * q                    % Push graphics state
 * 1 0 0 1 10 20 cm     % Concat matrix
 * BT                   % Begin text
 * /Helv 12 Tf          % Set font
 * (Hello) Tj           % Show text
 * ET                   % End text
 * Q                    % Pop graphics state
 * ```
 *
 * This module provides type-safe creation and serialization of operators.
 */

import { formatPdfNumber } from "#src/helpers/format";
import { ByteWriter } from "#src/io/byte-writer";
import type { PdfArray } from "#src/objects/pdf-array";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { PdfName } from "#src/objects/pdf-name";
import type { PdfString } from "#src/objects/pdf-string";

/** Valid operand types */
export type Operand = number | string | PdfName | PdfString | PdfArray | PdfDict;

/**
 * Format an operand for content stream output.
 */
function formatOperand(operand: Operand): string {
  if (typeof operand === "number") {
    return formatPdfNumber(operand);
  }

  if (typeof operand === "string") {
    // Assume already formatted (e.g., "/FontName")
    return operand;
  }

  // PdfName, PdfString, PdfArray, PdfDict all have toBytes()
  // We serialize them to get the string representation
  const writer = new ByteWriter();
  operand.toBytes(writer);

  return new TextDecoder().decode(writer.toBytes());
}

/** All PDF content stream operator names */
export const Op = {
  // Graphics state (Table 57)
  PushGraphicsState: "q",
  PopGraphicsState: "Q",
  ConcatMatrix: "cm",
  SetLineWidth: "w",
  SetLineCap: "J",
  SetLineJoin: "j",
  SetMiterLimit: "M",
  SetDashPattern: "d",
  SetRenderingIntent: "ri",
  SetFlatness: "i",
  SetGraphicsState: "gs",

  // Path construction (Table 59)
  MoveTo: "m",
  LineTo: "l",
  CurveTo: "c",
  CurveToInitial: "v",
  CurveToFinal: "y",
  ClosePath: "h",
  Rectangle: "re",

  // Path painting (Table 60)
  Stroke: "S",
  CloseAndStroke: "s",
  Fill: "f",
  FillCompat: "F",
  FillEvenOdd: "f*",
  FillAndStroke: "B",
  FillAndStrokeEvenOdd: "B*",
  CloseFillAndStroke: "b",
  CloseFillAndStrokeEvenOdd: "b*",
  EndPath: "n",

  // Clipping (Table 61)
  Clip: "W",
  ClipEvenOdd: "W*",

  // Text state (Table 105)
  SetCharSpacing: "Tc",
  SetWordSpacing: "Tw",
  SetHorizontalScale: "Tz",
  SetLeading: "TL",
  SetFont: "Tf",
  SetTextRenderMode: "Tr",
  SetTextRise: "Ts",

  // Text positioning (Table 106)
  BeginText: "BT",
  EndText: "ET",
  MoveText: "Td",
  MoveTextSetLeading: "TD",
  SetTextMatrix: "Tm",
  NextLine: "T*",

  // Text showing (Table 107)
  ShowText: "Tj",
  ShowTextArray: "TJ",
  MoveAndShowText: "'",
  MoveSetSpacingShowText: '"',

  // Color (Tables 74, 75)
  SetStrokingColorSpace: "CS",
  SetNonStrokingColorSpace: "cs",
  SetStrokingColor: "SC",
  SetStrokingColorN: "SCN",
  SetNonStrokingColor: "sc",
  SetNonStrokingColorN: "scn",
  SetStrokingGray: "G",
  SetNonStrokingGray: "g",
  SetStrokingRGB: "RG",
  SetNonStrokingRGB: "rg",
  SetStrokingCMYK: "K",
  SetNonStrokingCMYK: "k",

  // XObjects (Table 87)
  DrawXObject: "Do",

  // Marked content (Table 320)
  DesignateMarkedContentPoint: "MP",
  DesignateMarkedContentPointProps: "DP",
  BeginMarkedContent: "BMC",
  BeginMarkedContentProps: "BDC",
  EndMarkedContent: "EMC",

  // Shading
  PaintShading: "sh",

  // Inline images
  BeginInlineImage: "BI",
  BeginInlineImageData: "ID",
  EndInlineImage: "EI",
} as const;

export type Op = (typeof Op)[keyof typeof Op];

/**
 * A single content stream operator with its operands.
 * Immutable - create via factory functions or Operator.of().
 */
export class Operator {
  private constructor(
    readonly op: Op,
    readonly operands: readonly Operand[],
  ) {}

  /**
   * Create an operator with operands.
   */
  static of(op: Op, ...operands: Operand[]): Operator {
    return new Operator(op, Object.freeze([...operands]));
  }

  /**
   * Serialize to PDF content stream syntax.
   * Format: "operand1 operand2 ... operator"
   */
  toString(): string {
    if (this.operands.length === 0) {
      return this.op;
    }

    const parts = this.operands.map(formatOperand);
    parts.push(this.op);
    return parts.join(" ");
  }

  /**
   * Get byte length when serialized (for pre-allocation).
   */
  byteLength(): number {
    return this.toString().length;
  }
}
