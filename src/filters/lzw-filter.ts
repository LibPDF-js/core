import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";
import { applyPredictor } from "./predictor";

/**
 * LZWDecode filter.
 *
 * Implements LZW (Lempel-Ziv-Welch) decompression as used in PDF.
 * This is a dictionary-based compression algorithm also used in GIF and TIFF.
 *
 * PDF-specific details:
 * - Uses variable-length codes starting at 9 bits
 * - Clear code = 256, EOD code = 257
 * - EarlyChange parameter affects when code width increases
 */
export class LZWFilter implements Filter {
  readonly name = "LZWDecode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    const earlyChange = params?.getNumber("EarlyChange")?.value ?? 1;
    const result = this.lzwDecode(data, earlyChange);

    // Apply predictor if specified
    if (params) {
      const predictor = params.getNumber("Predictor")?.value ?? 1;

      if (predictor > 1) {
        return applyPredictor(result, params);
      }
    }

    return result;
  }

  async encode(_data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    // LZW encoding is rarely needed (FlateDecode is preferred)
    throw new Error("LZW encoding not implemented");
  }

  private lzwDecode(data: Uint8Array, earlyChange: number): Uint8Array {
    const output: number[] = [];

    // LZW constants
    const CLEAR_CODE = 256;
    const EOD_CODE = 257;

    // Bit reading state
    let bitPos = 0;
    let codeLength = 9;
    let nextCode = 258;

    // Dictionary: maps code → byte sequence
    // Codes 0-255 are single bytes, 256=clear, 257=EOD
    const dictionary: Uint8Array[] = [];

    // Initialize dictionary with single-byte entries
    for (let i = 0; i < 256; i++) {
      dictionary[i] = new Uint8Array([i]);
    }

    /**
     * Read next code from bit stream.
     */
    const readCode = (): number => {
      let code = 0;
      let bitsNeeded = codeLength;
      let bitOffset = bitPos;

      while (bitsNeeded > 0) {
        const byteIndex = Math.floor(bitOffset / 8);

        if (byteIndex >= data.length) {
          return EOD_CODE; // Premature end
        }

        const byte = data[byteIndex];
        const bitsAvailable = 8 - (bitOffset % 8);
        const bitsToRead = Math.min(bitsAvailable, bitsNeeded);

        // Extract bits from current byte (MSB first)
        const shift = bitsAvailable - bitsToRead;
        const mask = ((1 << bitsToRead) - 1) << shift;
        const bits = (byte & mask) >> shift;

        code = (code << bitsToRead) | bits;
        bitsNeeded -= bitsToRead;
        bitOffset += bitsToRead;
      }

      bitPos = bitOffset;
      return code;
    };

    let prevEntry: Uint8Array | null = null;

    while (true) {
      const code = readCode();

      if (code === EOD_CODE) {
        break;
      }

      if (code === CLEAR_CODE) {
        // Reset dictionary
        dictionary.length = 258;
        codeLength = 9;
        nextCode = 258;
        prevEntry = null;
        continue;
      }

      let entry: Uint8Array;

      if (code < nextCode) {
        // Code is in dictionary
        entry = dictionary[code];
      } else if (code === nextCode && prevEntry !== null) {
        // Special case: code not yet in dictionary
        // Entry is prevEntry + first byte of prevEntry
        entry = new Uint8Array(prevEntry.length + 1);
        entry.set(prevEntry);
        entry[prevEntry.length] = prevEntry[0];
      } else {
        // Invalid code
        throw new Error(`Invalid LZW code: ${code}`);
      }

      // Output entry
      for (const byte of entry) {
        output.push(byte);
      }

      // Add new dictionary entry: prevEntry + first byte of entry
      if (prevEntry !== null && nextCode < 4096) {
        const newEntry = new Uint8Array(prevEntry.length + 1);

        newEntry.set(prevEntry);
        newEntry[prevEntry.length] = entry[0];
        dictionary[nextCode] = newEntry;
        nextCode++;

        // Increase code length when needed
        // EarlyChange=1 (default): increase before code is used
        // EarlyChange=0: increase after code is used
        const threshold = earlyChange === 1 ? nextCode : nextCode - 1;

        if (threshold === 512 && codeLength < 10) {
          codeLength = 10;
        } else if (threshold === 1024 && codeLength < 11) {
          codeLength = 11;
        } else if (threshold === 2048 && codeLength < 12) {
          codeLength = 12;
        }
      }

      prevEntry = entry;
    }

    return new Uint8Array(output);
  }
}
