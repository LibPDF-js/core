import { ByteWriter } from "#src/io/byte-writer";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";

/**
 * RunLengthDecode filter.
 *
 * Simple run-length encoding (RLE) compression.
 * Each run is encoded as a length byte followed by data:
 *
 * - Length 0-127: Copy next (length + 1) bytes literally
 * - Length 129-255: Repeat next byte (257 - length) times
 * - Length 128: End of data (EOD)
 *
 * Rarely used in modern PDFs, but simple to implement.
 */
export class RunLengthFilter implements Filter {
  readonly name = "RunLengthDecode";

  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const output = new ByteWriter();
    let i = 0;

    while (i < data.length) {
      const length = data[i++];

      if (length === 128) {
        // EOD marker
        break;
      }

      if (length < 128) {
        // Literal run: copy next (length + 1) bytes
        const count = length + 1;

        for (let j = 0; j < count && i < data.length; j++) {
          output.writeByte(data[i++]);
        }
      } else {
        // Repeat run: repeat next byte (257 - length) times
        const count = 257 - length;
        const value = data[i++];

        for (let j = 0; j < count; j++) {
          output.writeByte(value);
        }
      }
    }

    return output.toBytes();
  }

  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const output = new ByteWriter();
    let i = 0;

    while (i < data.length) {
      // Look for runs of identical bytes
      let runLength = 1;
      const runValue = data[i];

      while (i + runLength < data.length && data[i + runLength] === runValue && runLength < 128) {
        runLength++;
      }

      if (runLength >= 2) {
        // Repeat run is worthwhile (2+ bytes)
        output.writeByte(257 - runLength); // Length byte
        output.writeByte(runValue);
        i += runLength;
      } else {
        // Literal run: find extent of non-repeating bytes
        const literalStart = i;
        let literalLength = 0;

        while (i < data.length && literalLength < 128) {
          // Check if next byte starts a run of 3+
          let nextRunLength = 1;

          while (
            i + nextRunLength < data.length &&
            data[i + nextRunLength] === data[i] &&
            nextRunLength < 3
          ) {
            nextRunLength++;
          }

          if (nextRunLength >= 3 && literalLength > 0) {
            // End literal run before the repeat run
            break;
          }

          literalLength++;
          i++;

          if (nextRunLength >= 3) {
            // Include first byte of run in literal if length is 1
            break;
          }
        }

        if (literalLength > 0) {
          output.writeByte(literalLength - 1); // Length byte

          for (let j = 0; j < literalLength; j++) {
            output.writeByte(data[literalStart + j]);
          }
        }
      }
    }

    // Add EOD marker
    output.writeByte(128);

    return output.toBytes();
  }
}
