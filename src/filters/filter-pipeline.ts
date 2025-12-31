/** biome-ignore-all lint/complexity/noStaticOnlyClass: utility class */
import type { Filter, FilterSpec } from "./filter";

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
    return FilterPipeline.filters.has(name);
  }

  /**
   * Get a registered filter by name.
   */
  static getFilter(name: string): Filter | undefined {
    return FilterPipeline.filters.get(name);
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
   * @throws Error if a filter is not registered
   */
  static async decode(data: Uint8Array, filters: FilterSpec | FilterSpec[]): Promise<Uint8Array> {
    const filterList = Array.isArray(filters) ? filters : [filters];

    if (filterList.length === 0) {
      return data;
    }

    let result = data;

    for (const spec of filterList) {
      const filter = FilterPipeline.filters.get(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = await filter.decode(result, spec.params);
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
   * @throws Error if a filter is not registered
   */
  static async encode(data: Uint8Array, filters: FilterSpec | FilterSpec[]): Promise<Uint8Array> {
    const filterList = Array.isArray(filters) ? filters : [filters];

    if (filterList.length === 0) {
      return data;
    }

    let result = data;

    // Apply in reverse order for encoding
    for (const spec of filterList.toReversed()) {
      const filter = FilterPipeline.filters.get(spec.name);

      if (!filter) {
        throw new Error(`Unknown filter: ${spec.name}`);
      }

      result = await filter.encode(result, spec.params);
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
