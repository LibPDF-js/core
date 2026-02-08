import type { PdfDict } from "#src/objects/pdf-dict";
import pako from "pako";

import type { Filter } from "./filter";
import { applyPredictor } from "./predictor";

/**
 * FlateDecode filter - zlib/deflate compression.
 *
 * This is the most common filter in modern PDFs. Uses pako for
 * decompression and includes fallback handling for malformed streams.
 *
 * Some PDF generators (notably PDFium) produce zlib streams terminated
 * with a sync-flush marker (00 00 FF FF) instead of a proper final
 * block and Adler-32 checksum. Standard `pako.inflate()` returns
 * `undefined` for these streams. We detect this case and recover
 * the decompressed data from pako's internal state.
 *
 * Supports Predictor parameter for PNG/TIFF prediction algorithms.
 */
export class FlateFilter implements Filter {
  readonly name = "FlateDecode";

  decode(data: Uint8Array, params?: PdfDict): Uint8Array {
    const decompressed = this.inflate(data);

    // Apply predictor if specified
    if (params) {
      const predictor = params.getNumber("Predictor")?.value ?? 1;

      if (predictor > 1) {
        return applyPredictor(decompressed, params);
      }
    }

    return decompressed;
  }

  encode(data: Uint8Array, _params?: PdfDict): Uint8Array {
    // Use default compression level (6)
    // Returns zlib format with header
    return pako.deflate(data);
  }

  /**
   * Decompress zlib data with fallback for sync-flush terminated streams.
   *
   * pako.inflate() returns undefined (instead of throwing) when the
   * zlib stream ends with a sync-flush marker (00 00 FF FF) and lacks
   * a proper final deflate block. This is technically invalid per the
   * zlib spec but common in practice — PDFium and other generators
   * produce these streams.
   *
   * When this happens, we use pako's Inflate class directly and
   * extract whatever data was successfully decompressed from its
   * internal output buffer.
   */
  private inflate(data: Uint8Array): Uint8Array {
    // Fast path: standard inflate handles well-formed streams
    try {
      const result = pako.inflate(data);

      if (result !== undefined) {
        return result;
      }
    } catch {
      // pako throws on invalid headers, corrupt data, etc.
      // Fall through to the recovery path below.
    }

    // Slow path: recover partial output from malformed streams.
    //
    // This handles two cases:
    // 1. Sync-flush terminated streams (pako.inflate returns undefined):
    //    Some PDF generators (e.g. PDFium) produce zlib streams ending
    //    with a sync-flush marker (00 00 FF FF) instead of a proper
    //    final block. Push without finalization to extract output.
    // 2. Streams with corrupt headers or checksums (pako.inflate throws):
    //    Try to recover whatever was decompressed before the error.
    try {
      const inf = new pako.Inflate();
      inf.push(data, false);

      // Access pako's internal zlib stream state. The `strm` property
      // exists at runtime but is not exposed in pako's type definitions.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const strm = (inf as any).strm;
      const totalOut = strm.total_out;

      if (totalOut > 0 && strm.output) {
        // Copy the decompressed bytes out of pako's internal buffer
        return new Uint8Array(strm.output.slice(0, totalOut));
      }
    } catch {
      // Recovery also failed — truly unrecoverable
    }

    // No data could be recovered. Return empty rather than throwing to
    // stay lenient with malformed PDFs — callers (font parsers, content
    // stream extractors) already handle empty data gracefully.
    return new Uint8Array(0);
  }
}
