import { formatPdfNumber } from "#src/helpers/format";
import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * PDF numeric object (integer or real).
 *
 * In PDF: `42`, `-3.14`, `0.5`
 */
export class PdfNumber implements PdfPrimitive {
  get type(): "number" {
    return "number";
  }

  constructor(readonly value: number) {}

  /**
   * Returns true if this number is an integer (no fractional part).
   */
  isInteger(): boolean {
    return Number.isInteger(this.value);
  }

  static of(value: number): PdfNumber {
    return new PdfNumber(value);
  }

  toBytes(writer: ByteWriter): void {
    writer.writeAscii(formatPdfNumber(this.value));
  }
}
