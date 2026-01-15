import type { PdfDict } from "#src/objects/pdf-dict";

import type { Filter } from "./filter";

/**
 * JPXDecode filter (stub).
 *
 * JPX (JPEG 2000) is a wavelet-based image compression standard that offers
 * better compression and quality than traditional JPEG (DCT-based).
 *
 * Decoding JPEG 2000 requires:
 * 1. EBCOT (Embedded Block Coding with Optimal Truncation)
 * 2. DWT (Discrete Wavelet Transform)
 * 3. Tier-1 and Tier-2 decoding
 * 4. Color space conversion
 *
 * This is beyond the scope of a simple implementation. For JPX support,
 * consider using a dedicated library like OpenJPEG.
 *
 * The raw data can be extracted and passed to an external decoder.
 */
export class JPXFilter implements Filter {
  readonly name = "JPXDecode";

  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    // Check JPEG 2000 signature
    const isValidJP2 = this.isJPEG2000(data);

    throw new Error(
      "JPXDecode: Decoding not implemented. " +
        `Stream contains ${data.length} bytes of ${isValidJP2 ? "valid" : "possible"} JPEG 2000 data. ` +
        "Consider using an external JPEG 2000 decoder library (e.g., OpenJPEG).",
    );
  }

  async encode(_data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    throw new Error("JPXDecode: Encoding not implemented");
  }

  /**
   * Check if data appears to be valid JPEG 2000.
   *
   * JPEG 2000 files start with:
   * - Codestream: FF 4F (SOC marker)
   * - JP2 file: 00 00 00 0C 6A 50 20 20 (signature box)
   */
  private isJPEG2000(data: Uint8Array): boolean {
    if (data.length < 2) {
      return false;
    }

    // Check for codestream SOC marker
    if (data[0] === 0xff && data[1] === 0x4f) {
      return true;
    }

    // Check for JP2 signature box
    if (data.length >= 12) {
      const sig = [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20];

      for (let i = 0; i < 8; i++) {
        if (data[i] !== sig[i]) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Extract raw JPEG 2000 data for use with external decoder.
   */
  static getRawData(data: Uint8Array): Uint8Array {
    return data;
  }
}
