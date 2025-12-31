import type { PdfDict } from "#src/objects/pdf-dict";
import type { Filter } from "./filter";

/**
 * JBIG2Decode filter (stub).
 *
 * JBIG2 is a complex image compression standard for bi-level (black and white)
 * images, commonly used in scanned documents. It achieves very high compression
 * by pattern matching and dictionary-based encoding.
 *
 * Decoding JBIG2 requires:
 * 1. Arithmetic decoding (QM coder)
 * 2. Symbol dictionary management
 * 3. Region decoding (text, halftone, generic)
 * 4. Page composition
 *
 * This is beyond the scope of a simple implementation. For JBIG2 support,
 * consider using a dedicated library like jbig2dec or the pdf.js implementation.
 *
 * The raw data can be extracted and passed to an external decoder.
 */
export class JBIG2Filter implements Filter {
  readonly name = "JBIG2Decode";

  async decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array> {
    // Check for global data reference
    const globals = params?.get("JBIG2Globals");

    if (globals) {
      throw new Error(
        "JBIG2Decode: Decoding not implemented. " +
          "This stream uses JBIG2 compression with global symbols. " +
          "Consider using an external JBIG2 decoder library.",
      );
    }

    throw new Error(
      "JBIG2Decode: Decoding not implemented. " +
        `Stream contains ${data.length} bytes of JBIG2 data. ` +
        "Consider using an external JBIG2 decoder library (e.g., jbig2dec).",
    );
  }

  async encode(_data: Uint8Array, _params?: PdfDict): Promise<Uint8Array> {
    throw new Error("JBIG2Decode: Encoding not implemented");
  }

  /**
   * Check if this stream uses JBIG2 global symbols.
   * Global symbols are stored in a separate stream referenced by /JBIG2Globals.
   */
  static hasGlobalSymbols(params?: PdfDict): boolean {
    return params?.get("JBIG2Globals") !== undefined;
  }
}
