import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * PDF null object - a singleton representing the null value.
 *
 * In PDF: `null`
 */
export class PdfNull implements PdfPrimitive {
  static readonly instance = new PdfNull();

  get type(): "null" {
    return "null";
  }

  private constructor() {}

  toBytes(writer: ByteWriter): void {
    writer.writeAscii("null");
  }
}
