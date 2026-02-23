import { SINGLE_BYTE_MASK, SPACE } from "#src/helpers/chars";
import { ByteWriter } from "#src/io/byte-writer";
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

  private static readonly END_MARKER = 0x7e;
  private static readonly END_MARKER_FOLLOWING = 0x3e;

  private static readonly ZERO_SHORTCUT = 0x7a;

  decode(data: Uint8Array, _params?: PdfDict): Uint8Array {
    const output = new ByteWriter(undefined, {
      initialSize: Math.ceil((data.length * 4) / 5), // Estimate output size
    });

    let buffer = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      // Skip whitespace
      if (byte <= SPACE) {
        continue;
      }

      // End marker '~>'
      if (byte === ASCII85Filter.END_MARKER) {
        // Check for '>' following
        if (i + 1 < data.length && data[i + 1] === ASCII85Filter.END_MARKER_FOLLOWING) {
          break;
        }
        // Lone '~' - skip (lenient)
        continue;
      }

      // 'z' = shorthand for 4 zero bytes (only valid at group start)
      if (byte === ASCII85Filter.ZERO_SHORTCUT) {
        if (count !== 0) {
          // 'z' inside a group - invalid, but be lenient
          continue;
        }
        output.writeByte(0);
        output.writeByte(0);
        output.writeByte(0);
        output.writeByte(0);
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
        output.writeByte((buffer >> 24) & SINGLE_BYTE_MASK);
        output.writeByte((buffer >> 16) & SINGLE_BYTE_MASK);
        output.writeByte((buffer >> 8) & SINGLE_BYTE_MASK);
        output.writeByte(buffer & SINGLE_BYTE_MASK);

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
        output.writeByte((buffer >> (24 - i * 8)) & SINGLE_BYTE_MASK);
      }
    }

    return output.toBytes();
  }

  encode(data: Uint8Array, _params?: PdfDict): Uint8Array {
    const output = new ByteWriter(undefined, {
      initialSize: Math.ceil((data.length * 5) / 4) + 2, // Estimate output size + end marker
    });

    // Process 4 bytes at a time
    let i = 0;

    while (i < data.length) {
      const remaining = data.length - i;

      if (remaining >= 4) {
        // Full group
        const value = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];

        if (value === 0) {
          // Special case: all zeros → 'z'
          output.writeByte(ASCII85Filter.ZERO_SHORTCUT);
        } else {
          // Encode as 5 base-85 digits
          this.encodeGroup(value, 5, output);
        }

        i += 4;
      } else {
        // Partial final group (1-3 bytes)
        let value = 0;

        for (let j = 0; j < remaining; j++) {
          value |= data[i + j] << (24 - j * 8);
        }

        // Output (remaining + 1) characters
        this.encodeGroup(value, remaining + 1, output);
        i += remaining;
      }
    }

    // Add end marker '~>'
    output.writeByte(ASCII85Filter.END_MARKER);
    output.writeByte(ASCII85Filter.END_MARKER_FOLLOWING);

    return output.toBytes();
  }

  private encodeGroup(value: number, numChars: number, output: ByteWriter): void {
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
      output.writeByte(digits[i]);
    }
  }
}
