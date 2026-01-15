/**
 * Raw PDF bytes object.
 *
 * This is a special object that serializes to exactly its raw content,
 * without any PDF encoding or escaping. Used for signature placeholders
 * where we need precise control over the byte output.
 *
 * IMPORTANT: This is for internal use only. The raw bytes must be valid
 * PDF syntax for the context where they're used.
 */

import type { ByteWriter } from "#src/io/byte-writer";

import type { PdfPrimitive } from "./pdf-primitive";

/**
 * A raw bytes object that serializes without any transformation.
 *
 * Used for signature ByteRange and Contents placeholders where we need
 * exact byte control for later patching.
 */
export class PdfRaw implements PdfPrimitive {
  readonly type = "raw" as const;

  /** The raw bytes to write */
  readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array | string) {
    if (typeof bytes === "string") {
      this.bytes = new TextEncoder().encode(bytes);
    } else {
      this.bytes = bytes;
    }
  }

  /**
   * Create from an ASCII string.
   */
  static fromString(str: string): PdfRaw {
    return new PdfRaw(str);
  }

  /**
   * Write the raw bytes exactly as-is.
   */
  toBytes(writer: ByteWriter): void {
    writer.writeBytes(this.bytes);
  }
}
