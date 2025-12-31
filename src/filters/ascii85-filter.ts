import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";

/**
 * ASCII85Decode filter (also known as btoa).
 *
 * Encodes 4 bytes into 5 ASCII characters (chars 33-117, '!' to 'u').
 * More efficient than hex encoding (25% overhead vs 100%).
 *
 * Special cases:
 * - 'z' represents 4 zero bytes (only valid at group boundary)
 * - '~>' is the end-of-data marker
 *
 * Example: "87cURD]j" → "Hello"
 */
export class ASCII85Filter implements Filter {
  readonly name = "ASCII85Decode";

  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const result: number[] = [];
    let buffer = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      // Skip whitespace
      if (byte <= 0x20) continue;

      // End marker '~>'
      if (byte === 0x7e) {
        // Check for '>' following
        if (i + 1 < data.length && data[i + 1] === 0x3e) {
          break;
        }
        // Lone '~' - skip (lenient)
        continue;
      }

      // 'z' = shorthand for 4 zero bytes (only valid at group start)
      if (byte === 0x7a) {
        if (count !== 0) {
          // 'z' inside a group - invalid, but be lenient
          continue;
        }
        result.push(0, 0, 0, 0);
        continue;
      }

      // Valid base-85 digit: '!' (33) to 'u' (117)
      if (byte < 0x21 || byte > 0x75) {
        // Invalid character - skip (lenient)
        continue;
      }

      // Decode base-85 digit
      buffer = buffer * 85 + (byte - 33);
      count++;

      if (count === 5) {
        // Complete group - output 4 bytes
        result.push(
          (buffer >> 24) & 0xff,
          (buffer >> 16) & 0xff,
          (buffer >> 8) & 0xff,
          buffer & 0xff,
        );
        buffer = 0;
        count = 0;
      }
    }

    // Handle partial final group (2-4 characters → 1-3 bytes)
    if (count > 1) {
      // Pad with 'u' (84) to make 5 characters
      for (let i = count; i < 5; i++) {
        buffer = buffer * 85 + 84;
      }

      // Output (count - 1) bytes
      const outputBytes = count - 1;

      for (let i = 0; i < outputBytes; i++) {
        result.push((buffer >> (24 - i * 8)) & 0xff);
      }
    }

    return new Uint8Array(result);
  }

  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const result: number[] = [];

    // Process 4 bytes at a time
    let i = 0;

    while (i < data.length) {
      const remaining = data.length - i;

      if (remaining >= 4) {
        // Full group
        const value = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];

        if (value === 0) {
          // Special case: all zeros → 'z'
          result.push(0x7a);
        } else {
          // Encode as 5 base-85 digits
          this.encodeGroup(value, 5, result);
        }

        i += 4;
      } else {
        // Partial final group (1-3 bytes)
        let value = 0;

        for (let j = 0; j < remaining; j++) {
          value |= data[i + j] << (24 - j * 8);
        }

        // Output (remaining + 1) characters
        this.encodeGroup(value, remaining + 1, result);
        i += remaining;
      }
    }

    // Add end marker '~>'
    result.push(0x7e, 0x3e);

    return new Uint8Array(result);
  }

  private encodeGroup(value: number, numChars: number, output: number[]): void {
    // Convert to unsigned 32-bit for division
    let v = value >>> 0;

    // Calculate 5 digits
    const digits = new Array(5);

    for (let i = 4; i >= 0; i--) {
      digits[i] = (v % 85) + 33;
      v = Math.floor(v / 85);
    }

    // Output requested number of characters
    for (let i = 0; i < numChars; i++) {
      output.push(digits[i]);
    }
  }
}
