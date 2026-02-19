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

const SPACE = 0x20;

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
   * Write operator bytes directly into a shared ByteWriter.
   * Avoids intermediate allocations compared to toBytes().
   */
  writeTo(writer: ByteWriter): void {
    for (const operand of this.operands) {
      writeOperand(writer, operand);
      writer.writeByte(SPACE);
    }

    writer.writeAscii(this.op);
  }

  /**
   * Serialize to bytes for content stream output.
   * Format: "operand1 operand2 ... operator"
   */
  toBytes(): Uint8Array {
    const writer = new ByteWriter(undefined, { initialSize: 64 });
    this.writeTo(writer);

    return writer.toBytes();
  }

  /**
   * Serialize to PDF content stream syntax string.
   * Format: "operand1 operand2 ... operator"
   */
  toString(): string {
    return new TextDecoder().decode(this.toBytes());
  }

  /**
   * Get byte length when serialized.
   *
   * Should be avoided in performance-critical paths, use {@link writeTo} instead.
   */
  byteLength(): number {
    return this.toBytes().length;
  }
}

/** Write an operand directly into a ByteWriter. */
function writeOperand(writer: ByteWriter, operand: Operand): void {
  if (typeof operand === "number") {
    writer.writeAscii(formatPdfNumber(operand));
    return;
  }

  if (typeof operand === "string") {
    // Assume already formatted (e.g., "/FontName")
    writer.writeAscii(operand);
    return;
  }

  // PdfName, PdfString, PdfArray, PdfDict all have toBytes(writer)
  operand.toBytes(writer);
}
