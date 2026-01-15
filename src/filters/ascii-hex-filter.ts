import { CR, hexValue, LF, SPACE, TAB } from "#src/helpers/chars";
import { ByteWriter } from "#src/io/byte-writer";
import type { PdfDict } from "#src/objects/pdf-dict";

import type { Filter } from "./filter";

/**
 * ASCIIHexDecode filter.
 *
 * Converts hexadecimal ASCII representation to binary.
 * Used for encoding binary data in a text-safe format.
 *
 * Format: pairs of hex digits (00-FF), whitespace ignored,
 * terminated by '>'. Odd final digit is padded with 0.
 *
 * Example: "48656C6C6F>" → "Hello"
 */
export class ASCIIHexFilter implements Filter {
  readonly name = "ASCIIHexDecode";

  private static readonly END_MARKER = 0x3e;
  private static readonly NIBBLE_MASK = 0x0f;

  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const output = new ByteWriter();

    let high: number | null = null;

    for (const byte of data) {
      if (byte === SPACE || byte === TAB || byte === LF || byte === CR) {
        continue;
      }

      // End marker '>'
      if (byte === ASCIIHexFilter.END_MARKER) {
        break;
      }

      const nibble = hexValue(byte);

      if (nibble === -1) {
        // Invalid character - skip (lenient parsing)
        continue;
      }

      if (high === null) {
        high = nibble;
      } else {
        output.writeByte((high << 4) | nibble);
        high = null;
      }
    }

    // Odd number of digits: pad final nibble with 0
    if (high !== null) {
      output.writeByte(high << 4);
    }

    return output.toBytes();
  }

  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const hexChars = "0123456789ABCDEF";

    // Each byte becomes 2 hex chars, plus '>' terminator
    const result = new Uint8Array(data.length * 2 + 1);

    let i = 0;

    for (const byte of data) {
      result[i] = hexChars.charCodeAt((byte >> 4) & ASCIIHexFilter.NIBBLE_MASK);
      result[i + 1] = hexChars.charCodeAt(byte & ASCIIHexFilter.NIBBLE_MASK);

      i += 2;
    }

    // Add terminator
    result[i] = ASCIIHexFilter.END_MARKER;

    return result;
  }
}
