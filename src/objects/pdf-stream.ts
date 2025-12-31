import { FilterPipeline, type FilterSpec } from "#src/filters";
import type { PdfObject } from "./object";
import { PdfArray } from "./pdf-array";
import { PdfDict } from "./pdf-dict";
import { PdfName } from "./pdf-name";

/**
 * PDF stream object (dictionary + binary data).
 *
 * In PDF:
 * ```
 * << /Length 5 /Filter /FlateDecode >>
 * stream
 * ...binary data...
 * endstream
 * ```
 *
 * Extends PdfDict with attached data.
 */
export class PdfStream extends PdfDict {
  override get type(): "stream" {
    return "stream";
  }

  private _data: Uint8Array;

  constructor(
    dict?: PdfDict | Iterable<[PdfName | string, PdfObject]>,
    data: Uint8Array = new Uint8Array(0),
  ) {
    if (dict instanceof PdfDict) {
      // Copy entries from existing dict
      super(dict);
    } else {
      super(dict);
    }

    this._data = data;
  }

  /**
   * The raw (possibly compressed) stream data.
   */
  get data(): Uint8Array {
    return this._data;
  }

  /**
   * Set new stream data.
   */
  set data(value: Uint8Array) {
    this._data = value;
    this.notifyMutation();
  }

  /**
   * Create stream from dict entries and data.
   */
  static fromDict(
    entries: Record<string, PdfObject>,
    data: Uint8Array = new Uint8Array(0),
  ): PdfStream {
    return new PdfStream(Object.entries(entries), data);
  }

  /**
   * Get the decoded (decompressed) stream data.
   *
   * Applies any filters specified in /Filter in order.
   * Results are not cached - call once and store if needed.
   *
   * @returns Decoded data
   * @throws Error if a filter fails or is unknown
   */
  async getDecodedData(): Promise<Uint8Array> {
    const filterEntry = this.get("Filter");

    // No filter - return raw data
    if (!filterEntry) {
      return this._data;
    }

    // Build filter specs
    const filterSpecs = this.buildFilterSpecs(filterEntry);

    if (filterSpecs.length === 0) {
      return this._data;
    }

    // Decode through filter pipeline
    return FilterPipeline.decode(this._data, filterSpecs);
  }

  /**
   * Build filter specs from /Filter and /DecodeParms entries.
   */
  private buildFilterSpecs(filterEntry: PdfObject): FilterSpec[] {
    const filters: PdfName[] = [];
    const params: (PdfDict | null)[] = [];

    // Collect filter names
    if (filterEntry instanceof PdfName) {
      filters.push(filterEntry);
    } else if (filterEntry instanceof PdfArray) {
      for (const item of filterEntry) {
        if (item instanceof PdfName) {
          filters.push(item);
        }
      }
    }

    // Collect decode parameters
    const parmsEntry = this.get("DecodeParms");

    if (parmsEntry instanceof PdfDict) {
      params.push(parmsEntry);
    } else if (parmsEntry instanceof PdfArray) {
      for (const item of parmsEntry) {
        if (item instanceof PdfDict) {
          params.push(item);
        } else {
          params.push(null); // null entry means no params for this filter
        }
      }
    }

    // Build specs
    return filters.map((filter, i) => ({
      name: filter.value,
      params: params[i] ?? undefined,
    }));
  }
}
