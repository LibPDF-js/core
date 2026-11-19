/** biome-ignore-all lint/complexity/noStaticOnlyClass: utility class */

import { ASCIIHexFilter } from "./ascii-hex-filter";
import { ASCII85Filter } from "./ascii85-filter";
import { CCITTFaxFilter } from "./ccitt-fax-filter";
import { DCTFilter } from "./dct-filter";
import type { Filter, FilterSpec } from "./filter";
import { FlateFilter } from "./flate-filter";
import { JBIG2Filter } from "./jbig2-filter";
import { JPXFilter } from "./jpx-filter";
import { LZWFilter } from "./lzw-filter";
import { RunLengthFilter } from "./run-length-filter";

/**
 * Abbreviated filter names from ISO 32000-1 Table 6. Real-world PDFs use
 * them interchangeably with the full names, so lookups resolve through
 * this table before hitting the registry.
 */
const FILTER_ALIASES: Record<string, string> = {
  AHx: "ASCIIHexDecode",
  A85: "ASCII85Decode",
  LZW: "LZWDecode",
  Fl: "FlateDecode",
  RL: "RunLengthDecode",
  CCF: "CCITTFaxDecode",
  DCT: "DCTDecode",
};

/**
 * Registry and executor for PDF stream filters.
 *
 * Handles filter chaining - when a stream has multiple filters,
 * they are applied in sequence: first filter's output becomes
 * second filter's input.
 *
 * @example
 * ```typescript
 * // Decode a FlateDecode stream
 * const decoded = await FilterPipeline.decode(data, { name: "FlateDecode" });
 *
 * // Decode a chain: first ASCII85, then Flate
 * const decoded = await FilterPipeline.decode(data, [
 *   { name: "ASCII85Decode" },
 *   { name: "FlateDecode" },
 * ]);
 * ```
 */
export class FilterPipeline {
  private static filters = new Map<string, Filter>();

  /**
   * Register a filter implementation.
   * Typically called at module initialization.
   */
  static register(filter: Filter): void {
    FilterPipeline.filters.set(filter.name, filter);
  }

  /**
   * Check if a filter is registered.
   */
  static hasFilter(name: string): boolean {
    return FilterPipeline.filters.has(FILTER_ALIASES[name] ?? name);
  }

  /**
   * Get a registered filter by name.
   */
  static getFilter(name: string): Filter | undefined {
    return FilterPipeline.filters.get(FILTER_ALIASES[name] ?? name);
  }

  /**
   * Decode data through a chain of filters.
   *
   * Filters are applied in order: first filter's output → second filter's input.
   * This matches PDF semantics where /Filter [/ASCII85Decode /FlateDecode] means
   * decode ASCII85 first, then decompress with Flate.
   *
   * @param data - Raw stream data
   * @param filters - Single filter spec or array of filter specs
   * @returns Decoded data
   * @throws {Error} if a filter is not registered
   */
  static decode(data: Uint8Array, filters: FilterSpec | FilterSpec[]): Uint8Array {
    const filterList = Array.isArray(filters) ? filters : [filters];

    if (filterList.length === 0) {
      return data;
    }

    let result = data;

    for (const spec of filterList) {
      const filter = FilterPipeline.getFilter(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = filter.decode(result, spec.params);
    }

    return result;
  }

  /**
   * Encode data through a chain of filters.
   *
   * Filters are applied in REVERSE order compared to decoding.
   * If /Filter is [/ASCII85Decode /FlateDecode], encoding applies
   * Flate first, then ASCII85.
   *
   * @param data - Data to encode
   * @param filters - Single filter spec or array of filter specs
   * @returns Encoded data
   * @throws {Error} if a filter is not registered
   */
  static encode(data: Uint8Array, filters: FilterSpec | FilterSpec[]): Uint8Array {
    const filterList = Array.isArray(filters) ? filters : [filters];

    if (filterList.length === 0) {
      return data;
    }

    let result = data;

    // Apply in reverse order for encoding
    for (const spec of filterList.toReversed()) {
      const filter = FilterPipeline.getFilter(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = filter.encode(result, spec.params);
    }

    return result;
  }

  /**
   * Clear all registered filters.
   * Mainly useful for testing.
   */
  static clear(): void {
    FilterPipeline.filters.clear();
  }
}

FilterPipeline.register(new FlateFilter());
FilterPipeline.register(new LZWFilter());
FilterPipeline.register(new ASCIIHexFilter());
FilterPipeline.register(new ASCII85Filter());
FilterPipeline.register(new RunLengthFilter());
FilterPipeline.register(new DCTFilter());
FilterPipeline.register(new CCITTFaxFilter());
FilterPipeline.register(new JBIG2Filter());
FilterPipeline.register(new JPXFilter());
