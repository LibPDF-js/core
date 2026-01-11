import { SINGLE_BYTE_MASK } from "#src/helpers/chars";
import type { PdfDict } from "#src/objects/pdf-dict";

/**
 * Apply predictor algorithm to decompressed data.
 *
 * Predictors are used in PDF streams (especially images) to improve
 * compression by encoding differences between pixels rather than
 * absolute values.
 *
 * Predictor values:
 * - 1: No prediction (passthrough)
 * - 2: TIFF Predictor 2 (horizontal differencing)
 * - 10-15: PNG predictors (per-row filter byte)
 *
 * @param data - Decompressed data with prediction applied
 * @param params - Filter parameters containing predictor settings
 * @returns Data with prediction reversed
 */
export function applyPredictor(data: Uint8Array, params: PdfDict): Uint8Array {
  const predictor = params.getNumber("Predictor")?.value ?? 1;

  if (predictor === 1) {
    return data; // No prediction
  }

  const columns = params.getNumber("Columns")?.value ?? 1;
  const colors = params.getNumber("Colors")?.value ?? 1;
  const bpc = params.getNumber("BitsPerComponent")?.value ?? 8;

  // Calculate bytes per pixel and bytes per row
  const bytesPerPixel = Math.max(1, Math.floor((colors * bpc + 7) / 8));
  const bytesPerRow = Math.floor((columns * colors * bpc + 7) / 8);

  if (predictor === 2) {
    return decodeTiffPredictor(data, bytesPerRow, bytesPerPixel, bpc);
  }

  if (predictor >= 10 && predictor <= 15) {
    return decodePngPredictor(data, bytesPerRow, bytesPerPixel);
  }

  throw new Error(`Unknown predictor value: ${predictor}`);
}

/**
 * Decode TIFF Predictor 2 (horizontal differencing).
 *
 * Each sample is stored as the difference from the previous sample
 * in the same row. First sample in each row is stored as-is.
 */
function decodeTiffPredictor(
  data: Uint8Array,
  bytesPerRow: number,
  bytesPerPixel: number,
  bpc: number,
): Uint8Array {
  const rows = Math.floor(data.length / bytesPerRow);
  const output = new Uint8Array(data.length);

  if (bpc === 8) {
    // Optimized path for 8-bit components (most common)
    for (let row = 0; row < rows; row++) {
      const rowStart = row * bytesPerRow;

      for (let col = 0; col < bytesPerRow; col++) {
        const pos = rowStart + col;

        if (col < bytesPerPixel) {
          // First pixel in row - no prediction
          output[pos] = data[pos];
        } else {
          // Add previous pixel value (mod 256)
          output[pos] = (data[pos] + output[pos - bytesPerPixel]) & SINGLE_BYTE_MASK;
        }
      }
    }
  } else if (bpc === 16) {
    // 16-bit components
    for (let row = 0; row < rows; row++) {
      const rowStart = row * bytesPerRow;

      for (let col = 0; col < bytesPerRow; col += 2) {
        const pos = rowStart + col;

        if (col < bytesPerPixel) {
          output[pos] = data[pos];
          output[pos + 1] = data[pos + 1];
        } else {
          // 16-bit addition with carry
          const prev = (output[pos - bytesPerPixel] << 8) | output[pos - bytesPerPixel + 1];
          const curr = (data[pos] << 8) | data[pos + 1];
          const sum = (prev + curr) & 0xffff;

          output[pos] = (sum >> 8) & SINGLE_BYTE_MASK;
          output[pos + 1] = sum & SINGLE_BYTE_MASK;
        }
      }
    }
  } else {
    // Generic path for other bit depths (1, 2, 4 bits)
    // For simplicity, treat as 8-bit - this handles most cases
    for (let row = 0; row < rows; row++) {
      const rowStart = row * bytesPerRow;

      for (let col = 0; col < bytesPerRow; col++) {
        const pos = rowStart + col;

        if (col < bytesPerPixel) {
          output[pos] = data[pos];
        } else {
          output[pos] = (data[pos] + output[pos - bytesPerPixel]) & SINGLE_BYTE_MASK;
        }
      }
    }
  }

  return output;
}

/**
 * Decode PNG predictors.
 *
 * Each row starts with a filter byte indicating the prediction algorithm:
 * - 0: None (copy as-is)
 * - 1: Sub (add left pixel)
 * - 2: Up (add above pixel)
 * - 3: Average (add average of left and above)
 * - 4: Paeth (optimal of left, above, upper-left)
 *
 * Predictor 15 means each row can have its own filter byte.
 * Predictors 10-14 use a fixed algorithm for all rows.
 */
function decodePngPredictor(
  data: Uint8Array,
  bytesPerRow: number,
  bytesPerPixel: number,
): Uint8Array {
  // Each row has 1 filter byte prefix
  const inputRowSize = bytesPerRow + 1;
  const rows = Math.floor(data.length / inputRowSize);
  const output = new Uint8Array(rows * bytesPerRow);

  // Previous row (starts as zeros)
  let prevRow = new Uint8Array(bytesPerRow);

  for (let row = 0; row < rows; row++) {
    const inputOffset = row * inputRowSize;
    const outputOffset = row * bytesPerRow;

    const filterByte = data[inputOffset];
    const rowData = data.subarray(inputOffset + 1, inputOffset + 1 + bytesPerRow);
    const outRow = output.subarray(outputOffset, outputOffset + bytesPerRow);

    switch (filterByte) {
      case 0: // None
        outRow.set(rowData);
        break;

      case 1: // Sub
        decodeSubRow(rowData, outRow, bytesPerPixel);
        break;

      case 2: // Up
        decodeUpRow(rowData, outRow, prevRow);
        break;

      case 3: // Average
        decodeAverageRow(rowData, outRow, prevRow, bytesPerPixel);
        break;

      case 4: // Paeth
        decodePaethRow(rowData, outRow, prevRow, bytesPerPixel);
        break;

      default:
        // Unknown filter - treat as None (lenient)
        outRow.set(rowData);
    }

    // Save this row for next iteration
    prevRow = outRow.slice();
  }

  return output;
}

/**
 * PNG Sub filter: Raw(x) = Sub(x) + Raw(x - bpp)
 */
function decodeSubRow(input: Uint8Array, output: Uint8Array, bytesPerPixel: number): void {
  for (let i = 0; i < output.length; i++) {
    const left = i >= bytesPerPixel ? output[i - bytesPerPixel] : 0;

    output[i] = (input[i] + left) & SINGLE_BYTE_MASK;
  }
}

/**
 * PNG Up filter: Raw(x) = Up(x) + Prior(x)
 */
function decodeUpRow(input: Uint8Array, output: Uint8Array, prevRow: Uint8Array): void {
  for (let i = 0; i < output.length; i++) {
    output[i] = (input[i] + prevRow[i]) & SINGLE_BYTE_MASK;
  }
}

/**
 * PNG Average filter: Raw(x) = Average(x) + floor((Raw(x-bpp) + Prior(x)) / 2)
 */
function decodeAverageRow(
  input: Uint8Array,
  output: Uint8Array,
  prevRow: Uint8Array,
  bytesPerPixel: number,
): void {
  for (let i = 0; i < output.length; i++) {
    const left = i >= bytesPerPixel ? output[i - bytesPerPixel] : 0;
    const up = prevRow[i];

    output[i] = (input[i] + Math.floor((left + up) / 2)) & SINGLE_BYTE_MASK;
  }
}

/**
 * PNG Paeth filter: uses Paeth predictor function.
 */
function decodePaethRow(
  input: Uint8Array,
  output: Uint8Array,
  prevRow: Uint8Array,
  bytesPerPixel: number,
): void {
  for (let i = 0; i < output.length; i++) {
    const left = i >= bytesPerPixel ? output[i - bytesPerPixel] : 0;
    const up = prevRow[i];
    const upLeft = i >= bytesPerPixel ? prevRow[i - bytesPerPixel] : 0;

    output[i] = (input[i] + paethPredictor(left, up, upLeft)) & SINGLE_BYTE_MASK;
  }
}

/**
 * Paeth predictor function.
 *
 * Returns the value (a, b, or c) that is closest to p = a + b - c.
 * If there's a tie, a is preferred, then b, then c.
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) {
    return a;
  }

  if (pb <= pc) {
    return b;
  }

  return c;
}
