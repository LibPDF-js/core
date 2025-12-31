/**
 * PDF Stream Filters
 *
 * This module provides decoding (decompression) and encoding (compression)
 * for PDF stream data. Supports filter chaining and predictor algorithms.
 *
 * @example
 * ```typescript
 * import { FilterPipeline } from "@libpdf/core/filters";
 *
 * // Decode FlateDecode stream
 * const decoded = await FilterPipeline.decode(compressedData, {
 *   name: "FlateDecode",
 *   params: dictWithPredictorSettings,
 * });
 *
 * // Decode chained filters
 * const decoded = await FilterPipeline.decode(data, [
 *   { name: "ASCII85Decode" },
 *   { name: "FlateDecode" },
 * ]);
 * ```
 *
 * ## Supported Filters
 *
 * | Filter | Status | Description |
 * |--------|--------|-------------|
 * | FlateDecode | Full | zlib/deflate (native + pako fallback) |
 * | LZWDecode | Full | LZW compression |
 * | ASCIIHexDecode | Full | Hex encoding |
 * | ASCII85Decode | Full | Base85 encoding |
 * | RunLengthDecode | Full | RLE compression |
 * | DCTDecode | Pass-through | JPEG (for browser decoding) |
 * | CCITTFaxDecode | Partial | Fax compression (Group 4) |
 * | JBIG2Decode | Stub | Binary image compression |
 * | JPXDecode | Stub | JPEG 2000 |
 */

export { ASCIIHexFilter } from "./ascii-hex-filter";
export { ASCII85Filter } from "./ascii85-filter";
export { CCITTFaxFilter } from "./ccitt-fax-filter";
export { createJpegBlobUrl, DCTFilter } from "./dct-filter";
export type { Filter, FilterSpec } from "./filter";
export { FilterPipeline } from "./filter-pipeline";
export { FlateFilter } from "./flate-filter";
export { JBIG2Filter } from "./jbig2-filter";
export { JPXFilter } from "./jpx-filter";
export { LZWFilter } from "./lzw-filter";
export { applyPredictor } from "./predictor";
export { RunLengthFilter } from "./run-length-filter";

import { ASCIIHexFilter } from "./ascii-hex-filter";
import { ASCII85Filter } from "./ascii85-filter";
import { CCITTFaxFilter } from "./ccitt-fax-filter";
import { DCTFilter } from "./dct-filter";
// Auto-register built-in filters
import { FilterPipeline } from "./filter-pipeline";
import { FlateFilter } from "./flate-filter";
import { JBIG2Filter } from "./jbig2-filter";
import { JPXFilter } from "./jpx-filter";
import { LZWFilter } from "./lzw-filter";
import { RunLengthFilter } from "./run-length-filter";

FilterPipeline.register(new FlateFilter());
FilterPipeline.register(new LZWFilter());
FilterPipeline.register(new ASCIIHexFilter());
FilterPipeline.register(new ASCII85Filter());
FilterPipeline.register(new RunLengthFilter());
FilterPipeline.register(new DCTFilter());
FilterPipeline.register(new CCITTFaxFilter());
FilterPipeline.register(new JBIG2Filter());
FilterPipeline.register(new JPXFilter());
