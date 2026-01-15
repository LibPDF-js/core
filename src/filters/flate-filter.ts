import type { PdfDict } from "#src/objects/pdf-dict";

import type { Filter } from "./filter";
import { applyPredictor } from "./predictor";

/**
 * FlateDecode filter - zlib/deflate compression.
 *
 * This is the most common filter in modern PDFs. Uses pako for
 * decompression as it handles malformed/truncated data gracefully,
 * unlike native DecompressionStream which can hang indefinitely.
 *
 * Supports Predictor parameter for PNG/TIFF prediction algorithms.
 */
export class FlateFilter implements Filter {
  readonly name = "FlateDecode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    // Dynamic import for tree-shaking
    const pako = await import("pako");

    // pako.inflate handles zlib header automatically and gracefully
    // handles truncated/corrupt data (unlike native DecompressionStream
    // which can hang indefinitely on malformed input)
    const decompressed = pako.inflate(data);

    // Apply predictor if specified
    if (params) {
      const predictor = params.getNumber("Predictor")?.value ?? 1;

      if (predictor > 1) {
        return applyPredictor(decompressed, params);
      }
    }

    return decompressed;
  }

  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    const pako = await import("pako");

    // Use default compression level (6)
    // Returns zlib format with header
    return pako.deflate(data);
  }
}
