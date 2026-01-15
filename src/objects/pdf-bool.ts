import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * PDF boolean object.
 *
 * In PDF: `true` or `false`
 *
 * Use `PdfBool.of(value)` to get cached instances.
 */
export class PdfBool implements PdfPrimitive {
  static readonly TRUE = new PdfBool(true);
  static readonly FALSE = new PdfBool(false);

  private constructor(readonly value: boolean) {}

  get type(): "bool" {
    return "bool";
  }

  static of(value: boolean): PdfBool {
    return value ? PdfBool.TRUE : PdfBool.FALSE;
  }

  toBytes(writer: ByteWriter): void {
    writer.writeAscii(this.value ? "true" : "false");
  }
}
