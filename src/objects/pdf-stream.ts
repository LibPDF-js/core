import type { FilterSpec } from "#src/filters/filter";
import { FilterPipeline } from "#src/filters/filter-pipeline";
import type { ByteWriter } from "#src/io/byte-writer";
import { PdfArray } from "./pdf-array";
import { PdfDict } from "./pdf-dict";
import { PdfName } from "./pdf-name";
import type { PdfObject } from "./pdf-object";

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
 *
 * ## Data State
 *
 * The `_data` field can contain either encoded (compressed) or decoded
 * (uncompressed) bytes, depending on how the stream was created:
 *
 * - **After parsing**: `_data` contains the raw bytes from the PDF file,
 *   which are typically encoded/compressed. Use `getDecodedData()` to
 *   decompress them.
 *
 * - **After setData()**: `_data` contains uncompressed bytes. The /Filter
 *   entries are cleared. The stream will be written as-is (or re-compressed
 *   if `compressStreams` is enabled during save).
 *
 * This asymmetry is intentional for efficiency (avoid decompressing during
 * parse if not needed) but users should be aware of it.
 */
export class PdfStream extends PdfDict {
  override get type(): "stream" {
    return "stream";
  }

  private _data: Uint8Array;

  /**
   * Create a new PdfStream.
   *
   * @param dict - Either a PdfDict to copy entries from, or an iterable of
   *               [key, value] pairs. When passing a PdfDict, all its entries
   *               are copied to the new stream.
   * @param data - The stream data (default: empty). After parsing, this is
   *               the raw (possibly encoded) bytes. After setData(), this is
   *               the decoded bytes.
   */
  constructor(
    dict?: PdfDict | Iterable<[PdfName | string, PdfObject]>,
    data: Uint8Array = new Uint8Array(0),
  ) {
    // PdfDict's [Symbol.iterator] yields [PdfName, PdfObject] pairs,
    // so we can pass it directly to super() when dict is a PdfDict.
    // The super constructor will iterate over the entries.
    super(dict);

    this._data = data;
  }

  /**
   * The raw (possibly compressed) stream data.
   */
  get data(): Uint8Array {
    return this._data;
  }

  /**
   * Set new stream content (decoded/uncompressed).
   *
   * Clears any existing filters since the data is now uncompressed.
   * Compression will be applied at write time if `compressStreams` is enabled.
   */
  setData(value: Uint8Array): void {
    // Clear filters - the new data is uncompressed
    this.delete("Filter");
    this.delete("DecodeParms");
    this._data = value;
    this.dirty = true;
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
   * @throws {Error} if a filter fails or is unknown
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
   * Get the encoded (compressed) stream data.
   *
   * **Important:** This method assumes `_data` contains *decoded* bytes
   * and applies the filters specified in /Filter to encode them.
   *
   * This is typically used after `setData()` has been called with
   * uncompressed content, and you need to get the compressed form.
   *
   * If the stream was just parsed and hasn't been modified, `_data`
   * is already encoded - calling this would double-encode! In that
   * case, just use the `.data` property directly.
   *
   * @returns Encoded data (compressed if filters are specified)
   */
  async getEncodedData(): Promise<Uint8Array> {
    const filterEntry = this.get("Filter");

    if (!filterEntry) {
      return this._data;
    }

    const filterSpecs = this.buildFilterSpecs(filterEntry);

    if (filterSpecs.length === 0) {
      return this._data;
    }

    return FilterPipeline.encode(this._data, filterSpecs);
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

  /**
   * Write stream to bytes.
   *
   * Streams consist of:
   * 1. Dictionary (with /Length entry)
   * 2. "stream" keyword followed by newline
   * 3. Raw stream data
   * 4. Newline followed by "endstream" keyword
   */
  override toBytes(writer: ByteWriter): void {
    // Write dictionary with /Length first
    writer.writeAscii("<<\n");

    // Always write /Length as direct value
    writer.writeAscii(`/Length ${this._data.length}`);

    // Write other entries (skip /Length if present, we already wrote it)
    for (const [key, value] of this) {
      if (key.value === "Length") {
        continue;
      }

      // Skip null/undefined values silently
      if (value == null) {
        continue;
      }

      key.toBytes(writer);
      writer.writeAscii(" ");
      value.toBytes(writer);
      writer.writeAscii("\n");
    }

    writer.writeAscii(">>");

    // Per PDF spec, stream keyword followed by single newline (or CRLF)
    // endstream preceded by newline
    writer.writeAscii("\nstream\n");
    writer.writeBytes(this._data);
    writer.writeAscii("\nendstream");
  }
}
