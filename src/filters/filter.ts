import type { PdfDict } from "#src/objects/pdf-dict";

/**
 * Filter specification from PDF stream dictionary.
 */
export interface FilterSpec {
  /** Filter name (e.g., "FlateDecode", "ASCII85Decode") */
  name: string;
  /** Filter-specific parameters from /DecodeParms */
  params?: PdfDict;
}

/**
 * A PDF stream filter implementation.
 *
 * Filters transform stream data - decoding (decompression) for reading,
 * encoding (compression) for writing.
 */
export interface Filter {
  /** Filter name as used in PDF (e.g., "FlateDecode") */
  readonly name: string;

  /**
   * Decode (decompress) data through this filter.
   * @param data - Input bytes (possibly from previous filter in chain)
   * @param params - Filter-specific parameters from /DecodeParms
   * @returns Decoded bytes
   */
  decode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array>;

  /**
   * Encode (compress) data through this filter.
   * @param data - Input bytes to encode
   * @param params - Filter-specific parameters
   * @returns Encoded bytes
   */
  encode(data: Uint8Array, params?: PdfDict): Promise<Uint8Array>;
}
