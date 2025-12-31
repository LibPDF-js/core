import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";

/**
 * Hex digit values (0-15), or -1 for invalid.
 */
function hexValue(byte: number): number {
  // 0-9
  if (byte >= 0x30 && byte <= 0x39) {
    return byte - 0x30;
  }

  // A-F
  if (byte >= 0x41 && byte <= 0x46) {
    return byte - 0x41 + 10;
  }

  // a-f
  if (byte >= 0x61 && byte <= 0x66) {
    return byte - 0x61 + 10;
  }

  return -1;
}

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

  private static END_MARKER = 0x3e;

  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const result: number[] = [];

    let high: number | null = null;

    for (const byte of data) {
      // Skip whitespace (space, tab, newline, carriage return)
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
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
        result.push((high << 4) | nibble);
        high = null;
      }
    }

    // Odd number of digits: pad final nibble with 0
    if (high !== null) {
      result.push(high << 4);
    }

    return new Uint8Array(result);
  }

  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const hexChars = "0123456789ABCDEF";

    // Each byte becomes 2 hex chars, plus '>' terminator
    const result = new Uint8Array(data.length * 2 + 1);

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      result[i * 2] = hexChars.charCodeAt((byte >> 4) & 0x0f);
      result[i * 2 + 1] = hexChars.charCodeAt(byte & 0x0f);
    }

    // Add terminator
    result[data.length * 2] = 0x3e; // '>'

    return result;
  }
}
