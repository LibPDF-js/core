import type { PdfDict } from "#src/objects/pdf-dict";
import pako from "pako";

import { countDecoded, DecodeLimitError } from "./decode-limit";
import type { Filter } from "./filter";
import { applyPredictor } from "./predictor";

declare module "pako" {
  /** State pako's `Inflate` carries at runtime that its published types leave out. */
  interface Inflate {
    /** The zlib stream: `output` is the buffer being filled, `next_out` how much of it is filled. */
    strm?: { output: Uint8Array | null; next_out: number };
    /** Whether `push` has finished the stream, cleanly or not. */
    ended: boolean;
  }
}

/**
 * FlateDecode filter - zlib/deflate compression.
 *
 * This is the most common filter in modern PDFs. Uses pako for
 * decompression and includes fallback handling for malformed streams.
 *
 * Some PDF generators (notably PDFium) produce zlib streams terminated
 * with a sync-flush marker (00 00 FF FF) instead of a proper final
 * block and Adler-32 checksum. Standard `pako.inflate()` returns
 * `undefined` for these streams, so output is collected chunk by chunk
 * and whatever pako produced is kept.
 *
 * Output is checked against the limits from `setDecodeLimit()` as it is
 * produced, so a decompression bomb stops early.
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
   * Decompress zlib data, counting every chunk against the decode limits.
   *
   * Some PDF generators (notably PDFium) end the zlib stream with a
   * sync-flush marker instead of a final block, and corrupt streams fail
   * partway through. In both cases pako reports no result, so we collect
   * the chunks it produced and keep them.
   *
   * When a stream ends on a sync-flush marker or fails partway, pako stops
   * without handing its last chunk to `onData`; that output is still in its
   * buffer, so it is copied out of pako's internal state.
   */
  private inflate(data: Uint8Array): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;

    const inf = new pako.Inflate();

    inf.onData = (chunk: Uint8Array) => {
      total += chunk.length;
      countDecoded(total, chunk.length);
      chunks.push(chunk);
    };

    try {
      inf.push(data, true);
    } catch (error) {
      if (error instanceof DecodeLimitError) {
        throw error;
      }

      // Anything else is a corrupt stream. Keep what was produced.
    }

    const { strm, ended } = inf;

    if ((!ended || inf.err) && strm?.output && strm.next_out > 0) {
      const tail: Uint8Array = strm.output.slice(0, strm.next_out);

      total += tail.length;
      countDecoded(total, tail.length);
      chunks.push(tail);
    }

    // No data recovered gives empty output rather than an error, to stay
    // lenient with malformed PDFs — callers (font parsers, content stream
    // extractors) already handle empty data gracefully.
    return concatChunks(chunks, total);
  }
}

/**
 * Join pako's chunks into one array of exactly `total` bytes.
 *
 * pako hands out views into its 64 KB output buffer, so a lone chunk is
 * returned as it is only when it spans its whole buffer; otherwise a small
 * stream would keep the full buffer alive.
 */
function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1 && chunks[0].byteLength === chunks[0].buffer.byteLength) {
    return chunks[0];
  }

  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
