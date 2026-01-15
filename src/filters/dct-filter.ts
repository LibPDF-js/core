import type { PdfDict } from "#src/objects/pdf-dict";

import type { Filter } from "./filter";

/**
 * DCTDecode filter (JPEG).
 *
 * DCT (Discrete Cosine Transform) is the compression used in JPEG images.
 * In PDF, image streams with /Filter /DCTDecode contain raw JPEG data.
 *
 * This filter is a **pass-through** because:
 * 1. The data is already valid JPEG that browsers/image libraries can decode
 * 2. Decoding to raw pixels would be memory-intensive and usually unnecessary
 * 3. When rendering, the JPEG can be passed directly to canvas/img element
 *
 * If you need actual pixel data, use an external JPEG decoder on the raw data.
 */
export class DCTFilter implements Filter {
  readonly name = "DCTDecode";

  /**
   * Returns the JPEG data as-is.
   *
   * The returned data is valid JPEG that can be:
   * - Used as src for an <img> element (via Blob URL)
   * - Decoded by canvas.drawImage()
   * - Passed to an external JPEG library for pixel access
   */
  async decode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    // Validate JPEG header (optional, for error detection)
    if (data.length >= 2) {
      // JPEG starts with FFD8 (SOI marker)
      if (data[0] !== 0xff || data[1] !== 0xd8) {
        // Not a valid JPEG, but return anyway (lenient)
        console.warn("DCTDecode: Data does not appear to be valid JPEG");
      }
    }

    // Return as-is - this is raw JPEG data
    return data;
  }

  /**
   * Returns the data as-is (assumes it's already JPEG).
   *
   * For actual JPEG encoding from raw pixels, use an external library.
   */
  async encode(data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    // Assume data is already JPEG encoded
    return data;
  }
}

/**
 * Helper to create a Blob URL from JPEG data for use in browser.
 *
 * @example
 * ```typescript
 * const jpegData = await stream.getDecodedData();
 * const url = createJpegBlobUrl(jpegData);
 * img.src = url;
 * // Later: URL.revokeObjectURL(url);
 * ```
 */
export function createJpegBlobUrl(data: Uint8Array): string {
  const blob = new Blob([data], { type: "image/jpeg" });

  return URL.createObjectURL(blob);
}
