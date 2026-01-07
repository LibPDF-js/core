import { concatBytes } from "#src/helpers/buffer";
import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";
import { applyPredictor } from "./predictor";

/**
 * Check if native DecompressionStream is available.
 */
function hasNativeDecompression(): boolean {
  return typeof DecompressionStream !== "undefined";
}

/**
 * FlateDecode filter - zlib/deflate compression.
 *
 * This is the most common filter in modern PDFs. Uses native
 * DecompressionStream when available (modern browsers, Node 18+),
 * falling back to pako for older environments.
 *
 * Supports Predictor parameter for PNG/TIFF prediction algorithms.
 */
export class FlateFilter implements Filter {
  readonly name = "FlateDecode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    // Decompress the data
    let decompressed: Uint8Array;

    try {
      if (hasNativeDecompression()) {
        throw new Error("Native decompression not available, falling back to pako");
      }

      decompressed = await this.decodeNative(data);
    } catch {
      decompressed = await this.decodePako(data);
    }

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
    // For encoding, always use pako (more control over compression level)
    const pako = await import("pako");

    // Use default compression level (6)
    // Returns zlib format with header
    return pako.deflate(data);
  }

  /**
   * Decode using native DecompressionStream API.
   *
   * PDF uses zlib format (RFC 1950) which has a 2-byte header.
   * DecompressionStream("deflate") expects raw deflate (RFC 1951),
   * so we need to skip the zlib header.
   */
  private async decodeNative(data: Uint8Array): Promise<Uint8Array> {
    // Verify zlib header (first byte should be 0x78 for default compression)
    if (data.length < 2) {
      throw new Error("Data too short for zlib format");
    }

    // Check zlib header: CMF (compression method and flags)
    const cmf = data[0];
    const cm = cmf & 0x0f; // Compression method (should be 8 for deflate)

    if (cm !== 8) {
      throw new Error(`Invalid zlib compression method: ${cm}`);
    }

    // Skip 2-byte zlib header, and strip 4-byte Adler-32 checksum at end
    const rawDeflate = data.subarray(2, data.length - 4);

    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();

    // Write data and close - copy to ensure standard ArrayBuffer
    await writer.write(new Uint8Array(rawDeflate));
    await writer.close();

    // Read all output chunks
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
    }

    return concatBytes(chunks);
  }

  /**
   * Decode using pako library (fallback).
   */
  private async decodePako(data: Uint8Array): Promise<Uint8Array> {
    // Dynamic import for tree-shaking when native is available
    const pako = await import("pako");

    // pako.inflate handles zlib header automatically
    return pako.inflate(data);
  }
}
